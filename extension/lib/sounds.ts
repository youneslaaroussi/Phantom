const cache: Record<string, HTMLAudioElement> = {};

function play(name: string, volume = 0.5) {
  try {
    if (!cache[name]) {
      cache[name] = new Audio(chrome.runtime.getURL(`assets/sfx/${name}.mp3`));
    }
    const audio = cache[name];
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

function playLoop(name: string, volume = 0.3): () => void {
  try {
    if (!cache[name]) {
      cache[name] = new Audio(chrome.runtime.getURL(`assets/sfx/${name}.mp3`));
    }
    const audio = cache[name];
    audio.volume = volume;
    audio.loop = true;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.currentTime = 0; audio.loop = false; };
  } catch {
    return () => {};
  }
}

export function playWake() { play("wake", 0.4); }
export function playConnect() {
  const variant = Math.floor(Math.random() * 3) + 1;
  play("connect_" + variant, 0.4);
}
export function playDisconnect() { play("disconnect", 0.35); }
export function playToolStart() { play("tool_start", 0.25); }
export function playToolEnd() { play("tool_end", 0.25); }
export function playError() { play("error", 0.3); }
export function playListenStart() { play("listen_start", 0.3); }
export function playListenStop() { play("listen_stop", 0.25); }
export function playVisionOn() { play("vision_on", 0.3); }
export function playVisionOff() { play("vision_off", 0.25); }
export function playHighlight() { play("highlight", 0.2); }
export function playNavigate() { play("navigate", 0.25); }
export function playTyping() { play("typing", 0.15); }
export function playScroll() { play("scroll", 0.15); }
export function playSuccess() { play("success", 0.3); }
export function startThinking(): () => void { return playLoop("thinking", 0.12); }
let lastPersonaAudio: HTMLAudioElement | null = null;

export function playPersona(id: string) {
  if (lastPersonaAudio) {
    lastPersonaAudio.pause();
    lastPersonaAudio.currentTime = 0;
  }
  const name = `persona_${id}`;
  try {
    if (!cache[name]) {
      cache[name] = new Audio(chrome.runtime.getURL(`assets/sfx/${name}.wav`));
    }
    const audio = cache[name];
    audio.volume = 0.5;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    lastPersonaAudio = audio;
  } catch {}
}
