import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function DentistAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);

  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedRescheduleAppointment, setSelectedRescheduleAppointment] =
    useState(null);
  const [rescheduleAction, setRescheduleAction] = useState("");
  const [processingReschedule, setProcessingReschedule] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, statusFilter]);

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
      setError(err.response?.data?.error || "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    if (statusFilter === "All") {
      setFilteredAppointments(appointments);
      return;
    }

    const filtered = appointments.filter(
      (appointment) => appointment.status === statusFilter,
    );

    setFilteredAppointments(filtered);
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

  const openRescheduleModal = (appointment, action) => {
    setSelectedRescheduleAppointment(appointment);
    setRescheduleAction(action);
    setMessage("");
    setError("");
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedRescheduleAppointment(null);
    setRescheduleAction("");
  };

  const handleRescheduleDecision = async (e) => {
    e.preventDefault();

    if (!selectedRescheduleAppointment || !rescheduleAction) {
      setError("Please select a valid reschedule action.");
      return;
    }

    try {
      setProcessingReschedule(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/appointments/${selectedRescheduleAppointment.appointment_id}/reschedule/${rescheduleAction}`,
        {},
        authHeaders,
      );

      setMessage(
        rescheduleAction === "approve"
          ? "Reschedule request approved successfully."
          : "Reschedule request rejected successfully.",
      );

      closeRescheduleModal();
      fetchAppointments();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to process reschedule request.",
      );
    } finally {
      setProcessingReschedule(false);
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

  const totalAppointments = appointments.length;
  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "Pending",
  ).length;
  const scheduledAppointments = appointments.filter(
    (appointment) => appointment.status === "Scheduled",
  ).length;
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === "Completed",
  ).length;

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Appointments</h2>
            <p>
              View your assigned patient appointments and manage appointment
              requests.
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

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Total Appointments</h3>
            <strong>{totalAppointments}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Pending</h3>
            <strong>{pendingAppointments}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Scheduled</h3>
            <strong>{scheduledAppointments}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Completed</h3>
            <strong>{completedAppointments}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading appointments...</p>
        ) : filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <h3>No appointments found</h3>
            <p>
              Assigned patient appointments will appear here once patients
              submit booking requests.
            </p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredAppointments.map((appointment) => (
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
                    <strong>Patient:</strong>{" "}
                    {appointment.patient_name ||
                      `Patient ID ${appointment.patient_id}`}
                  </p>

                  <p>
                    <strong>Clinic:</strong>{" "}
                    {appointment.clinic_name || "No assigned clinic"}
                  </p>

                  <p>
                    <strong>Current Date:</strong>{" "}
                    {appointment.appointment_date
                      ? new Date(appointment.appointment_date).toLocaleString()
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
                      {appointment.reschedule_request && (
                        <>
                          <button
                            className="primary-button"
                            disabled={processingReschedule}
                            onClick={() =>
                              openRescheduleModal(appointment, "approve")
                            }
                          >
                            Approve Reschedule
                          </button>

                          <button
                            className="danger-button"
                            disabled={processingReschedule}
                            onClick={() =>
                              openRescheduleModal(appointment, "reject")
                            }
                          >
                            Reject Reschedule
                          </button>
                        </>
                      )}

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

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {rescheduleAction === "approve"
                    ? "Approve Reschedule"
                    : "Reject Reschedule"}
                </h3>
                <p>
                  Confirm this action for appointment #
                  {selectedRescheduleAppointment?.appointment_id}.
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

            <form className="modal-form" onSubmit={handleRescheduleDecision}>
              <div className="form-group">
                <label>Patient</label>
                <input
                  type="text"
                  value={
                    selectedRescheduleAppointment?.patient_name ||
                    `Patient ID ${selectedRescheduleAppointment?.patient_id}`
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Current Appointment Date</label>
                <input
                  type="text"
                  value={
                    selectedRescheduleAppointment?.appointment_date
                      ? new Date(
                          selectedRescheduleAppointment.appointment_date,
                        ).toLocaleString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Requested New Date</label>
                <input
                  type="text"
                  value={
                    selectedRescheduleAppointment?.requested_appointment_date
                      ? new Date(
                          selectedRescheduleAppointment.requested_appointment_date,
                        ).toLocaleString()
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRescheduleModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className={
                    rescheduleAction === "approve"
                      ? "primary-button"
                      : "danger-button"
                  }
                  disabled={processingReschedule}
                >
                  {processingReschedule
                    ? "Processing..."
                    : rescheduleAction === "approve"
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
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
