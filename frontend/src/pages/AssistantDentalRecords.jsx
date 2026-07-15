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

function AssistantDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [assignedClinic, setAssignedClinic] = useState({
    clinic_id: null,
    clinic_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setMessage("");

      const response = await API.get("/api/dental-records", authHeaders);

      setRecords(response.data.dental_records || []);
      setAssignedClinic({
        clinic_id: response.data.assigned_clinic_id || null,
        clinic_name: response.data.assigned_clinic_name || "",
      });
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getPatientDentitionLabel = (dentitionType) => {
    if (dentitionType === "Child") return "Child / Primary Teeth";
    if (dentitionType === "Adult") return "Adult / Permanent Teeth";

    return "Dentition type not set";
  };

  const getRecordSourceLabel = (recordSourceValue) => {
    if (recordSourceValue === "PDA_BASED_RECORD") {
      return "Old / Imported Record";
    }

    const foundSource = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === recordSourceValue,
    );

    return foundSource?.label || "New System Record";
  };

  const getRecordSourceDescription = (recordSourceValue) => {
    if (recordSourceValue === "PDA_BASED_RECORD") {
      return "Record imported from a previous clinic document.";
    }

    const foundSource = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === recordSourceValue,
    );

    return foundSource?.description || RECORD_SOURCE_OPTIONS[0].description;
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

  const getRecordSourceClass = (recordSourceValue) => {
    switch (recordSourceValue) {
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
          getRecordSourceDescription(record.record_source),
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

      const clinicA = (a.clinic_name || "").toLowerCase();
      const clinicB = (b.clinic_name || "").toLowerCase();

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
        case "clinic-az":
          return clinicA.localeCompare(clinicB);
        case "clinic-za":
          return clinicB.localeCompare(clinicA);
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

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSourceFilter("All");
    setSortBy("newest");
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
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Records</h2>

            <p>
              View dental records for patients under your assigned clinic.
              Dental assistants have view-only access to record details,
              treatment history, tooth status history, and 3D dental
              visualization.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => fetchRecords(true)}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="info-message assistant-record-access-message">
          <strong>Assistant Access:</strong> View-only mode. You can view dental
          records, treatment history, tooth status history, and the 3D chart.
          Creating, editing, archiving, or deleting dental record data is
          restricted to authorized dentist/admin roles.
        </div>

        {assignedClinic.clinic_name && (
          <div className="info-message">
            <strong>Assigned Clinic Location:</strong>{" "}
            {assignedClinic.clinic_name}
            {assignedClinic.clinic_id
              ? ` (Clinic ID: ${assignedClinic.clinic_id})`
              : ""}
          </div>
        )}

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Dental record notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total Records</span>
            <strong>{recordSummary.total}</strong>
            <p>All dental records visible to this assistant account.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Active Records</span>
            <strong>{recordSummary.active}</strong>
            <p>Currently active patient dental records.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Archived Records</span>
            <strong>{recordSummary.archived}</strong>
            <p>Records kept for history or reference.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Old / Imported</span>
            <strong>{recordSummary.oldImported}</strong>
            <p>Encoded, scanned, or imported clinic records.</p>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Search and Filter</h2>
              <p>
                Search by patient, dentist, clinic, record ID, source, or notes.
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

          <div className="assistant-record-filter-panel">
            <div className="form-group">
              <label>Search Records</label>
              <input
                type="text"
                placeholder="Search by patient, dentist, clinic, record ID, or notes..."
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
                <option value="clinic-az">Clinic A-Z</option>
                <option value="clinic-za">Clinic Z-A</option>
              </select>
            </div>
          </div>

          <div className="assistant-record-count-box">{recordCountText()}</div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Record List</h2>
              <p>Open a record to review its details, history, and 3D chart.</p>
            </div>
          </div>

          {loading ? (
            renderLoadingState()
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>
                Dental records created by dentists in your clinic will appear
                here.
              </p>
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
                  className="appointment-item assistant-record-item"
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

                    <div className="assistant-record-detail-grid">
                      <p>
                        <strong>Patient:</strong>{" "}
                        {record.patient_name ||
                          `Patient ID ${record.patient_id}`}
                      </p>

                      <p>
                        <strong>Patient Type:</strong>{" "}
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

                      <p>
                        <strong>Date Created:</strong>{" "}
                        {formatDate(record.date_created)}
                      </p>

                      <p>
                        <strong>Last Updated:</strong>{" "}
                        {formatDate(record.last_updated)}
                      </p>
                    </div>

                    <div className="assistant-record-source-note">
                      <strong>Record Source:</strong>{" "}
                      {getRecordSourceDescription(record.record_source)}
                    </div>

                    {record.source_notes && (
                      <div className="assistant-record-source-note">
                        <strong>Source Notes:</strong> {record.source_notes}
                      </div>
                    )}
                  </div>

                  <div className="appointment-actions assistant-record-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        navigate(
                          `/assistant/dental-records/${record.record_id}`,
                        )
                      }
                    >
                      View Details
                    </button>

                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate(
                          `/assistant/dental-records/${record.record_id}/3d-view`,
                        )
                      }
                    >
                      3D View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AssistantDentalRecords;
