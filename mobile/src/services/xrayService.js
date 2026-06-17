import { API_BASE_URL } from "../config/api";

const API_HOST_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const buildXrayFileUrl = (filePath) => {
  if (!filePath) return null;

  if (String(filePath).startsWith("http://") || String(filePath).startsWith("https://")) {
    return filePath;
  }

  const normalizedPath = String(filePath).startsWith("/")
    ? filePath
    : `/${filePath}`;

  return `${API_HOST_URL}${normalizedPath}`;
};

export const getXraysByRecord = async ({ token, record_id }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/record/${record_id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("XRAYS BY RECORD STATUS:", response.status);
  console.log("XRAYS BY RECORD RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-rays.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load X-rays");
  }

  return data;
};

export const getSingleXray = async ({ token, xray_id }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/${xray_id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("SINGLE XRAY STATUS:", response.status);
  console.log("SINGLE XRAY RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-ray details.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load X-ray");
  }

  return data;
};

export const getXrayAnnotations = async ({ token, xray_id }) => {
  const response = await fetch(`${API_BASE_URL}/xrays/${xray_id}/annotations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("XRAY ANNOTATIONS STATUS:", response.status);
  console.log("XRAY ANNOTATIONS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for X-ray annotations.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load X-ray annotations"
    );
  }

  return data;
};