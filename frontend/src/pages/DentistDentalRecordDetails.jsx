import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function DentistDentalRecordDetails() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [selectedTooth, setSelectedTooth] = useState(null);

  const [toothForm, setToothForm] = useState({
    tooth_number: "",
    tooth_status: "Normal",
  });

  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    procedure_type: "",
    description: "",
    treatment_date: "",
  });

  const [loading, setLoading] = useState(true);
  const [addingTooth, setAddingTooth] = useState(false);
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [updatingToothId, setUpdatingToothId] = useState(null);

  const [message, setMessage] = useState("");
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

  const handleToothChange = (e) => {
    setToothForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleTreatmentChange = (e) => {
    setTreatmentForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddTooth = async (e) => {
    e.preventDefault();

    if (!toothForm.tooth_number) {
      setError("Please enter a tooth number.");
      return;
    }

    try {
      setAddingTooth(true);
      setMessage("");
      setError("");

      await API.post(
        `/api/dental-records/${record_id}/teeth`,
        {
          tooth_number: Number(toothForm.tooth_number),
          tooth_status: toothForm.tooth_status,
        },
        authHeaders,
      );

      setMessage("Tooth added successfully.");
      setToothForm({
        tooth_number: "",
        tooth_status: "Normal",
      });

      fetchRecordDetails();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add tooth.");
    } finally {
      setAddingTooth(false);
    }
  };

  const handleUpdateToothStatus = async (toothId, newStatus) => {
    try {
      setUpdatingToothId(toothId);
      setMessage("");
      setError("");

      await API.put(
        `/api/dental-records/teeth/${toothId}`,
        {
          tooth_status: newStatus,
        },
        authHeaders,
      );

      setMessage("Tooth status updated successfully.");
      fetchRecordDetails();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update tooth status.");
    } finally {
      setUpdatingToothId(null);
    }
  };

  const openTreatmentModal = (tooth) => {
    setSelectedTooth(tooth);
    setTreatmentForm({
      procedure_type: "",
      description: "",
      treatment_date: "",
    });
    setMessage("");
    setError("");
    setShowTreatmentModal(true);
  };

  const closeTreatmentModal = () => {
    setShowTreatmentModal(false);
    setTreatmentForm({
      procedure_type: "",
      description: "",
      treatment_date: "",
    });
  };

  const handleAddTreatment = async (e) => {
    e.preventDefault();

    if (!selectedTooth) {
      setError("Please select a tooth first.");
      return;
    }

    if (!treatmentForm.procedure_type) {
      setError("Please enter the procedure type.");
      return;
    }

    try {
      setAddingTreatment(true);
      setMessage("");
      setError("");

      await API.post(
        `/api/dental-records/teeth/${selectedTooth.tooth_id}/treatments`,
        {
          procedure_type: treatmentForm.procedure_type,
          description: treatmentForm.description,
          treatment_date:
            treatmentForm.treatment_date || new Date().toISOString(),
        },
        authHeaders,
      );

      setMessage("Treatment added successfully.");
      closeTreatmentModal();
      fetchRecordDetails();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add treatment.");
    } finally {
      setAddingTreatment(false);
    }
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
    <DashboardLayout role="Dentist">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Add Tooth</h2>
          <p>
            Add tooth information to this dental record. After adding a tooth,
            it will appear in the visual dental chart.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleAddTooth}>
            <div className="form-group">
              <label>Tooth Number</label>
              <input
                type="number"
                name="tooth_number"
                value={toothForm.tooth_number}
                onChange={handleToothChange}
                placeholder="Example: 11, 12, 21, 36"
                required
              />
            </div>

            <div className="form-group">
              <label>Tooth Status</label>
              <select
                name="tooth_status"
                value={toothForm.tooth_status}
                onChange={handleToothChange}
              >
                <option value="Normal">Normal</option>
                <option value="Healthy">Healthy</option>
                <option value="Cavity">Cavity</option>
                <option value="Needs Treatment">Needs Treatment</option>
                <option value="Filled">Filled</option>
                <option value="Treated">Treated</option>
                <option value="Missing">Missing</option>
                <option value="Extracted">Extracted</option>
              </select>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={addingTooth}
            >
              {addingTooth ? "Adding..." : "Add Tooth"}
            </button>
          </form>

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

              <button
                className="secondary-button"
                onClick={() => openTreatmentModal(selectedTooth)}
              >
                Add Treatment
              </button>
            </div>
          )}
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Dental Record Details</h2>
              <p>
                View the visual tooth chart, update tooth status, manage
                treatments, and view uploaded X-rays.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => navigate("/dentist/dental-records")}
            >
              Back
            </button>
          </div>

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
                    <span className="status-badge status-scheduled">
                      Active
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
                      Click a recorded tooth to view details and add treatments.
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
                            setToothForm((prev) => ({
                              ...prev,
                              tooth_number: toothNumber,
                            }));
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
              </div>

              <div style={{ marginTop: "28px" }}>
                <div className="appointments-header">
                  <div>
                    <h2>Recorded Teeth</h2>
                    <p>Update tooth status or add treatment records.</p>
                  </div>
                </div>

                {teeth.length === 0 ? (
                  <div className="empty-state">
                    <h3>No teeth added yet</h3>
                    <p>Add a tooth using the form on the left side.</p>
                  </div>
                ) : (
                  <div className="appointments-list">
                    {teeth.map((tooth) => (
                      <div className="appointment-item" key={tooth.tooth_id}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>Tooth #{tooth.tooth_number}</h3>

                            <span
                              className={getToothStatusClass(
                                tooth.tooth_status,
                              )}
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

                        <div className="appointment-actions">
                          <select
                            value={tooth.tooth_status}
                            disabled={updatingToothId === tooth.tooth_id}
                            onChange={(e) =>
                              handleUpdateToothStatus(
                                tooth.tooth_id,
                                e.target.value,
                              )
                            }
                          >
                            <option value="Normal">Normal</option>
                            <option value="Healthy">Healthy</option>
                            <option value="Cavity">Cavity</option>
                            <option value="Needs Treatment">
                              Needs Treatment
                            </option>
                            <option value="Filled">Filled</option>
                            <option value="Treated">Treated</option>
                            <option value="Missing">Missing</option>
                            <option value="Extracted">Extracted</option>
                          </select>

                          <button
                            className="secondary-button"
                            onClick={() => openTreatmentModal(tooth)}
                          >
                            Add Treatment
                          </button>
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
                    <p>Treatment history connected to teeth in this record.</p>
                  </div>
                </div>

                {treatments.length === 0 ? (
                  <div className="empty-state">
                    <h3>No treatments yet</h3>
                    <p>Treatments added to teeth will appear here.</p>
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
                            {treatment.description ||
                              "No description provided."}
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
                      X-rays uploaded from the X-ray module will appear here.
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
      </div>

      {showTreatmentModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Add Treatment</h3>
                <p>Add a treatment for Tooth #{selectedTooth?.tooth_number}.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeTreatmentModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddTreatment}>
              <div className="form-group">
                <label>Procedure Type</label>
                <input
                  type="text"
                  name="procedure_type"
                  value={treatmentForm.procedure_type}
                  onChange={handleTreatmentChange}
                  placeholder="Example: Filling, Extraction, Cleaning"
                  required
                />
              </div>

              <div className="form-group">
                <label>Treatment Date</label>
                <input
                  type="datetime-local"
                  name="treatment_date"
                  value={treatmentForm.treatment_date}
                  onChange={handleTreatmentChange}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={treatmentForm.description}
                  onChange={handleTreatmentChange}
                  placeholder="Enter treatment notes or description..."
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeTreatmentModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={addingTreatment}
                >
                  {addingTreatment ? "Saving..." : "Save Treatment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistDentalRecordDetails;
