import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AssistantAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedRescheduleAppointment, setSelectedRescheduleAppointment] =
    useState(null);
  const [rescheduleAction, setRescheduleAction] = useState("");
  const [processingReschedule, setProcessingReschedule] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

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
  }, [appointments, searchTerm, statusFilter]);

  useEffect(() => {
    if (showStatusModal || showRescheduleModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showStatusModal, showRescheduleModal]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/appointments", authHeaders);

      setAppointments(response.data.appointments || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load appointments.");
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (appointment) => appointment.status === statusFilter,
      );
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(
        (appointment) =>
          appointment.patient_name?.toLowerCase().includes(term) ||
          appointment.dentist_name?.toLowerCase().includes(term) ||
          appointment.appointment_type?.toLowerCase().includes(term) ||
          appointment.notes?.toLowerCase().includes(term) ||
          appointment.cancellation_reason?.toLowerCase().includes(term),
      );
    }

    setFilteredAppointments(filtered);
  };

  const openStatusModal = (appointment, status) => {
    setSelectedAppointment(appointment);
    setSelectedStatus(status);
    setCancellationReason("");
    setMessage("");
    setError("");
    setModalError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedAppointment(null);
    setSelectedStatus("");
    setCancellationReason("");
    setModalError("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedAppointment || !selectedStatus) {
      setModalError("Please select a valid appointment status.");
      return;
    }

    const trimmedReason = cancellationReason.trim();

    if (selectedStatus === "Cancelled" && !trimmedReason) {
      setModalError("Cancellation remarks are required.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/status`,
        {
          status: selectedStatus,
          cancellation_reason:
            selectedStatus === "Cancelled" ? trimmedReason : null,
        },
        authHeaders,
      );

      setMessage(
        selectedStatus === "Cancelled"
          ? "Appointment cancelled successfully."
          : `Appointment marked as ${selectedStatus}.`,
      );

      closeStatusModal();
      fetchAppointments();
    } catch (err) {
      setModalError(
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
    setModalError("");
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedRescheduleAppointment(null);
    setRescheduleAction("");
    setModalError("");
  };

  const handleRescheduleDecision = async (e) => {
    e.preventDefault();

    if (!selectedRescheduleAppointment || !rescheduleAction) {
      setModalError("Please select a valid reschedule action.");
      return;
    }

    try {
      setProcessingReschedule(true);
      setMessage("");
      setError("");
      setModalError("");

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
      setModalError(
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
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Appointment Management</h2>
            <p>
              View and manage patient appointments for your assigned clinic.
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
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient, dentist, type, notes, or remarks"
            />
          </div>

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
              Appointments will appear here once patients submit booking
              requests.
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
                      <strong>Cancellation Remarks:</strong>{" "}
                      {appointment.cancellation_reason}
                    </p>
                  )}

                  {appointment.cancelled_at && (
                    <p>
                      <strong>Cancelled At:</strong>{" "}
                      {new Date(appointment.cancelled_at).toLocaleString()}
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
                <h3>
                  {selectedStatus === "Cancelled"
                    ? "Cancel Appointment"
                    : "Update Appointment Status"}
                </h3>
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
              {modalError && <div className="error-message">{modalError}</div>}

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
                <label>Dentist</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.dentist_name ||
                    `Dentist ID ${selectedAppointment?.dentist_id}`
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

              {selectedStatus === "Cancelled" && (
                <>
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
                </>
              )}

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
              {modalError && <div className="error-message">{modalError}</div>}

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
                <label>Dentist</label>
                <input
                  type="text"
                  value={
                    selectedRescheduleAppointment?.dentist_name ||
                    `Dentist ID ${selectedRescheduleAppointment?.dentist_id}`
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

export default AssistantAppointments;
