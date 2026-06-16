import { API_BASE_URL } from "../config/api";

export const getPatientDentalRecords = async (token) => {
  const response = await fetch(
    `${API_BASE_URL}/dental-records/patient/my-records/list`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  const text = await response.text();

  console.log("DENTAL RECORDS STATUS:", response.status);
  console.log("DENTAL RECORDS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for dental records.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load dental records"
    );
  }

  return data;
};

export const getDentalRecordDetails = async ({ token, record_id }) => {
  const response = await fetch(`${API_BASE_URL}/dental-records/${record_id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("DENTAL RECORD DETAILS STATUS:", response.status);
  console.log("DENTAL RECORD DETAILS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Server returned non-JSON response for dental record details."
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to load dental record details"
    );
  }

  return data;
};