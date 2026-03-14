/**
 * Launch Animation — WebGL wave sweep + mascot pop + hello sound.
 *
 * Played once when the sidepanel first opens (after setup).
 * A blue wave sweeps from top to bottom, then the mascot logo
 * pops in with a scale-up + the persona hello sound plays.
 */

const LAUNCH_VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const LAUNCH_FRAG = `
  precision mediump float;
  uniform float u_progress; // 0..1 sweep progress
  uniform vec2 u_resolution;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float y = 1.0 - uv.y; // flip so 0=top, 1=bottom

    // Wave front position
    float front = u_progress * 1.4 - 0.2;
    float dist = y - front;

    // Sharp leading edge with soft trail
    float wave = smoothstep(0.15, 0.0, dist) * smoothstep(-0.6, -0.1, dist);

    // Add ripple texture
    float ripple = sin(y * 30.0 - u_progress * 20.0) * 0.1 + 0.9;
    wave *= ripple;

    // Fade out as sweep completes
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, u_progress);
    wave *= fadeOut;

    // Google Blue with slight cyan shift
    vec3 col = mix(vec3(0.26, 0.52, 0.96), vec3(0.4, 0.8, 0.96), uv.y);
    float alpha = wave * 0.7;

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export interface LaunchAnimationHandle {
  destroy: () => void;
}

/**
 * Play the launch animation on a container element.
 * Returns a handle to destroy it early if needed.
 */
export function playLaunchAnimation(
  container: HTMLElement,
  onWaveDone?: () => void
): LaunchAnimationHandle {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;z-index:100;pointer-events:none;";
  container.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    // Fallback: just call onWaveDone immediately
    canvas.remove();
    onWaveDone?.();
    return { destroy: () => {} };
  }

  // Compile shaders
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, LAUNCH_VERT);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, LAUNCH_FRAG);
  gl.compileShader(fs);

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const posLoc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const uProgress = gl.getUniformLocation(prog, "u_progress");
  const uRes = gl.getUniformLocation(prog, "u_resolution");

  // Sizing
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  let destroyed = false;
  const DURATION = 800; // ms
  const start = performance.now();
  let waveDoneCalled = false;

  const frame = (now: number) => {
    if (destroyed) return;
    const t = Math.min((now - start) / DURATION, 1);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uProgress, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (t >= 0.6 && !waveDoneCalled) {
      waveDoneCalled = true;
      onWaveDone?.();
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // Fade canvas out
      canvas.style.transition = "opacity 0.3s ease-out";
      canvas.style.opacity = "0";
      setTimeout(() => canvas.remove(), 300);
    }
  };

  requestAnimationFrame(frame);

  return {
    destroy: () => {
      destroyed = true;
      canvas.remove();
    },
  };
}
