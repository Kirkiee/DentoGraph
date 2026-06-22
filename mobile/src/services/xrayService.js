import { API_BASE_URL } from "../config/api";

const API_HOST_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const buildXrayFileUrl = (filePath) => {
  if (!filePath) return null;

  const normalizedPath = String(filePath).replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://")
  ) {
    return normalizedPath;
  }

  const pathWithSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return `${API_HOST_URL}${pathWithSlash}`;
};

export const getXraysByRecord = async ({ token, recordId }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/record/${recordId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("XRAYS BY RECORD STATUS:", response.status);
  console.log("XRAYS BY RECORD RAW RESPONSE:", text.slice(0, 1000));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-rays.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load X-rays.");
  }

  return data;
};

export const getXrayById = async ({ token, xrayId }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/${xrayId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("XRAY DETAIL STATUS:", response.status);
  console.log("XRAY DETAIL RAW RESPONSE:", text.slice(0, 1000));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-ray detail.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load X-ray.");
  }

  return data;
};

export const getXrayAnnotations = async ({ token, xrayId }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/${xrayId}/annotations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("XRAY ANNOTATIONS STATUS:", response.status);
  console.log("XRAY ANNOTATIONS RAW RESPONSE:", text.slice(0, 1000));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-ray annotations.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load X-ray annotations.",
    );
  }

  return data;
};