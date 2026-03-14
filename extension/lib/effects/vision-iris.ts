export function injectVisionIris(): void {
  var existing = document.getElementById("phantom-vision-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "phantom-vision-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483640;pointer-events:none;overflow:hidden;";

  var canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
  overlay.appendChild(canvas);

  document.body.appendChild(overlay);

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
  if (!gl) { overlay.remove(); return; }

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
    "  float dist=length(pos);float ang=atan(pos.y,pos.x);",
    "  float et=u_t<0.5?2.0*u_t*u_t:1.0-pow(-2.0*u_t+2.0,2.0)/2.0;",
    "  float blade=cos(ang*6.0+PI*0.25)*0.15+0.85;",
    "  float rad=et*1.5*blade;",
    "  float ring=smoothstep(rad-0.03,rad,dist)*smoothstep(rad+0.06,rad+0.01,dist);",
    "  float fill=smoothstep(rad,rad-0.02,dist)*(1.0-et);",
    "  vec3 col=mix(vec3(0.26,0.52,0.96),vec3(0.4,0.91,0.98),ring)*ring*2.0;",
    "  float al=ring*0.8+fill*0.5;",
    "  al*=1.0-smoothstep(0.75,1.0,u_t);",
    "  gl_FragColor=vec4(col,clamp(al,0.0,0.85));",
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
  var DUR = 1400;

  function frame(now: number) {
    var t = Math.min((now - start) / DUR, 1);
    gl!.clearColor(0, 0, 0, 0); gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform1f(uT, t); gl!.uniform2f(uR, canvas.width, canvas.height);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    if (t < 1) requestAnimationFrame(frame);
    else setTimeout(function () { overlay.remove(); }, 100);
  }
  requestAnimationFrame(frame);
}
