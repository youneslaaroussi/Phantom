export const SHOW_INDICATOR_SCRIPT = (imgUrl: string) => {
  var ID = "__phantom_vision_indicator";
  var existing = document.getElementById(ID);
  if (existing) existing.remove();

  var el = document.createElement("div");
  el.id = ID;
  el.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";

  var wisp = document.createElement("div");
  wisp.id = "__phantom_wisp";
  wisp.style.cssText = "position:fixed;width:80px;height:80px;pointer-events:none;z-index:2147483647;will-change:left,top,transform;filter:drop-shadow(0 0 12px rgba(103,232,249,0.5)) drop-shadow(0 0 24px rgba(99,102,241,0.3));transition:filter 0.3s;";
  wisp.innerHTML = '<img src="' + imgUrl + '" style="width:80px;height:80px;image-rendering:pixelated;" />';
  el.appendChild(wisp);

  document.body.appendChild(el);

  var mouseX = window.innerWidth - 60;
  var mouseY = 40;
  var wispX = mouseX, wispY = mouseY;
  var prevX = wispX, prevY = wispY;
  var velX = 0, velY = 0;
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

    var tx = mouseX + 28;
    var ty = mouseY - 28;

    if (idle) {
      idleAngle += 0.02;
      tx = mouseX + 28 + Math.sin(idleAngle) * 10;
      ty = mouseY - 28 + Math.cos(idleAngle * 0.7) * 6 + Math.sin(idleAngle * 1.5) * 4;
    }

    wispX += (tx - wispX) * 0.12;
    wispY += (ty - wispY) * 0.12;

    velX = velX * 0.85 + (wispX - prevX) * 0.15;
    velY = velY * 0.85 + (wispY - prevY) * 0.15;
    prevX = wispX;
    prevY = wispY;

    var speed = Math.sqrt(velX * velX + velY * velY);
    var angle = Math.atan2(velY, velX) * (180 / Math.PI);

    var stretch = 1 + Math.min(speed * 0.04, 0.6);
    var squash = 1 / Math.sqrt(stretch);

    var wobble = idle ? Math.sin(idleAngle * 3) * 3 : 0;
    var breathe = 1 + Math.sin(idleAngle * 2) * 0.03;

    var transform;
    if (speed > 1.5) {
      transform = "scaleX(" + stretch.toFixed(3) + ") scaleY(" + squash.toFixed(3) + ")";
      wisp.style.filter = "drop-shadow(0 0 " + Math.min(16 + speed * 2, 40) + "px rgba(103,232,249," + Math.min(0.5 + speed * 0.03, 0.9) + ")) drop-shadow(0 0 " + Math.min(28 + speed * 3, 60) + "px rgba(99,102,241,0.3))";
    } else {
      transform = "scale(" + breathe.toFixed(3) + ")";
      wisp.style.filter = "drop-shadow(0 0 12px rgba(103,232,249,0.5)) drop-shadow(0 0 24px rgba(99,102,241,0.3))";
    }

    wisp.style.left = (wispX - 40) + "px";
    wisp.style.top = (wispY - 40) + "px";
    wisp.style.transform = transform;

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
    if (wisp) { wisp.style.transition = "opacity 0.3s ease, transform 0.3s ease"; wisp.style.opacity = "0"; wisp.style.transform = "scale(0) rotate(180deg)"; }
    setTimeout(function() { if (el) el.remove(); }, 300);
  }
};
