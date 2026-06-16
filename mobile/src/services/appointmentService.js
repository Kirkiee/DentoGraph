import { API_BASE_URL } from "../config/api";

export const getPatientAppointments = async (token) => {
  const response = await fetch(`${API_BASE_URL}/appointments/my-appointments`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("APPOINTMENTS STATUS:", response.status);
  console.log("APPOINTMENTS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for appointments.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load appointments");
  }

  return data;
};

export const getActiveDentists = async (token) => {
  const response = await fetch(`${API_BASE_URL}/appointments/dentists/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();

  console.log("DENTISTS STATUS:", response.status);
  console.log("DENTISTS RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response for dentists.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to load dentists");
  }

  return data;
};

export const bookAppointment = async ({
  token,
  dentist_id,
  appointment_date,
  appointment_type,
  notes,
}) => {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      dentist_id,
      appointment_date,
      appointment_type,
      notes,
    }),
  });

  const text = await response.text();

  console.log("BOOK APPOINTMENT STATUS:", response.status);
  console.log("BOOK APPOINTMENT RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response while booking.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Failed to book appointment");
  }

  return data;
};

export const cancelPatientAppointment = async ({
  token,
  appointment_id,
  cancellation_reason,
}) => {
  const response = await fetch(
    `${API_BASE_URL}/appointments/${appointment_id}/cancel`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        cancellation_reason,
      }),
    }
  );

  const text = await response.text();

  console.log("CANCEL APPOINTMENT STATUS:", response.status);
  console.log("CANCEL APPOINTMENT RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response while cancelling.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to cancel appointment"
    );
  }

  return data;
};

export const requestPatientReschedule = async ({
  token,
  appointment_id,
  new_appointment_date,
}) => {
  const response = await fetch(
    `${API_BASE_URL}/appointments/${appointment_id}/reschedule`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        new_appointment_date,
      }),
    }
  );

  const text = await response.text();

  console.log("RESCHEDULE STATUS:", response.status);
  console.log("RESCHEDULE RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response while rescheduling.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Failed to request reschedule"
    );
  }

  return data;
};