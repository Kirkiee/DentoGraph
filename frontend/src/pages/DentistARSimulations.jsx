import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/arBracesSimulation.css";

function DentistARSimulations() {
  const navigate = useNavigate();
  const { recordId } = useParams();

  const [record, setRecord] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [reviewForms, setReviewForms] = useState({});
  const [logsBySimulation, setLogsBySimulation] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [loadingLogsId, setLoadingLogsId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchARSimulations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const fetchARSimulations = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await API.get(
        `/api/ar-simulations/dentist/record/${recordId}`,
        authHeaders,
      );

      const previews = response.data.simulations || [];

      setRecord(response.data.record || null);
      setSimulations(previews);

      const initialForms = {};

      previews.forEach((preview) => {
        initialForms[preview.simulation_id] = {
          review_status: preview.review_status || "Pending Review",
          dentist_notes: preview.dentist_notes || "",
        };
      });

      setReviewForms(initialForms);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load AR simulation previews for this record.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchSimulationLogs = async (simulationId) => {
    try {
      setLoadingLogsId(simulationId);
      setError("");

      const response = await API.get(
        `/api/ar-simulations/${simulationId}/logs`,
        authHeaders,
      );

      setLogsBySimulation((prev) => ({
        ...prev,
        [simulationId]: response.data.logs || [],
      }));
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load AR simulation history.",
      );
    } finally {
      setLoadingLogsId(null);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    if (filePath.startsWith("http")) {
      return filePath;
    }

    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;

    return `${baseURL}/${cleanPath}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString();
  };

  const getReviewStatusClass = (status) => {
    switch (status) {
      case "Reviewed":
        return "status-badge status-completed";
      case "For Consultation":
        return "status-badge status-scheduled";
      case "Pending Review":
      default:
        return "status-badge status-pending";
    }
  };

  const getBraceStyleLabelFromValue = (styleValue) => {
    switch (styleValue) {
      case "ceramic":
        return "Ceramic Braces";
      case "blue":
        return "Blue Ligatures";
      case "pink":
        return "Pink Ligatures";
      case "green":
        return "Green Ligatures";
      case "purple":
        return "Purple Ligatures";
      case "metal":
      default:
        return "Metal Braces";
    }
  };

  const handleReviewChange = (simulationId, field, value) => {
    setReviewForms((prev) => ({
      ...prev,
      [simulationId]: {
        ...prev[simulationId],
        [field]: value,
      },
    }));
  };

  const saveReview = async (simulationId) => {
    try {
      setSavingReviewId(simulationId);
      setMessage("");
      setError("");

      const form = reviewForms[simulationId];

      await API.put(
        `/api/ar-simulations/dentist/${simulationId}/review`,
        {
          review_status: form.review_status,
          dentist_notes: form.dentist_notes,
        },
        authHeaders,
      );

      setMessage("AR simulation review updated successfully.");
      await fetchARSimulations();
      await fetchSimulationLogs(simulationId);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update AR simulation review.",
      );
    } finally {
      setSavingReviewId(null);
    }
  };

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>AR Braces Simulations</h2>
            <p>
              View and review patient-generated AR braces previews linked to
              this dental record.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate(`/dentist/dental-records/${recordId}`)}
            >
              Back to Record
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={fetchARSimulations}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading AR simulation previews...</p>
        ) : !record ? (
          <div className="empty-state">
            <h3>Dental record not found</h3>
            <p>
              This record may not exist or may not be assigned to your dentist
              account.
            </p>
          </div>
        ) : (
          <>
            <div className="appointment-item" style={{ marginBottom: "18px" }}>
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Record #{record.record_id}</h3>

                  <span className="status-badge status-scheduled">
                    {record.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Patient:</strong>{" "}
                  {record.patient_name || `Patient ID ${record.patient_id}`}
                </p>

                <p>
                  <strong>Dentist:</strong>{" "}
                  {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                </p>

                <p>
                  <strong>Record Date:</strong>{" "}
                  {formatDate(
                    record.record_date ||
                      record.date_created ||
                      record.created_at,
                  )}
                </p>

                {record.clinic_name && (
                  <p>
                    <strong>Clinic:</strong> {record.clinic_name}
                  </p>
                )}

                {record.notes && (
                  <p>
                    <strong>Record Notes:</strong> {record.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="info-message">
              AR braces previews are for patient education and treatment
              visualization only. Final orthodontic diagnosis and treatment
              planning must still be completed by a licensed dentist.
            </div>

            <div className="appointments-header" style={{ marginTop: "28px" }}>
              <div>
                <h2>Saved AR Previews</h2>
                <p>
                  Review captured AR braces simulations submitted by the patient
                  for this dental record.
                </p>
              </div>
            </div>

            {simulations.length === 0 ? (
              <div className="empty-state">
                <h3>No AR previews yet</h3>
                <p>
                  Patient AR braces previews linked to this dental record will
                  appear here once captured.
                </p>
              </div>
            ) : (
              <div className="appointments-list">
                {simulations.map((simulation) => {
                  const form = reviewForms[simulation.simulation_id] || {
                    review_status: simulation.review_status || "Pending Review",
                    dentist_notes: simulation.dentist_notes || "",
                  };

                  const logs = logsBySimulation[simulation.simulation_id] || [];

                  return (
                    <div
                      className="appointment-item"
                      key={simulation.simulation_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>AR Preview #{simulation.simulation_id}</h3>

                          <span
                            className={getReviewStatusClass(
                              simulation.review_status || "Pending Review",
                            )}
                          >
                            {simulation.review_status || "Pending Review"}
                          </span>
                        </div>

                        <div className="ar-saved-preview">
                          <img
                            src={getFileUrl(simulation.image_path)}
                            alt={`AR braces simulation ${simulation.simulation_id}`}
                          />
                        </div>

                        <p>
                          <strong>Record ID:</strong> {simulation.record_id}
                        </p>

                        <p>
                          <strong>Patient:</strong>{" "}
                          {simulation.patient_name ||
                            `Patient ID ${simulation.patient_id}`}
                        </p>

                        <p>
                          <strong>Captured:</strong>{" "}
                          {formatDate(simulation.created_at)}
                        </p>

                        <p>
                          <strong>Reviewed At:</strong>{" "}
                          {formatDate(simulation.reviewed_at)}
                        </p>

                        <p>
                          <strong>Type:</strong> AR Braces Simulation
                        </p>

                        <p>
                          <strong>Braces Style:</strong>{" "}
                          {getBraceStyleLabelFromValue(simulation.brace_style)}
                        </p>

                        {simulation.notes && (
                          <p>
                            <strong>Patient Notes:</strong> {simulation.notes}
                          </p>
                        )}

                        <div className="ar-review-form">
                          <div className="form-group">
                            <label>Review Status</label>
                            <select
                              value={form.review_status}
                              onChange={(e) =>
                                handleReviewChange(
                                  simulation.simulation_id,
                                  "review_status",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="Pending Review">
                                Pending Review
                              </option>
                              <option value="Reviewed">Reviewed</option>
                              <option value="For Consultation">
                                For Consultation
                              </option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Dentist Notes</label>
                            <textarea
                              value={form.dentist_notes}
                              onChange={(e) =>
                                handleReviewChange(
                                  simulation.simulation_id,
                                  "dentist_notes",
                                  e.target.value,
                                )
                              }
                              placeholder="Enter review notes or consultation recommendation..."
                              rows="4"
                            />
                          </div>

                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => saveReview(simulation.simulation_id)}
                            disabled={
                              savingReviewId === simulation.simulation_id
                            }
                          >
                            {savingReviewId === simulation.simulation_id
                              ? "Saving..."
                              : "Save Review"}
                          </button>
                        </div>

                        <div className="ar-log-section">
                          <div className="appointments-header">
                            <div>
                              <h3>Activity History</h3>
                              <p>
                                Track when this AR preview was captured and
                                reviewed.
                              </p>
                            </div>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                fetchSimulationLogs(simulation.simulation_id)
                              }
                              disabled={
                                loadingLogsId === simulation.simulation_id
                              }
                            >
                              {loadingLogsId === simulation.simulation_id
                                ? "Loading..."
                                : "View History"}
                            </button>
                          </div>

                          {logs.length > 0 && (
                            <div className="annotation-list">
                              {logs.map((log) => (
                                <div
                                  className="annotation-card"
                                  key={log.log_id}
                                >
                                  <h3>{log.action}</h3>

                                  <p>
                                    <strong>By:</strong>{" "}
                                    {log.user_name || "System"}{" "}
                                    {log.user_role ? `(${log.user_role})` : ""}
                                  </p>

                                  <p>
                                    <strong>Date:</strong>{" "}
                                    {formatDate(log.created_at)}
                                  </p>

                                  {log.details && (
                                    <p>
                                      <strong>Details:</strong> {log.details}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="appointment-actions">
                        <a
                          className="secondary-button"
                          href={getFileUrl(simulation.image_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>

                        <a
                          className="primary-button"
                          href={getFileUrl(simulation.image_path)}
                          download={`dentograph-ar-preview-${simulation.simulation_id}.png`}
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default DentistARSimulations;
