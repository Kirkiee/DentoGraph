import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [dentists, setDentists] = useState([]);

  const [formData, setFormData] = useState({
    dentist_id: "",
    appointment_date: "",
    appointment_type: "Dental Consultation",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const [newAppointmentDate, setNewAppointmentDate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const [rescheduling, setRescheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchAppointments();
    fetchDentists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchDentists = async () => {
    try {
      const response = await API.get(
        "/api/appointments/dentists/list",
        authHeaders,
      );

      setDentists(response.data.dentists || []);
    } catch (err) {
      console.error("Fetch dentists error:", err);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();

    setBooking(true);
    setMessage("");
    setError("");

    try {
      await API.post(
        "/api/appointments",
        {
          dentist_id: Number(formData.dentist_id),
          appointment_date: formData.appointment_date.replace("T", " "),
          appointment_type: formData.appointment_type,
          notes: formData.notes,
        },
        authHeaders,
      );

      setMessage(
        "Appointment booked successfully. Please wait for confirmation.",
      );

      setFormData({
        dentist_id: "",
        appointment_date: "",
        appointment_type: "Dental Consultation",
        notes: "",
      });

      fetchAppointments();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to book appointment.");
    } finally {
      setBooking(false);
    }
  };

  const openRescheduleModal = (appointment) => {
    setSelectedAppointment(appointment);
    setNewAppointmentDate("");
    setMessage("");
    setError("");
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedAppointment(null);
    setNewAppointmentDate("");
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();

    if (!newAppointmentDate) {
      setError("Please select a new appointment date and time.");
      return;
    }

    try {
      setRescheduling(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/reschedule`,
        {
          new_appointment_date: newAppointmentDate.replace("T", " "),
        },
        authHeaders,
      );

      setMessage("Reschedule request submitted successfully.");
      closeRescheduleModal();
      fetchAppointments();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to submit reschedule request.",
      );
    } finally {
      setRescheduling(false);
    }
  };

  const openCancelModal = (appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason("");
    setMessage("");
    setError("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setSelectedAppointment(null);
    setCancellationReason("");
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();

    try {
      setCancelling(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/cancel`,
        {
          cancellation_reason:
            cancellationReason.trim() || "No reason provided",
        },
        authHeaders,
      );

      setMessage("Appointment cancelled successfully.");
      closeCancelModal();
      fetchAppointments();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to cancel appointment.");
    } finally {
      setCancelling(false);
    }
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

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Book New Appointment</h2>
          <p>
            Select your preferred dentist, appointment date, and visit type.
            Your appointment will be marked as pending until confirmed by the
            clinic.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleBookAppointment}>
            <div className="form-group">
              <label>Dentist</label>
              <select
                name="dentist_id"
                value={formData.dentist_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Dentist</option>
                {dentists.map((dentist) => (
                  <option key={dentist.dentist_id} value={dentist.dentist_id}>
                    {dentist.dentist_name} -{" "}
                    {dentist.specialization || "General Dentistry"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Appointment Date and Time</label>
              <input
                type="datetime-local"
                name="appointment_date"
                value={formData.appointment_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Appointment Type</label>
              <select
                name="appointment_type"
                value={formData.appointment_type}
                onChange={handleChange}
              >
                <option value="Dental Consultation">Dental Consultation</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Tooth Extraction">Tooth Extraction</option>
                <option value="Dental Filling">Dental Filling</option>
                <option value="Orthodontic Consultation">
                  Orthodontic Consultation
                </option>
                <option value="X-ray Review">X-ray Review</option>
              </select>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Describe your concern or reason for visit"
                rows="4"
              />
            </div>

            <button type="submit" className="primary-button" disabled={booking}>
              {booking ? "Booking..." : "Book Appointment"}
            </button>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>My Appointments</h2>
              <p>Track your appointment requests and confirmed schedules.</p>
            </div>
          </div>

          {loading ? (
            <p>Loading appointments...</p>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <h3>No appointments yet</h3>
              <p>Your booked appointments will appear here.</p>
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
                    </div>

                    <p>
                      <strong>Dentist:</strong>{" "}
                      {appointment.dentist_name ||
                        `Dentist ID ${appointment.dentist_id}`}
                    </p>

                    <p>
                      <strong>Date:</strong>{" "}
                      {new Date(appointment.appointment_date).toLocaleString()}
                    </p>

                    {appointment.notes && (
                      <p>
                        <strong>Notes:</strong> {appointment.notes}
                      </p>
                    )}

                    {appointment.reschedule_request && (
                      <p>
                        <strong>Reschedule Request:</strong> Pending review
                      </p>
                    )}

                    {appointment.cancellation_reason && (
                      <p>
                        <strong>Cancellation Reason:</strong>{" "}
                        {appointment.cancellation_reason}
                      </p>
                    )}
                  </div>

                  {appointment.status !== "Cancelled" &&
                    appointment.status !== "Completed" && (
                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          onClick={() => openRescheduleModal(appointment)}
                        >
                          Reschedule
                        </button>

                        <button
                          className="danger-button"
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
      </div>

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Request Appointment Reschedule</h3>
                <p>Select your preferred new appointment date and time.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRescheduleModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRescheduleSubmit}>
              <div className="form-group">
                <label>Current Appointment</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? new Date(
                          selectedAppointment.appointment_date,
                        ).toLocaleString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>New Appointment Date and Time</label>
                <input
                  type="datetime-local"
                  value={newAppointmentDate}
                  onChange={(e) => setNewAppointmentDate(e.target.value)}
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
                  disabled={rescheduling}
                >
                  {rescheduling ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Cancel Appointment</h3>
                <p>Please provide a reason for cancelling this appointment.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCancelModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCancelSubmit}>
              <div className="form-group">
                <label>Appointment</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? new Date(
                          selectedAppointment.appointment_date,
                        ).toLocaleString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Reason for Cancellation</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Enter your reason for cancellation..."
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCancelModal}
                >
                  Keep Appointment
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling..." : "Cancel Appointment"}
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
