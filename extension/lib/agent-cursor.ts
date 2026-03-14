/**
 * Agent Cursor — visual indicator of where Phantom is clicking/scrolling.
 *
 * Shows a Google-style animated ring on the page when:
 * - DOM tools click an element (via CSS selector)
 * - Computer Use clicks at coordinates
 * - Scroll actions are performed
 *
 * The cursor slides in from a random screen edge, performs the action,
 * then fades/slides out.
 */

function randomEdgeStart(x: number, y: number) {
  const edges = [
    { left: x, top: -60 },
    { left: x, top: window.innerHeight + 60 },
    { left: -60, top: y },
    { left: window.innerWidth + 60, top: y },
  ];
  return edges[Math.floor(Math.random() * edges.length)];
}

export function showAgentCursor(x: number, y: number): void {
  const existing = document.getElementById("phantom-agent-cursor");
  if (existing) existing.remove();

  const cursor = document.createElement("div");
  cursor.id = "phantom-agent-cursor";
  cursor.innerHTML = `
    <div style="
      width:48px; height:48px; border-radius:24px;
      background:rgba(66,133,244,0.15);
      border:2.5px solid #4285F4;
      box-shadow:0 0 16px rgba(66,133,244,0.25), 0 0 4px rgba(66,133,244,0.15);
      transform:translate(-50%,-50%);
    "></div>
    <div id="phantom-cursor-ripple" style="
      position:absolute; top:0; left:0;
      width:48px; height:48px; border-radius:50%;
      background:rgba(66,133,244,0.2);
      transform:translate(-50%,-50%) scale(1);
      pointer-events:none;
      opacity:1;
    "></div>
  `;

  const start = randomEdgeStart(x, y);
  cursor.style.cssText = `
    position:fixed; z-index:2147483646; pointer-events:none;
    transition:left 0.4s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1);
    left:${start.left}px; top:${start.top}px;
  `;

  document.body.appendChild(cursor);

  requestAnimationFrame(() => {
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
  });

  setTimeout(() => {
    const ripple = document.getElementById("phantom-cursor-ripple");
    if (ripple) {
      ripple.style.transition = "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease-out";
      ripple.style.transform = "translate(-50%,-50%) scale(2.5)";
      ripple.style.opacity = "0";
    }
  }, 420);

  setTimeout(() => {
    cursor.style.transition = "opacity 0.5s ease-out";
    cursor.style.opacity = "0";
  }, 2000);

  setTimeout(() => {
    cursor.remove();
  }, 2500);
}

export function showAgentCursorAtSelector(selector: string): void {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  showAgentCursor(x, y);
}

export function showScrollCursor(x: number, y: number, direction: "up" | "down", amount?: number): void {
  const existing = document.getElementById("phantom-agent-cursor");
  if (existing) existing.remove();

  const isDown = direction === "down";
  const scrollAmount = amount || 400;
  const scrollDuration = 800;
  const drift = isDown ? 150 : -150;

  const cursor = document.createElement("div");
  cursor.id = "phantom-agent-cursor";
  cursor.innerHTML = `
    <div style="
      width:48px; height:48px; border-radius:24px;
      background:rgba(66,133,244,0.15);
      border:2.5px solid #4285F4;
      box-shadow:0 0 16px rgba(66,133,244,0.25), 0 0 4px rgba(66,133,244,0.15);
      transform:translate(-50%,-50%);
    "></div>
  `;

  const start = randomEdgeStart(x, y);
  cursor.style.cssText = `
    position:fixed; z-index:2147483646; pointer-events:none;
    transition:left 0.4s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1);
    left:${start.left}px; top:${start.top}px;
  `;

  document.body.appendChild(cursor);

  requestAnimationFrame(() => {
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
  });

  setTimeout(() => {
    cursor.style.transition = `top ${scrollDuration}ms cubic-bezier(0.4,0,0.2,1)`;
    cursor.style.top = (y + drift) + "px";

    const startScroll = window.scrollY;
    const targetScroll = startScroll + (isDown ? scrollAmount : -scrollAmount);
    const startTime = performance.now();

    function animateScroll(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / scrollDuration, 1);
      const ease = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startScroll + (targetScroll - startScroll) * ease);
      if (progress < 1) requestAnimationFrame(animateScroll);
    }
    requestAnimationFrame(animateScroll);
  }, 450);

  setTimeout(() => {
    cursor.style.transition = "top 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease-out";
    cursor.style.top = (isDown ? window.innerHeight + 60 : -60) + "px";
    cursor.style.opacity = "0";
  }, 450 + scrollDuration + 200);

  setTimeout(() => {
    cursor.remove();
  }, 450 + scrollDuration + 700);
}

let idleInterval: ReturnType<typeof setInterval> | null = null;

export function startIdleCursor(baseX: number, baseY: number): void {
  stopIdleCursor();

  const cursor = document.createElement("div");
  cursor.id = "phantom-idle-cursor";
  cursor.innerHTML = `
    <div style="
      width:48px; height:48px; border-radius:24px;
      background:rgba(66,133,244,0.1);
      border:2px solid rgba(66,133,244,0.3);
      transform:translate(-50%,-50%);
    "></div>
  `;
  cursor.style.cssText = `
    position:fixed; z-index:2147483646; pointer-events:none;
    left:${baseX}px; top:${baseY}px;
    transition:left 0.8s ease-in-out, top 0.8s ease-in-out, opacity 1s ease-in-out;
    opacity:0;
  `;

  document.body.appendChild(cursor);

  requestAnimationFrame(() => {
    cursor.style.opacity = "0.6";
  });

  let t = 0;
  idleInterval = setInterval(() => {
    t += 0.3;
    const nx = baseX + Math.sin(t * 0.7) * 12 + Math.cos(t * 1.3) * 6;
    const ny = baseY + Math.cos(t * 0.5) * 10 + Math.sin(t * 1.1) * 5;
    cursor.style.left = nx + "px";
    cursor.style.top = ny + "px";
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
