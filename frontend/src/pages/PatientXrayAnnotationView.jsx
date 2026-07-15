import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

function PatientXrayAnnotationView() {
  const { xray_id } = useParams();
  const navigate = useNavigate();
  const imageRef = useRef(null);

  const isValidXrayId =
    xray_id && xray_id !== "undefined" && !Number.isNaN(Number(xray_id));

  const [xray, setXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingAnnotations, setLoadingAnnotations] = useState(true);
  const [requestingAnalysis, setRequestingAnalysis] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    if (!isValidXrayId) {
      setLoading(false);
      setLoadingAnnotations(false);
      setError(
        "Invalid X-ray selected. Please go back to the X-ray list and try again.",
      );
      return;
    }

    fetchXray();
    fetchAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xray_id]);

  const fetchXray = async (isRefresh = false) => {
    if (!isValidXrayId) {
      setLoading(false);
      setError(
        "Invalid X-ray selected. Please go back to the X-ray list and try again.",
      );
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get(`/api/xrays/${xray_id}`, authHeaders);
      setXray(response.data.xray || null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-ray image.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnnotations = async (isRefresh = false) => {
    if (!isValidXrayId) {
      setLoadingAnnotations(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingAnnotations(true);
      }

      const response = await API.get(
        `/api/xrays/${xray_id}/annotations`,
        authHeaders,
      );

      setAnnotations(response.data.annotations || []);
      setPendingReviewCount(response.data.pending_review_count || 0);
    } catch (err) {
      console.error("Fetch annotations error:", err);
    } finally {
      setLoadingAnnotations(false);
      setRefreshing(false);
    }
  };

  const refreshPage = () => {
    if (!isValidXrayId) {
      setError(
        "Invalid X-ray selected. Please go back to the X-ray list and try again.",
      );
      return;
    }

    fetchXray(true);
    fetchAnnotations(true);
  };

  const handleRequestAiAnalysis = async () => {
    if (!isValidXrayId) {
      setError(
        "Invalid X-ray selected. Please go back to the X-ray list and try again.",
      );
      return;
    }

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

      fetchAnnotations(true);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to request AI X-ray analysis.",
      );
    } finally {
      setRequestingAnalysis(false);
    }
  };

  const getApiHost = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL.replace(/\/$/, "");
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    return isLocalhost
      ? "http://localhost:5000"
      : "https://api.dentograph.site";
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

    const pathWithSlash = normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

    return `${getApiHost()}${pathWithSlash}`;
  };

  const getFileName = (filePath) => {
    if (!filePath) return "No file name";
    return String(filePath).split("/").pop() || filePath;
  };

  const isPdfFile = (filePath) => {
    return String(filePath || "")
      .toLowerCase()
      .endsWith(".pdf");
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
        <p>
          <strong>Note:</strong> {parsedNote.plainNote}
        </p>
      );
    }

    return (
      <div className="patient-ai-note-box">
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

  const summary = useMemo(() => {
    const confirmed = annotations.filter(
      (annotation) => annotation.status === "Confirmed",
    ).length;

    const pending = annotations.filter(
      (annotation) => annotation.status !== "Confirmed",
    ).length;

    const aiSuggested = annotations.filter(
      (annotation) => annotation.source === "AI",
    ).length;

    return {
      total: annotations.length,
      pending,
      confirmed,
      aiSuggested,
    };
  }, [annotations]);

  const renderLoadingState = () => {
    return (
      <div className="patient-xray-review-layout">
        <div className="patient-xray-review-image-card loading-card">
          <div className="loading-line loading-title"></div>
          <div className="loading-line loading-text"></div>
          <div className="loading-line loading-text"></div>
        </div>

        <div className="patient-xray-review-panel loading-card">
          <div className="loading-line loading-title"></div>
          <div className="loading-line loading-text"></div>
          <div className="loading-line loading-text"></div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>AI-Assisted X-ray Review</h2>
            <p>
              View your X-ray image, AI-assisted suggestions, dentist review
              status, and annotation details.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              className="secondary-button"
              onClick={() => navigate("/patient/xrays")}
            >
              Back to X-rays
            </button>

            <button
              className="primary-button"
              onClick={handleRequestAiAnalysis}
              disabled={requestingAnalysis || loading || !isValidXrayId}
            >
              {requestingAnalysis ? "Requesting..." : "Request AI Analysis"}
            </button>

            <button
              className="secondary-button"
              onClick={refreshPage}
              disabled={
                loading || loadingAnnotations || refreshing || !isValidXrayId
              }
            >
              {loading || loadingAnnotations || refreshing
                ? "Refreshing..."
                : "Refresh"}
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

        {xray?.clinic_name && (
          <div className="info-message">
            <strong>Clinic Location:</strong> {xray.clinic_name}
          </div>
        )}

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>X-ray review notice</strong>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          renderLoadingState()
        ) : !isValidXrayId ? (
          <div className="empty-state">
            <h3>Invalid X-ray selected</h3>
            <p>
              Please return to the X-ray list and open AI Review from a valid
              X-ray card.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate("/patient/xrays")}
            >
              Back to X-rays
            </button>
          </div>
        ) : !xray ? (
          <div className="empty-state">
            <h3>X-ray not found</h3>
            <p>The selected X-ray image could not be loaded.</p>
          </div>
        ) : (
          <>
            <div className="patient-dashboard-summary-grid">
              <div className="patient-dashboard-card">
                <span>Total Annotations</span>
                <strong>{summary.total}</strong>
                <p>All annotations linked to this X-ray.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Pending Review</span>
                <strong>{summary.pending}</strong>
                <p>Suggestions awaiting dentist confirmation.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Confirmed</span>
                <strong>{summary.confirmed}</strong>
                <p>Findings reviewed by the dentist.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>AI Suggested</span>
                <strong>{summary.aiSuggested}</strong>
                <p>Annotations generated by AI assistance.</p>
              </div>
            </div>

            <div className="patient-xray-review-layout">
              <div className="patient-xray-review-image-card">
                <div className="appointments-header">
                  <div>
                    <h2>X-ray Preview</h2>
                    <p>
                      Markers appear over image files. PDF files can be opened
                      directly.
                    </p>
                  </div>
                </div>

                <div className="xray-image-wrapper patient-xray-image-wrapper">
                  {isPdfFile(xray.file_path) ? (
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
                  Orange markers are AI-suggested findings pending dentist
                  review. Green markers are dentist-confirmed findings.
                </p>
              </div>

              <div className="patient-xray-review-panel">
                <div className="appointments-header">
                  <div>
                    <h2>X-ray Information</h2>
                    <p>Basic details for this uploaded X-ray.</p>
                  </div>
                </div>

                <div className="patient-record-detail-grid">
                  <p>
                    <strong>X-ray ID:</strong> {xray.xray_id || xray_id}
                  </p>

                  <p>
                    <strong>Record ID:</strong> {xray.record_id || "N/A"}
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

                <div className="patient-xray-actions">
                  <a
                    className="secondary-button"
                    href={getFileUrl(xray.file_path)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Original File
                  </a>
                </div>

                <div className="patient-marker-legend">
                  <h3>Marker Legend</h3>

                  <p>
                    <span className="legend-dot ai-suggested"></span>
                    AI suggested / pending dentist review
                  </p>

                  <p>
                    <span className="legend-dot confirmed"></span>
                    Dentist confirmed finding
                  </p>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>AI-Assisted Annotations</h2>
                  <p>
                    These results are shown for transparency. Final clinical
                    meaning depends on dentist review.
                  </p>
                </div>
              </div>

              {loadingAnnotations ? (
                renderLoadingState()
              ) : annotations.length === 0 ? (
                <div className="empty-state">
                  <h3>No AI annotations yet</h3>
                  <p>
                    Request AI analysis to generate preliminary suggestions.
                    These still need dentist review before they become confirmed
                    clinical findings.
                  </p>
                </div>
              ) : (
                <div className="patient-annotation-grid">
                  {annotations.map((annotation) => (
                    <div
                      className="patient-annotation-card"
                      key={annotation.annotation_id}
                    >
                      <div className="appointment-title-row">
                        <h3>{annotation.label}</h3>

                        <span className={getStatusClass(annotation)}>
                          {getStatusLabel(annotation)}
                        </span>
                      </div>

                      <div className="patient-record-detail-grid">
                        <p>
                          <strong>Source:</strong>{" "}
                          {annotation.source === "AI"
                            ? "AI-assisted suggestion"
                            : "Dentist annotation"}
                        </p>

                        <p>
                          <strong>Confidence:</strong>{" "}
                          {formatConfidence(annotation.confidence)}
                          {annotation.confidence !== null &&
                            annotation.confidence !== undefined && (
                              <>
                                {" "}
                                ({getConfidenceLevel(annotation.confidence)})
                              </>
                            )}
                        </p>

                        <p>
                          <strong>Reviewed by:</strong>{" "}
                          {annotation.status === "Confirmed"
                            ? annotation.dentist_name || "Dentist"
                            : "Pending dentist review"}
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

                      {renderAnnotationInterpretation(annotation)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientXrayAnnotationView;
