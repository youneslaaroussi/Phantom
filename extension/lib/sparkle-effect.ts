/**
 * Sparkle Effect — white sparkles that burst across the screen
 * when vision or tab audio is toggled on.
 *
 * Pure CSS animations, no canvas needed.
 */

const SPARKLE_COUNT = 18;
const SPARKLE_DURATION = 1200; // ms

/**
 * Burst sparkles from a point (or spread across the container).
 */
export function playSparkles(
  container: HTMLElement,
  options?: { originX?: number; originY?: number; color?: string }
): void {
  const { originX, originY, color = "#fff" } = options || {};
  const rect = container.getBoundingClientRect();
  const cx = originX ?? rect.width / 2;
  const cy = originY ?? rect.height / 2;

  // Inject keyframes if not already present
  if (!document.getElementById("phantom-sparkle-keyframes")) {
    const style = document.createElement("style");
    style.id = "phantom-sparkle-keyframes";
    style.textContent = `
      @keyframes phantomSparkle {
        0% { transform: translate(0,0) scale(0); opacity: 1; }
        50% { opacity: 1; }
        100% { transform: translate(var(--sx), var(--sy)) scale(0); opacity: 0; }
      }
      @keyframes phantomSparkleGlow {
        0% { transform: scale(0); opacity: 0.6; }
        50% { transform: scale(1.5); opacity: 0.3; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:50; overflow:hidden;
  `;

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / SPARKLE_COUNT + (Math.random() - 0.5) * 0.5;
    const dist = 40 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = 2 + Math.random() * 4;
    const delay = Math.random() * 200;

    const sparkle = document.createElement("div");
    sparkle.style.cssText = `
      position:absolute;
      left:${cx}px; top:${cy}px;
      width:${size}px; height:${size}px;
      border-radius:50%;
      background:${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      --sx:${dx}px; --sy:${dy}px;
      animation: phantomSparkle ${SPARKLE_DURATION}ms ${delay}ms ease-out forwards;
    `;
    wrapper.appendChild(sparkle);
  }

  // Central glow burst
  const glow = document.createElement("div");
  glow.style.cssText = `
    position:absolute;
    left:${cx - 20}px; top:${cy - 20}px;
    width:40px; height:40px;
    border-radius:50%;
    background:radial-gradient(circle, ${color}44 0%, transparent 70%);
    animation: phantomSparkleGlow ${SPARKLE_DURATION}ms ease-out forwards;
  `;
  wrapper.appendChild(glow);

  container.appendChild(wrapper);

  setTimeout(() => wrapper.remove(), SPARKLE_DURATION + 300);
}
