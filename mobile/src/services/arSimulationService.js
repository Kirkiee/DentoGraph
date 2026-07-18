import { API_BASE_URL, buildFileUrl } from "../config/api";

const parseResponse = async (response, fallbackMessage) => {
  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
};

export const buildARSimulationImageUrl = (imagePath) =>
  buildFileUrl(imagePath);

export const getMyARPreviews = async (token) => {
  const response = await fetch(
    `${API_BASE_URL}/ar-simulations/my-previews`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  return parseResponse(response, "Unable to load AR braces previews.");
};

export const getARPreviewsByRecord = async ({ token, recordId }) => {
  const response = await fetch(
    `${API_BASE_URL}/ar-simulations/record/${recordId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  return parseResponse(
    response,
    "Unable to load AR previews for this dental record.",
  );
};

export const deleteARPreview = async ({ token, simulationId }) => {
  const response = await fetch(
    `${API_BASE_URL}/ar-simulations/${simulationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  return parseResponse(response, "Unable to delete the AR braces preview.");
};