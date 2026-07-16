import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AssistantAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [assignedClinic, setAssignedClinic] = useState({
    clinic_id: null,
    clinic_name: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    if (showStatusModal || showRescheduleModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showStatusModal, showRescheduleModal]);

  const fetchAppointments = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get("/api/appointments", authHeaders);

      setAppointments(response.data.appointments || []);
      setAssignedClinic({
        clinic_id: response.data.assigned_clinic_id || null,
        clinic_name: response.data.assigned_clinic_name || "",
      });
    } catch (err) {
      setAppointments([]);
      setAssignedClinic({
        clinic_id: null,
        clinic_name: "",
      });
      setError(err.response?.data?.error || "Unable to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
    if (updating) return;

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
      fetchAppointments(true);
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
    if (processingReschedule) return;

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
      fetchAppointments(true);
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
      case "Pending":
      default:
        return "status-badge status-pending";
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (appointment) => appointment.status === statusFilter,
      );
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.trim().toLowerCase();

      filtered = filtered.filter((appointment) => {
        const searchableText = [
          appointment.appointment_id,
          appointment.patient_name,
          appointment.patient_id,
          appointment.dentist_name,
          appointment.dentist_id,
          appointment.clinic_name,
          appointment.appointment_type,
          appointment.notes,
          appointment.cancellation_reason,
          appointment.status,
          appointment.reschedule_status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(term);
      });
    }

    return filtered;
  }, [appointments, searchTerm, statusFilter]);

  const appointmentSummary = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(
        (appointment) => appointment.status === "Pending",
      ).length,
      scheduled: appointments.filter(
        (appointment) => appointment.status === "Scheduled",
      ).length,
      completed: appointments.filter(
        (appointment) => appointment.status === "Completed",
      ).length,
      cancelled: appointments.filter(
        (appointment) => appointment.status === "Cancelled",
      ).length,
      reschedule: appointments.filter(
        (appointment) => appointment.reschedule_request,
      ).length,
    };
  }, [appointments]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
  };

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="appointment-item loading-card" key={index}>
            <div className="appointment-info">
              <div className="loading-line loading-title"></div>
              <div className="loading-line loading-text"></div>
              <div className="loading-line loading-text"></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Appointment Management</h2>
            <p>
              View and manage patient appointments from your assigned clinic
              location only.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => fetchAppointments(true)}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Appointment notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total</span>
            <strong>{appointmentSummary.total}</strong>
            <p>All clinic appointments.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Pending</span>
            <strong>{appointmentSummary.pending}</strong>
            <p>Awaiting confirmation.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Scheduled</span>
            <strong>{appointmentSummary.scheduled}</strong>
            <p>Confirmed appointments.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Completed</span>
            <strong>{appointmentSummary.completed}</strong>
            <p>Finished visits.</p>
          </div>
        </div>

        <div className="patient-dashboard-summary-grid assistant-appointment-secondary-summary">
          <div className="patient-dashboard-card">
            <span>Cancelled</span>
            <strong>{appointmentSummary.cancelled}</strong>
            <p>Appointments cancelled with remarks.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Reschedule Requests</span>
            <strong>{appointmentSummary.reschedule}</strong>
            <p>Requests waiting for review.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Filtered Results</span>
            <strong>{filteredAppointments.length}</strong>
            <p>Appointments currently shown below.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Assigned Clinic Location</span>
            <strong>
              {assignedClinic.clinic_name ||
                (loading ? "Loading..." : "Not assigned")}
            </strong>
            <p>
              {assignedClinic.clinic_id
                ? `Clinic ID: ${assignedClinic.clinic_id}`
                : "Appointment access is restricted until a clinic location is assigned."}
            </p>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Search and Filter</h2>
              <p>
                Find appointments by patient, dentist, type, status, or notes
                within your assigned clinic location.
              </p>
            </div>

            {(searchTerm || statusFilter !== "All") && (
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="assistant-appointment-filter-panel">
            <div className="form-group">
              <label>Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search patient, dentist, type, notes, or remarks"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={loading}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Appointment List</h2>
              <p>
                {loading
                  ? "Loading appointments..."
                  : `${filteredAppointments.length} of ${appointments.length} appointments shown.`}
              </p>
            </div>
          </div>

          {loading ? (
            renderLoadingState()
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <h3>No appointments found</h3>
              <p>
                Appointments will appear here when patients assigned to your
                clinic location submit booking requests.
              </p>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="empty-state">
              <h3>No matching appointments</h3>
              <p>Try changing the search or status filter.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="appointments-list">
              {filteredAppointments.map((appointment) => (
                <div
                  className="appointment-item assistant-appointment-item"
                  key={appointment.appointment_id}
                >
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>
                        {appointment.appointment_type || "Dental Consultation"}
                      </h3>

                      <span className={getStatusClass(appointment.status)}>
                        {appointment.status || "Pending"}
                      </span>

                      {appointment.reschedule_request && (
                        <span className="status-badge status-pending">
                          Reschedule Request
                        </span>
                      )}
                    </div>

                    <div className="assistant-appointment-detail-grid">
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
                        {formatDate(appointment.appointment_date)}
                      </p>

                      {appointment.reschedule_request &&
                        appointment.requested_appointment_date && (
                          <p>
                            <strong>Requested New Date:</strong>{" "}
                            {formatDate(appointment.requested_appointment_date)}
                          </p>
                        )}

                      {appointment.reschedule_status &&
                        appointment.reschedule_status !== "None" && (
                          <p>
                            <strong>Reschedule Status:</strong>{" "}
                            {appointment.reschedule_status}
                          </p>
                        )}
                    </div>

                    {appointment.notes && (
                      <div className="assistant-appointment-note">
                        <strong>Notes:</strong> {appointment.notes}
                      </div>
                    )}

                    {appointment.cancellation_reason && (
                      <div className="assistant-appointment-note danger">
                        <strong>Cancellation Remarks:</strong>{" "}
                        {appointment.cancellation_reason}
                      </div>
                    )}

                    {(appointment.cancelled_at ||
                      appointment.cancelled_by_name) && (
                      <div className="assistant-appointment-note danger">
                        {appointment.cancelled_at && (
                          <p>
                            <strong>Cancelled At:</strong>{" "}
                            {formatDate(appointment.cancelled_at)}
                          </p>
                        )}

                        {appointment.cancelled_by_name && (
                          <p>
                            <strong>Cancelled By:</strong>{" "}
                            {appointment.cancelled_by_name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {appointment.status !== "Cancelled" &&
                    appointment.status !== "Completed" && (
                      <div className="appointment-actions assistant-appointment-actions">
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
                disabled={updating}
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
                  value={formatDate(selectedAppointment?.appointment_date)}
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
                  disabled={updating}
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
                disabled={processingReschedule}
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
                  value={formatDate(
                    selectedRescheduleAppointment?.appointment_date,
                  )}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Requested New Date</label>
                <input
                  type="text"
                  value={formatDate(
                    selectedRescheduleAppointment?.requested_appointment_date,
                  )}
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRescheduleModal}
                  disabled={processingReschedule}
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
