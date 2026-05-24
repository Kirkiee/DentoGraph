import React, { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

function PatientXrayAnnotationView() {
  const { xray_id } = useParams();
  const navigate = useNavigate();
  const imageRef = useRef(null);

  const [xray, setXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [requestingAnalysis, setRequestingAnalysis] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchXray();
    fetchAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xray_id]);

  const fetchXray = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(`/api/xrays/${xray_id}`, authHeaders);
      setXray(response.data.xray || null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-ray image.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotations = async () => {
    try {
      const response = await API.get(
        `/api/xrays/${xray_id}/annotations`,
        authHeaders,
      );

      setAnnotations(response.data.annotations || []);
      setPendingReviewCount(response.data.pending_review_count || 0);
    } catch (err) {
      console.error("Fetch annotations error:", err);
    }
  };

  const handleRequestAiAnalysis = async () => {
    try {
      setRequestingAnalysis(true);
      setMessage("");
      setError("");

      const response = await API.post(
        `/api/xrays/${xray_id}/analyze`,
        {},
        authHeaders,
      );

      setMessage(
        response.data.message ||
          "AI analysis request submitted. Results are pending dentist review.",
      );

      fetchAnnotations();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to request AI X-ray analysis.",
      );
    } finally {
      setRequestingAnalysis(false);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const getMarkerClass = (annotation) => {
    if (annotation.status === "Confirmed") {
      return "xray-marker confirmed";
    }

    return "xray-marker suggested";
  };

  const getStatusClass = (annotation) => {
    if (annotation.status === "Confirmed") {
      return "status-badge status-completed";
    }

    return "status-badge status-pending";
  };

  const getStatusLabel = (annotation) => {
    if (annotation.status === "Confirmed") {
      return "Dentist Confirmed";
    }

    return "Pending Dentist Review";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>AI-Assisted X-ray Review</h2>
            <p>
              Request AI-assisted X-ray analysis and view annotations related to
              your X-ray.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/patient/xrays")}
            >
              Back to X-rays
            </button>

            <button
              className="primary-button"
              onClick={handleRequestAiAnalysis}
              disabled={requestingAnalysis || loading}
            >
              {requestingAnalysis ? "Requesting..." : "Request AI Analysis"}
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                fetchXray();
                fetchAnnotations();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          AI-assisted annotations are preliminary suggestions only. They are not
          final diagnoses and must still be reviewed by your dentist.
        </div>

        {pendingReviewCount > 0 && (
          <div className="info-message">
            {pendingReviewCount} AI suggestion
            {pendingReviewCount > 1 ? "s are" : " is"} currently pending dentist
            review.
          </div>
        )}

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading X-ray review...</p>
        ) : !xray ? (
          <div className="empty-state">
            <h3>X-ray not found</h3>
            <p>The selected X-ray image could not be loaded.</p>
          </div>
        ) : (
          <div className="xray-annotation-layout">
            <div className="xray-annotation-viewer">
              <div className="xray-image-wrapper">
                {xray.file_path?.toLowerCase().endsWith(".pdf") ? (
                  <div className="empty-state">
                    <h3>PDF X-ray file</h3>
                    <p>
                      AI annotation preview is available for image files. You
                      can still open this PDF directly.
                    </p>

                    <a
                      className="primary-button"
                      href={getFileUrl(xray.file_path)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PDF
                    </a>
                  </div>
                ) : (
                  <>
                    <img
                      ref={imageRef}
                      src={getFileUrl(xray.file_path)}
                      alt="Dental X-ray"
                      className="xray-annotation-image"
                    />

                    {annotations.map((annotation) => (
                      <button
                        key={annotation.annotation_id}
                        type="button"
                        className={getMarkerClass(annotation)}
                        style={{
                          left: `${annotation.x_position}%`,
                          top: `${annotation.y_position}%`,
                        }}
                        title={`${annotation.label} - ${getStatusLabel(
                          annotation,
                        )}`}
                      >
                        !
                      </button>
                    ))}
                  </>
                )}
              </div>

              <p className="xray-helper-text">
                Orange markers are AI-suggested findings pending dentist review.
                Green markers are dentist-confirmed findings.
              </p>
            </div>

            <div className="xray-annotation-panel">
              <h3>X-ray #{xray.xray_id}</h3>

              <p>
                <strong>Record ID:</strong> {xray.record_id}
              </p>

              <p>
                <strong>Tooth:</strong>{" "}
                {xray.tooth_number ? `Tooth #${xray.tooth_number}` : "General"}
              </p>

              <p>
                <strong>Uploaded:</strong> {formatDate(xray.upload_date)}
              </p>

              <div className="dental-legend">
                <h3>Marker Legend</h3>

                <p>
                  <span className="legend-dot ai-suggested"></span> AI suggested
                  / pending dentist review
                </p>

                <p>
                  <span className="legend-dot confirmed"></span> Dentist
                  confirmed finding
                </p>
              </div>

              <div className="dental-legend">
                <h3>AI-Assisted Annotations</h3>

                {annotations.length === 0 ? (
                  <div className="empty-state">
                    <h3>No AI annotations yet</h3>
                    <p>
                      Request AI analysis to generate preliminary suggestions.
                      These still need dentist review before they become
                      confirmed clinical findings.
                    </p>
                  </div>
                ) : (
                  <div className="annotation-list">
                    {annotations.map((annotation) => (
                      <div
                        className="annotation-card"
                        key={annotation.annotation_id}
                      >
                        <div className="appointment-title-row">
                          <h3>{annotation.label}</h3>

                          <span className={getStatusClass(annotation)}>
                            {getStatusLabel(annotation)}
                          </span>
                        </div>

                        <p>
                          <strong>Source:</strong>{" "}
                          {annotation.source === "AI"
                            ? "AI-assisted suggestion"
                            : "Dentist annotation"}
                        </p>

                        <p>
                          <strong>Reviewed by:</strong>{" "}
                          {annotation.status === "Confirmed"
                            ? annotation.dentist_name || "Dentist"
                            : "Pending dentist review"}
                        </p>

                        <p>
                          <strong>Note:</strong>{" "}
                          {annotation.note || "No note provided"}
                        </p>

                        <p>
                          <strong>Created At:</strong>{" "}
                          {formatDate(annotation.created_at)}
                        </p>

                        {annotation.status === "Confirmed" && (
                          <p>
                            <strong>Reviewed At:</strong>{" "}
                            {formatDate(annotation.reviewed_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientXrayAnnotationView;
