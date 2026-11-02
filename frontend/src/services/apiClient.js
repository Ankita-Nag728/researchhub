import axios from "axios";

// One configured Axios instance for the whole app.
// - withCredentials: sends the HttpOnly session cookie automatically.
// - CSRF: for unsafe methods we copy the readable csrf_token cookie into a header.
//   The backend compares the two, so a malicious site cannot forge requests.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  withCredentials: true,
  timeout: 15000,
});

const SAFE_METHODS = ["get", "head", "options"];

function readCookie(name) {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

// Anonymous visitors have no CSRF token yet, so the first write asks the server for one.
api.interceptors.request.use(async (config) => {
  if (!SAFE_METHODS.includes((config.method || "get").toLowerCase())) {
    let token = readCookie("csrf_token");
    if (!token) {
      await axios.get(`${api.defaults.baseURL}/auth/csrf`, { withCredentials: true });
      token = readCookie("csrf_token");
    }
    if (token) config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

// Turn any failure into a small, predictable error object the UI can show.
export function toApiError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const detail = data?.detail;
    let message = "Something went wrong. Please try again.";
    let fieldErrors = {};
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      // FastAPI validation errors: [{ loc: [..., "field"], msg: "..." }]
      message = "Please check the highlighted fields.";
      detail.forEach((item) => {
        const field = item.loc?.[item.loc.length - 1];
        if (field && !(field in fieldErrors)) fieldErrors[field] = item.msg;
      });
    }
    return { status, message, fieldErrors, isNetwork: false };
  }
  if (error.code === "ECONNABORTED") {
    return { status: 0, message: "The request timed out. Please try again.", fieldErrors: {}, isNetwork: true };
  }
  return {
    status: 0,
    message: "Cannot reach the server. Check your connection and try again.",
    fieldErrors: {},
    isNetwork: true,
  };
}

export default api;
