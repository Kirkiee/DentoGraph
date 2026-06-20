import { API_BASE_URL } from "../config/api";

const API_HOST_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export const buildARSimulationImageUrl = (imagePath) => {
  if (!imagePath) return null;

  if (
    String(imagePath).startsWith("http://") ||
    String(imagePath).startsWith("https://")
  ) {
    return imagePath;
  }

  const normalizedPath = String(imagePath).startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  return `${API_HOST_URL}${normalizedPath}`;
};

export const getMyARPreviews = async (token) => {
  const response = await fetch(`${API_BASE_URL}/ar-simulations/my-previews`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("AR PREVIEWS STATUS:", response.status);
  console.log("AR PREVIEWS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for AR previews.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load AR previews");
  }

  return data;
};

export const getARPreviewsByRecord = async ({ token, recordId }) => {
  const response = await fetch(
    `${API_BASE_URL}/ar-simulations/record/${recordId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  const text = await response.text();

  console.log("AR PREVIEWS BY RECORD STATUS:", response.status);
  console.log("AR PREVIEWS BY RECORD RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Server returned non-JSON response for record AR previews."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load record AR previews"
    );
  }

  return data;
};