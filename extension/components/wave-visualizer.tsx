import React, { useRef, useEffect, useCallback } from "react";

interface WaveVisualizerProps {
  inputLevel: number;
  outputLevel: number;
  isListening: boolean;
  isSpeaking: boolean;
  className?: string;
}

const VERT = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
  precision mediump float;
  
  uniform float u_time;
  uniform float u_inputLevel;
  uniform float u_outputLevel;
  uniform float u_listening;
  uniform float u_speaking;
  uniform vec2 u_resolution;
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    float outSpeed = 0.5 + u_outputLevel * 2.0;
    float outHeight = 0.08 + u_outputLevel * 0.25;
    float ow1 = snoise(vec2(uv.x * 3.0 + u_time * outSpeed * 0.3, u_time * 0.2)) * outHeight;
    float ow2 = snoise(vec2(uv.x * 5.0 - u_time * outSpeed * 0.5, u_time * 0.3 + 10.0)) * outHeight * 0.7;
    float ow3 = snoise(vec2(uv.x * 8.0 + u_time * outSpeed * 0.8, u_time * 0.4 + 20.0)) * outHeight * 0.4;
    float outWave = ow1 + ow2 + ow3;
    float outThreshold = outWave + 0.15;
    float outDist = uv.y - outThreshold;
    float outAlpha = smoothstep(0.12, 0.0, outDist);
    float outGlow = exp(-outDist * 8.0) * 0.4 * u_outputLevel;
    outAlpha += outGlow;
    outAlpha *= 0.2 + u_speaking * 0.8;
    float outCrest = smoothstep(0.02, 0.0, abs(outDist)) * u_outputLevel * 0.4;
    vec3 outColor = vec3(0.26, 0.52, 0.96);
    vec3 outCol = outColor * (1.0 - uv.y * 0.5) + vec3(1.0) * outCrest;

    float inSpeed = 0.6 + u_inputLevel * 2.5;
    float inHeight = 0.06 + u_inputLevel * 0.2;
    float iw1 = snoise(vec2(uv.x * 4.0 - u_time * inSpeed * 0.4, u_time * 0.25 + 5.0)) * inHeight;
    float iw2 = snoise(vec2(uv.x * 6.0 + u_time * inSpeed * 0.6, u_time * 0.35 + 15.0)) * inHeight * 0.6;
    float inWave = iw1 + iw2;
    float inThreshold = inWave + 0.12;
    float inDist = uv.y - inThreshold;
    float inAlpha = smoothstep(0.10, 0.0, inDist);
    float inGlow = exp(-inDist * 8.0) * 0.3 * u_inputLevel;
    inAlpha += inGlow;
    inAlpha *= 0.15 + u_listening * 0.85;
    float inCrest = smoothstep(0.02, 0.0, abs(inDist)) * u_inputLevel * 0.5;
    vec3 inColor = vec3(0.92, 0.26, 0.21);
    vec3 inCol = inColor * (1.0 - uv.y * 0.5) + vec3(1.0) * inCrest;

    vec3 col = outCol * outAlpha + inCol * inAlpha * (1.0 - outAlpha * 0.5);
    float alpha = max(outAlpha, inAlpha) * 0.85;
    
    gl_FragColor = vec4(col, alpha);
  }
`;

export const WaveVisualizer = ({ inputLevel, outputLevel, isListening, isSpeaking, className = "" }: WaveVisualizerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const frameRef = useRef(0);
  const t0Ref = useRef(Date.now());
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);
  const listeningRef = useRef(0);
  const speakingRef = useRef(0);

  const targetInputRef = useRef(0);
  const targetOutputRef = useRef(0);
  const targetListeningRef = useRef(0);
  const targetSpeakingRef = useRef(0);

  targetInputRef.current = inputLevel;
  targetOutputRef.current = outputLevel;
  targetListeningRef.current = isListening ? 1 : 0;
  targetSpeakingRef.current = isSpeaking ? 1 : 0;

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) return;
    glRef.current = gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    programRef.current = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    t0Ref.current = Date.now();
  }, []);

  const render = useCallback(() => {
    const gl = glRef.current, prog = programRef.current, canvas = canvasRef.current;
    if (!gl || !prog || !canvas) { frameRef.current = requestAnimationFrame(render); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);

    inputLevelRef.current += (targetInputRef.current - inputLevelRef.current) * 0.3;
    outputLevelRef.current += (targetOutputRef.current - outputLevelRef.current) * 0.3;
    listeningRef.current += (targetListeningRef.current - listeningRef.current) * 0.15;
    speakingRef.current += (targetSpeakingRef.current - speakingRef.current) * 0.15;

    const t = (Date.now() - t0Ref.current) / 1000;
    gl.uniform1f(gl.getUniformLocation(prog, "u_time"), t);
    gl.uniform1f(gl.getUniformLocation(prog, "u_inputLevel"), inputLevelRef.current);
    gl.uniform1f(gl.getUniformLocation(prog, "u_outputLevel"), outputLevelRef.current);
    gl.uniform1f(gl.getUniformLocation(prog, "u_listening"), listeningRef.current);
    gl.uniform1f(gl.getUniformLocation(prog, "u_speaking"), speakingRef.current);
    gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    frameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    initGL();
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [initGL, render]);

  useEffect(() => {
    const wrapper = wrapperRef.current, canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = wrapper.clientWidth, h = wrapper.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={className}>
      <canvas ref={canvasRef} className="block w-full h-full" style={{ pointerEvents: "none" }} />
    </div>
  );
};
