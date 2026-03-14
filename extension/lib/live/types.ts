/**
 * Types for Gemini Live API
 */

export type LiveVoiceName =
  | "Puck"
  | "Charon"
  | "Kore"
  | "Fenrir"
  | "Aoede"
  | "Leda"
  | "Orus"
  | "Zephyr"
  | "Autonoe"
  | "Enceladus"
  | "Iapetus"
  | "Umbriel"
  | "Algieba"
  | "Despina"
  | "Erinome"
  | "Algenib"
  | "Rasalgethi"
  | "Laomedeia"
  | "Achernar"
  | "Alnilam"
  | "Schedar"
  | "Gacrux"
  | "Pulcherrima"
  | "Achird"
  | "Zubenelgenubi"
  | "Vindemiatrix"
  | "Sadachbia"
  | "Sadaltager"
  | "Sulafat"
  | "Callirrhoe";

export interface LiveSessionConfig {
  model: string;
  systemInstruction?: string;
  tools?: LiveToolDeclaration[];
  responseModalities?: ("AUDIO" | "TEXT")[];
  voice?: LiveVoiceName;
}

export interface LiveToolDeclaration {
  functionDeclarations: LiveFunctionDeclaration[];
}

export interface LiveFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface LiveSessionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  isListening: boolean;
  isSpeaking: boolean;
  closeCode?: number;
  closeReason?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

export interface BidiServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: {
    modelTurn?: {
      parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        };
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
    generationComplete?: boolean;
    inputTranscription?: { text: string };
    outputTranscription?: { text: string };
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  toolCallCancellation?: {
    ids: string[];
  };
  sessionResumptionUpdate?: {
    newHandle?: string;
    resumable?: boolean;
  };
  goAway?: {
    timeLeft?: string;
  };
}

export interface LiveSessionCallbacks {
  onStateChange?: (state: LiveSessionState) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onInputTranscription?: (text: string) => void;
  onOutputTranscription?: (text: string) => void;
  onToolCall?: (toolCall: ToolCallRequest) => Promise<Record<string, unknown>>;
  onToolStart?: (toolCall: { name: string; id: string }) => void;
  onToolEnd?: (toolCall: { name: string; id: string; success: boolean }) => void;
  onAudioOutput?: (audioData: ArrayBuffer) => void;
  onOutputLevel?: (level: number) => void;
  onError?: (error: Error) => void;
  onGoAway?: (timeLeft?: string) => void;
}
