import { addTrace } from "./trace";

let capturing = false;
let chunkInterval: ReturnType<typeof setInterval> | null = null;
let activeTabId: number | null = null;
let sendChunkFn: ((pcm: Int16Array) => boolean) | null = null;
let chunkCount = 0;
let totalBytes = 0;
let tabSwitchListener: ((info: chrome.tabs.TabActiveInfo) => void) | null = null;
let restarting = false;

export function isTabAudioActive(): boolean {
  return capturing;
}

export async function startTabAudio(
  sendChunk: (pcm: Int16Array) => boolean
): Promise<void> {
  if (capturing) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    throw new Error("Cannot capture audio from this page");
  }

  const stored = await chrome.storage.local.get(["pendingStreamId", "pendingStreamTabId", "pendingStreamTs"]);

  let streamId: string | undefined;
  const MAX_STREAM_AGE = 15000;

  if (stored.pendingStreamId && stored.pendingStreamTabId === tab.id) {
    const age = Date.now() - (stored.pendingStreamTs || 0);
    if (age < MAX_STREAM_AGE) {
      streamId = stored.pendingStreamId;
      addTrace("system", `Tab audio: using cached stream ID (age: ${age}ms)`);
      await chrome.storage.local.remove(["pendingStreamId", "pendingStreamTabId", "pendingStreamTs"]);
    }
  }

  if (!streamId) {
    addTrace("system", "Tab audio: requesting fresh stream ID from background");
    const resp = await chrome.runtime.sendMessage({ type: "get-tab-audio-stream-id", tabId: tab.id });
    if (resp?.error) {
      throw new Error(`Tab audio stream failed: ${resp.error}`);
    }
    streamId = resp?.streamId;
  }

  if (!streamId) {
    throw new Error("Failed to get tab audio stream ID");
  }

  addTrace("system", `Tab audio: got stream ID`);

  let started = await tryStartCapture(tab.id, streamId);

  if (!started) {
    addTrace("system", "Tab audio: first attempt failed, requesting fresh stream ID");
    const resp = await chrome.runtime.sendMessage({ type: "get-tab-audio-stream-id", tabId: tab.id });
    if (resp?.error || !resp?.streamId) {
      throw new Error("Tab audio: failed to get fresh stream ID for retry");
    }
    started = await tryStartCapture(tab.id, resp.streamId);
  }

  if (!started) {
    throw new Error("Tab audio capture failed after retry");
  }

  activeTabId = tab.id;
  sendChunkFn = sendChunk;
  capturing = true;

  chunkCount = 0;
  totalBytes = 0;

  if (tabSwitchListener) {
    chrome.tabs.onActivated.removeListener(tabSwitchListener);
  }
  tabSwitchListener = (info: chrome.tabs.TabActiveInfo) => {
    if (!capturing || restarting) return;
    if (info.tabId === activeTabId) return;
    restarting = true;
    addTrace("system", `Tab audio: tab switched to ${info.tabId}, restarting capture`);
    restartOnTab(info.tabId).finally(() => { restarting = false; });
  };
  chrome.tabs.onActivated.addListener(tabSwitchListener);

  chunkInterval = setInterval(async () => {
    if (!capturing || !activeTabId) return;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: getChunkFromPage,
      });
      const samples = results?.[0]?.result as number[] | null;
      if (samples && samples.length > 0 && sendChunkFn) {
        const pcm = new Int16Array(samples);
        const sent = sendChunkFn(pcm);
        if (!sent) {
          addTrace("system", "Tab audio: ws closed, auto-stopping");
          stopTabAudio();
          return;
        }
        chunkCount++;
        const byteLen = pcm.byteLength;
        totalBytes += byteLen;
        addTrace("system", `Tab audio chunk #${chunkCount}: ${(byteLen / 1024).toFixed(1)}KB (total: ${(totalBytes / 1024).toFixed(1)}KB)`);
      }
    } catch (err) {
      addTrace("error", `Tab audio chunk failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, 500);

  addTrace("system", `Tab audio started streaming (tab ${activeTabId})`);
}

export async function stopTabAudio(): Promise<void> {
  if (!capturing) return;
  capturing = false;
  sendChunkFn = null;

  if (tabSwitchListener) {
    chrome.tabs.onActivated.removeListener(tabSwitchListener);
    tabSwitchListener = null;
  }

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

  addTrace("system", `Tab audio stopped (${chunkCount} chunks, ${(totalBytes / 1024).toFixed(1)}KB total)`);
}

async function restartOnTab(newTabId: number): Promise<void> {
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
  }

  const tab = await chrome.tabs.get(newTabId).catch(() => null);
  if (!tab || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    addTrace("system", "Tab audio: new tab is not capturable, pausing");
    activeTabId = null;
    return;
  }

  try {
    const resp = await chrome.runtime.sendMessage({ type: "get-tab-audio-stream-id", tabId: newTabId });
    if (resp?.error || !resp?.streamId) {
      addTrace("error", `Tab audio: failed to get stream for new tab: ${resp?.error || "no stream ID"}`);
      return;
    }

    const started = await tryStartCapture(newTabId, resp.streamId);
    if (!started) {
      addTrace("error", "Tab audio: failed to start capture on new tab");
      return;
    }

    activeTabId = newTabId;
    chunkCount = 0;
    totalBytes = 0;

    chunkInterval = setInterval(async () => {
      if (!capturing || !activeTabId) return;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          func: getChunkFromPage,
        });
        const samples = results?.[0]?.result as number[] | null;
        if (samples && samples.length > 0 && sendChunkFn) {
          const pcm = new Int16Array(samples);
          const sent = sendChunkFn(pcm);
          if (!sent) {
            addTrace("system", "Tab audio: ws closed, auto-stopping");
            stopTabAudio();
            return;
          }
          chunkCount++;
          const byteLen = pcm.byteLength;
          totalBytes += byteLen;
          addTrace("system", `Tab audio chunk #${chunkCount}: ${(byteLen / 1024).toFixed(1)}KB (total: ${(totalBytes / 1024).toFixed(1)}KB)`);
        }
      } catch (err) {
        addTrace("error", `Tab audio chunk failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, 500);

    addTrace("system", `Tab audio restarted on tab ${newTabId}`);
  } catch (err) {
    addTrace("error", `Tab audio restart failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function tryStartCapture(tabId: number, streamId: string): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: startCaptureInPage,
    args: [streamId],
  });
  return results?.[0]?.result === true;
}

async function startCaptureInPage(streamId: string): Promise<boolean> {
  if ((window as any).__phantom_tab_audio) {
    try { (window as any).__phantom_tab_audio.stop(); } catch (_e) {}
  }

  var pcmChunks: Int16Array[] = [];

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

    var processor = audioCtx.createScriptProcessor(4096, 1, 1);
    source.connect(processor);
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
      pcmChunks.push(new Int16Array(pcm16));
    };

    (window as any).__phantom_tab_audio = {
      stream: stream,
      audioCtx: audioCtx,
      processor: processor,
      pcmChunks: pcmChunks,
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
    return true;
  } catch (err) {
    console.error("[TabAudio] Capture failed:", err);
    return false;
  }
}

function getChunkFromPage(): number[] | null {
  var state = (window as any).__phantom_tab_audio;
  if (!state || !state.pcmChunks || state.pcmChunks.length === 0) return null;

  var parts = (state.pcmChunks as Int16Array[]).slice();
  state.pcmChunks.length = 0;
  var numParts = parts.length;

  var totalLen = 0;
  for (var i = 0; i < numParts; i++) totalLen += parts[i].length;

  var merged = new Int16Array(totalLen);
  var offset = 0;
  for (var k = 0; k < numParts; k++) {
    merged.set(parts[k], offset);
    offset += parts[k].length;
  }

  return Array.from(merged);
}

function stopCaptureInPage() {
  var state = (window as any).__phantom_tab_audio;
  if (state && state.stop) state.stop();
}
