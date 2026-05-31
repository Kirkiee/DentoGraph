import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

const VALID_TOOTH_NUMBERS = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
];

function DentistDentalRecordDetails() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(true);
  const [updatingTooth, setUpdatingTooth] = useState(false);
  const [addingTooth, setAddingTooth] = useState(false);
  const [savingTreatment, setSavingTreatment] = useState(false);

  const [showToothModal, setShowToothModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);

  const [selectedTooth, setSelectedTooth] = useState(null);
  const [selectedTreatment, setSelectedTreatment] = useState(null);

  const [toothForm, setToothForm] = useState({
    tooth_number: "",
    tooth_status: "Normal",
  });

  const [treatmentForm, setTreatmentForm] = useState({
    tooth_id: "",
    procedure_type: "",
    description: "",
    treatment_date: "",
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

  useEffect(() => {
    fetchRecordDetails();
    fetchXrays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

  useEffect(() => {
    const isAnyModalOpen = showToothModal || showTreatmentModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showToothModal, showTreatmentModal]);

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/dental-records/${record_id}`,
        authHeaders,
      );

      setRecord(response.data.dental_record || null);
      setTeeth(response.data.teeth || []);
      setTreatments(response.data.treatments || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dental record details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchXrays = async () => {
    try {
      setLoadingXrays(true);

      const response = await API.get(
        `/api/xrays/record/${record_id}`,
        authHeaders,
      );

      setXrays(response.data.xrays || []);
    } catch (err) {
      console.error("Fetch X-rays error:", err);
    } finally {
      setLoadingXrays(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  const formatDateTimeLocal = (dateValue) => {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);

    return localDate.toISOString().slice(0, 16);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Archived":
        return "status-badge status-cancelled";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getToothStatusClass = (status) => {
    switch (status) {
      case "Decayed":
        return "status-badge status-cancelled";
      case "Filled":
        return "status-badge status-pending";
      case "Missing":
        return "status-badge status-cancelled";
      case "Crowned":
        return "status-badge status-scheduled";
      case "Impacted":
        return "status-badge status-pending";
      case "Normal":
      default:
        return "status-badge status-completed";
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const getAvailableToothNumbers = () => {
    const usedToothNumbers = teeth.map((tooth) => Number(tooth.tooth_number));

    return VALID_TOOTH_NUMBERS.filter(
      (toothNumber) => !usedToothNumbers.includes(toothNumber),
    );
  };

  const openToothModal = () => {
    const availableToothNumbers = getAvailableToothNumbers();

    setToothForm({
      tooth_number: availableToothNumbers[0]
        ? String(availableToothNumbers[0])
        : "",
      tooth_status: "Normal",
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowToothModal(true);
  };

  const closeToothModal = () => {
    setShowToothModal(false);
    setModalError("");
    setToothForm({
      tooth_number: "",
      tooth_status: "Normal",
    });
  };

  const handleToothChange = (e) => {
    setModalError("");

    setToothForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddTooth = async (e) => {
    e.preventDefault();

    if (!toothForm.tooth_number) {
      setModalError("Please select a valid tooth number.");
      return;
    }

    try {
      setAddingTooth(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.post(
        `/api/dental-records/${record_id}/teeth`,
        {
          tooth_number: Number(toothForm.tooth_number),
          tooth_status: toothForm.tooth_status,
        },
        authHeaders,
      );

      setMessage("Tooth added successfully.");
      closeToothModal();
      fetchRecordDetails();
    } catch (err) {
      setModalError(err.response?.data?.error || "Unable to add tooth.");
    } finally {
      setAddingTooth(false);
    }
  };

  const handleUpdateToothStatus = async (tooth, newStatus) => {
    try {
      setUpdatingTooth(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/dental-records/teeth/${tooth.tooth_id}`,
        {
          tooth_status: newStatus,
        },
        authHeaders,
      );

      setMessage(`Tooth #${tooth.tooth_number} updated successfully.`);
      fetchRecordDetails();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update tooth status.");
    } finally {
      setUpdatingTooth(false);
    }
  };

  const openAddTreatmentModal = (tooth = null) => {
    setSelectedTooth(tooth);
    setSelectedTreatment(null);

    setTreatmentForm({
      tooth_id: tooth?.tooth_id || "",
      procedure_type: "",
      description: "",
      treatment_date: formatDateTimeLocal(new Date()),
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowTreatmentModal(true);
  };

  const openEditTreatmentModal = (treatment) => {
    setSelectedTreatment(treatment);

    const matchingTooth = teeth.find(
      (tooth) => Number(tooth.tooth_id) === Number(treatment.tooth_id),
    );

    setSelectedTooth(matchingTooth || null);

    setTreatmentForm({
      tooth_id: treatment.tooth_id || "",
      procedure_type: treatment.procedure_type || "",
      description: treatment.description || "",
      treatment_date: formatDateTimeLocal(treatment.treatment_date),
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowTreatmentModal(true);
  };

  const closeTreatmentModal = () => {
    setShowTreatmentModal(false);
    setSelectedTooth(null);
    setSelectedTreatment(null);
    setModalError("");

    setTreatmentForm({
      tooth_id: "",
      procedure_type: "",
      description: "",
      treatment_date: "",
    });
  };

  const handleTreatmentChange = (e) => {
    setModalError("");

    setTreatmentForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveTreatment = async (e) => {
    e.preventDefault();

    if (!treatmentForm.tooth_id || !treatmentForm.procedure_type) {
      setModalError("Please select a tooth and enter a procedure type.");
      return;
    }

    if (selectedTreatment && !treatmentForm.treatment_date) {
      setModalError("Treatment date is required when updating a treatment.");
      return;
    }

    try {
      setSavingTreatment(true);
      setMessage("");
      setError("");
      setModalError("");

      if (selectedTreatment) {
        await API.put(
          `/api/dental-records/treatments/${selectedTreatment.treatment_id}`,
          {
            procedure_type: treatmentForm.procedure_type,
            description: treatmentForm.description,
            treatment_date: treatmentForm.treatment_date,
          },
          authHeaders,
        );

        setMessage("Treatment updated successfully.");
      } else {
        await API.post(
          `/api/dental-records/teeth/${treatmentForm.tooth_id}/treatments`,
          {
            procedure_type: treatmentForm.procedure_type,
            description: treatmentForm.description,
            treatment_date: treatmentForm.treatment_date || new Date(),
          },
          authHeaders,
        );

        setMessage("Treatment added successfully.");
      }

      closeTreatmentModal();
      fetchRecordDetails();
    } catch (err) {
      setModalError(
        err.response?.data?.error ||
          (selectedTreatment
            ? "Unable to update treatment."
            : "Unable to add treatment."),
      );
    } finally {
      setSavingTreatment(false);
    }
  };

  const availableToothNumbers = getAvailableToothNumbers();

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Record Details</h2>
            <p>
              View and manage teeth, treatments, and X-rays connected to this
              patient dental record.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/dentist/dental-records")}
            >
              Back to Records
            </button>

            <button
              className="primary-button"
              onClick={() =>
                navigate(`/dentist/dental-records/${record_id}/3d-view`)
              }
            >
              3D View
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                fetchRecordDetails();
                fetchXrays();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading dental record details...</p>
        ) : !record ? (
          <div className="empty-state">
            <h3>Dental record not found</h3>
            <p>
              The selected dental record may not exist or may be unavailable.
            </p>
          </div>
        ) : (
          <>
            <div className="appointment-item">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Record #{record.record_id}</h3>

                  <span className={getStatusClass(record.status)}>
                    {record.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Patient:</strong>{" "}
                  {record.patient_name || `Patient ID ${record.patient_id}`}
                </p>

                <p>
                  <strong>Patient Email:</strong>{" "}
                  {record.patient_email || "N/A"}
                </p>

                <p>
                  <strong>Dentist:</strong>{" "}
                  {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {record.clinic_name || "No assigned clinic"}
                </p>

                <p>
                  <strong>Date Created:</strong>{" "}
                  {formatDate(record.date_created)}
                </p>

                <p>
                  <strong>Last Updated:</strong>{" "}
                  {formatDate(record.last_updated)}
                </p>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Teeth Overview</h2>
                  <p>
                    Add valid FDI tooth numbers, update tooth status, or open
                    the 3D chart for a visual tooth map.
                  </p>
                </div>

                <div
                  className="appointment-actions"
                  style={{ flexDirection: "row" }}
                >
                  <button
                    className="primary-button"
                    onClick={openToothModal}
                    disabled={availableToothNumbers.length === 0}
                  >
                    Add Tooth
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      navigate(`/dentist/dental-records/${record_id}/3d-view`)
                    }
                  >
                    Open 3D Chart
                  </button>
                </div>
              </div>

              {teeth.length === 0 ? (
                <div className="empty-state">
                  <h3>No teeth added</h3>
                  <p>
                    Add teeth manually or use the 3D view to select and update a
                    tooth.
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
                            className={getToothStatusClass(
                              tooth.tooth_status || "Normal",
                            )}
                          >
                            {tooth.tooth_status || "Normal"}
                          </span>
                        </div>

                        <p>
                          <strong>Tooth ID:</strong> {tooth.tooth_id}
                        </p>

                        <p>
                          <strong>Status:</strong>{" "}
                          {tooth.tooth_status || "Normal"}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <select
                          value={tooth.tooth_status || "Normal"}
                          onChange={(e) =>
                            handleUpdateToothStatus(tooth, e.target.value)
                          }
                          disabled={updatingTooth}
                        >
                          <option value="Normal">Normal</option>
                          <option value="Decayed">Decayed</option>
                          <option value="Filled">Filled</option>
                          <option value="Missing">Missing</option>
                          <option value="Crowned">Crowned</option>
                          <option value="Impacted">Impacted</option>
                        </select>

                        <button
                          className="secondary-button"
                          onClick={() => openAddTreatmentModal(tooth)}
                        >
                          Add Treatment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Treatment History</h2>
                  <p>
                    View and update procedures recorded under this dental
                    record.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => openAddTreatmentModal()}
                  disabled={teeth.length === 0}
                >
                  Add Treatment
                </button>
              </div>

              {treatments.length === 0 ? (
                <div className="empty-state">
                  <h3>No treatments recorded</h3>
                  <p>Treatment history will appear here once added.</p>
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
                          <strong>Treatment ID:</strong>{" "}
                          {treatment.treatment_id}
                        </p>

                        <p>
                          <strong>Description:</strong>{" "}
                          {treatment.description || "No description provided"}
                        </p>

                        <p>
                          <strong>Treatment Date:</strong>{" "}
                          {formatDate(treatment.treatment_date)}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          onClick={() => openEditTreatmentModal(treatment)}
                        >
                          Edit Treatment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>X-ray Images</h2>
                  <p>View uploaded X-ray files connected to this record.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/dentist/xrays")}
                >
                  Manage X-rays
                </button>
              </div>

              {loadingXrays ? (
                <p>Loading X-rays...</p>
              ) : xrays.length === 0 ? (
                <div className="empty-state">
                  <h3>No X-rays uploaded</h3>
                  <p>X-ray files will appear here once uploaded.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {xrays.map((xray) => (
                    <div className="appointment-item" key={xray.xray_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>X-ray #{xray.xray_id}</h3>

                          <span className="status-badge status-scheduled">
                            {xray.tooth_number
                              ? `Tooth #${xray.tooth_number}`
                              : "General"}
                          </span>
                        </div>

                        <p>
                          <strong>Uploaded:</strong>{" "}
                          {formatDate(xray.upload_date)}
                        </p>

                        <p>
                          <strong>File Path:</strong> {xray.file_path}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <a
                          className="secondary-button"
                          href={getFileUrl(xray.file_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open File
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

      {showToothModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Add Tooth</h3>
                <p>
                  Add a valid FDI permanent tooth number to this dental record.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeToothModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddTooth}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Tooth Number</label>
                <select
                  name="tooth_number"
                  value={toothForm.tooth_number}
                  onChange={handleToothChange}
                  required
                >
                  <option value="">Select Tooth</option>
                  {availableToothNumbers.map((toothNumber) => (
                    <option key={toothNumber} value={toothNumber}>
                      Tooth #{toothNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tooth Status</label>
                <select
                  name="tooth_status"
                  value={toothForm.tooth_status}
                  onChange={handleToothChange}
                >
                  <option value="Normal">Normal</option>
                  <option value="Decayed">Decayed</option>
                  <option value="Filled">Filled</option>
                  <option value="Missing">Missing</option>
                  <option value="Crowned">Crowned</option>
                  <option value="Impacted">Impacted</option>
                </select>
              </div>

              <div className="info-message">
                Valid FDI tooth numbers are 11-18, 21-28, 31-38, and 41-48.
                Teeth already added to this record are hidden from the list.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeToothModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={addingTooth}
                >
                  {addingTooth ? "Adding..." : "Add Tooth"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTreatmentModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedTreatment ? "Edit Treatment" : "Add Treatment"}
                </h3>
                <p>
                  {selectedTreatment
                    ? "Update the selected treatment or procedure."
                    : "Add a treatment or procedure for a selected tooth."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeTreatmentModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveTreatment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Tooth</label>
                <select
                  name="tooth_id"
                  value={treatmentForm.tooth_id}
                  onChange={handleTreatmentChange}
                  required
                  disabled={Boolean(selectedTreatment)}
                >
                  <option value="">Select Tooth</option>
                  {teeth.map((tooth) => (
                    <option key={tooth.tooth_id} value={tooth.tooth_id}>
                      Tooth #{tooth.tooth_number} -{" "}
                      {tooth.tooth_status || "Normal"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Procedure Type</label>
                <input
                  type="text"
                  name="procedure_type"
                  value={treatmentForm.procedure_type}
                  onChange={handleTreatmentChange}
                  placeholder="Example: Filling, Cleaning, Extraction"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={treatmentForm.description}
                  onChange={handleTreatmentChange}
                  placeholder="Enter treatment notes or details..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Treatment Date</label>
                <input
                  type="datetime-local"
                  name="treatment_date"
                  value={treatmentForm.treatment_date}
                  onChange={handleTreatmentChange}
                  required={Boolean(selectedTreatment)}
                />
              </div>

              {selectedTreatment && (
                <div className="info-message">
                  Tooth selection is locked when editing an existing treatment.
                  To move a treatment to another tooth, delete and recreate it
                  under the correct tooth.
                </div>
              )}

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
                  disabled={savingTreatment}
                >
                  {savingTreatment
                    ? "Saving..."
                    : selectedTreatment
                      ? "Save Changes"
                      : "Add Treatment"}
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
