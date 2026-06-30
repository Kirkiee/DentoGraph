import { API_BASE_URL } from "../config/api";

const parseJsonResponse = async (response, fallbackMessage) => {
  const text = await response.text();

  console.log("STATUS:", response.status);
  console.log("RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Server returned non-JSON response.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
};

export const getPatientAppointments = async (token) => {
  const response = await fetch(`${API_BASE_URL}/appointments/my-appointments`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  return parseJsonResponse(response, "Failed to load appointments");
};

export const getActiveClinics = async (token) => {
  const response = await fetch(`${API_BASE_URL}/appointments/clinics/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  return parseJsonResponse(response, "Failed to load clinics");
};

export const getActiveDentists = async (token) => {
  const response = await fetch(`${API_BASE_URL}/appointments/dentists/list`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  return parseJsonResponse(response, "Failed to load dentists");
};

export const getDentistsByClinic = async ({ token, clinic_id }) => {
  const response = await fetch(
    `${API_BASE_URL}/appointments/dentists/by-clinic/${clinic_id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  return parseJsonResponse(response, "Failed to load dentists for clinic");
};

export const getAvailableTimes = async ({
  token,
  dentist_id,
  appointment_date,
}) => {
  const query = new URLSearchParams({
    dentist_id: String(dentist_id),
    appointment_date: String(appointment_date),
  });

  const response = await fetch(
    `${API_BASE_URL}/appointments/available-times?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  return parseJsonResponse(response, "Failed to load available time slots");
};

export const bookAppointment = async ({
  token,
  clinic_id,
  dentist_id,
  appointment_date,
  appointment_time,
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
      clinic_id,
      dentist_id,
      appointment_date,
      appointment_time,
      appointment_type,
      notes,
    }),
  });

  return parseJsonResponse(response, "Failed to book appointment");
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

  return parseJsonResponse(response, "Failed to cancel appointment");
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

  return parseJsonResponse(response, "Failed to request reschedule");
};