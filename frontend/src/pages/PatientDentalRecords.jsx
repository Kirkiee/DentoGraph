import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
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

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
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

  const filteredAndSortedRecords = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    let result = [...records];

    if (statusFilter !== "All") {
      result = result.filter(
        (record) => getRecordStatus(record) === statusFilter,
      );
    }

    if (cleanSearch) {
      result = result.filter((record) => {
        const searchableText = [
          record.record_id,
          record.dentist_id,
          record.dentist_name,
          record.clinic_name,
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
  }, [records, searchTerm, statusFilter, sortBy]);

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

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Dental Records</h2>
            <p>
              View your dental records, tooth status, and treatment history.
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

        {error && <div className="error-message">{error}</div>}

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search Records</label>
            <input
              type="text"
              placeholder="Search by record ID, dentist, clinic, or status..."
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
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              disabled={loading}
            >
              <option value="newest">Newest Created</option>
              <option value="oldest">Oldest Created</option>
              <option value="updated">Recently Updated</option>
              <option value="dentist-az">Dentist A-Z</option>
              <option value="dentist-za">Dentist Z-A</option>
            </select>
          </div>
        </div>

        <div className="info-message">{recordCountText()}</div>

        {loading ? (
          <p>Loading dental records...</p>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <h3>No dental records yet</h3>
            <p>
              Your dental records will appear here once your dentist creates
              them.
            </p>
          </div>
        ) : filteredAndSortedRecords.length === 0 ? (
          <div className="empty-state">
            <h3>No matching dental records</h3>
            <p>
              Try changing your search, filter, or sorting options to view more
              records.
            </p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredAndSortedRecords.map((record) => {
              const status = getRecordStatus(record);

              return (
                <div className="appointment-item" key={record.record_id}>
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>Record #{record.record_id}</h3>

                      <span className={getStatusClass(status)}>{status}</span>
                    </div>

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
                        navigate(`/patient/records/${record.record_id}`)
                      }
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientDentalRecords;
