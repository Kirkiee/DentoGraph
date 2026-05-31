import React, { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

function DentistXrayAnnotation() {
  const { xray_id } = useParams();
  const navigate = useNavigate();
  const imageRef = useRef(null);

  const [xray, setXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);

  const [annotationForm, setAnnotationForm] = useState({
    label: "",
    note: "",
    x_position: "",
    y_position: "",
  });

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
    } catch (err) {
      console.error("Fetch annotations error:", err);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const handleGenerateAiSuggestions = async () => {
    try {
      setAnalyzing(true);
      setMessage("");
      setError("");

      const response = await API.post(
        `/api/xrays/${xray_id}/analyze`,
        {},
        authHeaders,
      );

      setMessage(
        response.data.message ||
          "AI suggestions generated successfully. Dentist review is required.",
      );

      fetchAnnotations();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to generate AI suggestions.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageClick = (e) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setSelectedAnnotation(null);
    setAnnotationForm({
      label: "",
      note: "",
      x_position: x.toFixed(2),
      y_position: y.toFixed(2),
    });

    setShowAnnotationModal(true);
  };

  const openEditAnnotationModal = (annotation) => {
    setSelectedAnnotation(annotation);

    setAnnotationForm({
      label: annotation.label || "",
      note: annotation.note || "",
      x_position: annotation.x_position || "",
      y_position: annotation.y_position || "",
    });

    setShowAnnotationModal(true);
  };

  const closeAnnotationModal = () => {
    setShowAnnotationModal(false);
    setSelectedAnnotation(null);
    setAnnotationForm({
      label: "",
      note: "",
      x_position: "",
      y_position: "",
    });
  };

  const handleAnnotationChange = (e) => {
    setAnnotationForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveAnnotation = async (e) => {
    e.preventDefault();

    if (
      !annotationForm.label ||
      annotationForm.x_position === "" ||
      annotationForm.y_position === ""
    ) {
      setError("Label and marker position are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      if (selectedAnnotation) {
        await API.put(
          `/api/xrays/annotations/${selectedAnnotation.annotation_id}`,
          {
            label: annotationForm.label,
            note: annotationForm.note,
            x_position: Number(annotationForm.x_position),
            y_position: Number(annotationForm.y_position),
            status: selectedAnnotation.status,
          },
          authHeaders,
        );

        setMessage("Annotation updated successfully.");
      } else {
        await API.post(
          `/api/xrays/${xray_id}/annotations`,
          {
            label: annotationForm.label,
            note: annotationForm.note,
            x_position: Number(annotationForm.x_position),
            y_position: Number(annotationForm.y_position),
          },
          authHeaders,
        );

        setMessage("Dentist annotation added successfully.");
      }

      closeAnnotationModal();
      fetchAnnotations();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save annotation.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAnnotationStatus = async (annotation, status) => {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/xrays/annotations/${annotation.annotation_id}/review`,
        {
          status,
          label: annotation.label,
          note: annotation.note,
        },
        authHeaders,
      );

      setMessage(`Annotation marked as ${status}.`);
      fetchAnnotations();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update annotation status.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnotation = async (annotation) => {
    const confirmDelete = window.confirm(
      `Delete annotation "${annotation.label}"?`,
    );

    if (!confirmDelete) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");

      await API.delete(
        `/api/xrays/annotations/${annotation.annotation_id}`,
        authHeaders,
      );

      setMessage("Annotation deleted successfully.");
      fetchAnnotations();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete annotation.");
    } finally {
      setSaving(false);
    }
  };

  const getAnnotationStatusClass = (status) => {
    switch (status) {
      case "Confirmed":
        return "status-badge status-completed";
      case "Rejected":
        return "status-badge status-cancelled";
      case "Suggested":
      default:
        return "status-badge status-pending";
    }
  };

  const getMarkerClass = (annotation) => {
    if (annotation.status === "Confirmed") return "xray-marker confirmed";
    if (annotation.status === "Rejected") return "xray-marker rejected";
    return "xray-marker suggested";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>AI-Assisted X-ray Annotation</h2>
            <p>
              Generate AI-suggested findings, then review, confirm, edit, or
              reject them. Suggestions are not final diagnoses.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/dentist/xrays")}
            >
              Back to X-rays
            </button>

            <button
              className="primary-button"
              onClick={handleGenerateAiSuggestions}
              disabled={analyzing || loading}
            >
              {analyzing ? "Analyzing..." : "Generate AI Suggestions"}
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
          AI-assisted findings are preliminary suggestions only. Patients must
          still consult a licensed dentist for interpretation, confirmation, and
          treatment planning.
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading X-ray annotation tool...</p>
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
                      PDF files can be opened directly, but image annotation is
                      currently available for JPG, PNG, WEBP, and GIF files.
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
                      onClick={handleImageClick}
                    />

                    {annotations
                      .filter((annotation) => annotation.status !== "Rejected")
                      .map((annotation) => (
                        <button
                          key={annotation.annotation_id}
                          type="button"
                          className={getMarkerClass(annotation)}
                          style={{
                            left: `${annotation.x_position}%`,
                            top: `${annotation.y_position}%`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditAnnotationModal(annotation);
                          }}
                          title={`${annotation.label} - ${annotation.status}`}
                        >
                          !
                        </button>
                      ))}
                  </>
                )}
              </div>

              <p className="xray-helper-text">
                Click anywhere on the X-ray image to add a dentist annotation.
                Click a marker to edit it.
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
                <h3>Annotations</h3>

                {annotations.length === 0 ? (
                  <div className="empty-state">
                    <h3>No annotations yet</h3>
                    <p>
                      Generate AI suggestions or click on the image to add one.
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

                          <span
                            className={getAnnotationStatusClass(
                              annotation.status,
                            )}
                          >
                            {annotation.status}
                          </span>
                        </div>

                        <p>
                          <strong>Source:</strong> {annotation.source}
                        </p>

                        <p>
                          <strong>Note:</strong>{" "}
                          {annotation.note || "No note provided"}
                        </p>

                        <p>
                          <strong>Position:</strong> X {annotation.x_position}%
                          , Y {annotation.y_position}%
                        </p>

                        <div
                          className="appointment-actions"
                          style={{ flexDirection: "row", flexWrap: "wrap" }}
                        >
                          <button
                            className="secondary-button"
                            onClick={() => openEditAnnotationModal(annotation)}
                            disabled={saving}
                          >
                            Edit
                          </button>

                          {annotation.status !== "Confirmed" && (
                            <button
                              className="primary-button"
                              onClick={() =>
                                handleUpdateAnnotationStatus(
                                  annotation,
                                  "Confirmed",
                                )
                              }
                              disabled={saving}
                            >
                              Confirm
                            </button>
                          )}

                          {annotation.status !== "Rejected" && (
                            <button
                              className="danger-button"
                              onClick={() =>
                                handleUpdateAnnotationStatus(
                                  annotation,
                                  "Rejected",
                                )
                              }
                              disabled={saving}
                            >
                              Reject
                            </button>
                          )}

                          <button
                            className="danger-button"
                            onClick={() => handleDeleteAnnotation(annotation)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAnnotationModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedAnnotation ? "Edit Annotation" : "Add Annotation"}
                </h3>
                <p>
                  Add or update an X-ray finding. Confirmed annotations become
                  part of the reviewed record.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeAnnotationModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveAnnotation}>
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  name="label"
                  value={annotationForm.label}
                  onChange={handleAnnotationChange}
                  placeholder="Example: Possible cavity"
                  required
                />
              </div>

              <div className="form-group">
                <label>Note</label>
                <textarea
                  name="note"
                  value={annotationForm.note}
                  onChange={handleAnnotationChange}
                  placeholder="Add clinical note or review details..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>X Position (%)</label>
                <input
                  type="number"
                  name="x_position"
                  value={annotationForm.x_position}
                  onChange={handleAnnotationChange}
                  step="0.01"
                  min="0"
                  max="100"
                  required
                />
              </div>

              <div className="form-group">
                <label>Y Position (%)</label>
                <input
                  type="number"
                  name="y_position"
                  value={annotationForm.y_position}
                  onChange={handleAnnotationChange}
                  step="0.01"
                  min="0"
                  max="100"
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeAnnotationModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Annotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistXrayAnnotation;
