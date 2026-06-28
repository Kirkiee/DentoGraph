import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

const RECORD_SOURCE_OPTIONS = [
  {
    value: "NEW_SYSTEM_RECORD",
    label: "New System Record",
  },
  {
    value: "OLD_ENCODED_RECORD",
    label: "Old Encoded Record",
  },
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
  },
];

function AdminDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/dental-records?status=${statusFilter}`,
        authHeaders,
      );

      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
    }
  };

  const getRecordStatus = (record) => {
    return record.status || "Active";
  };

  const getStatusClass = (status) => {
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

  const getRecordSourceLabel = (source) => {
    if (source === "PDA_BASED_RECORD") {
      return "Old / Imported Record";
    }

    const match = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === source,
    );

    return match?.label || "New System Record";
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
          record.dentist_id,
          record.dentist_name,
          record.clinic_name,
          record.status,
          record.record_source,
          getRecordSourceLabel(record.record_source),
          record.source_notes,
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
  }, [records, searchTerm, sourceFilter, sortBy]);

  const activeCount = records.filter(
    (record) => getRecordStatus(record) === "Active",
  ).length;

  const archivedCount = records.filter(
    (record) => getRecordStatus(record) === "Archived",
  ).length;

  const shownCount = filteredAndSortedRecords.length;

  const recordCountText = () => {
    if (loading) return "Loading records...";

    if (records.length === 0) {
      return "No dental records found.";
    }

    if (shownCount === records.length) {
      return `${records.length} dental record${
        records.length === 1 ? "" : "s"
      } found.`;
    }

    return `${shownCount} of ${records.length} dental records shown.`;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSourceFilter("All");
    setSortBy("newest");
  };

  const openRestoreModal = (record) => {
    setSelectedRecord(record);
    setMessage("");
    setError("");
    setShowRestoreModal(true);
  };

  const closeRestoreModal = () => {
    setShowRestoreModal(false);
    setSelectedRecord(null);
  };

  const handleRestoreRecord = async (e) => {
    e.preventDefault();

    if (!selectedRecord) {
      setError("No dental record selected for restoration.");
      return;
    }

    try {
      setRestoring(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/dental-records/${selectedRecord.record_id}/restore`,
        {},
        authHeaders,
      );

      setMessage(`Record #${selectedRecord.record_id} restored successfully.`);
      closeRestoreModal();
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to restore dental record.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Records Management</h2>
            <p>
              View, search, filter, sort, and restore archived dental records.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchRecords}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Listed Records</h3>
            <strong>{shownCount}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Current Filter</h3>
            <strong>{statusFilter}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Active in List</h3>
            <strong>{activeCount}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Archived in List</h3>
            <strong>{archivedCount}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search record ID, patient, dentist, clinic, email, or source"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Record Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={loading}
            >
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
              <option value="All">All</option>
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

        <div
          className="appointment-actions"
          style={{ flexDirection: "row", marginBottom: "16px" }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={clearFilters}
            disabled={
              loading ||
              (!searchTerm && sourceFilter === "All" && sortBy === "newest")
            }
          >
            Clear Search / Sort
          </button>
        </div>

        <div className="info-message">{recordCountText()}</div>

        {loading ? (
          <p>Loading dental records...</p>
        ) : filteredAndSortedRecords.length === 0 ? (
          <div className="empty-state">
            <h3>No dental records found</h3>
            <p>
              Dental records matching the selected search, filter, or sorting
              options will appear here.
            </p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredAndSortedRecords.map((record) => (
              <div className="appointment-item" key={record.record_id}>
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
                    <strong>Record Source:</strong>{" "}
                    <span
                      className={getRecordSourceClass(record.record_source)}
                    >
                      {getRecordSourceLabel(record.record_source)}
                    </span>
                  </p>

                  {record.source_notes && (
                    <p>
                      <strong>Source Notes:</strong> {record.source_notes}
                    </p>
                  )}

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

                <div className="appointment-actions">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      navigate(`/admin/dental-records/${record.record_id}`)
                    }
                  >
                    View Details
                  </button>

                  {record.status === "Archived" && (
                    <button
                      className="primary-button"
                      disabled={restoring}
                      onClick={() => openRestoreModal(record)}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Restore Dental Record</h3>
                <p>
                  Confirm that you want to restore this archived dental record.
                  It will appear again in normal record lists.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRestoreModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRestoreRecord}>
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

              <div className="form-group">
                <label>Clinic</label>
                <input
                  type="text"
                  value={selectedRecord?.clinic_name || "No assigned clinic"}
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

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRestoreModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={restoring}
                >
                  {restoring ? "Restoring..." : "Confirm Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminDentalRecords;
