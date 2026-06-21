import { API_BASE_URL } from "../config/api";

export const getClinics = async (token) => {
  const response = await fetch(`${API_BASE_URL}/clinics/discovery/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("CLINIC DISCOVERY STATUS:", response.status);
  console.log("CLINIC DISCOVERY RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for clinic discovery.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load clinic discovery list"
    );
  }

  return data;
};