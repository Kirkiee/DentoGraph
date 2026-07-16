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

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadgeClass = (action) => {
    const normalizedAction = String(action || "").toUpperCase();

    if (
      normalizedAction.includes("DELETE") ||
      normalizedAction.includes("ARCHIVE") ||
      normalizedAction.includes("DEACTIVATE") ||
      normalizedAction.includes("FAILED")
    ) {
      return "status-badge status-cancelled";
    }

    if (
      normalizedAction.includes("CREATE") ||
      normalizedAction.includes("LOGIN") ||
      normalizedAction.includes("VERIFY") ||
      normalizedAction.includes("CONFIRM") ||
      normalizedAction.includes("PAYMENT")
    ) {
      return "status-badge status-completed";
    }

    if (
      normalizedAction.includes("UPDATE") ||
      normalizedAction.includes("CHANGE") ||
      normalizedAction.includes("SUBSCRIPTION")
    ) {
      return "status-badge status-scheduled";
    }

    return "status-badge status-pending";
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-audit-logs-page">
        <div className="appointments-header">
          <div>
            <h2>Audit Logs</h2>
            <p>
              Monitor important admin and system activities including logins,
              role changes, clinic location updates, shared subscription
              changes, payments, records, and X-ray actions.
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

        <div className="admin-audit-section">
          <div className="appointments-header">
            <div>
              <h2>Audit Summary</h2>
              <p>Quick overview of recorded system activity.</p>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Total Logs</h3>
              <strong>{summary?.total_logs || 0}</strong>
              <p>All recorded activities</p>
            </div>

            <div className="dashboard-card">
              <h3>Logs Today</h3>
              <strong>{summary?.logs_today || 0}</strong>
              <p>Activities recorded today</p>
            </div>

            <div className="dashboard-card">
              <h3>Users Logged</h3>
              <strong>{summary?.active_users_logged || 0}</strong>
              <p>Unique users with activity</p>
            </div>

            <div className="dashboard-card">
              <h3>Listed Logs</h3>
              <strong>{logs.length}</strong>
              <p>Rows matching current filters</p>
            </div>
          </div>
        </div>

        <div className="admin-audit-section">
          <div className="appointments-header">
            <div>
              <h2>Audit Filters</h2>
              <p>
                Search and filter logs by user, action, module, IP address, or
                description.
              </p>
            </div>
          </div>

          <div className="admin-audit-filter-card">
            <div className="appointment-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search user, action, module, IP, or description"
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
                  <label>Visible Logs</label>
                  <input type="text" value={logs.length} disabled />
                </div>
              </div>

              <div className="admin-audit-filter-actions">
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
        </div>

        <div className="admin-audit-section">
          <div className="appointments-header">
            <div>
              <h2>Audit Log Records</h2>
              <p>
                Table view of logged activity for easier scanning during demos
                and admin review.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <h3>No audit logs found</h3>
              <p>
                System activities will appear here once actions are recorded.
              </p>
            </div>
          ) : (
            <div className="payment-table-wrapper admin-audit-table-wrapper">
              <table className="payment-table admin-audit-table">
                <thead>
                  <tr>
                    <th>Log</th>
                    <th>User</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Description</th>
                    <th>IP Address</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.log_id}>
                      <td>
                        <strong>#{log.log_id}</strong>
                      </td>

                      <td>
                        <strong>
                          {log.user_name || "System / Unknown User"}
                        </strong>
                        <br />
                        <span className="muted-text">
                          {log.role_name || "No Role"}
                        </span>
                        <br />
                        <span className="admin-audit-email-text">
                          {log.user_email || "N/A"}
                        </span>
                      </td>

                      <td>
                        <strong>{log.module || "General"}</strong>
                      </td>

                      <td>
                        <span className={getActionBadgeClass(log.action)}>
                          {log.action || "ACTION"}
                        </span>
                      </td>

                      <td>
                        <span className="admin-audit-description">
                          {log.description || "No description provided"}
                        </span>
                      </td>

                      <td>
                        <span className="muted-text">
                          {log.ip_address || "N/A"}
                        </span>
                      </td>

                      <td>{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminAuditLogs;
