// Friendly client-side checks. They save a round trip, but the server validates everything again.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value) {
  if (!value.trim()) return "Enter your email address.";
  return EMAIL_PATTERN.test(value.trim()) ? "" : "Enter a valid email address.";
}

export function validatePassword(value) {
  if (!value) return "Enter a password.";
  if (value.length < 10) return "Use at least 10 characters.";
  if (value.length > 128) return "Use at most 128 characters.";
  return "";
}

export function required(value, label = "This field") {
  return String(value ?? "").trim() ? "" : `${label} is required.`;
}

export function minLength(value, min, label = "This field") {
  return String(value ?? "").trim().length >= min ? "" : `${label} needs at least ${min} characters.`;
}

export function validateUrl(value) {
  if (!value || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? "" : "Use a link starting with http:// or https://";
  } catch {
    return "Use a link starting with http:// or https://";
  }
}

// Runs { field: () => "error" or "" } checks and returns only the failures.
export function collectErrors(checks) {
  return Object.fromEntries(Object.entries(checks).map(([k, fn]) => [k, fn()]).filter(([, msg]) => msg));
}

// Only allow redirects to pages inside this app (stops "open redirect" tricks).
export function safeRedirect(path, fallback = "/dashboard") {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : fallback;
}

export function splitList(text) {
  return String(text || "").split(",").map((s) => s.trim()).filter(Boolean);
}
