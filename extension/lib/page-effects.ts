/**
 * Page Effects — immersive full-page animations injected into the user's tab.
 *
 * These run on the ACTUAL webpage, not the sidepanel.
 * All functions are self-contained (no imports) for chrome.scripting.executeScript.
 */

/**
 * Full-page WebGL wave sweep + mascot pop.
 * Injected when Phantom connects or on first launch.
 */
export function injectLaunchEffect(mascotUrl: string): void {
  // Remove any existing
  var existing = document.getElementById("phantom-launch-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-launch-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  // WebGL canvas for wave
  var canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
  overlay.appendChild(canvas);

  // Mascot element (starts hidden)
  var mascot = document.createElement("img");
  mascot.src = mascotUrl;
  mascot.style.cssText = "position:absolute;top:50%;left:50%;width:120px;height:120px;transform:translate(-50%,-50%) scale(0);opacity:0;transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s ease-out;image-rendering:pixelated;filter:drop-shadow(0 0 40px rgba(66,133,244,0.5));";
  overlay.appendChild(mascot);

  document.body.appendChild(overlay);

  // Init WebGL
  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) {
    // Fallback: just show mascot
    mascot.style.transform = "translate(-50%,-50%) scale(1)";
    mascot.style.opacity = "1";
    setTimeout(function() { overlay.style.transition = "opacity 0.5s"; overlay.style.opacity = "0"; }, 1500);
    setTimeout(function() { overlay.remove(); }, 2000);
    return;
  }

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);

  var vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, "attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}");
  gl.compileShader(vs);

  var fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, [
    "precision mediump float;",
    "uniform float u_t;",
    "uniform vec2 u_r;",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/u_r;",
    "  float y=1.0-uv.y;",
    "  float front=u_t*1.5-0.2;",
    "  float d=y-front;",
    "  float wave=smoothstep(0.12,0.0,d)*smoothstep(-0.5,-0.05,d);",
    "  wave*=sin(y*25.0-u_t*18.0)*0.15+0.85;",
    "  wave*=1.0-smoothstep(0.6,1.0,u_t);",
    "  vec3 c=mix(vec3(0.26,0.52,0.96),vec3(0.4,0.91,0.98),uv.y);",
    "  gl_FragColor=vec4(c*wave,wave*0.85);",
    "}"
  ].join("\n"));
  gl.compileShader(fs);

  var prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var uT = gl.getUniformLocation(prog, "u_t");
  var uR = gl.getUniformLocation(prog, "u_r");

  var start = performance.now();
  var DUR = 1000;
  var mascotShown = false;

  function frame(now: number) {
    var t = Math.min((now - start) / DUR, 1);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform1f(uT, t);
    gl!.uniform2f(uR, canvas.width, canvas.height);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

    // Show mascot at 50%
    if (t >= 0.5 && !mascotShown) {
      mascotShown = true;
      mascot.style.transform = "translate(-50%,-50%) scale(1)";
      mascot.style.opacity = "1";
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // Hold mascot for a moment, then fade everything
      setTimeout(function() {
        mascot.style.transition = "transform 0.4s ease-in, opacity 0.4s ease-in";
        mascot.style.transform = "translate(-50%,-50%) scale(0.8)";
        mascot.style.opacity = "0";
        canvas.style.transition = "opacity 0.3s";
        canvas.style.opacity = "0";
      }, 600);
      setTimeout(function() {
        overlay.remove();
      }, 1100);
    }
  }

  requestAnimationFrame(frame);
}

/**
 * Full-page sparkle burst effect.
 * Injected when vision or tab audio is toggled on.
 */
export function injectSparkleEffect(color: string): void {
  var existing = document.getElementById("phantom-sparkle-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-sparkle-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  // Inject keyframes
  var style = document.createElement("style");
  style.textContent = [
    "@keyframes phSpk{0%{transform:translate(0,0) scale(0);opacity:1}50%{opacity:0.8}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}",
    "@keyframes phGlow{0%{transform:translate(-50%,-50%) scale(0);opacity:0.5}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}",
    "@keyframes phFlash{0%{opacity:0.15}100%{opacity:0}}"
  ].join("");
  overlay.appendChild(style);

  // Full-screen flash
  var flash = document.createElement("div");
  flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:" + color + ";opacity:0;animation:phFlash 0.4s ease-out forwards;";
  overlay.appendChild(flash);

  // Center glow
  var glow = document.createElement("div");
  glow.style.cssText = "position:absolute;top:50%;left:50%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle," + color + "66 0%,transparent 70%);animation:phGlow 0.8s ease-out forwards;";
  overlay.appendChild(glow);

  // Sparkle particles
  var cx = window.innerWidth / 2;
  var cy = window.innerHeight / 2;
  var COUNT = 30;

  for (var i = 0; i < COUNT; i++) {
    var angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.6;
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

  setTimeout(function() { overlay.remove(); }, 1200);
}

// ─── Wrappers that call chrome.scripting.executeScript ───

export async function playPageLaunchEffect(personaImage: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url?.startsWith("chrome://")) return;

  const mascotUrl = chrome.runtime.getURL("assets/" + personaImage);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectLaunchEffect,
    args: [mascotUrl],
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
