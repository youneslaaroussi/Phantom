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

  constructor(config: LiveSessionConfig, callbacks: LiveSessionCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
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

      if (!message.setupComplete && !message.serverContent && !message.toolCall && !message.toolCallCancellation) {
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
          this.setState({ isSpeaking: false });
          return;
        }

        if (content.modelTurn?.parts) {
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

        if (content.turnComplete) {
          this.setState({ isSpeaking: false });
        }
      }

      if (message.toolCall?.functionCalls) {
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

    for (const call of functionCalls) {
      try {
        this.callbacks.onToolStart?.({ name: call.name, id: call.id });

        const result = await this.callbacks.onToolCall?.({
          id: call.id,
          name: call.name,
          args: call.args,
        });

        this.callbacks.onToolEnd?.({ name: call.name, id: call.id, success: !result?.error });

        responses.push({
          id: call.id,
          name: call.name,
          response: result ?? { result: "ok" },
        });
      } catch (error) {
        this.callbacks.onToolEnd?.({ name: call.name, id: call.id, success: false });
        responses.push({
          id: call.id,
          name: call.name,
          response: {
            error: error instanceof Error ? error.message : "Tool execution failed",
          },
        });
      }
    }

    this.sendToolResponses(responses);
  }

  private sendToolResponses(responses: ToolCallResponse[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

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

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[LiveSession] sendImage: ws not open");
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
    console.log("[LiveSession] sendImage: %d KB, mimeType=%s", Math.round(payload.length / 1024), mimeType);
    this.ws.send(payload);
  }

  disconnect(): void {
    this.stopListening();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.cleanup();
    this.setState({ status: "disconnected" });
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
}
