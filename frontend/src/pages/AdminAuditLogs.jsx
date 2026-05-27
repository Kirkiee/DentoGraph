import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (moduleFilter !== "All") {
        params.append("module", moduleFilter);
      }

      if (actionFilter !== "All") {
        params.append("action", actionFilter);
      }

      if (searchTerm.trim() !== "") {
        params.append("search", searchTerm.trim());
      }

      const response = await API.get(
        `/api/audit-logs?${params.toString()}`,
        authHeaders,
      );

      setLogs(response.data.logs || []);
      setSummary(response.data.summary || null);
      setModules(response.data.modules || []);
      setActions(response.data.actions || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setModuleFilter("All");
    setActionFilter("All");

    setTimeout(() => {
      fetchAuditLogs();
    }, 0);
  };

  const getActionBadgeClass = (action) => {
    if (action?.includes("DELETE") || action?.includes("ARCHIVE")) {
      return "status-badge status-cancelled";
    }

    if (action?.includes("CREATE") || action?.includes("LOGIN")) {
      return "status-badge status-completed";
    }

    return "status-badge status-scheduled";
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Audit Logs</h2>
            <p>
              Monitor important system activities such as logins, role changes,
              subscription updates, record actions, and X-ray activity.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchAuditLogs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Total Logs</h3>
            <strong>{summary?.total_logs || 0}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Logs Today</h3>
            <strong>{summary?.logs_today || 0}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Users Logged</h3>
            <strong>{summary?.active_users_logged || 0}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Listed Logs</h3>
            <strong>{logs.length}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user, action, module, or description"
            />
          </div>

          <div className="form-group">
            <label>Module</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="All">All Modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="All">All Actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>&nbsp;</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary-button"
                onClick={fetchAuditLogs}
              >
                Apply Filters
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p>Loading audit logs...</p>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <h3>No audit logs found</h3>
            <p>System activities will appear here once actions are recorded.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {logs.map((log) => (
              <div className="appointment-item" key={log.log_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{log.module}</h3>

                    <span className={getActionBadgeClass(log.action)}>
                      {log.action}
                    </span>
                  </div>

                  <p>
                    <strong>User:</strong>{" "}
                    {log.user_name
                      ? `${log.user_name} (${log.role_name || "No Role"})`
                      : "System / Unknown User"}
                  </p>

                  <p>
                    <strong>Email:</strong> {log.user_email || "N/A"}
                  </p>

                  <p>
                    <strong>Description:</strong>{" "}
                    {log.description || "No description provided"}
                  </p>

                  <p>
                    <strong>IP Address:</strong> {log.ip_address || "N/A"}
                  </p>

                  <p>
                    <strong>Date:</strong>{" "}
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminAuditLogs;
