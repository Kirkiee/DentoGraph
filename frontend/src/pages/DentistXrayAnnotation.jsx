import React, { useEffect, useMemo, useRef, useState } from "react";
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
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const [modalError, setModalError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const isValidXrayId =
    xray_id &&
    xray_id !== "undefined" &&
    xray_id !== "null" &&
    Number.isInteger(Number(xray_id)) &&
    Number(xray_id) > 0;

  useEffect(() => {
    if (!isValidXrayId) {
      setLoading(false);
      setError("Invalid X-ray selected. Please return to the X-ray list.");
      return;
    }

    fetchPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xray_id]);

  useEffect(() => {
    if (showAnnotationModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showAnnotationModal]);

  const fetchPageData = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([fetchXray(false), fetchAnnotations(false)]);
    } finally {
      setLoading(false);
    }
  };

  const fetchXray = async (manageLoading = true) => {
    if (!isValidXrayId) return;

    try {
      if (manageLoading) {
        setLoading(true);
      }

      setError("");

      const response = await API.get(`/api/xrays/${xray_id}`, authHeaders);
      setXray(response.data.xray || null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-ray image.");
    } finally {
      if (manageLoading) {
        setLoading(false);
      }
    }
  };

  const fetchAnnotations = async (manageLoading = true) => {
    if (!isValidXrayId) return;

    try {
      if (manageLoading) {
        setLoadingAnnotations(true);
      }

      const response = await API.get(
        `/api/xrays/${xray_id}/annotations`,
        authHeaders,
      );

      setAnnotations(response.data.annotations || []);
    } catch (err) {
      console.error("Fetch annotations error:", err);
    } finally {
      if (manageLoading) {
        setLoadingAnnotations(false);
      }
    }
  };

  const refreshPage = async () => {
    try {
      setRefreshing(true);
      setError("");
      setMessage("");

      await Promise.all([fetchXray(false), fetchAnnotations(false)]);
    } finally {
      setRefreshing(false);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const normalizedPath = String(filePath).replace(/\\/g, "/");

    if (
      normalizedPath.startsWith("http://") ||
      normalizedPath.startsWith("https://")
    ) {
      return normalizedPath;
    }

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const cleanPath = normalizedPath.startsWith("/")
      ? normalizedPath.slice(1)
      : normalizedPath;

    return `${baseURL}/${cleanPath}`;
  };

  const getFileName = (filePath) => {
    if (!filePath) return "Uploaded X-ray file";

    const normalizedPath = String(filePath).replace(/\\/g, "/");
    const parts = normalizedPath.split("/");

    return parts[parts.length - 1] || "Uploaded X-ray file";
  };

  const isPdfFile = (filePath) => {
    return String(filePath || "")
      .toLowerCase()
      .endsWith(".pdf");
  };

  const handleGenerateAiSuggestions = async () => {
    if (!isValidXrayId) {
      setError("Invalid X-ray selected. Please return to the X-ray list.");
      return;
    }

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
    if (!imageRef.current || isPdfFile(xray?.file_path)) return;

    const rect = imageRef.current.getBoundingClientRect();

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setSelectedAnnotation(null);
    setModalError("");
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
    setModalError("");

    setAnnotationForm({
      label: annotation.label || "",
      note: annotation.note || "",
      x_position: annotation.x_position || "",
      y_position: annotation.y_position || "",
    });

    setShowAnnotationModal(true);
  };

  const closeAnnotationModal = () => {
    if (saving) return;

    setShowAnnotationModal(false);
    setSelectedAnnotation(null);
    setModalError("");

    setAnnotationForm({
      label: "",
      note: "",
      x_position: "",
      y_position: "",
    });
  };

  const handleAnnotationChange = (e) => {
    setModalError("");

    setAnnotationForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveAnnotation = async (e) => {
    e.preventDefault();

    if (
      !annotationForm.label.trim() ||
      annotationForm.x_position === "" ||
      annotationForm.y_position === ""
    ) {
      setModalError("Label and marker position are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");
      setModalError("");

      if (selectedAnnotation) {
        await API.put(
          `/api/xrays/annotations/${selectedAnnotation.annotation_id}`,
          {
            label: annotationForm.label.trim(),
            note: annotationForm.note.trim(),
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
            label: annotationForm.label.trim(),
            note: annotationForm.note.trim(),
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
      setModalError(err.response?.data?.error || "Unable to save annotation.");
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

  const formatConfidence = (confidence) => {
    if (confidence === null || confidence === undefined || confidence === "") {
      return "N/A";
    }

    return `${(Number(confidence) * 100).toFixed(1)}%`;
  };

  const getConfidenceLevel = (confidence) => {
    const percent = Number(confidence || 0) * 100;

    if (percent >= 80) return "High";
    if (percent >= 50) return "Moderate";

    return "Low";
  };

  const parseAnnotationNote = (note) => {
    if (!note) {
      return {
        isStructured: false,
        plainNote: "No note provided",
        interpretation: "",
        reason: "",
        confidence: "",
        location: "",
        reminder: "",
      };
    }

    const lines = String(note)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const getLineValue = (prefix) => {
      const matchedLine = lines.find((line) =>
        line.toLowerCase().startsWith(prefix.toLowerCase()),
      );

      if (!matchedLine) return "";

      return matchedLine.replace(new RegExp(`^${prefix}\\s*`, "i"), "").trim();
    };

    const interpretation = getLineValue("AI Interpretation:");
    const reason = getLineValue("Reason:");
    const confidence = getLineValue("Confidence:");
    const location = getLineValue("Location:");
    const reminder = getLineValue("Clinical Reminder:");

    const isStructured =
      interpretation || reason || confidence || location || reminder;

    return {
      isStructured,
      plainNote: note,
      interpretation,
      reason,
      confidence,
      location,
      reminder,
    };
  };

  const renderAnnotationInterpretation = (annotation) => {
    const parsedNote = parseAnnotationNote(annotation.note);

    if (!parsedNote.isStructured) {
      return (
        <div className="dentist-annotation-note-box">
          <p>
            <strong>Note:</strong> {parsedNote.plainNote}
          </p>
        </div>
      );
    }

    return (
      <div className="dentist-annotation-note-box">
        {parsedNote.interpretation && (
          <p>
            <strong>AI Interpretation:</strong> {parsedNote.interpretation}
          </p>
        )}

        {parsedNote.reason && (
          <p>
            <strong>Reason:</strong> {parsedNote.reason}
          </p>
        )}

        {parsedNote.confidence && (
          <p>
            <strong>Confidence Explanation:</strong> {parsedNote.confidence}
          </p>
        )}

        {parsedNote.location && (
          <p>
            <strong>Location:</strong> {parsedNote.location}
          </p>
        )}

        {parsedNote.reminder && (
          <p>
            <strong>Clinical Reminder:</strong> {parsedNote.reminder}
          </p>
        )}
      </div>
    );
  };

  const annotationSummary = useMemo(() => {
    return {
      total: annotations.length,
      suggested: annotations.filter(
        (annotation) => annotation.status === "Suggested",
      ).length,
      confirmed: annotations.filter(
        (annotation) => annotation.status === "Confirmed",
      ).length,
      rejected: annotations.filter(
        (annotation) => annotation.status === "Rejected",
      ).length,
    };
  }, [annotations]);

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 3 }).map((_, index) => (
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

          <div className="appointment-actions dentist-annotation-top-actions">
            <button
              className="secondary-button"
              onClick={() => navigate("/dentist/xrays")}
            >
              Back to X-rays
            </button>

            <button
              className="primary-button"
              onClick={handleGenerateAiSuggestions}
              disabled={
                analyzing || loading || !xray || isPdfFile(xray?.file_path)
              }
            >
              {analyzing ? "Analyzing..." : "Generate AI Suggestions"}
            </button>

            <button
              className="secondary-button"
              onClick={refreshPage}
              disabled={loading || refreshing}
            >
              {loading || refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          AI-assisted findings are preliminary suggestions only. Patients must
          still consult a licensed dentist for interpretation, confirmation, and
          treatment planning.
        </div>

        {xray?.clinic_name && (
          <div className="info-message">
            <strong>Clinic Location:</strong> {xray.clinic_name}
          </div>
        )}

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>X-ray annotation notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total Annotations</span>
            <strong>{annotationSummary.total}</strong>
            <p>All findings linked to this X-ray.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Suggested</span>
            <strong>{annotationSummary.suggested}</strong>
            <p>AI or pending review suggestions.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Confirmed</span>
            <strong>{annotationSummary.confirmed}</strong>
            <p>Dentist-confirmed findings.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Rejected</span>
            <strong>{annotationSummary.rejected}</strong>
            <p>Suggestions rejected after review.</p>
          </div>
        </div>

        {loading ? (
          renderLoadingState()
        ) : !xray ? (
          <div className="empty-state">
            <h3>X-ray not found</h3>
            <p>The selected X-ray image could not be loaded.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/dentist/xrays")}
            >
              Back to X-rays
            </button>
          </div>
        ) : (
          <div className="dentist-annotation-layout">
            <div className="dentist-annotation-image-section">
              <div className="dentist-annotation-image-card">
                <div className="appointments-header">
                  <div>
                    <h2>X-ray Preview</h2>
                    <p>
                      Click on the image to add a manual dentist annotation.
                      Click a marker to edit it.
                    </p>
                  </div>
                </div>

                <div className="xray-image-wrapper dentist-annotation-image-wrapper">
                  {isPdfFile(xray.file_path) ? (
                    <div className="empty-state">
                      <h3>PDF X-ray file</h3>
                      <p>
                        PDF files can be opened directly, but image annotation
                        is currently available for JPG, PNG, WEBP, and GIF
                        files.
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
                        .filter(
                          (annotation) => annotation.status !== "Rejected",
                        )
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
                  Rejected annotations are kept in the review list but hidden
                  from the image markers to avoid clutter.
                </p>
              </div>
            </div>

            <div className="dentist-annotation-side-section">
              <div className="dentist-annotation-panel">
                <div className="appointments-header">
                  <div>
                    <h2>X-ray Information</h2>
                    <p>Review file details and marker meaning.</p>
                  </div>
                </div>

                <div className="dentist-annotation-info-grid">
                  <p>
                    <strong>X-ray ID:</strong> #{xray.xray_id}
                  </p>

                  <p>
                    <strong>Record ID:</strong> {xray.record_id}
                  </p>

                  <p>
                    <strong>Tooth:</strong>{" "}
                    {xray.tooth_number
                      ? `Tooth #${xray.tooth_number}`
                      : "General"}
                  </p>

                  <p>
                    <strong>Uploaded:</strong> {formatDate(xray.upload_date)}
                  </p>

                  <p>
                    <strong>File:</strong> {getFileName(xray.file_path)}
                  </p>
                </div>

                <div className="appointment-actions dentist-annotation-file-actions">
                  <a
                    className="secondary-button"
                    href={getFileUrl(xray.file_path)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Original File
                  </a>
                </div>

                <div className="dental-legend dentist-annotation-legend">
                  <h3>Marker Legend</h3>

                  <p>
                    <span className="legend-dot ai-suggested"></span> AI
                    suggested
                  </p>

                  <p>
                    <span className="legend-dot confirmed"></span> Dentist
                    confirmed
                  </p>

                  <p>
                    <span className="legend-dot rejected"></span> Rejected
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && xray && (
          <div className="patient-dashboard-section">
            <div className="appointments-header">
              <div>
                <h2>Annotation Review</h2>
                <p>
                  {loadingAnnotations
                    ? "Loading annotations..."
                    : `${annotations.length} annotations available for this X-ray.`}
                </p>
              </div>
            </div>

            {loadingAnnotations ? (
              renderLoadingState()
            ) : annotations.length === 0 ? (
              <div className="empty-state">
                <h3>No annotations yet</h3>
                <p>
                  Generate AI suggestions or click on the image to add a manual
                  dentist annotation.
                </p>
              </div>
            ) : (
              <div className="dentist-annotation-card-grid">
                {annotations.map((annotation) => (
                  <div
                    className="dentist-annotation-card"
                    key={annotation.annotation_id}
                  >
                    <div className="appointment-title-row">
                      <h3>{annotation.label}</h3>

                      <span
                        className={getAnnotationStatusClass(annotation.status)}
                      >
                        {annotation.status}
                      </span>
                    </div>

                    <div className="dentist-annotation-meta-grid">
                      <p>
                        <strong>Source:</strong> {annotation.source || "Manual"}
                      </p>

                      <p>
                        <strong>Confidence:</strong>{" "}
                        {formatConfidence(annotation.confidence)}
                        {annotation.confidence !== null &&
                          annotation.confidence !== undefined && (
                            <> ({getConfidenceLevel(annotation.confidence)})</>
                          )}
                      </p>

                      <p>
                        <strong>Position:</strong> X {annotation.x_position}%, Y{" "}
                        {annotation.y_position}%
                      </p>

                      {annotation.dentist_name && (
                        <p>
                          <strong>Reviewed By:</strong>{" "}
                          {annotation.dentist_name}
                        </p>
                      )}

                      {annotation.reviewed_at && (
                        <p>
                          <strong>Reviewed At:</strong>{" "}
                          {formatDate(annotation.reviewed_at)}
                        </p>
                      )}
                    </div>

                    {renderAnnotationInterpretation(annotation)}

                    <div className="appointment-actions dentist-annotation-card-actions">
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
                            handleUpdateAnnotationStatus(annotation, "Rejected")
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
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveAnnotation}>
              {modalError && <div className="error-message">{modalError}</div>}

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
                <label>Interpretation / Clinical Note</label>
                <textarea
                  name="note"
                  value={annotationForm.note}
                  onChange={handleAnnotationChange}
                  placeholder="Add interpretation, clinical note, or review details..."
                  rows="6"
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
                  disabled={saving}
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
