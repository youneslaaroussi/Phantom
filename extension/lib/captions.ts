let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let currentRole: "user" | "agent" | null = null;
let accumulated = "";

export async function showCaption(text: string, role: "user" | "agent"): Promise<void> {
  if (role !== currentRole) {
    accumulated = "";
    currentRole = role;
  }
  accumulated += text;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: _injectCaption,
    args: [accumulated, role],
  });

  if (fadeTimer) clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    accumulated = "";
    currentRole = null;
    hideCaption();
  }, 4000);
}

export async function hideCaption(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: _fadeCaption,
  }).catch(() => {});
}

function _injectCaption(text: string, role: string): void {
  var id = "phantom-caption-bar";
  var el = document.getElementById(id);

  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:2147483645",
      "pointer-events:none",
      "max-width:min(680px,90vw)",
      "padding:10px 20px",
      "border-radius:16px",
      "font-family:'Google Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
      "font-size:14px",
      "line-height:1.5",
      "text-align:center",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "white-space:nowrap",
      "backdrop-filter:blur(16px)",
      "-webkit-backdrop-filter:blur(16px)",
      "transition:opacity 0.3s ease,transform 0.3s ease",
      "opacity:0",
      "transform:translateX(-50%) translateY(8px)",
    ].join(";");
    document.body.appendChild(el);
    void el.offsetHeight;
  }

  var isUser = role === "user";
  el.style.background = isUser
    ? "linear-gradient(135deg,rgba(66,133,244,0.85),rgba(66,133,244,0.7))"
    : "linear-gradient(135deg,rgba(32,33,36,0.88),rgba(32,33,36,0.75))";
  el.style.color = "#fff";
  el.style.boxShadow = isUser
    ? "0 4px 24px rgba(66,133,244,0.3)"
    : "0 4px 24px rgba(0,0,0,0.25)";

  el.textContent = text;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
}

function _fadeCaption(): void {
  var el = document.getElementById("phantom-caption-bar");
  if (el) {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(function () {
      if (el && el.style.opacity === "0") el.remove();
    }, 400);
  }
}
