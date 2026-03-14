import { injectLaunchRipple } from "./effects/launch-ripple";
import { injectLaunchVortex } from "./effects/launch-vortex";
import { injectLaunchShatter } from "./effects/launch-shatter";
import { injectVisionIris } from "./effects/vision-iris";
import { injectAudioEQ } from "./effects/audio-eq";

const LAUNCH_EFFECTS = [injectLaunchRipple, injectLaunchVortex, injectLaunchShatter];

export async function playPageLaunchEffect(personaImage: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) return;

  const mascotUrl = chrome.runtime.getURL("assets/" + personaImage);
  const effect = LAUNCH_EFFECTS[Math.floor(Math.random() * LAUNCH_EFFECTS.length)];

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: effect,
    args: [mascotUrl],
  });
}

export async function playPageVisionEffect(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectVisionIris,
    args: [],
  });
}

export async function playPageAudioEffect(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectAudioEQ,
    args: [],
  });
}

export async function playPageSparkleEffect(color: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectSparkleEffect,
    args: [color],
  });
}

function injectSparkleEffect(color: string): void {
  var existing = document.getElementById("phantom-sparkle-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-sparkle-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  var style = document.createElement("style");
  style.textContent = "@keyframes phSpk{0%{transform:translate(0,0) scale(0);opacity:1}50%{opacity:0.8}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}@keyframes phGlow{0%{transform:translate(-50%,-50%) scale(0);opacity:0.5}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}@keyframes phFlash{0%{opacity:0.15}100%{opacity:0}}";
  overlay.appendChild(style);

  var flash = document.createElement("div");
  flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:" + color + ";opacity:0;animation:phFlash 0.4s ease-out forwards;";
  overlay.appendChild(flash);

  var glow = document.createElement("div");
  glow.style.cssText = "position:absolute;top:50%;left:50%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle," + color + "66 0%,transparent 70%);animation:phGlow 0.8s ease-out forwards;";
  overlay.appendChild(glow);

  var cx = window.innerWidth / 2;
  var cy = window.innerHeight / 2;

  for (var i = 0; i < 30; i++) {
    var angle = (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.6;
    var dist = 80 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.35;
    var dx = Math.cos(angle) * dist;
    var dy = Math.sin(angle) * dist;
    var size = 3 + Math.random() * 6;
    var delay = Math.random() * 150;
    var dur = 600 + Math.random() * 400;

    var spark = document.createElement("div");
    spark.style.cssText = "position:absolute;left:" + cx + "px;top:" + cy + "px;width:" + size + "px;height:" + size + "px;border-radius:50%;background:" + color + ";box-shadow:0 0 " + (size * 3) + "px " + color + ";--dx:" + dx + "px;--dy:" + dy + "px;animation:phSpk " + dur + "ms " + delay + "ms ease-out forwards;";
    overlay.appendChild(spark);
  }

  document.body.appendChild(overlay);
  setTimeout(function () { overlay.remove(); }, 1200);
}
