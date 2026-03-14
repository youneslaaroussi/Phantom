/**
 * Audio utilities for Gemini Live API
 * Input: 16-bit PCM, 16kHz, mono
 * Output: 24kHz PCM from Gemini
 */

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const CHUNK_SIZE = 4096;

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  } catch {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(device => device.kind === "audioinput")
    .map(device => ({
      deviceId: device.deviceId,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
    }));
}

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private onAudioData: ((data: ArrayBuffer) => void) | null = null;
  private onAudioLevel: ((level: number) => void) | null = null;
  private levelCheckInterval: ReturnType<typeof setInterval> | null = null;
  private tabBuffer: Int16Array[] = [];
  private tabBufferSamples = 0;

  pushTabAudio(pcm: Int16Array): void {
    this.tabBuffer.push(pcm);
    this.tabBufferSamples += pcm.length;
  }

  private drainTabBuffer(numSamples: number): Int16Array {
    const out = new Int16Array(numSamples);
    let written = 0;

    while (written < numSamples && this.tabBuffer.length > 0) {
      const chunk = this.tabBuffer[0];
      const needed = numSamples - written;

      if (chunk.length <= needed) {
        out.set(chunk, written);
        written += chunk.length;
        this.tabBuffer.shift();
      } else {
        out.set(chunk.subarray(0, needed), written);
        this.tabBuffer[0] = chunk.subarray(needed);
        written = numSamples;
      }
    }

    this.tabBufferSamples = this.tabBuffer.reduce((s, c) => s + c.length, 0);
    return out;
  }

  async start(
    onAudioData: (data: ArrayBuffer) => void,
    options?: {
      deviceId?: string;
      onAudioLevel?: (level: number) => void;
    }
  ): Promise<void> {
    this.onAudioData = onAudioData;
    this.onAudioLevel = options?.onAudioLevel || null;

    const audioConstraints: MediaTrackConstraints = {
      sampleRate: INPUT_SAMPLE_RATE,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    if (options?.deviceId) {
      audioConstraints.deviceId = { exact: options.deviceId };
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    this.audioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.5;

    this.scriptNode = this.audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
    this.scriptNode.onaudioprocess = (e) => {
      if (!this.onAudioData) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      if (this.tabBufferSamples > 0) {
        const tab = this.drainTabBuffer(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          const mixed = pcm16[i] + tab[i];
          pcm16[i] = mixed > 32767 ? 32767 : mixed < -32768 ? -32768 : mixed;
        }
      }

      this.onAudioData(pcm16.buffer);
    };

    source.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);

    if (this.onAudioLevel) {
      this.startLevelMonitoring();
    }
  }

  private startLevelMonitoring(): void {
    if (!this.analyserNode || !this.onAudioLevel) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.levelCheckInterval = setInterval(() => {
      if (!this.analyserNode || !this.onAudioLevel) return;

      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255;

      this.onAudioLevel(average);
    }, 50);
  }

  stop(): void {
    if (this.levelCheckInterval) {
      clearInterval(this.levelCheckInterval);
      this.levelCheckInterval = null;
    }

    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onAudioData = null;
    this.onAudioLevel = null;
    this.tabBuffer = [];
    this.tabBufferSamples = 0;
  }

}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private nextPlayTime = 0;
  private isPlaying = false;
  private onOutputLevel: ((level: number) => void) | null = null;
  private levelCheckInterval: ReturnType<typeof setInterval> | null = null;

  async init(onOutputLevel?: (level: number) => void): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.nextPlayTime = this.audioContext.currentTime;
    this.onOutputLevel = onOutputLevel || null;

    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.5;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    if (this.onOutputLevel) {
      this.startLevelMonitoring();
    }
  }

  private startLevelMonitoring(): void {
    if (!this.analyserNode || !this.onOutputLevel) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.levelCheckInterval = setInterval(() => {
      if (!this.analyserNode || !this.onOutputLevel) return;

      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255;

      this.onOutputLevel(average);
    }, 50);
  }

  play(pcmData: ArrayBuffer): void {
    if (!this.audioContext || !this.gainNode) return;

    const int16Array = new Int16Array(pcmData);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Array.length,
      OUTPUT_SAMPLE_RATE
    );
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextPlayTime);
    source.start(startTime);

    this.nextPlayTime = startTime + audioBuffer.duration;
    this.isPlaying = true;

    source.onended = () => {
      if (this.nextPlayTime <= (this.audioContext?.currentTime ?? 0) + 0.1) {
        this.isPlaying = false;
      }
    };
  }

  stop(): void {
    if (this.levelCheckInterval) {
      clearInterval(this.levelCheckInterval);
      this.levelCheckInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.nextPlayTime = 0;
    this.onOutputLevel = null;
  }

  clear(): void {
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
