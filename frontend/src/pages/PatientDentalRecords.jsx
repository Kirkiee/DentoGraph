import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [assignedClinic, setAssignedClinic] = useState({
    clinic_id: null,
    clinic_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const fetchRecords = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

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

  const recordSummary = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((record) => getRecordStatus(record) === "Active")
        .length,
      inactive: records.filter(
        (record) => getRecordStatus(record) === "Inactive",
      ).length,
      archived: records.filter(
        (record) => getRecordStatus(record) === "Archived",
      ).length,
    };
  }, [records]);

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

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSortBy("newest");
  };

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 3 }).map((_, index) => (
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

  const filterTabs = [
    { label: "All", value: "All", count: recordSummary.total },
    { label: "Active", value: "Active", count: recordSummary.active },
    { label: "Inactive", value: "Inactive", count: recordSummary.inactive },
    { label: "Archived", value: "Archived", count: recordSummary.archived },
  ];

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Dental Records</h2>
            <p>
              View your dental records, assigned dentist, clinic, record status,
              and available record actions.
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

        {error && (
          <div className="error-message">
            <strong>Unable to load dental records.</strong>
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => fetchRecords(true)}
              disabled={refreshing}
            >
              Try Again
            </button>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total Records</span>
            <strong>{recordSummary.total}</strong>
            <p>All dental records linked to your account.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Active</span>
            <strong>{recordSummary.active}</strong>
            <p>Records currently available for viewing.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Inactive</span>
            <strong>{recordSummary.inactive}</strong>
            <p>Records currently marked as inactive.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Archived</span>
            <strong>{recordSummary.archived}</strong>
            <p>Records archived by clinic staff.</p>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Search and Filter</h2>
              <p>Use these controls to reduce clutter when records increase.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={clearFilters}
              disabled={loading}
            >
              Clear Filters
            </button>
          </div>

          <div className="patient-record-filter-panel">
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

          <div className="patient-filter-tabs">
            {filterTabs.map((tab) => (
              <button
                type="button"
                key={tab.value}
                className={
                  statusFilter === tab.value
                    ? "patient-filter-tab active"
                    : "patient-filter-tab"
                }
                onClick={() => setStatusFilter(tab.value)}
                disabled={loading}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="info-message">{recordCountText()}</div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Record List</h2>
              <p>Open a record to view full details, X-rays, and 3D chart.</p>
            </div>
          </div>

          {loading ? (
            renderLoadingState()
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>
                Your dental records will appear here once your dentist creates
                them during or after a consultation.
              </p>
            </div>
          ) : filteredAndSortedRecords.length === 0 ? (
            <div className="empty-state">
              <h3>No matching dental records</h3>
              <p>
                Try changing your search, status filter, or sorting option to
                view more records.
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
              {filteredAndSortedRecords.map((record) => {
                const status = getRecordStatus(record);

                return (
                  <div className="appointment-item" key={record.record_id}>
                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>Record #{record.record_id}</h3>

                        <span className={getStatusClass(status)}>{status}</span>
                      </div>

                      <div className="patient-record-detail-grid">
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
                    </div>

                    <div className="appointment-actions">
                      <button
                        className="primary-button"
                        onClick={() =>
                          navigate(`/patient/records/${record.record_id}`)
                        }
                      >
                        View Details
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => navigate("/patient/xrays")}
                      >
                        View X-rays
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() =>
                          navigate(
                            `/patient/records/${record.record_id}/3d-view`,
                          )
                        }
                      >
                        3D Chart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PatientDentalRecords;
