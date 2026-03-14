export function injectAudioEQ(): void {
  var existing = document.getElementById("phantom-audio-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-audio-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  var style = document.createElement("style");
  style.textContent = "@keyframes phEQ{0%{transform:scaleY(0)}30%{transform:scaleY(var(--h))}60%{transform:scaleY(calc(var(--h)*0.6))}80%{transform:scaleY(calc(var(--h)*0.3))}100%{transform:scaleY(0)}}";
  overlay.appendChild(style);

  var colors = ["#7C3AED", "#8B5CF6", "#A78BFA", "#C084FC", "#9334E9", "#6D28D9", "#7C3AED", "#8B5CF6"];
  var W = window.innerWidth;
  var count = Math.floor(W / 12);

  for (var i = 0; i < count; i++) {
    var h = 0.3 + Math.random() * 0.7;
    var delay = Math.abs(i - count / 2) * 8 + Math.random() * 100;
    var dur = 600 + Math.random() * 400;
    var c = colors[i % colors.length];

    var bar = document.createElement("div");
    bar.style.cssText = "position:absolute;bottom:0;left:" + (i * 12) + "px;width:8px;height:100%;background:" + c + ";transform-origin:bottom;transform:scaleY(0);--h:" + h + ";animation:phEQ " + dur + "ms " + delay + "ms ease-out forwards;border-radius:4px 4px 0 0;opacity:0.7;";
    overlay.appendChild(bar);
  }

  document.body.appendChild(overlay);
  setTimeout(function () { overlay.remove(); }, 1800);
}
