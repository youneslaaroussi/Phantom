/**
 * Agent Cursor — visual indicator of where Phantom is clicking.
 *
 * Shows a Google-style animated cursor on the page when:
 * - DOM tools click an element (via CSS selector)
 * - Computer Use clicks at coordinates
 *
 * The cursor is a small SVG injected into the page via content script,
 * with a smooth move animation + ripple on click.
 */

// Injected into the page — shows cursor moving to target and clicking
export function showAgentCursor(x: number, y: number): void {
  // Remove existing cursor
  const existing = document.getElementById("phantom-agent-cursor");
  if (existing) existing.remove();

  // Create cursor container
  const cursor = document.createElement("div");
  cursor.id = "phantom-agent-cursor";
  cursor.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#4285F4" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
    <div id="phantom-cursor-ripple" style="
      position:absolute; top:50%; left:50%;
      width:0; height:0; border-radius:50%;
      background:rgba(66,133,244,0.3);
      transform:translate(-50%,-50%);
      pointer-events:none;
    "></div>
  `;
  cursor.style.cssText = `
    position:fixed; z-index:2147483646; pointer-events:none;
    transition:left 0.4s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1);
    left:-40px; top:-40px;
  `;

  document.body.appendChild(cursor);

  // Animate cursor to target position
  requestAnimationFrame(() => {
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
  });

  // Ripple on arrival
  setTimeout(() => {
    const ripple = document.getElementById("phantom-cursor-ripple");
    if (ripple) {
      ripple.style.transition = "width 0.3s ease-out, height 0.3s ease-out, opacity 0.3s ease-out";
      ripple.style.width = "40px";
      ripple.style.height = "40px";
      ripple.style.opacity = "0";
    }
  }, 420);

  // Fade out and remove
  setTimeout(() => {
    cursor.style.transition = "opacity 0.3s ease-out";
    cursor.style.opacity = "0";
  }, 900);

  setTimeout(() => {
    cursor.remove();
  }, 1200);
}

// Show cursor at a CSS selector target
export function showAgentCursorAtSelector(selector: string): void {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  showAgentCursor(x, y);
}

// Idle cursor that drifts with noise — for when computer use is thinking
let idleInterval: ReturnType<typeof setInterval> | null = null;

export function startIdleCursor(baseX: number, baseY: number): void {
  stopIdleCursor();

  const cursor = document.createElement("div");
  cursor.id = "phantom-idle-cursor";
  cursor.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.6;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.15))">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#4285F4" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  `;
  cursor.style.cssText = `
    position:fixed; z-index:2147483646; pointer-events:none;
    left:${baseX}px; top:${baseY}px;
    transition:left 0.8s ease-in-out, top 0.8s ease-in-out, opacity 1s ease-in-out;
    opacity:0;
  `;

  document.body.appendChild(cursor);

  // Fade in
  requestAnimationFrame(() => {
    cursor.style.opacity = "0.6";
  });

  // Drift with Perlin-like noise
  let t = 0;
  idleInterval = setInterval(() => {
    t += 0.3;
    const nx = baseX + Math.sin(t * 0.7) * 12 + Math.cos(t * 1.3) * 6;
    const ny = baseY + Math.cos(t * 0.5) * 10 + Math.sin(t * 1.1) * 5;
    cursor.style.left = nx + "px";
    cursor.style.top = ny + "px";

    // Subtle opacity pulse
    cursor.style.opacity = String(0.4 + Math.sin(t * 0.4) * 0.2);
  }, 800);
}

export function stopIdleCursor(): void {
  if (idleInterval) {
    clearInterval(idleInterval);
    idleInterval = null;
  }
  const cursor = document.getElementById("phantom-idle-cursor");
  if (cursor) {
    cursor.style.opacity = "0";
    setTimeout(() => cursor.remove(), 1000);
  }
}
