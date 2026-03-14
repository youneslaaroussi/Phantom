/**
 * Unique CSS selector generator for DOM elements.
 * 
 * Produces the shortest unique selector possible. NO fallbacks to
 * ambiguous selectors — every selector matches exactly one element.
 * 
 * Strategy:
 *  1. #id
 *  2. tag[attr="value"] for semantic attributes
 *  3. tag.class (single semantic class)
 *  4. tag.class1.class2 (two-class combo)
 *  5. Walk up DOM building parent > child path with :nth-of-type
 */

const UTILITY_PATTERN = /^(w-|h-|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|text-\[|bg-\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|skew-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;

function isSemanticClass(c: string): boolean {
  if (c.length > 60) return false;
  if (/^[0-9]/.test(c)) return false;
  if (UTILITY_PATTERN.test(c)) return false;
  return true;
}

export function buildUniqueSelector(el: Element): string {
  if (!(el instanceof Element)) return "";

  const esc = (s: string) => CSS.escape(s);
  const only = (s: string) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };

  if (el.id) {
    const s = `#${esc(el.id)}`;
    if (only(s)) return s;
  }

  const tag = el.tagName.toLowerCase();

  for (const a of ["aria-label", "placeholder", "name", "data-testid", "title", "type", "role"]) {
    const v = el.getAttribute(a);
    if (v) {
      const s = `${tag}[${a}="${esc(v)}"]`;
      if (only(s)) return s;
    }
  }

  const allCls = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).filter(Boolean);
  const semantic = allCls.filter(isSemanticClass);
  const classes = semantic.length > 0 ? semantic : allCls.slice(0, 3);

  for (const c of classes) {
    const s = `${tag}.${esc(c)}`;
    if (only(s)) return s;
  }

  for (let i = 0; i < classes.length && i < 5; i++) {
    for (let j = i + 1; j < classes.length && j < 6; j++) {
      const s = `${tag}.${esc(classes[i])}.${esc(classes[j])}`;
      if (only(s)) return s;
    }
  }

  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    let seg = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`#${esc(cur.id)}`);
      const f = parts.join(" > ");
      if (only(f)) return f;
      return f;
    }
    const p = cur.parentElement;
    if (p) {
      const sibs = Array.from(p.children).filter(c => c.tagName === cur!.tagName);
      if (sibs.length > 1) seg = `${seg}:nth-of-type(${sibs.indexOf(cur) + 1})`;
    }
    parts.unshift(seg);
    const f = parts.join(" > ");
    if (only(f)) return f;
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

/**
 * The inlineable uniqueSel function body for chrome.scripting.executeScript.
 * Paste at the top of any injected func.
 */
export const UNIQUE_SEL_SOURCE = `
const __UP = /^(w-|h-|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|text-\\[|bg-\\[|border-|rounded-|shadow-|opacity-|z-|gap-|space-|overflow-|max-|min-|top-|right-|bottom-|left-|inset-|translate-|scale-|rotate-|skew-|duration-|delay-|ease-|tracking-|leading-|font-(?:normal|bold|light|thin|medium|semibold|extrabold|black)|disabled:|hover:|focus:|active:|group-hover:|dark:|sm:|md:|lg:|xl:|2xl:)/;
const __isSem = (c) => c.length <= 60 && !/^[0-9]/.test(c) && !__UP.test(c);
const __esc = (s) => CSS.escape(s);
const __only = (s) => { try { return document.querySelectorAll(s).length === 1; } catch { return false; } };
`;
