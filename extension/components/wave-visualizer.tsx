/**
 * WebGL audio wave visualizer
 * Uses simplex noise on the GPU for organic, responsive motion.
 */

import React, { useRef, useEffect, useCallback } from "react";

interface WaveVisualizerProps {
  level: number;
  isActive: boolean;
  color?: string;
  className?: string;
}

const VERT = `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
  precision mediump float;
  
  uniform float u_time;
  uniform float u_level;
  uniform float u_active;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  
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
    
    float speed = 0.5 + u_level * 2.0;
    float height = 0.15 + u_level * 0.35;
    
    float w1 = snoise(vec2(uv.x * 3.0 + u_time * speed * 0.3, u_time * 0.2)) * height;
    float w2 = snoise(vec2(uv.x * 5.0 - u_time * speed * 0.5, u_time * 0.3 + 10.0)) * height * 0.7;
    float w3 = snoise(vec2(uv.x * 8.0 + u_time * speed * 0.8, u_time * 0.4 + 20.0)) * height * 0.4;
    
    float wave = w1 + w2 + w3;
    float threshold = wave + 0.3;
    float dist = uv.y - threshold;
    
    float alpha = smoothstep(0.15, 0.0, dist);
    float glow = exp(-dist * 8.0) * 0.5 * u_level;
    alpha += glow;
    alpha *= 0.3 + u_active * 0.7;
    
    float gradient = 1.0 - uv.y * 0.5;
    vec3 col = u_color * gradient;
    
    float crest = smoothstep(0.02, 0.0, abs(dist)) * u_level * 0.5;
    col += vec3(1.0) * crest;
    
    gl_FragColor = vec4(col, alpha * 0.8);
  }
`;

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, "");
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const WaveVisualizer = ({ level, isActive, color = "#3b82f6", className = "" }: WaveVisualizerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const frameRef = useRef(0);
  const t0Ref = useRef(Date.now());
  const levelRef = useRef(0);
  const activeRef = useRef(0);

  useEffect(() => { levelRef.current = levelRef.current * 0.7 + level * 0.3; }, [level]);
  useEffect(() => { activeRef.current = activeRef.current * 0.85 + (isActive ? 1 : 0) * 0.15; }, [isActive]);

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

    const t = (Date.now() - t0Ref.current) / 1000;
    gl.uniform1f(gl.getUniformLocation(prog, "u_time"), t);
    gl.uniform1f(gl.getUniformLocation(prog, "u_level"), levelRef.current);
    gl.uniform1f(gl.getUniformLocation(prog, "u_active"), activeRef.current);
    gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), canvas.width, canvas.height);
    const rgb = hexToRgb(color);
    gl.uniform3f(gl.getUniformLocation(prog, "u_color"), rgb[0], rgb[1], rgb[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    frameRef.current = requestAnimationFrame(render);
  }, [color]);

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
