import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientDentalRecordDetails() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [xrays, setXrays] = useState([]);
  const [selectedTooth, setSelectedTooth] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const adultTeethNumbers = [
    18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
    45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
  ];

  useEffect(() => {
    fetchRecordDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const recordResponse = await API.get(
        `/api/dental-records/${record_id}`,
        authHeaders,
      );

      setRecord(recordResponse.data.dental_record);
      setTeeth(recordResponse.data.teeth || []);
      setTreatments(recordResponse.data.treatments || []);

      const xrayResponse = await API.get(
        `/api/xrays/record/${record_id}`,
        authHeaders,
      );

      setXrays(xrayResponse.data.xrays || []);

      if (selectedTooth) {
        const updatedSelectedTooth = recordResponse.data.teeth?.find(
          (tooth) => tooth.tooth_id === selectedTooth.tooth_id,
        );

        setSelectedTooth(updatedSelectedTooth || null);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dental record details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getToothByNumber = (toothNumber) => {
    return teeth.find(
      (tooth) => Number(tooth.tooth_number) === Number(toothNumber),
    );
  };

  const getTreatmentsByToothId = (toothId) => {
    return treatments.filter((treatment) => treatment.tooth_id === toothId);
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "#";

    const normalizedPath = filePath.replace(/\\/g, "/");

    if (normalizedPath.startsWith("http")) {
      return normalizedPath;
    }

    return `http://localhost:5000/${normalizedPath}`;
  };

  const isImageFile = (filePath) => {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(filePath || "");
  };

  const getToothStatusClass = (status) => {
    switch (status) {
      case "Healthy":
      case "Normal":
        return "status-badge status-completed";
      case "Cavity":
      case "Needs Treatment":
        return "status-badge status-pending";
      case "Extracted":
      case "Missing":
        return "status-badge status-cancelled";
      case "Filled":
      case "Treated":
        return "status-badge status-scheduled";
      default:
        return "status-badge status-pending";
    }
  };

  const getToothChartClass = (status, isSelected) => {
    let className = "tooth-chart-item";

    if (isSelected) {
      className += " selected";
    }

    switch (status) {
      case "Healthy":
      case "Normal":
        return `${className} tooth-normal`;
      case "Cavity":
      case "Needs Treatment":
        return `${className} tooth-warning`;
      case "Extracted":
      case "Missing":
        return `${className} tooth-danger`;
      case "Filled":
      case "Treated":
        return `${className} tooth-treated`;
      default:
        return `${className} tooth-empty`;
    }
  };

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Record Details</h2>
            <p>
              View your visual tooth chart, tooth status, treatment history, and
              uploaded X-rays.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => navigate("/patient/records")}
          >
            Back
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading dental record details...</p>
        ) : !record ? (
          <div className="empty-state">
            <h3>Record not found</h3>
            <p>The selected dental record could not be loaded.</p>
          </div>
        ) : (
          <>
            <div className="appointment-item">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Record #{record.record_id}</h3>
                  <span className="status-badge status-scheduled">Active</span>
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
                  <strong>Date Created:</strong>{" "}
                  {record.date_created
                    ? new Date(record.date_created).toLocaleString()
                    : "N/A"}
                </p>

                <p>
                  <strong>Last Updated:</strong>{" "}
                  {record.last_updated
                    ? new Date(record.last_updated).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            <div className="tooth-chart-section">
              <div className="appointments-header">
                <div>
                  <h2>Visual Tooth Chart</h2>
                  <p>
                    Click a recorded tooth to view its status and treatment
                    count.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={fetchRecordDetails}
                >
                  Refresh
                </button>
              </div>

              <div className="tooth-chart-legend">
                <span>
                  <i className="legend-dot normal"></i> Normal
                </span>
                <span>
                  <i className="legend-dot warning"></i> Needs Treatment
                </span>
                <span>
                  <i className="legend-dot treated"></i> Treated
                </span>
                <span>
                  <i className="legend-dot danger"></i> Missing/Extracted
                </span>
                <span>
                  <i className="legend-dot empty"></i> Not Recorded
                </span>
              </div>

              <div className="tooth-chart-grid">
                {adultTeethNumbers.map((toothNumber) => {
                  const tooth = getToothByNumber(toothNumber);
                  const isSelected =
                    selectedTooth?.tooth_number === toothNumber;

                  return (
                    <button
                      key={toothNumber}
                      type="button"
                      className={getToothChartClass(
                        tooth?.tooth_status,
                        isSelected,
                      )}
                      onClick={() => {
                        if (tooth) {
                          setSelectedTooth(tooth);
                        } else {
                          setSelectedTooth(null);
                        }
                      }}
                    >
                      <span>{toothNumber}</span>
                      <small>{tooth ? tooth.tooth_status : "Empty"}</small>
                    </button>
                  );
                })}
              </div>

              {selectedTooth && (
                <div className="selected-tooth-panel">
                  <h3>Selected Tooth #{selectedTooth.tooth_number}</h3>

                  <p>
                    <strong>Status:</strong> {selectedTooth.tooth_status}
                  </p>

                  <p>
                    <strong>Treatments:</strong>{" "}
                    {getTreatmentsByToothId(selectedTooth.tooth_id).length}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: "28px" }}>
              <div className="appointments-header">
                <div>
                  <h2>Recorded Teeth</h2>
                  <p>Your recorded tooth status information.</p>
                </div>
              </div>

              {teeth.length === 0 ? (
                <div className="empty-state">
                  <h3>No teeth added yet</h3>
                  <p>
                    Tooth information will appear here once added by your
                    dentist.
                  </p>
                </div>
              ) : (
                <div className="appointments-list">
                  {teeth.map((tooth) => (
                    <div className="appointment-item" key={tooth.tooth_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>Tooth #{tooth.tooth_number}</h3>

                          <span
                            className={getToothStatusClass(tooth.tooth_status)}
                          >
                            {tooth.tooth_status}
                          </span>
                        </div>

                        <p>
                          <strong>Tooth ID:</strong> {tooth.tooth_id}
                        </p>

                        <p>
                          <strong>Treatments:</strong>{" "}
                          {getTreatmentsByToothId(tooth.tooth_id).length}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "28px" }}>
              <div className="appointments-header">
                <div>
                  <h2>Treatments</h2>
                  <p>Treatment history connected to your dental record.</p>
                </div>
              </div>

              {treatments.length === 0 ? (
                <div className="empty-state">
                  <h3>No treatments yet</h3>
                  <p>
                    Your treatment history will appear here once your dentist
                    adds treatments.
                  </p>
                </div>
              ) : (
                <div className="appointments-list">
                  {treatments.map((treatment) => (
                    <div
                      className="appointment-item"
                      key={treatment.treatment_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>{treatment.procedure_type}</h3>

                          <span className="status-badge status-scheduled">
                            Tooth #{treatment.tooth_number}
                          </span>
                        </div>

                        <p>
                          <strong>Description:</strong>{" "}
                          {treatment.description || "No description provided."}
                        </p>

                        <p>
                          <strong>Treatment Date:</strong>{" "}
                          {treatment.treatment_date
                            ? new Date(
                                treatment.treatment_date,
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "28px" }}>
              <div className="appointments-header">
                <div>
                  <h2>X-rays</h2>
                  <p>Uploaded X-rays connected to this dental record.</p>
                </div>
              </div>

              {xrays.length === 0 ? (
                <div className="empty-state">
                  <h3>No X-rays uploaded yet</h3>
                  <p>
                    Your uploaded X-rays will appear here once your dentist adds
                    them.
                  </p>
                </div>
              ) : (
                <div className="xray-grid">
                  {xrays.map((xray) => (
                    <div className="xray-card" key={xray.xray_id}>
                      <div className="xray-preview">
                        {isImageFile(xray.file_path) ? (
                          <img
                            src={getFileUrl(xray.file_path)}
                            alt={`X-ray ${xray.xray_id}`}
                          />
                        ) : (
                          <div className="xray-pdf-preview">PDF</div>
                        )}
                      </div>

                      <div className="xray-info">
                        <h3>X-ray #{xray.xray_id}</h3>

                        <p>
                          <strong>Tooth:</strong>{" "}
                          {xray.tooth_number
                            ? `Tooth #${xray.tooth_number}`
                            : "General record X-ray"}
                        </p>

                        <p>
                          <strong>Uploaded:</strong>{" "}
                          {xray.upload_date
                            ? new Date(xray.upload_date).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>

                      <div className="xray-actions">
                        <a
                          href={getFileUrl(xray.file_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="secondary-button"
                        >
                          View
                        </a>
                      </div>
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

export default PatientDentalRecordDetails;
