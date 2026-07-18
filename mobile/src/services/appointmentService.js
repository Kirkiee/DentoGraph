import { apiGet, apiPost, apiPut } from "./apiClient";

const withToken = (token, fallbackMessage) => ({
  token,
  fallbackMessage,
});

export const getPatientAppointments = async (token) =>
  apiGet(
    "/appointments/my-appointments",
    withToken(token, "Failed to load appointments."),
  );

export const getBookingServices = async (token) =>
  apiGet(
    "/appointments/booking/services",
    withToken(token, "Failed to load dental services."),
  );

export const getBookingClinics = async ({ token, service_id }) => {
  const query = new URLSearchParams({
    service_id: String(service_id),
  });

  return apiGet(
    `/appointments/booking/clinics?${query.toString()}`,
    withToken(token, "Failed to load clinic availability."),
  );
};

export const getBookingDentists = async ({
  token,
  clinic_id,
  service_id,
}) => {
  const query = new URLSearchParams({
    clinic_id: String(clinic_id),
    service_id: String(service_id),
  });

  return apiGet(
    `/appointments/booking/dentists?${query.toString()}`,
    withToken(token, "Failed to load eligible Dentists."),
  );
};

export const getBookingAvailableDates = async ({
  token,
  clinic_id,
  dentist_id,
  service_id,
}) => {
  const query = new URLSearchParams({
    clinic_id: String(clinic_id),
    dentist_id: String(dentist_id),
    service_id: String(service_id),
  });

  return apiGet(
    `/appointments/booking/available-dates?${query.toString()}`,
    withToken(token, "Failed to load available appointment dates."),
  );
};

export const getBookingAvailableTimes = async ({
  token,
  clinic_id,
  dentist_id,
  service_id,
  appointment_date,
}) => {
  const query = new URLSearchParams({
    clinic_id: String(clinic_id),
    dentist_id: String(dentist_id),
    service_id: String(service_id),
    appointment_date: String(appointment_date),
  });

  return apiGet(
    `/appointments/booking/available-times?${query.toString()}`,
    withToken(token, "Failed to load available appointment times."),
  );
};

export const bookStructuredAppointment = async ({
  token,
  clinic_id,
  dentist_id,
  service_id,
  appointment_date,
  appointment_time,
  appointment_type,
  notes,
}) =>
  apiPost(
    "/appointments/booking",
    {
      clinic_id,
      dentist_id,
      service_id,
      appointment_date,
      appointment_time,
      appointment_type,
      notes,
    },
    withToken(token, "Failed to book the appointment."),
  );

export const cancelPatientAppointment = async ({
  token,
  appointment_id,
  cancellation_reason,
}) =>
  apiPut(
    `/appointments/${appointment_id}/cancel`,
    {
      cancellation_reason,
    },
    withToken(token, "Failed to cancel the appointment."),
  );

export const requestPatientReschedule = async ({
  token,
  appointment_id,
  new_appointment_date,
}) =>
  apiPut(
    `/appointments/${appointment_id}/reschedule`,
    {
      new_appointment_date,
    },
    withToken(token, "Failed to request an appointment reschedule."),
  );

// Compatibility aliases for older screens. New booking screens should use
// the structured service-first functions above.
export const getActiveClinics = async (token) =>
  apiGet(
    "/appointments/clinics/list",
    withToken(token, "Failed to load the assigned clinic."),
  );

export const getActiveDentists = async (token) =>
  apiGet(
    "/appointments/dentists/list",
    withToken(token, "Failed to load Dentists."),
  );

export const getDentistsByClinic = async ({ token, clinic_id }) =>
  apiGet(
    `/appointments/dentists/by-clinic/${clinic_id}`,
    withToken(token, "Failed to load Dentists for the clinic."),
  );

export const getAvailableTimes = async ({
  token,
  dentist_id,
  appointment_date,
}) => {
  const query = new URLSearchParams({
    dentist_id: String(dentist_id),
    appointment_date: String(appointment_date),
  });

  return apiGet(
    `/appointments/available-times?${query.toString()}`,
    withToken(token, "Failed to load available time slots."),
  );
};

export const bookAppointment = async (payload) =>
  bookStructuredAppointment(payload);