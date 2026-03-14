export function injectLaunchVortex(mascotUrl: string): void {
  var existing = document.getElementById("phantom-launch-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-launch-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  var canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
  overlay.appendChild(canvas);

  var mascot = document.createElement("img");
  mascot.src = mascotUrl;
  mascot.style.cssText = "position:absolute;top:50%;left:50%;width:160px;height:160px;transform:translate(-50%,-50%) scale(0);opacity:0;image-rendering:pixelated;filter:drop-shadow(0 4px 24px rgba(66,133,244,0.4));";
  overlay.appendChild(mascot);

  document.body.appendChild(overlay);

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) {
    mascot.style.transition = "transform 0.5s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s";
    mascot.style.transform = "translate(-50%,-50%) scale(1)";
    mascot.style.opacity = "1";
    setTimeout(function () { overlay.style.transition = "opacity 0.5s"; overlay.style.opacity = "0"; }, 1500);
    setTimeout(function () { overlay.remove(); }, 2000);
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
    "uniform float u_t;uniform vec2 u_r;",
    "#define PI 3.14159265",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/u_r;float aspect=u_r.x/u_r.y;",
    "  vec2 pos=(uv-0.5)*vec2(aspect,1.0);",
    "  float dist=length(pos);float angle=atan(pos.y,pos.x);",
    "  float et=u_t*u_t*(3.0-2.0*u_t);float spin=et*PI*3.0;",
    "  vec3 blue=vec3(0.26,0.52,0.96);vec3 red=vec3(0.92,0.26,0.21);",
    "  vec3 yellow=vec3(0.98,0.74,0.02);vec3 green=vec3(0.20,0.66,0.33);",
    "  float alpha=0.0;vec3 col=vec3(0.0);",
    "  for(int i=0;i<4;i++){",
    "    float fi=float(i);",
    "    float armAngle=angle-spin+fi*PI*0.5;",
    "    float spiral=fract(armAngle/(2.0*PI)+dist*2.0-et*0.5);",
    "    float arm=smoothstep(0.08,0.0,abs(spiral-0.5)-0.15);",
    "    float radialFade=smoothstep(0.0,0.1,dist)*smoothstep(et*1.5,et*0.3,dist);",
    "    arm*=radialFade;arm*=1.0-smoothstep(0.6,1.0,u_t);",
    "    vec3 c=(i==0)?blue:(i==1)?red:(i==2)?yellow:green;",
    "    col+=c*arm;alpha+=arm;",
    "  }",
    "  float core=exp(-dist*dist*30.0)*et*(1.0-smoothstep(0.5,1.0,u_t))*0.6;",
    "  col+=vec3(1.0)*core;alpha+=core;",
    "  alpha*=1.0-smoothstep(0.7,1.0,u_t);",
    "  gl_FragColor=vec4(col,clamp(alpha,0.0,0.8));",
    "}",
  ].join("\n"));
  gl.compileShader(fs);

  var prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog); gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var uT = gl.getUniformLocation(prog, "u_t");
  var uR = gl.getUniformLocation(prog, "u_r");
  var start = performance.now();
  var DUR = 1600;

  setTimeout(function () {
    mascot.style.transition = "transform 0.6s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s ease-out";
    mascot.style.transform = "translate(-50%,-50%) scale(1)";
    mascot.style.opacity = "1";
  }, 300);

  function frame(now: number) {
    var t = Math.min((now - start) / DUR, 1);
    gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform1f(uT, t); gl!.uniform2f(uR, canvas.width, canvas.height);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    if (t < 1) { requestAnimationFrame(frame); return; }
    setTimeout(function () {
      mascot.style.transition = "transform 0.5s ease-in,opacity 0.4s ease-in";
      mascot.style.transform = "translate(-50%,-50%) scale(0.6)";
      mascot.style.opacity = "0";
    }, 400);
    setTimeout(function () { overlay.remove(); }, 1000);
  }
  requestAnimationFrame(frame);
}
