const BLUR_ATTR = "data-phantom-blurred";
const BLUR_STYLE = "position:relative !important;";

export function applyBlur(elements: Element[]): void {
  for (const el of elements) {
    if (el.getAttribute(BLUR_ATTR)) continue;
    const htmlEl = el as HTMLElement;
    el.setAttribute(BLUR_ATTR, htmlEl.style.cssText || "");
    htmlEl.style.cssText += BLUR_STYLE;
  }
}

export function removeBlur(doc: Document): void {
  for (const el of doc.querySelectorAll(`[${BLUR_ATTR}]`)) {
    const htmlEl = el as HTMLElement;
    const prev = el.getAttribute(BLUR_ATTR) || "";
    htmlEl.style.cssText = prev;
    el.removeAttribute(BLUR_ATTR);
  }
}
