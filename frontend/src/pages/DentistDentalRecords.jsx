import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

const RECORD_SOURCE_OPTIONS = [
  {
    value: "NEW_SYSTEM_RECORD",
    label: "New System Record",
    description: "A new dental record created directly in DentoGraph.",
  },
  {
    value: "OLD_ENCODED_RECORD",
    label: "Old Encoded Record",
    description: "Old patient record manually encoded into the system.",
  },
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
    description: "Record based on uploaded or scanned previous clinic records.",
  },
];

const formatSubscriptionError = (errorMessage, fallbackMessage) => {
  const backendError = errorMessage || fallbackMessage;
  const lowerError = String(backendError).toLowerCase();

  if (
    lowerError.includes("limit") ||
    lowerError.includes("subscription") ||
    lowerError.includes("storage")
  ) {
    return `${backendError} Please ask the Clinic Owner to upgrade the clinic subscription.`;
  }

  return backendError;
};

function DentistDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const [recordSource, setRecordSource] = useState("NEW_SYSTEM_RECORD");
  const [sourceNotes, setSourceNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [policyError, setPolicyError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showArchiveModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showArchiveModal]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setLoadingPatients(true);
      setError("");
      setPolicyError(null);

      await Promise.all([fetchRecords(false), fetchPatients()]);
    } finally {
      setLoading(false);
      setLoadingPatients(false);
    }
  };

  const fetchRecords = async (manageLoading = true) => {
    try {
      if (manageLoading) {
        setRefreshing(true);
      }

      setError("");
      setPolicyError(null);

      const response = await API.get("/api/dental-records", authHeaders);
      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      if (manageLoading) {
        setRefreshing(false);
      }
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await API.get(
        "/api/dental-records/patients/list",
        authHeaders,
      );

      setPatients(response.data.patients || []);
    } catch (err) {
      console.error("Fetch patients error:", err);
    }
  };

  const refreshPage = async () => {
    setRefreshing(true);

    try {
      await Promise.all([fetchRecords(false), fetchPatients()]);
    } finally {
      setRefreshing(false);
    }
  };

  const getPatientDentitionLabel = (dentitionType) => {
    if (dentitionType === "Child") return "Child / Primary Teeth";
    if (dentitionType === "Adult") return "Adult / Permanent Teeth";

    return "Dental chart type not set";
  };

  const getPatientOptionLabel = (patient) => {
    const dentitionLabel = getPatientDentitionLabel(patient.dentition_type);

    return `${patient.patient_name} - ${patient.email} (${dentitionLabel})`;
  };

  const getRecordSourceLabel = (source) => {
    if (source === "PDA_BASED_RECORD") {
      return "Old / Imported Record";
    }

    const match = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === source,
    );

    return match?.label || "New System Record";
  };

  const getRecordSourceDescription = (source) => {
    if (source === "PDA_BASED_RECORD") {
      return "Record imported from a previous clinic document.";
    }

    const match = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === source,
    );

    return match?.description || RECORD_SOURCE_OPTIONS[0].description;
  };

  const getRecordSourceClass = (source) => {
    switch (source) {
      case "OLD_ENCODED_RECORD":
        return "status-badge status-pending";
      case "SCANNED_OLD_RECORD":
        return "status-badge status-scheduled";
      case "PDA_BASED_RECORD":
        return "status-badge status-pending";
      case "NEW_SYSTEM_RECORD":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getRecordStatus = (record) => {
    return record.status || "Active";
  };

  const getRecordStatusClass = (status) => {
    switch (status) {
      case "Archived":
        return "status-badge status-cancelled";
      case "Inactive":
        return "status-badge status-pending";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
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

  const selectedPatient = patients.find(
    (patient) => Number(patient.patient_id) === Number(selectedPatientId),
  );

  const resetCreateForm = () => {
    setSelectedPatientId("");
    setRecordSource("NEW_SYSTEM_RECORD");
    setSourceNotes("");
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();

    if (!selectedPatientId) {
      setError("Please select a patient first.");
      setPolicyError(null);
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");
      setPolicyError(null);

      const response = await API.post(
        "/api/dental-records",
        {
          patient_id: Number(selectedPatientId),
          record_source: recordSource,
          source_notes: sourceNotes.trim() || null,
        },
        authHeaders,
      );

      if (response.data.existing) {
        setMessage("Dental record already exists. Opening existing record...");
        resetCreateForm();

        const existingRecordId = response.data.dental_record?.record_id;

        if (existingRecordId) {
          navigate(`/dentist/dental-records/${existingRecordId}`);
        }

        return;
      }

      setMessage(
        response.data.message || "Dental record created successfully.",
      );
      resetCreateForm();
      setShowCreateForm(false);
      fetchRecords(true);
    } catch (err) {
      const responseData = err.response?.data;
      const formattedError = formatSubscriptionError(
        responseData?.error,
        "Unable to create dental record.",
      );

      if (responseData?.policy || responseData?.existing_record) {
        setPolicyError({
          message: formattedError,
          policy: responseData.policy || null,
          existingRecord: responseData.existing_record || null,
        });
        setError("");
      } else {
        setError(formattedError);
        setPolicyError(null);
      }
    } finally {
      setCreating(false);
    }
  };

  const openArchiveModal = (record) => {
    setSelectedRecord(record);
    setMessage("");
    setError("");
    setPolicyError(null);
    setShowArchiveModal(true);
  };

  const closeArchiveModal = () => {
    setShowArchiveModal(false);
    setSelectedRecord(null);
  };

  const handleArchiveRecord = async (e) => {
    e.preventDefault();

    if (!selectedRecord) {
      setError("No dental record selected for archiving.");
      return;
    }

    try {
      setArchiving(true);
      setMessage("");
      setError("");
      setPolicyError(null);

      await API.put(
        `/api/dental-records/${selectedRecord.record_id}/archive`,
        {},
        authHeaders,
      );

      setMessage(`Record #${selectedRecord.record_id} archived successfully.`);
      closeArchiveModal();
      fetchRecords(true);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to archive dental record.");
    } finally {
      setArchiving(false);
    }
  };

  const filteredAndSortedRecords = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    let result = [...records];

    if (statusFilter !== "All") {
      result = result.filter(
        (record) => getRecordStatus(record) === statusFilter,
      );
    }

    if (sourceFilter !== "All") {
      result = result.filter((record) => {
        const source = record.record_source || "NEW_SYSTEM_RECORD";

        if (sourceFilter === "OLD_IMPORTED") {
          return (
            source === "OLD_ENCODED_RECORD" ||
            source === "SCANNED_OLD_RECORD" ||
            source === "PDA_BASED_RECORD"
          );
        }

        return source === sourceFilter;
      });
    }

    if (cleanSearch) {
      result = result.filter((record) => {
        const searchableText = [
          record.record_id,
          record.patient_id,
          record.patient_name,
          record.patient_email,
          record.dentition_type,
          record.dentist_id,
          record.dentist_name,
          record.clinic_name,
          getRecordSourceLabel(record.record_source),
          record.source_notes,
          record.status,
          record.date_created,
          record.last_updated,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(cleanSearch);
      });
    }

    result.sort((a, b) => {
      const patientA = (a.patient_name || "").toLowerCase();
      const patientB = (b.patient_name || "").toLowerCase();

      const dentistA = (a.dentist_name || "").toLowerCase();
      const dentistB = (b.dentist_name || "").toLowerCase();

      const createdA = a.date_created ? new Date(a.date_created).getTime() : 0;
      const createdB = b.date_created ? new Date(b.date_created).getTime() : 0;

      const updatedA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
      const updatedB = b.last_updated ? new Date(b.last_updated).getTime() : 0;

      switch (sortBy) {
        case "oldest":
          return createdA - createdB;
        case "updated":
          return updatedB - updatedA;
        case "patient-az":
          return patientA.localeCompare(patientB);
        case "patient-za":
          return patientB.localeCompare(patientA);
        case "dentist-az":
          return dentistA.localeCompare(dentistB);
        case "dentist-za":
          return dentistB.localeCompare(dentistA);
        case "newest":
        default:
          return createdB - createdA;
      }
    });

    return result;
  }, [records, searchTerm, statusFilter, sourceFilter, sortBy]);

  const recordSummary = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((record) => getRecordStatus(record) === "Active")
        .length,
      archived: records.filter(
        (record) => getRecordStatus(record) === "Archived",
      ).length,
      oldImported: records.filter((record) => {
        const source = record.record_source || "NEW_SYSTEM_RECORD";
        return (
          source === "OLD_ENCODED_RECORD" ||
          source === "SCANNED_OLD_RECORD" ||
          source === "PDA_BASED_RECORD"
        );
      }).length,
    };
  }, [records]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSourceFilter("All");
    setSortBy("newest");
  };

  const recordCountText = () => {
    if (loading) return "Loading records...";

    if (records.length === 0) {
      return "No dental records found.";
    }

    if (filteredAndSortedRecords.length === records.length) {
      return `${records.length} dental record${
        records.length === 1 ? "" : "s"
      } found.`;
    }

    return `${filteredAndSortedRecords.length} of ${records.length} dental records shown.`;
  };

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 4 }).map((_, index) => (
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
            <h2>Dental Records</h2>
            <p>
              Create, search, review, and manage dental records for patients
              under your assigned dentist account.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              {showCreateForm ? "Hide Create Form" : "Create Record"}
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

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Dental record notice</strong>
            <p>{error}</p>
          </div>
        )}

        {policyError && (
          <div className="error-message">
            <strong>{policyError.message}</strong>

            {policyError.existingRecord && (
              <div style={{ marginTop: "10px" }}>
                <p>
                  <strong>Existing Active Record:</strong> Record #
                  {policyError.existingRecord.record_id}
                </p>

                <p>
                  <strong>Assigned Dentist:</strong>{" "}
                  {policyError.existingRecord.dentist_name || "N/A"}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {policyError.existingRecord.clinic_name || "N/A"}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  {policyError.existingRecord.status || "Active"}
                </p>

                <p>
                  <strong>Record Source:</strong>{" "}
                  {getRecordSourceLabel(
                    policyError.existingRecord.record_source,
                  )}
                </p>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    navigate(
                      `/dentist/dental-records/${policyError.existingRecord.record_id}`,
                    )
                  }
                  style={{ marginTop: "8px" }}
                >
                  Open Existing Record
                </button>
              </div>
            )}

            {policyError.policy?.rules?.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <strong>{policyError.policy.name || "Policy Rules"}:</strong>

                <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                  {policyError.policy.rules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total Records</span>
            <strong>{recordSummary.total}</strong>
            <p>All dental records under your account.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Active</span>
            <strong>{recordSummary.active}</strong>
            <p>Records available for normal updates.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Archived</span>
            <strong>{recordSummary.archived}</strong>
            <p>Records no longer editable by dentist.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Old / Imported</span>
            <strong>{recordSummary.oldImported}</strong>
            <p>Records from old or scanned sources.</p>
          </div>
        </div>

        {showCreateForm && (
          <div className="patient-dashboard-section">
            <div className="appointments-header">
              <div>
                <h2>Create Dental Record</h2>
                <p>
                  Select a patient and identify whether this is a new record or
                  an old/imported record.
                </p>
              </div>
            </div>

            <div className="info-message">
              <strong>Dental Record Creation Policy:</strong>
              <br />A dental record can only be created for an existing patient
              profile with Adult/Child dental chart type set. The dentist must
              have an appointment connection with the patient, and only one
              active dental record is allowed per patient per clinic.
            </div>

            {selectedPatient && (
              <div className="info-message">
                <strong>Selected Patient:</strong>{" "}
                {selectedPatient.patient_name}
                <br />
                <strong>Email:</strong> {selectedPatient.email}
                <br />
                <strong>Dental Chart Type:</strong>{" "}
                {getPatientDentitionLabel(selectedPatient.dentition_type)}
                {!selectedPatient.dentition_type && (
                  <>
                    <br />
                    <strong>Action Needed:</strong> This patient must update
                    their profile and select Adult or Child before a dental
                    record can be created.
                  </>
                )}
              </div>
            )}

            <form
              className="dentist-record-create-form"
              onSubmit={handleCreateRecord}
            >
              <div className="form-group">
                <label>Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    setMessage("");
                    setError("");
                    setPolicyError(null);
                  }}
                  disabled={loadingPatients}
                  required
                >
                  <option value="">Select Patient</option>
                  {patients.map((patient) => (
                    <option key={patient.patient_id} value={patient.patient_id}>
                      {getPatientOptionLabel(patient)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Record Source</label>
                <select
                  value={recordSource}
                  onChange={(e) => {
                    setRecordSource(e.target.value);
                    setMessage("");
                    setError("");
                    setPolicyError(null);
                  }}
                  required
                >
                  {RECORD_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="info-message dentist-record-source-guide">
                <strong>{getRecordSourceLabel(recordSource)}:</strong>{" "}
                {getRecordSourceDescription(recordSource)}
              </div>

              <div className="form-group dentist-record-notes-field">
                <label>Source Notes</label>
                <textarea
                  value={sourceNotes}
                  onChange={(e) => setSourceNotes(e.target.value)}
                  placeholder={
                    recordSource === "NEW_SYSTEM_RECORD"
                      ? "Example: New dental record created after today's consultation."
                      : recordSource === "OLD_ENCODED_RECORD"
                        ? "Example: Manually encoded from the patient's previous paper record."
                        : "Example: Based on scanned old record uploaded by clinic staff."
                  }
                  rows="4"
                />
              </div>

              <div className="appointment-actions dentist-record-create-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateForm(false);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creating || !selectedPatientId}
                >
                  {creating ? "Creating..." : "Create Dental Record"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Search and Filter</h2>
              <p>
                Search by patient, record ID, dentist, clinic, source, or notes.
              </p>
            </div>

            {(searchTerm ||
              statusFilter !== "All" ||
              sourceFilter !== "All" ||
              sortBy !== "newest") && (
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="dentist-record-filter-panel">
            <div className="form-group">
              <label>Search Records</label>
              <input
                type="text"
                placeholder="Search patient, clinic, record ID, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={loading}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="form-group">
              <label>Record Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                disabled={loading}
              >
                <option value="All">All Sources</option>
                <option value="NEW_SYSTEM_RECORD">New System Record</option>
                <option value="OLD_IMPORTED">Old / Imported Records</option>
                <option value="OLD_ENCODED_RECORD">Old Encoded Record</option>
                <option value="SCANNED_OLD_RECORD">Scanned Old Record</option>
              </select>
            </div>

            <div className="form-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                disabled={loading}
              >
                <option value="newest">Newest Created</option>
                <option value="oldest">Oldest Created</option>
                <option value="updated">Recently Updated</option>
                <option value="patient-az">Patient A-Z</option>
                <option value="patient-za">Patient Z-A</option>
                <option value="dentist-az">Dentist A-Z</option>
                <option value="dentist-za">Dentist Z-A</option>
              </select>
            </div>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Record List</h2>
              <p>{recordCountText()}</p>
            </div>
          </div>

          {loading ? (
            renderLoadingState()
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>Created patient dental records will appear here.</p>
            </div>
          ) : filteredAndSortedRecords.length === 0 ? (
            <div className="empty-state">
              <h3>No matching dental records</h3>
              <p>
                Try changing your search, filter, or sorting options to view
                more records.
              </p>
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="appointments-list">
              {filteredAndSortedRecords.map((record) => (
                <div
                  className="appointment-item dentist-record-item"
                  key={record.record_id}
                >
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>Record #{record.record_id}</h3>

                      <span className={getRecordStatusClass(record.status)}>
                        {record.status || "Active"}
                      </span>

                      <span
                        className={getRecordSourceClass(record.record_source)}
                      >
                        {getRecordSourceLabel(record.record_source)}
                      </span>
                    </div>

                    <div className="dentist-record-detail-grid">
                      <div className="dentist-record-left-details">
                        <p>
                          <strong>Patient:</strong>{" "}
                          {record.patient_name ||
                            `Patient ID ${record.patient_id}`}
                        </p>

                        <p>
                          <strong>Dental Chart Type:</strong>{" "}
                          {getPatientDentitionLabel(record.dentition_type)}
                        </p>

                        <p>
                          <strong>Dentist:</strong>{" "}
                          {record.dentist_name ||
                            `Dentist ID ${record.dentist_id}`}
                        </p>

                        <p>
                          <strong>Clinic:</strong>{" "}
                          {record.clinic_name || "No assigned clinic"}
                        </p>
                      </div>

                      <div className="dentist-record-right-details">
                        <p>
                          <strong>Date Created:</strong>{" "}
                          {formatDate(record.date_created)}
                        </p>

                        <p>
                          <strong>Last Updated:</strong>{" "}
                          {formatDate(record.last_updated)}
                        </p>

                        {record.source_notes && (
                          <p>
                            <strong>Source Notes:</strong> {record.source_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="appointment-actions dentist-record-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        navigate(`/dentist/dental-records/${record.record_id}`)
                      }
                    >
                      View Details
                    </button>

                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate(
                          `/dentist/dental-records/${record.record_id}/3d-view`,
                        )
                      }
                    >
                      3D Chart
                    </button>

                    <button
                      className="danger-button"
                      disabled={
                        archiving || getRecordStatus(record) === "Archived"
                      }
                      onClick={() => openArchiveModal(record)}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showArchiveModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Archive Dental Record</h3>
                <p>
                  Confirm that you want to archive this dental record. Archived
                  records cannot be modified unless restored by an
                  administrator.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeArchiveModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleArchiveRecord}>
              <div className="info-message">
                <strong>Policy Reminder:</strong> Archiving this record allows a
                new active dental record to be created for this patient under
                the same clinic, but the archived record itself cannot be
                modified while archived.
              </div>

              <div className="form-group">
                <label>Record</label>
                <input
                  type="text"
                  value={
                    selectedRecord ? `Record #${selectedRecord.record_id}` : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Patient</label>
                <input
                  type="text"
                  value={
                    selectedRecord?.patient_name ||
                    `Patient ID ${selectedRecord?.patient_id || ""}`
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Dental Chart Type</label>
                <input
                  type="text"
                  value={getPatientDentitionLabel(
                    selectedRecord?.dentition_type,
                  )}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Record Source</label>
                <input
                  type="text"
                  value={getRecordSourceLabel(selectedRecord?.record_source)}
                  disabled
                />
              </div>

              {selectedRecord?.source_notes && (
                <div className="form-group">
                  <label>Source Notes</label>
                  <textarea value={selectedRecord.source_notes} disabled />
                </div>
              )}

              <div className="form-group">
                <label>Dentist</label>
                <input
                  type="text"
                  value={
                    selectedRecord?.dentist_name ||
                    `Dentist ID ${selectedRecord?.dentist_id || ""}`
                  }
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeArchiveModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={archiving}
                >
                  {archiving ? "Archiving..." : "Confirm Archive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistDentalRecords;
