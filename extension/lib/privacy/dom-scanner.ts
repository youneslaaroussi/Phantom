import {
  SENSITIVE_INPUT_SELECTORS,
  SENSITIVE_NAME_PATTERNS,
  SENSITIVE_ARIA_PATTERNS,
  LOGIN_FORM_PATTERNS,
} from "./selectors";
import { PII_PATTERNS } from "./patterns";

export interface SensitiveMatch {
  element: Element;
  reason: string;
}

export function findSensitiveInputs(doc: Document): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];
  const seen = new Set<Element>();

  for (const sel of SENSITIVE_INPUT_SELECTORS) {
    for (const el of doc.querySelectorAll(sel)) {
      if (!seen.has(el)) {
        seen.add(el);
        matches.push({ element: el, reason: `selector:${sel}` });
      }
    }
  }

  for (const input of doc.querySelectorAll("input, textarea")) {
    if (seen.has(input)) continue;
    const name = (input.getAttribute("name") || "") + (input.getAttribute("id") || "");
    for (const pat of SENSITIVE_NAME_PATTERNS) {
      if (pat.test(name)) {
        seen.add(input);
        matches.push({ element: input, reason: `name:${pat.source}` });
        break;
      }
    }
  }

  for (const el of doc.querySelectorAll("[aria-label]")) {
    if (seen.has(el)) continue;
    const label = el.getAttribute("aria-label") || "";
    for (const pat of SENSITIVE_ARIA_PATTERNS) {
      if (pat.test(label)) {
        seen.add(el);
        matches.push({ element: el, reason: `aria:${pat.source}` });
        break;
      }
    }
  }

  for (const form of doc.querySelectorAll("form")) {
    const action = form.getAttribute("action") || "";
    const isLogin = LOGIN_FORM_PATTERNS.some((p) => p.test(action));
    if (isLogin) {
      for (const input of form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input:not([type])')) {
        if (!seen.has(input)) {
          seen.add(input);
          matches.push({ element: input, reason: `login_form` });
        }
      }
    }
  }

  return matches;
}

export function findSensitiveTextNodes(doc: Document): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    if (text.length < 8) continue;

    const parent = node.parentElement;
    if (!parent) continue;
    if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue;

    for (const { name, regex } of PII_PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(text)) {
        matches.push({ element: parent, reason: `text:${name}` });
        break;
      }
    }
  }

  return matches;
}
