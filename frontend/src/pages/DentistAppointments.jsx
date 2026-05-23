import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function DentistAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        "/api/appointments/dentist/my-appointments",
        authHeaders,
      );

      setAppointments(response.data.appointments || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dentist appointments.",
      );
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (appointment, status) => {
    setSelectedAppointment(appointment);
    setSelectedStatus(status);
    setMessage("");
    setError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedAppointment(null);
    setSelectedStatus("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedAppointment || !selectedStatus) {
      setError("Please select a valid appointment status.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/status`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`Appointment marked as ${selectedStatus}.`);
      closeStatusModal();
      fetchAppointments();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update appointment status.",
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

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dentist Appointments</h2>
            <p>
              View your assigned patient appointments and update their current
              status.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchAppointments}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
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
              Assigned patient appointments will appear here once patients book
              with you.
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
                  </div>

                  <p>
                    <strong>Patient:</strong>{" "}
                    {appointment.patient_name ||
                      `Patient ID ${appointment.patient_id}`}
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
                      {appointment.status !== "Scheduled" && (
                        <button
                          className="secondary-button"
                          disabled={updating}
                          onClick={() =>
                            openStatusModal(appointment, "Scheduled")
                          }
                        >
                          Mark Scheduled
                        </button>
                      )}

                      <button
                        className="secondary-button"
                        disabled={updating}
                        onClick={() =>
                          openStatusModal(appointment, "Completed")
                        }
                      >
                        Complete
                      </button>

                      <button
                        className="danger-button"
                        disabled={updating}
                        onClick={() =>
                          openStatusModal(appointment, "Cancelled")
                        }
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

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Appointment Status</h3>
                <p>
                  Confirm that you want to mark this appointment as{" "}
                  <strong>{selectedStatus}</strong>.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeStatusModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateStatus}>
              <div className="form-group">
                <label>Patient</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.patient_name ||
                    `Patient ID ${selectedAppointment?.patient_id}`
                  }
                  disabled
                />
              </div>

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
                <label>New Status</label>
                <input type="text" value={selectedStatus} disabled />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeStatusModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className={
                    selectedStatus === "Cancelled"
                      ? "danger-button"
                      : "primary-button"
                  }
                  disabled={updating}
                >
                  {updating ? "Updating..." : `Confirm ${selectedStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistAppointments;
