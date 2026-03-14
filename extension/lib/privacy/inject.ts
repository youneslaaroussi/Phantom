export const BLUR_SENSITIVE_SCRIPT = () => {
  var ATTR = "data-phantom-blurred";
  var OVERLAY_CLASS = "phantom-shield-overlay";
  var ANIM_ID = "phantom-shield-keyframes";
  var count = 0;

  if (!document.getElementById(ANIM_ID)) {
    var styleEl = document.createElement("style");
    styleEl.id = ANIM_ID;
    styleEl.textContent = "";
    document.head.appendChild(styleEl);
  }

  var sels = [
    'input[type="password"]',
    'input[autocomplete="cc-number"]',
    'input[autocomplete="cc-exp"]',
    'input[autocomplete="cc-csc"]',
    'input[autocomplete="new-password"]',
    'input[autocomplete="current-password"]',
  ];

  var namePatterns = [
    /ssn/i, /social.?security/i, /password/i, /passwd/i,
    /secret/i, /token/i, /api.?key/i, /credit.?card/i,
    /cvv/i, /cvc/i, /pin/i,
  ];

  var textPatterns = [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    /\d{4}\d{4}\d{4}\d{4}/,
    /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/,
    /3[47]\d{2}\d{6}\d{5}/,
    /\b3[068]\d{2}[\s-]?\d{6}[\s-]?\d{4}\b/,
    /3[068]\d{2}\d{6}\d{4}/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /AIza[0-9A-Za-z_-]{35}/,
    /sk-[a-zA-Z0-9_-]{20,}/,
    /sk_[a-zA-Z0-9_]{20,}/,
    /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
  ];

  var seen = new Set();

  function blur(el) {
    if (seen.has(el) || el.getAttribute(ATTR)) return;
    seen.add(el);
    el.setAttribute(ATTR, el.style.cssText || "");
    var pos = getComputedStyle(el).position;
    if (pos === "static") el.style.position = "relative";
    var ov = document.createElement("div");
    ov.className = OVERLAY_CLASS;
    ov.style.cssText =
      "position:absolute;inset:0;border-radius:4px;pointer-events:none;z-index:2147483647;" +
      "background:#111;";
    var label = document.createElement("div");
    label.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;" +
      "color:#ef4444;white-space:nowrap;";
    label.textContent = "REDACTED";
    ov.appendChild(label);
    el.appendChild(ov);
    count++;
  }

  for (var i = 0; i < sels.length; i++) {
    var els = document.querySelectorAll(sels[i]);
    for (var j = 0; j < els.length; j++) blur(els[j]);
  }

  var inputs = document.querySelectorAll("input, textarea");
  for (var i = 0; i < inputs.length; i++) {
    var n = (inputs[i].getAttribute("name") || "") + (inputs[i].getAttribute("id") || "");
    for (var k = 0; k < namePatterns.length; k++) {
      if (namePatterns[k].test(n)) { blur(inputs[i]); break; }
    }
  }

  function matchesPatterns(txt) {
    for (var k = 0; k < textPatterns.length; k++) {
      if (textPatterns[k].test(txt)) return true;
    }
    return false;
  }

  function findSmallestMatch(el) {
    var skip = { SCRIPT: 1, STYLE: 1, SVG: 1, NOSCRIPT: 1 };
    if (skip[el.tagName]) return;
    var txt = (el.textContent || "").replace(/\s+/g, "");
    if (txt.length < 8 || !matchesPatterns(txt)) return;
    var children = el.children;
    var childMatched = false;
    for (var i = 0; i < children.length; i++) {
      var ct = (children[i].textContent || "").replace(/\s+/g, "");
      if (ct.length >= 8 && matchesPatterns(ct)) {
        findSmallestMatch(children[i]);
        childMatched = true;
      }
    }
    if (!childMatched) blur(el);
  }

  findSmallestMatch(document.body);

  return count;
};

export const UNBLUR_SCRIPT = () => {
  var ATTR = "data-phantom-blurred";
  var OVERLAY_CLASS = "phantom-shield-overlay";
  var ANIM_ID = "phantom-shield-keyframes";
  var els = document.querySelectorAll("[" + ATTR + "]");
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var overlays = el.querySelectorAll("." + OVERLAY_CLASS);
    for (var j = 0; j < overlays.length; j++) overlays[j].remove();
    el.style.cssText = el.getAttribute(ATTR) || "";
    el.removeAttribute(ATTR);
  }
  var animStyle = document.getElementById(ANIM_ID);
  if (animStyle) animStyle.remove();
};
