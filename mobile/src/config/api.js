export const API_ORIGIN = "https://api.dentograph.site";
export const WEB_APP_ORIGIN = "https://dentograph.site";
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const API_TIMEOUT_MS = 20000;

export const buildApiUrl = (path = "") => {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const withoutLeadingSlash = normalizedPath.replace(/^\/+/, "");
  const withoutDuplicateApi = withoutLeadingSlash.replace(/^api\/+/, "");

  return `${API_BASE_URL}/${withoutDuplicateApi}`;
};

export const buildFileUrl = (path = "") => {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  return `${API_ORIGIN}/${normalizedPath.replace(/^\/+/, "")}`;
};

// For local backend testing on a physical phone, replace API_ORIGIN with
// the computer's LAN address. Do not use localhost from the phone.
// Example: http://192.168.1.10:5000