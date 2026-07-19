export const API_ORIGIN = "https://api.dentograph.site";
export const API_BASE_URL = `${API_ORIGIN}/api`;
export const WEB_APP_ORIGIN = "https://dentograph.site";
export const API_TIMEOUT_MS = 20000;

export const normalizeApiPath = (path = "") => {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return "";
  }

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    return normalizedPath;
  }

  return normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
};

export const buildApiUrl = (path = "") => {
  const normalizedPath = normalizeApiPath(path);

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    return normalizedPath;
  }

  return `${API_BASE_URL}${normalizedPath}`;
};

export const buildFileUrl = (filePath) => {
  if (!filePath) return null;

  const normalizedPath = String(filePath).replace(/\\/g, "/").trim();

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    return normalizedPath;
  }

  const pathWithSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return `${API_ORIGIN}${pathWithSlash}`;
};

// For local backend testing on a physical phone, do not use localhost.
// Use your computer's local IPv4 address instead, for example:
// export const API_ORIGIN = "http://192.168.1.10:5000";