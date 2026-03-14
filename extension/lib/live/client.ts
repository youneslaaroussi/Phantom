/**
 * Gemini Live API WebSocket Client
 * 
 * Uses API key auth (key= param).
 * Connects to v1beta endpoint.
 */

import type {
  LiveSessionConfig,
  LiveSessionState,
  LiveSessionCallbacks,
  BidiServerMessage,
  ToolCallResponse,
} from "./types";
import { AudioCapture, AudioPlayer, arrayBufferToBase64, base64ToArrayBuffer } from "./audio";
import { addTrace } from "../trace";

const LIVE_API_BASE = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export interface ConnectOptions {
  proxyUrl: string;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private audioCapture: AudioCapture | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private config: LiveSessionConfig;
  private callbacks: LiveSessionCallbacks;
  private state: LiveSessionState = {
    status: "disconnected",
    isListening: false,
    isSpeaking: false,
  };
  private resumptionHandle: string | null = null;
  private toolAbortController: AbortController | null = null;
  private inputGated = false;

  constructor(config: LiveSessionConfig, callbacks: LiveSessionCallbacks = {}, resumptionHandle?: string | null) {
    this.config = config;
    this.callbacks = callbacks;
    if (resumptionHandle) this.resumptionHandle = resumptionHandle;
  }

  private setState(updates: Partial<LiveSessionState>) {
    this.state = { ...this.state, ...updates };
    this.callbacks.onStateChange?.(this.state);
  }

  async connect(options: string | ConnectOptions): Promise<void> {
    if (this.ws) {
      throw new Error("Already connected");
    }

    const opts: ConnectOptions = typeof options === "string" ? { proxyUrl: options } : options;

    this.setState({ status: "connecting" });

    this.audioPlayer = new AudioPlayer();
    await this.audioPlayer.init(this.callbacks.onOutputLevel);

    this.ws = new WebSocket(opts.proxyUrl);

    const origSend = this.ws.send.bind(this.ws);
    this.ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          const type = parsed.setup ? "setup" : parsed.realtimeInput ? "realtimeInput" : parsed.clientContent ? "clientContent" : parsed.toolResponse ? "toolResponse" : "unknown";
          if (type === "realtimeInput" && this.inputGated) {
            addTrace("error", `WS SEND BLOCKED (gated): ${type} — ${parsed.realtimeInput?.audio ? "audio" : parsed.realtimeInput?.video ? "video" : parsed.realtimeInput?.text ? "text" : parsed.realtimeInput?.audioStreamEnd ? "audioStreamEnd" : "other"}`);
            return;
          }
          if (type === "clientContent" && this.inputGated) {
            addTrace("error", `WS SEND BLOCKED (gated): clientContent`);
            return;
          }
          if (type !== "realtimeInput" || !parsed.realtimeInput?.audio) {
            addTrace("system", `WS SEND: ${type}${type === "realtimeInput" ? (parsed.realtimeInput?.video ? " (video)" : parsed.realtimeInput?.audio ? " (audio)" : " (text)") : ""}`);
          }
        } catch {}
      }
      origSend(data);
    };

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error("WebSocket not initialized"));

      this.ws.onopen = () => {
        this.sendSetup();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data, resolve).catch((err) => {
          console.error("[LiveSession] Error handling message:", err);
        });
      };

      this.ws.onerror = (event) => {
        console.error("[LiveSession] WebSocket error:", event);
        const error = new Error("WebSocket error");
        this.setState({ status: "error", error: error.message });
        this.callbacks.onError?.(error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log("[LiveSession] WebSocket closed:", event.code, event.reason);
        addTrace("system", `WebSocket closed: code=${event.code} reason="${event.reason || "none"}"`);
        const is1008 = event.code === 1008;
        const friendlyMessage = is1008
          ? "Connection closed. Reconnect to continue."
          : undefined;
        this.setState({
          status: "disconnected",
          isListening: false,
          isSpeaking: false,
          closeCode: event.code,
          closeReason: event.reason || undefined,
          error: friendlyMessage,
        });
        this.cleanup();
        if (this.state.status === "connecting") {
          reject(new Error(`Connection closed: ${event.reason || "Unknown reason"} (code: ${event.code})`));
        }
      };
    });
  }

  private sendSetup() {
    if (!this.ws) return;

    const modelName = this.config.model.startsWith("models/")
      ? this.config.model
      : `models/${this.config.model}`;

    const generationConfig: Record<string, unknown> = {
      responseModalities: this.config.responseModalities || ["AUDIO"],
    };

    if (this.config.voice) {
      generationConfig.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voice,
          },
        },
      };
    }

    const config: Record<string, unknown> = {
      model: modelName,
      generationConfig,
    };

    if (this.config.systemInstruction) {
      config.systemInstruction = {
        parts: [{ text: this.config.systemInstruction }],
      };
    }

    if (this.config.tools && this.config.tools.length > 0) {
      config.tools = this.config.tools;
    }

    // Session resumption — pass handle if reconnecting
    if (this.resumptionHandle) {
      config.sessionResumption = { handle: this.resumptionHandle };
      console.log("[LiveSession] Reconnecting with resumption handle");
    } else {
      config.sessionResumption = {};
    }

    const msg = { setup: config };
    console.log("[LiveSession] Setup message:", JSON.stringify(msg).slice(0, 500));
    this.ws.send(JSON.stringify(msg));
  }

  private async handleMessage(data: string | ArrayBuffer | Blob, onSetupComplete?: () => void) {
    try {
      let textData: string;
      if (data instanceof Blob) {
        textData = await data.text();
      } else if (typeof data === "string") {
        textData = data;
      } else {
        textData = new TextDecoder().decode(data);
      }

      const message: BidiServerMessage = JSON.parse(textData);

      // Handle session resumption updates
      if (message.sessionResumptionUpdate?.newHandle) {
        this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
        console.log("[LiveSession] Got resumption handle");
      }

      // Handle GoAway — server is about to disconnect
      if (message.goAway) {
        console.log("[LiveSession] GoAway received, time left:", message.goAway.timeLeft);
        this.callbacks.onGoAway?.(message.goAway.timeLeft);
      }

      if (!message.setupComplete && !message.serverContent && !message.toolCall && !message.toolCallCancellation && !message.sessionResumptionUpdate && !message.goAway) {
        console.log("[LiveSession] Unknown/error message:", textData.slice(0, 500));
      }

      if (message.setupComplete) {
        this.setState({ status: "connected", error: undefined, closeCode: undefined, closeReason: undefined });
        onSetupComplete?.();
        return;
      }

      if (message.serverContent) {
        const content = message.serverContent;

        if (content.interrupted) {
          this.audioPlayer?.clear();
          this.inputGated = false;
          this.setState({ isSpeaking: false });
          return;
        }

        if (content.modelTurn?.parts) {
          if (!this.inputGated) addTrace("system", "GATE ON (modelTurn)");
          this.inputGated = true;
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) {
              const audioData = base64ToArrayBuffer(part.inlineData.data);
              this.audioPlayer?.play(audioData);
              this.callbacks.onAudioOutput?.(audioData);
              this.setState({ isSpeaking: true });
            }

            if (part.text) {
              this.callbacks.onTranscript?.(part.text, content.turnComplete ?? false);
            }
          }
        }

        if (content.inputTranscription?.text) {
          this.callbacks.onInputTranscription?.(content.inputTranscription.text);
        }
        if (content.outputTranscription?.text) {
          this.callbacks.onOutputTranscription?.(content.outputTranscription.text);
        }

        if (content.turnComplete) {
          addTrace("system", "GATE OFF (turnComplete)");
          this.inputGated = false;
          this.setState({ isSpeaking: false });
        }
      }

      if (message.toolCall?.functionCalls) {
        addTrace("system", `GATE ON (toolCall: ${message.toolCall.functionCalls.map((f: any) => f.name).join(", ")})`);
        this.inputGated = true;
        this.handleToolCalls(message.toolCall.functionCalls);
      }

      if (message.toolCallCancellation?.ids) {
        // Tool calls cancelled by server
      }
    } catch (error) {
      console.error("[LiveSession] Failed to parse message:", error);
    }
  }

  private async handleToolCalls(
    functionCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
  ) {
    const responses: ToolCallResponse[] = [];
    this.toolAbortController = new AbortController();
    const { signal } = this.toolAbortController;

    for (const call of functionCalls) {
      if (signal.aborted) {
        responses.push({
          id: call.id,
          name: call.name,
          response: { error: "Tool execution was stopped by the user." },
        });
        continue;
      }

      try {
        this.callbacks.onToolStart?.({ name: call.name, id: call.id });

        const result = await Promise.race([
          this.callbacks.onToolCall?.({
            id: call.id,
            name: call.name,
            args: call.args,
          }),
          new Promise<never>((_, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("Tool stopped by user", "AbortError")), { once: true });
          }),
        ]);

        this.callbacks.onToolEnd?.({ name: call.name, id: call.id, success: !result?.error });

        responses.push({
          id: call.id,
          name: call.name,
          response: result ?? { result: "ok" },
        });
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        this.callbacks.onToolEnd?.({ name: call.name, id: call.id, success: false });
        responses.push({
          id: call.id,
          name: call.name,
          response: {
            error: aborted ? "Tool execution was stopped by the user." : (error instanceof Error ? error.message : "Tool execution failed"),
          },
        });
      }
    }

    this.toolAbortController = null;
    this.sendToolResponses(responses);
  }

  cancelToolExecution(): void {
    if (this.toolAbortController) {
      this.toolAbortController.abort();
      this.toolAbortController = null;
    }
  }

  private sendToolResponses(responses: ToolCallResponse[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    addTrace("system", "GATE OFF (toolResponse sent)");
    this.inputGated = false;

    const message = {
      toolResponse: {
        functionResponses: responses.map((r) => ({
          id: r.id,
          name: r.name,
          response: r.response,
        })),
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  async startListening(options?: {
    deviceId?: string;
    onAudioLevel?: (level: number) => void;
  }): Promise<void> {
    if (this.state.isListening) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    this.audioCapture = new AudioCapture();
    await this.audioCapture.start(
      (audioData) => {
        this.sendAudio(audioData);
      },
      {
        deviceId: options?.deviceId,
        onAudioLevel: options?.onAudioLevel,
      }
    );

    this.setState({ isListening: true });
  }

  stopListening(): void {
    if (!this.state.isListening) return;

    this.audioCapture?.stop();
    this.audioCapture = null;

    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.inputGated) {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audioStreamEnd: true,
          },
        })
      );
    }

    this.setState({ isListening: false });
  }

  private sendAudio(audioData: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.inputGated) {
      addTrace("system", "sendAudio GATED (dropped)");
      return;
    }

    const message = {
      realtimeInput: {
        audio: {
          data: arrayBufferToBase64(audioData),
          mimeType: "audio/pcm;rate=16000",
        },
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  pushTabAudio(pcm: Int16Array): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (this.inputGated) return true;
    if (this.audioCapture) {
      this.audioCapture.pushTabAudio(pcm);
    } else {
      this.sendAudio(pcm.buffer as ArrayBuffer);
    }
    return true;
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.inputGated) {
      addTrace("system", `sendText GATED (dropped): ${text.slice(0, 80)}`);
      return;
    }

    const message = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  sendImage(base64Data: string, mimeType: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.inputGated) {
      addTrace("system", "sendImage GATED (dropped)");
      return;
    }

    const message = {
      realtimeInput: {
        video: {
          data: base64Data,
          mimeType,
        },
      },
    };

    const payload = JSON.stringify(message);
    addTrace("system", `sendImage SENT: ${Math.round(payload.length / 1024)} KB`);
    this.ws.send(payload);
  }

  disconnect(): void {
    this.stopListening();
    this.callbacks = {};

    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.cleanup();
  }

  private cleanup() {
    this.audioCapture?.stop();
    this.audioCapture = null;
    this.audioPlayer?.stop();
    this.audioPlayer = null;
  }

  getState(): LiveSessionState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.status === "connected";
  }

  getResumptionHandle(): string | null {
    return this.resumptionHandle;
  }
}
