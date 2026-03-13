let capturing = false;
let chunkInterval: ReturnType<typeof setInterval> | null = null;
let activeTabId: number | null = null;
let sendChunkFn: ((base64: string) => void) | null = null;

export function isTabAudioActive(): boolean {
  return capturing;
}

export async function startTabAudio(
  sendChunk: (base64: string) => void
): Promise<void> {
  if (capturing) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    throw new Error("Cannot capture audio from this page");
  }

  const resp = await chrome.runtime.sendMessage({
    type: "get-tab-audio-stream-id",
    tabId: tab.id,
  });

  if (resp.error) throw new Error(resp.error);
  const streamId = resp.streamId;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: startCaptureInPage,
    args: [streamId],
  });

  activeTabId = tab.id;
  sendChunkFn = sendChunk;
  capturing = true;

  chunkInterval = setInterval(async () => {
    if (!capturing || !activeTabId) return;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: getChunkFromPage,
      });
      const b64 = results?.[0]?.result;
      if (b64 && sendChunkFn) {
        sendChunkFn(b64);
      }
    } catch {}
  }, 500);

  console.log("[TabAudio] Started streaming");
}

export async function stopTabAudio(): Promise<void> {
  if (!capturing) return;
  capturing = false;
  sendChunkFn = null;

  if (chunkInterval) {
    clearInterval(chunkInterval);
    chunkInterval = null;
  }

  if (activeTabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: stopCaptureInPage,
      });
    } catch {}
    activeTabId = null;
  }

  console.log("[TabAudio] Stopped");
}

async function startCaptureInPage(streamId: string) {
  if ((window as any).__phantom_tab_audio) return;

  var chunks: string[] = [];

  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      } as any,
    } as any);

    var audioCtx = new AudioContext({ sampleRate: 16000 });
    var source = audioCtx.createMediaStreamSource(stream);

    // ScriptProcessor taps into the stream to extract PCM chunks.
    // We do NOT connect source → destination (that would echo audio back).
    var processor = audioCtx.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
    // Connect processor to destination so onaudioprocess fires (required by spec),
    // but gain is zero so nothing is audible.
    var silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    processor.onaudioprocess = function(e) {
      var state = (window as any).__phantom_tab_audio;
      if (!state || !state.active) return;
      var input = e.inputBuffer.getChannelData(0);
      var pcm16 = new Int16Array(input.length);
      for (var i = 0; i < input.length; i++) {
        var s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      var bytes = new Uint8Array(pcm16.buffer);
      var binary = "";
      for (var j = 0; j < bytes.length; j++) {
        binary += String.fromCharCode(bytes[j]);
      }
      chunks.push(btoa(binary));
    };

    (window as any).__phantom_tab_audio = {
      stream: stream,
      audioCtx: audioCtx,
      processor: processor,
      chunks: chunks,
      active: true,
      stop: function() {
        this.active = false;
        processor.disconnect();
        silentGain.disconnect();
        source.disconnect();
        stream.getTracks().forEach(function(t: MediaStreamTrack) { t.stop(); });
        audioCtx.close();
        delete (window as any).__phantom_tab_audio;
      },
    };
  } catch (err) {
    console.error("[TabAudio] Capture failed:", err);
  }
}

function getChunkFromPage(): string | null {
  var state = (window as any).__phantom_tab_audio;
  if (!state || !state.chunks || state.chunks.length === 0) return null;
  var all = state.chunks.join("");
  state.chunks.length = 0;
  return all;
}

function stopCaptureInPage() {
  var state = (window as any).__phantom_tab_audio;
  if (state && state.stop) state.stop();
}
