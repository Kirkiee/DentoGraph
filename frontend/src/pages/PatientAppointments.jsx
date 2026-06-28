import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [formData, setFormData] = useState({
    clinic_id: "",
    dentist_id: "",
    appointment_date: "",
    appointment_time: "",
    appointment_type: "Dental Consultation",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [booking, setBooking] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [newAppointmentDate, setNewAppointmentDate] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const padNumber = (value) => String(value).padStart(2, "0");

  const getCurrentDateLocal = () => {
    const now = new Date();

    return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(
      now.getDate(),
    )}`;
  };

  const getCurrentDateTimeLocal = () => {
    const now = new Date();

    return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(
      now.getDate(),
    )}T${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`;
  };

  const isPastDate = (dateValue) => {
    if (!dateValue) return true;

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const today = new Date(`${getCurrentDateLocal()}T00:00:00`);

    return selectedDate.getTime() < today.getTime();
  };

  const isPastDateTime = (dateTimeValue) => {
    if (!dateTimeValue) return true;

    const selectedDate = new Date(dateTimeValue);
    const now = new Date();

    return selectedDate.getTime() < now.getTime();
  };

  const combineDateAndTimeToOffsetISO = (dateValue, timeValue) => {
    if (!dateValue || !timeValue) return "";

    const localDateTime = `${dateValue}T${timeValue}`;
    const selectedDate = new Date(localDateTime);
    const timezoneOffsetMinutes = -selectedDate.getTimezoneOffset();

    const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(timezoneOffsetMinutes);
    const offsetHours = padNumber(Math.floor(absoluteOffset / 60));
    const offsetMinutes = padNumber(absoluteOffset % 60);

    return `${localDateTime}:00${sign}${offsetHours}:${offsetMinutes}`;
  };

  const formatAppointmentDateTime = (dateTimeValue) => {
    if (!dateTimeValue) return "N/A";

    return new Date(dateTimeValue).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    fetchAppointments();
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showCancelModal || showRescheduleModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showCancelModal, showRescheduleModal]);

  useEffect(() => {
    if (formData.clinic_id) {
      fetchDentistsByClinic(formData.clinic_id);
    } else {
      setDentists([]);
      setAvailableTimes([]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.clinic_id]);

  useEffect(() => {
    if (formData.dentist_id && formData.appointment_date) {
      fetchAvailableTimes(formData.dentist_id, formData.appointment_date);
    } else {
      setAvailableTimes([]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.dentist_id, formData.appointment_date]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        "/api/appointments/my-appointments",
        authHeaders,
      );

      setAppointments(response.data.appointments || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);
      setError("");

      const response = await API.get(
        "/api/appointments/clinics/list",
        authHeaders,
      );

      setClinics(response.data.clinics || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinics.");
    } finally {
      setLoadingClinics(false);
    }
  };

  const fetchDentistsByClinic = async (clinicId) => {
    if (!clinicId) return;

    try {
      setLoadingDentists(true);
      setError("");
      setDentists([]);
      setAvailableTimes([]);

      const response = await API.get(
        `/api/appointments/dentists/by-clinic/${clinicId}`,
        authHeaders,
      );

      setDentists(response.data.dentists || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dentists for this clinic.",
      );
    } finally {
      setLoadingDentists(false);
    }
  };

  const fetchAvailableTimes = async (dentistId, appointmentDate) => {
    if (!dentistId || !appointmentDate) return;

    if (isPastDate(appointmentDate)) {
      setAvailableTimes([]);
      setError("You cannot select a past appointment date.");
      return;
    }

    try {
      setLoadingTimes(true);
      setError("");
      setAvailableTimes([]);

      const response = await API.get("/api/appointments/available-times", {
        ...authHeaders,
        params: {
          dentist_id: dentistId,
          appointment_date: appointmentDate,
        },
      });

      setAvailableTimes(response.data.available_times || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load available times.");
    } finally {
      setLoadingTimes(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setError("");
    setMessage("");

    if (name === "clinic_id") {
      setFormData((prev) => ({
        ...prev,
        clinic_id: value,
        dentist_id: "",
        appointment_date: "",
        appointment_time: "",
      }));
      return;
    }

    if (name === "dentist_id") {
      setFormData((prev) => ({
        ...prev,
        dentist_id: value,
        appointment_date: "",
        appointment_time: "",
      }));
      return;
    }

    if (name === "appointment_date") {
      setFormData((prev) => ({
        ...prev,
        appointment_date: value,
        appointment_time: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();

    if (!formData.clinic_id) {
      setError("Please select a clinic first.");
      return;
    }

    if (!formData.dentist_id) {
      setError("Please select an active dentist from the selected clinic.");
      return;
    }

    if (!formData.appointment_date) {
      setError("Please select an appointment date.");
      return;
    }

    if (isPastDate(formData.appointment_date)) {
      setError("You cannot book an appointment in the past.");
      return;
    }

    if (!formData.appointment_time) {
      setError("Please select an available appointment time.");
      return;
    }

    const finalAppointmentDate = combineDateAndTimeToOffsetISO(
      formData.appointment_date,
      formData.appointment_time,
    );

    if (isPastDateTime(finalAppointmentDate)) {
      setError("You cannot book an appointment in the past.");
      return;
    }

    try {
      setBooking(true);
      setMessage("");
      setError("");

      await API.post(
        "/api/appointments",
        {
          clinic_id: Number(formData.clinic_id),
          dentist_id: Number(formData.dentist_id),
          appointment_date: finalAppointmentDate,
          appointment_time: formData.appointment_time,
          appointment_type: formData.appointment_type,
          notes: formData.notes,
        },
        authHeaders,
      );

      setMessage("Appointment booked successfully.");
      setFormData({
        clinic_id: "",
        dentist_id: "",
        appointment_date: "",
        appointment_time: "",
        appointment_type: "Dental Consultation",
        notes: "",
      });
      setDentists([]);
      setAvailableTimes([]);

      fetchAppointments();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to book appointment.");
    } finally {
      setBooking(false);
    }
  };

  const openCancelModal = (appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason("");
    setMessage("");
    setError("");
    setModalError("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setSelectedAppointment(null);
    setCancellationReason("");
    setModalError("");
  };

  const handleCancelAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment) {
      setModalError("No appointment selected for cancellation.");
      return;
    }

    const trimmedReason = cancellationReason.trim();

    if (!trimmedReason) {
      setModalError("Cancellation remarks are required.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/cancel`,
        {
          cancellation_reason: trimmedReason,
        },
        authHeaders,
      );

      setMessage("Appointment cancelled successfully.");
      closeCancelModal();
      fetchAppointments();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to cancel appointment.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const openRescheduleModal = (appointment) => {
    setSelectedAppointment(appointment);
    setNewAppointmentDate("");
    setMessage("");
    setError("");
    setModalError("");
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedAppointment(null);
    setNewAppointmentDate("");
    setModalError("");
  };

  const handleRescheduleAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment || !newAppointmentDate) {
      setModalError("Please select a new appointment date.");
      return;
    }

    if (isPastDateTime(newAppointmentDate)) {
      setModalError("You cannot request a reschedule to a past date or time.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/reschedule`,
        {
          new_appointment_date:
            combineDateTimeLocalToOffsetISO(newAppointmentDate),
        },
        authHeaders,
      );

      setMessage("Reschedule request submitted successfully.");
      closeRescheduleModal();
      fetchAppointments();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to submit reschedule request.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const combineDateTimeLocalToOffsetISO = (dateTimeValue) => {
    if (!dateTimeValue) return "";

    const selectedDate = new Date(dateTimeValue);
    const timezoneOffsetMinutes = -selectedDate.getTimezoneOffset();

    const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(timezoneOffsetMinutes);
    const offsetHours = padNumber(Math.floor(absoluteOffset / 60));
    const offsetMinutes = padNumber(absoluteOffset % 60);

    return `${dateTimeValue}:00${sign}${offsetHours}:${offsetMinutes}`;
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Scheduled":
        return "status-badge status-scheduled";
      case "Completed":
        return "status-badge status-completed";
      case "Cancelled":
        return "status-badge status-cancelled";
      default:
        return "status-badge status-pending";
    }
  };

  const selectedClinic = clinics.find(
    (clinic) => Number(clinic.clinic_id) === Number(formData.clinic_id),
  );

  const selectedDentist = dentists.find(
    (dentist) => Number(dentist.dentist_id) === Number(formData.dentist_id),
  );

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-layout">
        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>My Appointments</h2>
              <p>
                View your appointment requests, schedules, cancellations, and
                reschedule updates.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                fetchAppointments();
                fetchClinics();

                if (formData.clinic_id) {
                  fetchDentistsByClinic(formData.clinic_id);
                }

                if (formData.dentist_id && formData.appointment_date) {
                  fetchAvailableTimes(
                    formData.dentist_id,
                    formData.appointment_date,
                  );
                }
              }}
              disabled={loading || loadingClinics || loadingDentists}
            >
              {loading || loadingClinics || loadingDentists
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <p>Loading appointments...</p>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <h3>No appointments yet</h3>
              <p>
                Book your first appointment using the form on the right side.
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {appointments.map((appointment) => (
                <div
                  className="appointment-item"
                  key={appointment.appointment_id}
                >
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>
                        {appointment.appointment_type || "Dental Consultation"}
                      </h3>

                      <span className={getStatusClass(appointment.status)}>
                        {appointment.status}
                      </span>

                      {appointment.reschedule_request && (
                        <span className="status-badge status-pending">
                          Reschedule Request
                        </span>
                      )}
                    </div>

                    <p>
                      <strong>Dentist:</strong>{" "}
                      {appointment.dentist_name ||
                        `Dentist ID ${appointment.dentist_id}`}
                    </p>

                    <p>
                      <strong>Clinic:</strong>{" "}
                      {appointment.clinic_name || "No assigned clinic"}
                    </p>

                    <p>
                      <strong>Current Date:</strong>{" "}
                      {formatAppointmentDateTime(appointment.appointment_date)}
                    </p>

                    {appointment.reschedule_request &&
                      appointment.requested_appointment_date && (
                        <p>
                          <strong>Requested New Date:</strong>{" "}
                          {formatAppointmentDateTime(
                            appointment.requested_appointment_date,
                          )}
                        </p>
                      )}

                    {appointment.reschedule_status &&
                      appointment.reschedule_status !== "None" && (
                        <p>
                          <strong>Reschedule Status:</strong>{" "}
                          {appointment.reschedule_status}
                        </p>
                      )}

                    {appointment.notes && (
                      <p>
                        <strong>Notes:</strong> {appointment.notes}
                      </p>
                    )}

                    {appointment.cancellation_reason && (
                      <p>
                        <strong>Cancellation Remarks:</strong>{" "}
                        {appointment.cancellation_reason}
                      </p>
                    )}

                    {appointment.cancelled_at && (
                      <p>
                        <strong>Cancelled At:</strong>{" "}
                        {formatAppointmentDateTime(appointment.cancelled_at)}
                      </p>
                    )}

                    {appointment.cancelled_by_name && (
                      <p>
                        <strong>Cancelled By:</strong>{" "}
                        {appointment.cancelled_by_name}
                      </p>
                    )}
                  </div>

                  {appointment.status !== "Cancelled" &&
                    appointment.status !== "Completed" && (
                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          disabled={updating}
                          onClick={() => openRescheduleModal(appointment)}
                        >
                          Request Reschedule
                        </button>

                        <button
                          className="danger-button"
                          disabled={updating}
                          onClick={() => openCancelModal(appointment)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="appointment-form-card">
          <h2>Book New Appointment</h2>
          <p>
            Select a clinic first, choose an active dentist from that clinic,
            then pick an available date and time.
          </p>

          <form className="appointment-form" onSubmit={handleBookAppointment}>
            <div className="form-group">
              <label>Clinic</label>
              <select
                name="clinic_id"
                value={formData.clinic_id}
                onChange={handleChange}
                disabled={loadingClinics || booking}
                required
              >
                <option value="">
                  {loadingClinics ? "Loading clinics..." : "Select Clinic"}
                </option>

                {clinics.map((clinic) => (
                  <option key={clinic.clinic_id} value={clinic.clinic_id}>
                    {clinic.clinic_name}
                    {clinic.address ? ` - ${clinic.address}` : ""}
                  </option>
                ))}
              </select>

              {selectedClinic && (
                <div className="selected-dentist-card">
                  <h3>{selectedClinic.clinic_name}</h3>

                  {selectedClinic.address && (
                    <p>
                      <strong>Address:</strong> {selectedClinic.address}
                    </p>
                  )}

                  {selectedClinic.contact_number && (
                    <p>
                      <strong>Contact:</strong> {selectedClinic.contact_number}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Dentist</label>
              <select
                name="dentist_id"
                value={formData.dentist_id}
                onChange={handleChange}
                disabled={!formData.clinic_id || loadingDentists || booking}
                required
              >
                <option value="">
                  {!formData.clinic_id
                    ? "Select a clinic first"
                    : loadingDentists
                      ? "Loading dentists..."
                      : dentists.length === 0
                        ? "No active dentists in this clinic"
                        : "Select Dentist"}
                </option>

                {dentists.map((dentist) => (
                  <option key={dentist.dentist_id} value={dentist.dentist_id}>
                    {dentist.dentist_name}
                    {dentist.specialization
                      ? ` - ${dentist.specialization}`
                      : ""}
                  </option>
                ))}
              </select>

              {selectedDentist && (
                <div className="selected-dentist-card">
                  <h3>{selectedDentist.dentist_name}</h3>

                  <p>
                    <strong>Specialization:</strong>{" "}
                    {selectedDentist.specialization || "Not specified"}
                  </p>

                  <p>
                    <strong>Clinic:</strong>{" "}
                    {selectedDentist.clinic_name || "No assigned clinic"}
                  </p>

                  <p>
                    <strong>Availability:</strong>{" "}
                    {selectedDentist.availability || "Not specified"}
                  </p>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Appointment Date</label>
              <input
                type="date"
                name="appointment_date"
                value={formData.appointment_date}
                onChange={handleChange}
                min={getCurrentDateLocal()}
                disabled={!formData.dentist_id || booking}
                required
              />
            </div>

            <div className="form-group">
              <label>Available Time</label>
              <select
                name="appointment_time"
                value={formData.appointment_time}
                onChange={handleChange}
                disabled={
                  !formData.dentist_id ||
                  !formData.appointment_date ||
                  loadingTimes ||
                  booking
                }
                required
              >
                <option value="">
                  {!formData.dentist_id
                    ? "Select a dentist first"
                    : !formData.appointment_date
                      ? "Select a date first"
                      : loadingTimes
                        ? "Loading available times..."
                        : availableTimes.length === 0
                          ? "No available times"
                          : "Select Time"}
                </option>

                {availableTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Appointment Type</label>
              <select
                name="appointment_type"
                value={formData.appointment_type}
                onChange={handleChange}
                disabled={booking}
              >
                <option value="Dental Consultation">Dental Consultation</option>
                <option value="Dental Cleaning">Dental Cleaning</option>
                <option value="Tooth Extraction">Tooth Extraction</option>
                <option value="Dental Filling">Dental Filling</option>
                <option value="Orthodontic Consultation">
                  Orthodontic Consultation
                </option>
                <option value="X-ray Review">X-ray Review</option>
                <option value="Follow-up Checkup">Follow-up Checkup</option>
              </select>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add notes or concerns for your appointment..."
                rows="4"
                disabled={booking}
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={
                booking || loadingClinics || loadingDentists || loadingTimes
              }
            >
              {booking ? "Booking..." : "Book Appointment"}
            </button>
          </form>
        </div>
      </div>

      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Cancel Appointment</h3>
                <p>Please provide remarks for cancelling this appointment.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCancelModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCancelAppointment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Appointment</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? formatAppointmentDateTime(
                          selectedAppointment.appointment_date,
                        )
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Cancellation Remarks</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => {
                    setCancellationReason(e.target.value);
                    setModalError("");
                  }}
                  placeholder="Enter cancellation remarks..."
                  rows="4"
                  required
                />
              </div>

              <div className="info-message">
                Cancellation remarks are required and will be saved in the
                appointment record.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCancelModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={updating}
                >
                  {updating ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Request Reschedule</h3>
                <p>
                  Choose a new preferred appointment date. Your dentist or
                  clinic staff will review the request.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRescheduleModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRescheduleAppointment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Current Appointment Date</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? formatAppointmentDateTime(
                          selectedAppointment.appointment_date,
                        )
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>New Appointment Date</label>
                <input
                  type="datetime-local"
                  value={newAppointmentDate}
                  min={getCurrentDateTimeLocal()}
                  onChange={(e) => {
                    setNewAppointmentDate(e.target.value);
                    setModalError("");
                  }}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRescheduleModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={updating}
                >
                  {updating ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PatientAppointments;
