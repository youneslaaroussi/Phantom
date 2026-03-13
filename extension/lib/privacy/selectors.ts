export const SENSITIVE_INPUT_SELECTORS = [
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

export const SENSITIVE_NAME_PATTERNS = [
  /ssn/i,
  /social.?security/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api.?key/i,
  /routing.?number/i,
  /account.?number/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /pin/i,
];

export const SENSITIVE_ARIA_PATTERNS = [
  /password/i,
  /secret/i,
  /credit.?card/i,
  /social.?security/i,
  /security.?code/i,
];

export const LOGIN_FORM_PATTERNS = [
  /login/i,
  /signin/i,
  /sign.?in/i,
  /auth/i,
  /payment/i,
  /checkout/i,
];
