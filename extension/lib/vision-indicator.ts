/**
 * Injected into the active tab to show a visual indicator
 * when Phantom is watching the screen.
 */

export const SHOW_INDICATOR_SCRIPT = () => {
  const ID = "__phantom_vision_indicator";

  // Remove existing if any
  document.getElementById(ID)?.remove();

  const el = document.createElement("div");
  el.id = ID;
  el.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(59,130,246,0.3);
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      pointer-events: none;
      user-select: none;
      animation: __phantom_fade_in 0.3s ease;
    ">
      <div style="
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #3b82f6;
        animation: __phantom_pulse 2s ease infinite;
      "></div>
      Phantom is watching
    </div>
  `;
  el.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    pointer-events: none;
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes __phantom_pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes __phantom_fade_in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  el.appendChild(style);
  document.body.appendChild(el);
};

export const HIDE_INDICATOR_SCRIPT = () => {
  const el = document.getElementById("__phantom_vision_indicator");
  if (el) {
    el.style.transition = "opacity 0.3s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }
};
