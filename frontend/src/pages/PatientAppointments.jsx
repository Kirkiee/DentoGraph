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
  const [loadingDentists, setLoadingDentists] = useState(true);
  const [booking, setBooking] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [newAppointmentDate, setNewAppointmentDate] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setLoadingDentists(true);
      setError("");

      const response = await API.get(
        "/api/appointments/dentists/list",
        authHeaders,
      );

      setDentists(response.data.dentists || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dentists.");
    } finally {
      setLoadingDentists(false);
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

    if (!formData.dentist_id || !formData.appointment_date) {
      setError("Please select a dentist and appointment date.");
      return;
    }

    try {
      setBooking(true);
      setMessage("");
      setError("");

      await API.post(
        "/api/appointments",
        {
          dentist_id: Number(formData.dentist_id),
          appointment_date: formData.appointment_date,
          appointment_type: formData.appointment_type,
          notes: formData.notes,
        },
        authHeaders,
      );

      setMessage("Appointment booked successfully.");
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

  const handleCancelAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment) {
      setError("No appointment selected for cancellation.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/cancel`,
        {
          cancellation_reason: cancellationReason || "No reason provided",
        },
        authHeaders,
      );

      setMessage("Appointment cancelled successfully.");
      closeCancelModal();
      fetchAppointments();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to cancel appointment.");
    } finally {
      setUpdating(false);
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

  const handleRescheduleAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment || !newAppointmentDate) {
      setError("Please select a new appointment date.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/reschedule`,
        {
          new_appointment_date: newAppointmentDate,
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
      setUpdating(false);
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
                fetchDentists();
              }}
              disabled={loading || loadingDentists}
            >
              {loading || loadingDentists ? "Refreshing..." : "Refresh"}
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
                      {appointment.appointment_date
                        ? new Date(
                            appointment.appointment_date,
                          ).toLocaleString()
                        : "N/A"}
                    </p>

                    {appointment.reschedule_request &&
                      appointment.requested_appointment_date && (
                        <p>
                          <strong>Requested New Date:</strong>{" "}
                          {new Date(
                            appointment.requested_appointment_date,
                          ).toLocaleString()}
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
            Select a dentist, choose your preferred date, and submit an
            appointment request.
          </p>

          <form className="appointment-form" onSubmit={handleBookAppointment}>
            <div className="form-group">
              <label>Dentist</label>
              <select
                name="dentist_id"
                value={formData.dentist_id}
                onChange={handleChange}
                disabled={loadingDentists}
                required
              >
                <option value="">
                  {loadingDentists ? "Loading dentists..." : "Select Dentist"}
                </option>

                {dentists.map((dentist) => (
                  <option key={dentist.dentist_id} value={dentist.dentist_id}>
                    {dentist.dentist_name}
                    {dentist.specialization
                      ? ` - ${dentist.specialization}`
                      : ""}
                    {dentist.clinic_name
                      ? ` - ${dentist.clinic_name}`
                      : " - No assigned clinic"}
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
              />
            </div>

            <button type="submit" className="primary-button" disabled={booking}>
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

            <form className="modal-form" onSubmit={handleCancelAppointment}>
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
                <label>Reason</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  rows="4"
                />
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
              <div className="form-group">
                <label>Current Appointment Date</label>
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
                <label>New Appointment Date</label>
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
