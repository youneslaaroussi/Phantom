export function injectLaunchShatter(mascotUrl: string): void {
  var existing = document.getElementById("phantom-launch-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-launch-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  var mascot = document.createElement("img");
  mascot.src = mascotUrl;
  mascot.style.cssText = "position:absolute;top:50%;left:50%;width:160px;height:160px;transform:translate(-50%,-50%) scale(0);opacity:0;image-rendering:pixelated;filter:drop-shadow(0 4px 24px rgba(66,133,244,0.4));";
  overlay.appendChild(mascot);

  var style = document.createElement("style");
  style.textContent = "@keyframes phShard{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:0.7}100%{transform:translate(var(--tx),var(--ty)) rotate(var(--rot)) scale(0.3);opacity:0}}@keyframes phCrackFlash{0%{opacity:0.25}100%{opacity:0}}";
  overlay.appendChild(style);

  var flash = document.createElement("div");
  flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:white;animation:phCrackFlash 0.3s ease-out forwards;";
  overlay.appendChild(flash);

  var cx = window.innerWidth / 2;
  var cy = window.innerHeight / 2;
  var colors = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

  for (var i = 0; i < 40; i++) {
    var angle = Math.random() * Math.PI * 2;
    var dist = 50 + Math.random() * Math.max(window.innerWidth, window.innerHeight) * 0.6;
    var tx = Math.cos(angle) * dist;
    var ty = Math.sin(angle) * dist;
    var rot = (Math.random() - 0.5) * 720;
    var w = 20 + Math.random() * 60;
    var h = 20 + Math.random() * 60;
    var delay = Math.random() * 200;
    var dur = 800 + Math.random() * 600;
    var color = colors[i % 4];
    var x = cx - w / 2 + (Math.random() - 0.5) * 100;
    var y = cy - h / 2 + (Math.random() - 0.5) * 100;
    var clip = "polygon(" +
      (Math.random() * 30) + "% " + (Math.random() * 30) + "%," +
      (70 + Math.random() * 30) + "% " + (Math.random() * 30) + "%," +
      (70 + Math.random() * 30) + "% " + (70 + Math.random() * 30) + "%," +
      (Math.random() * 30) + "% " + (70 + Math.random() * 30) + "%)";

    var shard = document.createElement("div");
    shard.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;width:" + w + "px;height:" + h + "px;background:" + color + ";clip-path:" + clip + ";opacity:0.7;--tx:" + tx + "px;--ty:" + ty + "px;--rot:" + rot + "deg;animation:phShard " + dur + "ms " + delay + "ms cubic-bezier(0.25,0.46,0.45,0.94) forwards;border-radius:2px;";
    overlay.appendChild(shard);
  }

  document.body.appendChild(overlay);

  setTimeout(function () {
    mascot.style.transition = "transform 0.6s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s ease-out";
    mascot.style.transform = "translate(-50%,-50%) scale(1)";
    mascot.style.opacity = "1";
  }, 150);

  setTimeout(function () {
    mascot.style.transition = "transform 0.5s ease-in,opacity 0.4s ease-in";
    mascot.style.transform = "translate(-50%,-50%) scale(0.6)";
    mascot.style.opacity = "0";
  }, 1200);

  setTimeout(function () { overlay.remove(); }, 1800);
}
