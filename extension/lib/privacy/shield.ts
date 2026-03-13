import { findSensitiveInputs, findSensitiveTextNodes } from "./dom-scanner";
import { applyBlur, removeBlur } from "./blur";

export function blurSensitiveContent(doc: Document): number {
  const inputs = findSensitiveInputs(doc);
  const text = findSensitiveTextNodes(doc);
  const all = [...inputs, ...text];
  const unique = [...new Set(all.map((m) => m.element))];
  applyBlur(unique);
  return unique.length;
}

export function unblurAll(doc: Document): void {
  removeBlur(doc);
}

export { findSensitiveInputs, findSensitiveTextNodes } from "./dom-scanner";
export { applyBlur, removeBlur } from "./blur";
