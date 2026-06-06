import React, { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

function AdminXrayAnnotationView() {
  const { xray_id } = useParams();
  const navigate = useNavigate();
  const imageRef = useRef(null);

  const [xray, setXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [loading, setLoading] = useState(true);

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

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const getMarkerClass = (annotation) => {
    if (annotation.status === "Confirmed") return "xray-marker confirmed";
    if (annotation.status === "Rejected") return "xray-marker rejected";
    return "xray-marker suggested";
  };

  const getStatusClass = (annotation) => {
    if (annotation.status === "Confirmed") {
      return "status-badge status-completed";
    }

    if (annotation.status === "Rejected") {
      return "status-badge status-cancelled";
    }

    return "status-badge status-pending";
  };

  const getStatusLabel = (annotation) => {
    if (annotation.status === "Confirmed") return "Dentist Confirmed";
    if (annotation.status === "Rejected") return "Rejected";
    return "Pending Dentist Review";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Admin AI X-ray Annotation View</h2>
            <p>
              View AI-assisted X-ray annotations, dentist review status, and
              annotation details. This page is read-only for admin oversight.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/admin/dental-records")}
            >
              Back to Records
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
          Admin can view all AI-assisted annotations, including pending,
          confirmed, and rejected results. Only dentists should approve or
          reject clinical findings.
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
          <p>Loading X-ray annotation view...</p>
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
                      Annotation preview is available for image files. You can
                      still open this PDF directly.
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
                Orange markers are AI suggested, green markers are dentist
                confirmed, and red markers are rejected.
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
                  confirmed
                </p>

                <p>
                  <span className="legend-dot rejected"></span> Rejected
                </p>
              </div>

              <div className="dental-legend">
                <h3>All Annotations</h3>

                {annotations.length === 0 ? (
                  <div className="empty-state">
                    <h3>No annotations yet</h3>
                    <p>
                      AI suggestions and dentist-reviewed findings will appear
                      here once available.
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
                          {annotation.status === "Confirmed" ||
                          annotation.status === "Rejected"
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

                        <p>
                          <strong>Reviewed At:</strong>{" "}
                          {formatDate(annotation.reviewed_at)}
                        </p>

                        <p>
                          <strong>Position:</strong> X {annotation.x_position}
                          %, Y {annotation.y_position}%
                        </p>
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

export default AdminXrayAnnotationView;
