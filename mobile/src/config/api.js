export const API_BASE_URL = "https://api.dentograph.site/api";
export const WEB_APP_ORIGIN = "https://dentograph.site";

export const buildFileUrl = (filePath) => {
  if (!filePath) return null;

  const normalizedPath = String(filePath).replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    return normalizedPath;
  }

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  const pathWithSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return `${apiOrigin}${pathWithSlash}`;
};

// For local backend testing on your phone, do not use localhost.
// Use your computer's local IP instead, for example:
// export const API_BASE_URL = "http://192.168.1.10:5000/api";