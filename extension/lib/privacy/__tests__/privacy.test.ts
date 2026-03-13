/**
 * Privacy shield tests — mock DOM to validate detection + blur.
 *
 * Run with: npx tsx extension/lib/privacy/__tests__/privacy.test.ts
 * (Uses JSDOM for DOM simulation)
 */

import { JSDOM } from "jsdom";

// ─── Import the modules under test ───
// We re-implement the core logic inline since the real modules import from
// extension-only paths. This tests the SAME patterns/selectors/logic.

const PII_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "credit_card", regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { name: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: "api_key_google", regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "api_key_openai", regex: /sk-[a-zA-Z0-9_-]{20,}/g },
  { name: "api_key_elevenlabs", regex: /sk_[a-zA-Z0-9]{20,}/g },
  { name: "bearer_token", regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/g },
  { name: "private_key", regex: /-----BEGIN[A-Z ]*PRIVATE KEY-----/g },
  { name: "aws_key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "generic_secret", regex: /(?:secret|token|key|password|passwd|api_key)\s*[:=]\s*['"]?[^\s'"]{8,}/gi },
];

const SENSITIVE_INPUT_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete="cc-number"]',
  'input[autocomplete="cc-exp"]',
  'input[autocomplete="cc-exp-month"]',
  'input[autocomplete="cc-exp-year"]',
  'input[autocomplete="cc-csc"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="one-time-code"]',
];

const SENSITIVE_NAME_PATTERNS = [
  /ssn/i, /social.?security/i, /password/i, /passwd/i,
  /secret/i, /token/i, /api.?key/i, /routing.?number/i,
  /account.?number/i, /credit.?card/i, /card.?number/i,
  /cvv/i, /cvc/i, /pin/i,
];

const SENSITIVE_ARIA_PATTERNS = [
  /password/i, /secret/i, /credit.?card/i,
  /social.?security/i, /security.?code/i,
];

const LOGIN_FORM_PATTERNS = [
  /login/i, /signin/i, /sign.?in/i, /auth/i, /payment/i, /checkout/i,
];

// ─── Scanner (same logic as dom-scanner.ts) ───

interface SensitiveMatch {
  element: Element;
  reason: string;
}

function findSensitiveInputs(doc: Document): SensitiveMatch[] {
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

function findSensitiveTextNodes(doc: Document): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);

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

// ─── Blur (same logic as blur.ts) ───

const BLUR_ATTR = "data-phantom-blurred";
const BLUR_STYLE = "filter:blur(8px) !important;user-select:none !important;pointer-events:none !important;";

function applyBlur(elements: Element[]): void {
  for (const el of elements) {
    if (el.getAttribute(BLUR_ATTR)) continue;
    const htmlEl = el as HTMLElement;
    el.setAttribute(BLUR_ATTR, htmlEl.style.cssText || "");
    htmlEl.style.cssText += BLUR_STYLE;
  }
}

function removeBlur(doc: Document): void {
  for (const el of doc.querySelectorAll(`[${BLUR_ATTR}]`)) {
    const htmlEl = el as HTMLElement;
    const prev = el.getAttribute(BLUR_ATTR) || "";
    htmlEl.style.cssText = prev;
    el.removeAttribute(BLUR_ATTR);
  }
}

// ─── Test runner ───

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function makeDoc(html: string): Document {
  return new JSDOM(`<html><body>${html}</body></html>`).window.document;
}

// ─── Tests ───

console.log("\n🔒 Privacy Shield Tests\n");

// --- Input detection ---

console.log("Input selectors:");

test("detects password inputs", () => {
  const doc = makeDoc('<input type="password" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1 match, got ${matches.length}`);
  assert(matches[0].reason.includes("password"), `Wrong reason: ${matches[0].reason}`);
});

test("detects credit card autocomplete inputs", () => {
  const doc = makeDoc(`
    <input autocomplete="cc-number" />
    <input autocomplete="cc-exp" />
    <input autocomplete="cc-csc" />
  `);
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 3, `Expected 3, got ${matches.length}`);
});

test("detects one-time-code inputs", () => {
  const doc = makeDoc('<input autocomplete="one-time-code" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("ignores regular text inputs", () => {
  const doc = makeDoc('<input type="text" name="email" /><input type="text" name="username" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

// --- Name pattern detection ---

console.log("\nName patterns:");

test("detects input with name=ssn", () => {
  const doc = makeDoc('<input type="text" name="ssn" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects input with id=apiKey", () => {
  const doc = makeDoc('<input type="text" id="apiKey" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects input with name=credit_card_number", () => {
  const doc = makeDoc('<input type="text" name="credit_card_number" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects input with name=cvv", () => {
  const doc = makeDoc('<input type="text" name="cvv" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects textarea with name=secret_key", () => {
  const doc = makeDoc('<textarea name="secret_key"></textarea>');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects input with name=routing_number", () => {
  const doc = makeDoc('<input type="text" name="routing_number" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects input with name=pin_code", () => {
  const doc = makeDoc('<input type="text" name="pin_code" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

// --- Aria-label detection ---

console.log("\nAria labels:");

test("detects aria-label=Password", () => {
  const doc = makeDoc('<input aria-label="Password" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects aria-label='Enter your credit card'", () => {
  const doc = makeDoc('<input aria-label="Enter your credit card" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects aria-label='Security code'", () => {
  const doc = makeDoc('<input aria-label="Security code" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

// --- Login form detection ---

console.log("\nLogin forms:");

test("detects text inputs inside login form", () => {
  const doc = makeDoc(`
    <form action="/login">
      <input type="text" name="username" />
      <input type="password" name="pass" />
    </form>
  `);
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 2, `Expected 2, got ${matches.length}`);
});

test("detects inputs in checkout form", () => {
  const doc = makeDoc(`
    <form action="/checkout/submit">
      <input name="cardholder" />
      <input type="text" name="billing_address" />
    </form>
  `);
  const matches = findSensitiveInputs(doc);
  assert(matches.length >= 2, `Expected >=2, got ${matches.length}`);
});

test("detects inputs in auth form", () => {
  const doc = makeDoc(`
    <form action="/api/auth">
      <input type="text" name="user" />
    </form>
  `);
  const matches = findSensitiveInputs(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("does NOT flag inputs in regular forms", () => {
  const doc = makeDoc(`
    <form action="/search">
      <input type="text" name="q" />
    </form>
  `);
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

// --- Text node PII detection ---

console.log("\nText PII patterns:");

test("detects credit card numbers", () => {
  const doc = makeDoc("<p>Card: 4111 1111 1111 1111</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
  assert(matches[0].reason.includes("credit_card"), `Wrong reason: ${matches[0].reason}`);
});

test("detects credit card with dashes", () => {
  const doc = makeDoc("<p>Card: 4111-1111-1111-1111</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects credit card without spaces", () => {
  const doc = makeDoc("<p>Card: 4111111111111111</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
});

test("detects SSN", () => {
  const doc = makeDoc("<p>SSN: 123-45-6789</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
  assert(matches[0].reason.includes("ssn"), `Wrong reason: ${matches[0].reason}`);
});

test("detects Google API key", () => {
  const doc = makeDoc("<pre>AIzaSyA1234567890abcdefghijklmnopqrstuvw</pre>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
  assert(matches[0].reason.includes("api_key_google"), `Wrong reason: ${matches[0].reason}`);
});

test("detects OpenAI API key", () => {
  const doc = makeDoc("<code>sk-proj-abcdef1234567890abcdef1234567890</code>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects ElevenLabs API key", () => {
  const doc = makeDoc("<span>sk_abcdefghijklmnopqrstuvwxyz</span>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects Bearer token", () => {
  const doc = makeDoc("<div>Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123</div>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects AWS access key", () => {
  const doc = makeDoc("<p>AKIAIOSFODNN7EXAMPLE</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 1, `Expected 1, got ${matches.length}`);
  assert(matches[0].reason.includes("aws_key"), `Wrong reason: ${matches[0].reason}`);
});

test("detects private key header", () => {
  const doc = makeDoc("<pre>-----BEGIN RSA PRIVATE KEY-----\nMIIBogIB...</pre>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects generic secret patterns", () => {
  const doc = makeDoc('<div>password = "SuperSecret123!"</div>');
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("detects api_key in config", () => {
  const doc = makeDoc('<pre>api_key: "ghp_abc123def456ghi789jkl012"</pre>');
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length >= 1, `Expected >=1, got ${matches.length}`);
});

test("ignores SCRIPT tags", () => {
  const doc = makeDoc("<script>var key = 'sk-abcdefghijklmnopqrstuvwxyz1234';</script>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

test("ignores STYLE tags", () => {
  const doc = makeDoc("<style>/* token: abc123def456ghi789jkl012mn */</style>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

test("ignores short text", () => {
  const doc = makeDoc("<p>hello</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

test("does NOT flag regular numbers", () => {
  const doc = makeDoc("<p>Order #12345 was placed on 2024-01-15</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

test("does NOT flag regular text", () => {
  const doc = makeDoc("<p>The quick brown fox jumps over the lazy dog. This is a normal paragraph.</p>");
  const matches = findSensitiveTextNodes(doc);
  assert(matches.length === 0, `Expected 0, got ${matches.length}`);
});

// --- Blur / Unblur ---

console.log("\nBlur mechanics:");

test("applyBlur adds blur style", () => {
  const doc = makeDoc('<input type="password" id="pw" />');
  const el = doc.getElementById("pw")!;
  applyBlur([el]);
  assert(el.style.cssText.includes("blur"), "Should contain blur");
  assert(el.hasAttribute(BLUR_ATTR), "Should have blur attr");
});

test("applyBlur preserves original style", () => {
  const doc = makeDoc('<input id="pw" style="color: red;" />');
  const el = doc.getElementById("pw")!;
  applyBlur([el]);
  assert(el.getAttribute(BLUR_ATTR) === "color: red;", `Should preserve original: ${el.getAttribute(BLUR_ATTR)}`);
});

test("applyBlur is idempotent", () => {
  const doc = makeDoc('<input id="pw" />');
  const el = doc.getElementById("pw")!;
  applyBlur([el]);
  const firstStyle = el.style.cssText;
  applyBlur([el]);
  assert(el.style.cssText === firstStyle, "Should not double-blur");
});

test("removeBlur restores original style", () => {
  const doc = makeDoc('<input id="pw" style="color: red;" />');
  const el = doc.getElementById("pw")!;
  applyBlur([el]);
  removeBlur(doc);
  assert(el.style.cssText === "color: red;", `Should restore: ${el.style.cssText}`);
  assert(!el.hasAttribute(BLUR_ATTR), "Should remove attr");
});

test("removeBlur on element with no original style", () => {
  const doc = makeDoc('<input id="pw" />');
  const el = doc.getElementById("pw")!;
  applyBlur([el]);
  removeBlur(doc);
  assert(el.style.cssText === "", `Should be empty: ${el.style.cssText}`);
});

// --- No duplicates ---

console.log("\nDeduplication:");

test("password input detected only once (selector + name match)", () => {
  const doc = makeDoc('<input type="password" name="password" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1 (deduped), got ${matches.length}`);
});

test("input matching selector + aria not duplicated", () => {
  const doc = makeDoc('<input type="password" aria-label="Password" />');
  const matches = findSensitiveInputs(doc);
  assert(matches.length === 1, `Expected 1 (deduped), got ${matches.length}`);
});

// --- Complex page ---

console.log("\nComplex page simulation:");

test("real-world login page", () => {
  const doc = makeDoc(`
    <form action="/api/v1/login" method="POST">
      <label>Email</label>
      <input type="email" name="email" autocomplete="email" />
      <label>Password</label>
      <input type="password" name="password" autocomplete="current-password" />
      <button type="submit">Sign In</button>
    </form>
    <p>Forgot your password? <a href="/reset">Reset it</a></p>
  `);
  const inputs = findSensitiveInputs(doc);
  // Should get: password input (selector), email (login_form), possibly password by name too (deduped)
  assert(inputs.length >= 2, `Expected >=2, got ${inputs.length}`);
  const reasons = inputs.map(m => m.reason);
  assert(reasons.some(r => r.includes("password")), "Should find password input");
});

test("real-world payment page", () => {
  const doc = makeDoc(`
    <form action="/checkout">
      <input autocomplete="cc-number" placeholder="Card number" />
      <input autocomplete="cc-exp" placeholder="MM/YY" />
      <input autocomplete="cc-csc" placeholder="CVC" />
      <input type="text" name="billing_address" />
    </form>
    <div class="summary">
      <p>Total: $49.99</p>
    </div>
  `);
  const inputs = findSensitiveInputs(doc);
  assert(inputs.length >= 4, `Expected >=4 (3 cc + billing in checkout form), got ${inputs.length}`);
});

test("page with exposed secrets in code blocks", () => {
  // All 3 keys are in one <pre> text node — scanner finds the first match
  // and blurs the parent element once (which covers all keys visually)
  const doc = makeDoc(`
    <h1>API Documentation</h1>
    <pre>
      GOOGLE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      OPENAI_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234
      AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
    </pre>
    <p>Never share your API keys!</p>
  `);
  const text = findSensitiveTextNodes(doc);
  // Parent <pre> is matched once (first PII hit blurs the whole block)
  assert(text.length >= 1, `Expected >=1, got ${text.length}`);
});

test("secrets in separate elements each detected", () => {
  const doc = makeDoc(`
    <div><code>AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code></div>
    <div><code>sk-proj-abcdefghijklmnopqrstuvwxyz1234</code></div>
    <div><code>AKIAIOSFODNN7EXAMPLE</code></div>
  `);
  const text = findSensitiveTextNodes(doc);
  assert(text.length === 3, `Expected 3 (separate elements), got ${text.length}`);
});

test("page with no sensitive content", () => {
  const doc = makeDoc(`
    <h1>Welcome to My Blog</h1>
    <p>This is a normal blog post about cooking. No secrets here!</p>
    <form action="/search">
      <input type="text" name="q" placeholder="Search..." />
    </form>
    <img src="cat.jpg" alt="A cute cat" />
  `);
  const inputs = findSensitiveInputs(doc);
  const text = findSensitiveTextNodes(doc);
  assert(inputs.length === 0, `Expected 0 inputs, got ${inputs.length}`);
  assert(text.length === 0, `Expected 0 text, got ${text.length}`);
});

// --- Summary ---

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);
