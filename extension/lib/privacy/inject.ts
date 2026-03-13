export const BLUR_SENSITIVE_SCRIPT = () => {
  var ATTR = "data-phantom-blurred";
  var STYLE = "filter:blur(8px) !important;user-select:none !important;";
  var count = 0;

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
    /\b\d{3}-\d{2}-\d{4}\b/,
    /AIza[0-9A-Za-z_-]{35}/,
    /sk-[a-zA-Z0-9_-]{20,}/,
    /sk_[a-zA-Z0-9]{20,}/,
    /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
  ];

  var seen = new Set();

  function blur(el) {
    if (seen.has(el) || el.getAttribute(ATTR)) return;
    seen.add(el);
    el.setAttribute(ATTR, el.style.cssText || "");
    el.style.cssText += STYLE;
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

  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    var txt = node.textContent || "";
    if (txt.length < 8) continue;
    var p = node.parentElement;
    if (!p || p.tagName === "SCRIPT" || p.tagName === "STYLE") continue;
    for (var k = 0; k < textPatterns.length; k++) {
      if (textPatterns[k].test(txt)) { blur(p); break; }
    }
  }

  return count;
};

export const UNBLUR_SCRIPT = () => {
  var ATTR = "data-phantom-blurred";
  var els = document.querySelectorAll("[" + ATTR + "]");
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    el.style.cssText = el.getAttribute(ATTR) || "";
    el.removeAttribute(ATTR);
  }
};
