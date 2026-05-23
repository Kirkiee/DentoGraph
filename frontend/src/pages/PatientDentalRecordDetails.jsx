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

  const [loading, setLoading] = useState(true);
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
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Record Details</h2>
            <p>View your teeth information and treatment history.</p>
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

            <div style={{ marginTop: "28px" }}>
              <div className="appointments-header">
                <div>
                  <h2>Teeth</h2>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientDentalRecordDetails;
