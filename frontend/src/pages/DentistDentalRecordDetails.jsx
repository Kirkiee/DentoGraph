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

  const [toothForm, setToothForm] = useState({
    tooth_number: "",
    tooth_status: "Normal",
  });

  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [selectedTooth, setSelectedTooth] = useState(null);
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

  useEffect(() => {
    fetchRecordDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

  const fetchRecordDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/dental-records/${record_id}`,
        authHeaders,
      );

      setRecord(response.data.dental_record);
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
    setSelectedTooth(null);
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

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Add Tooth</h2>
          <p>
            Add tooth information to this dental record. Tooth details can later
            be used for treatment tracking.
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
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Dental Record Details</h2>
              <p>
                View and update teeth and treatment information for this patient
                record.
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

              <div style={{ marginTop: "22px" }}>
                <div className="appointments-header">
                  <div>
                    <h2>Teeth</h2>
                    <p>
                      Manage tooth status and add treatments for this dental
                      record.
                    </p>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={fetchRecordDetails}
                  >
                    Refresh
                  </button>
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
