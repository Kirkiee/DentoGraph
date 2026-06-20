import { API_BASE_URL } from "../config/api";

export const getPatientProfile = async (token) => {
  const response = await fetch(`${API_BASE_URL}/patients/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("PATIENT PROFILE STATUS:", response.status);
  console.log("PATIENT PROFILE RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for patient profile.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load profile");
  }

  return data;
};

export const updatePatientProfile = async ({ token, profile }) => {
  const response = await fetch(`${API_BASE_URL}/patients/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(profile),
  });

  const text = await response.text();

  console.log("UPDATE PATIENT PROFILE STATUS:", response.status);
  console.log("UPDATE PATIENT PROFILE RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response while updating profile.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to update profile");
  }

  return data;
};