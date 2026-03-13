export const SHOW_INDICATOR_SCRIPT = () => {
  var ID = "__phantom_vision_indicator";
  var existing = document.getElementById(ID);
  if (existing) existing.remove();

  var el = document.createElement("div");
  el.id = ID;
  el.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";

  var wisp = document.createElement("div");
  wisp.id = "__phantom_wisp";
  wisp.style.cssText = "position:fixed;width:32px;height:32px;pointer-events:none;z-index:2147483647;will-change:left,top;filter:drop-shadow(0 0 8px rgba(103,232,249,0.5)) drop-shadow(0 0 16px rgba(99,102,241,0.3));";
  wisp.innerHTML = '<img src="' + (typeof chrome !== "undefined" && chrome.runtime ? chrome.runtime.getURL("assets/mascot.png") : "/mascot.png") + '" style="width:32px;height:32px;image-rendering:pixelated;" />';
  el.appendChild(wisp);

  var trail = document.createElement("div");
  trail.id = "__phantom_trail";
  trail.style.cssText = "position:fixed;width:16px;height:16px;border-radius:50%;pointer-events:none;z-index:2147483646;background:radial-gradient(circle,rgba(103,232,249,0.3),rgba(99,102,241,0.05));filter:blur(4px);will-change:left,top;";
  el.appendChild(trail);

  var style = document.createElement("style");
  style.textContent = "@keyframes __pw{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.85)}}";
  el.appendChild(style);

  document.body.appendChild(el);

  var mouseX = window.innerWidth - 60;
  var mouseY = 40;
  var wispX = mouseX, wispY = mouseY;
  var trailX = mouseX, trailY = mouseY;
  var idle = true;
  var idleAngle = 0;
  var idleTimer = 0;

  var onMove = function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    idle = false;
    idleTimer = 0;
  };
  document.addEventListener("mousemove", onMove);

  var tick = function() {
    if (!document.getElementById(ID)) return;

    idleTimer++;
    if (idleTimer > 90) idle = true;

    var tx = mouseX + 22;
    var ty = mouseY - 22;

    if (idle) {
      idleAngle += 0.02;
      tx = mouseX + 22 + Math.sin(idleAngle) * 8;
      ty = mouseY - 22 + Math.cos(idleAngle * 0.7) * 5 + Math.sin(idleAngle * 1.5) * 3;
    }

    wispX += (tx - wispX) * 0.14;
    wispY += (ty - wispY) * 0.14;
    trailX += (wispX - trailX) * 0.07;
    trailY += (wispY - trailY) * 0.07;

    wisp.style.left = (wispX - 16) + "px";
    wisp.style.top = (wispY - 16) + "px";
    trail.style.left = (trailX - 8) + "px";
    trail.style.top = (trailY - 8) + "px";

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.__phantom_eye_cleanup = function() {
    document.removeEventListener("mousemove", onMove);
  };
};

export const HIDE_INDICATOR_SCRIPT = () => {
  var el = document.getElementById("__phantom_vision_indicator");
  if (el) {
    if (window.__phantom_eye_cleanup) window.__phantom_eye_cleanup();
    var wisp = document.getElementById("__phantom_wisp");
    var trail = document.getElementById("__phantom_trail");
    if (wisp) { wisp.style.transition = "opacity 0.3s ease, transform 0.3s ease"; wisp.style.opacity = "0"; wisp.style.transform = "scale(0)"; }
    if (trail) { trail.style.transition = "opacity 0.3s ease"; trail.style.opacity = "0"; }
    setTimeout(function() { if (el) el.remove(); }, 300);
  }
};
