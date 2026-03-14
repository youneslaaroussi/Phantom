export async function showKeystroke(keys: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) return;

  const fontUrl = chrome.runtime.getURL("assets/jetbrains-mono-400.woff2");

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: _injectKeystroke,
    args: [keys, fontUrl],
  });
}

function _injectKeystroke(keys: string, fontUrl: string): void {
  var fontId = "phantom-jb-mono-font";
  if (!document.getElementById(fontId)) {
    var style = document.createElement("style");
    style.id = fontId;
    style.textContent =
      "@font-face{font-family:'Phantom Mono';font-style:normal;font-weight:400;" +
      "src:url('" + fontUrl + "') format('woff2');font-display:swap}" +
      "@keyframes phKsIn{0%{opacity:0;transform:translateX(-50%) translateY(4px) scale(0.95)}" +
      "100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}" +
      "@keyframes phKsOut{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}" +
      "100%{opacity:0;transform:translateX(-50%) translateY(-8px) scale(0.95)}}";
    document.head.appendChild(style);
  }

  var containerId = "phantom-keystroke-bar";
  var el = document.getElementById(containerId);

  if (!el) {
    el = document.createElement("div");
    el.id = containerId;
    el.style.cssText = [
      "position:fixed",
      "bottom:72px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:2147483645",
      "pointer-events:none",
      "display:flex",
      "gap:6px",
      "align-items:center",
      "padding:8px 14px",
      "border-radius:12px",
      "background:linear-gradient(135deg,rgba(26,27,30,0.92),rgba(40,42,48,0.88))",
      "backdrop-filter:blur(12px)",
      "-webkit-backdrop-filter:blur(12px)",
      "box-shadow:0 4px 20px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06)",
      "border:1px solid rgba(255,255,255,0.08)",
      "animation:phKsIn 0.2s ease-out forwards",
    ].join(";");
    document.body.appendChild(el);
  }

  el.innerHTML = "";
  el.style.animation = "none";
  void el.offsetHeight;
  el.style.animation = "phKsIn 0.2s ease-out forwards";

  var parts = keys.split("+").map(function (p) { return p.trim(); });
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) {
      var plus = document.createElement("span");
      plus.textContent = "+";
      plus.style.cssText = "color:rgba(255,255,255,0.35);font-family:'Phantom Mono',monospace;font-size:13px;";
      el.appendChild(plus);
    }
    var key = document.createElement("span");
    key.textContent = parts[i];
    key.style.cssText = [
      "font-family:'Phantom Mono',monospace",
      "font-size:13px",
      "color:#fff",
      "background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))",
      "border:1px solid rgba(255,255,255,0.15)",
      "border-bottom:2px solid rgba(255,255,255,0.1)",
      "border-radius:6px",
      "padding:3px 8px",
      "text-transform:capitalize",
      "letter-spacing:0.3px",
      "text-shadow:0 1px 2px rgba(0,0,0,0.3)",
    ].join(";");
    el.appendChild(key);
  }

  if ((el as any)._fadeTimer) clearTimeout((el as any)._fadeTimer);
  (el as any)._fadeTimer = setTimeout(function () {
    if (el) {
      el.style.animation = "phKsOut 0.3s ease-in forwards";
      setTimeout(function () { if (el) el.remove(); }, 350);
    }
  }, 1500);
}
