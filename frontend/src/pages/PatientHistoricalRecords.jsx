import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientHistoricalRecords() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const role = storedUser.role || storedUser.role_name;
  const isPatient = role === "Patient";

  const [directory, setDirectory] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [data, setData] = useState(null);
  const [expandedEpisode, setExpandedEpisode] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    assignment_status: "All",
    clinic_id: "",
  });

  const [loadingDirectory, setLoadingDirectory] = useState(!isPatient);
  const [loadingHistory, setLoadingHistory] = useState(isPatient);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const loadDirectory = async (nextFilters = filters) => {
    if (isPatient) return;

    try {
      setLoadingDirectory(true);
      setError("");

      const params = new URLSearchParams();

      if (nextFilters.search.trim()) {
        params.append("search", nextFilters.search.trim());
      }

      if (nextFilters.assignment_status !== "All") {
        params.append("assignment_status", nextFilters.assignment_status);
      }

      if (nextFilters.clinic_id) {
        params.append("clinic_id", nextFilters.clinic_id);
      }

      const response = await API.get(
        `/api/patient-transfers/historical-patients?${params.toString()}`,
        authHeaders,
      );

      setDirectory(response.data.patients || []);
      setClinics(response.data.clinics || []);
    } catch (err) {
      setDirectory([]);
      setError(err.response?.data?.error || "Unable to load the Patient list.");
    } finally {
      setLoadingDirectory(false);
    }
  };

  const loadHistory = async (patientId = selectedPatientId) => {
    try {
      setLoadingHistory(true);
      setSelectedPatientId(String(patientId || ""));
      setError("");

      const query = isPatient
        ? ""
        : `?patient_id=${encodeURIComponent(patientId)}`;

      const response = await API.get(
        `/api/patient-transfers/historical-records${query}`,
        authHeaders,
      );

      setData(response.data);
      setSelectedPatientId(String(response.data.patient.patient_id));
      setExpandedEpisode(
        response.data.care_episodes?.[0]?.care_episode_id || null,
      );
    } catch (err) {
      setData(null);
      setError(
        err.response?.data?.error ||
          "Unable to load Patient historical records.",
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isPatient) {
      loadHistory();
    } else {
      loadDirectory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const episodes = data?.care_episodes || [];

  const historicalCount = useMemo(
    () =>
      episodes.filter((episode) => episode.episode_status === "Historical")
        .length,
    [episodes],
  );

  const formatDate = (value, includeTime = false) => {
    if (!value) return "Present";

    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      ...(includeTime
        ? {
            hour: "numeric",
            minute: "2-digit",
          }
        : {}),
    });
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    if (/^https?:\/\//i.test(filePath)) {
      return filePath;
    }

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${String(filePath).replace(/^\/+/, "")}`;
  };

  const getRecordDetailPath = (recordId) => {
    switch (role) {
      case "Clinic Owner":
        return `/clinic-owner/dental-records/${recordId}`;
      case "Dentist":
        return `/dentist/dental-records/${recordId}`;
      case "Assistant":
      case "Dental Assistant":
        return `/assistant/dental-records/${recordId}`;
      case "Admin":
        return `/admin/dental-records/${recordId}`;
      case "Patient":
      default:
        return `/patient/records/${recordId}`;
    }
  };

  const clearFilters = () => {
    const cleared = {
      search: "",
      assignment_status: "All",
      clinic_id: "",
    };

    setFilters(cleared);
    loadDirectory(cleared);
  };

  return (
    <DashboardLayout role={role}>
      <div className="appointments-list-card historical-records-page">
        <div className="appointments-header historical-page-header">
          <div>
            <h1>Patient Historical Records</h1>
            <p>
              Review current and previous clinic care episodes while preserving
              each record&apos;s original clinic, Dentist, and treatment
              timeline.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => (isPatient ? loadHistory() : loadDirectory(filters))}
            disabled={loadingDirectory || loadingHistory}
          >
            Refresh
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!isPatient && (
          <>
            <form
              className="historical-record-filters"
              onSubmit={(event) => {
                event.preventDefault();
                loadDirectory(filters);
              }}
            >
              <div className="form-group historical-search-field">
                <label htmlFor="historical-search">Search Patient</label>
                <input
                  id="historical-search"
                  type="search"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Name, email, contact number, or Patient ID"
                />
              </div>

              <div className="form-group">
                <label htmlFor="historical-assignment-status">
                  Patient Status
                </label>
                <select
                  id="historical-assignment-status"
                  value={filters.assignment_status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      assignment_status: event.target.value,
                    }))
                  }
                >
                  <option value="All">All Patients</option>
                  <option value="Current">Currently Assigned</option>
                  <option value="Historical">Has Historical Records</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="historical-clinic-filter">Clinic History</label>
                <select
                  id="historical-clinic-filter"
                  value={filters.clinic_id}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      clinic_id: event.target.value,
                    }))
                  }
                >
                  <option value="">All Authorized Clinics</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.clinic_id} value={clinic.clinic_id}>
                      {clinic.clinic_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="historical-filter-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={loadingDirectory}
                >
                  {loadingDirectory ? "Loading..." : "Apply Filters"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                  disabled={loadingDirectory}
                >
                  Clear
                </button>
              </div>
            </form>

            <section className="historical-patient-directory">
              <div className="appointments-header">
                <div>
                  <h2>Patient List</h2>
                  <p>
                    Select a Patient to open their complete clinic and care
                    history.
                  </p>
                </div>

                <span className="status-badge status-scheduled">
                  {directory.length} found
                </span>
              </div>

              {loadingDirectory ? (
                <div className="loading-message">Loading Patients...</div>
              ) : directory.length === 0 ? (
                <div className="empty-state">
                  No Patients match the selected filters.
                </div>
              ) : (
                <div className="historical-patient-table-wrap">
                  <table className="historical-patient-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Contact</th>
                        <th>Current Clinic</th>
                        <th>Assignments</th>
                        <th>Historical</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {directory.map((patient) => (
                        <tr
                          key={patient.patient_id}
                          className={
                            Number(selectedPatientId) ===
                            Number(patient.patient_id)
                              ? "selected"
                              : ""
                          }
                        >
                          <td>
                            <strong>{patient.patient_name}</strong>
                            <span>{patient.patient_email}</span>
                            <small>Patient ID: {patient.patient_id}</small>
                          </td>

                          <td>{patient.contact_number || "Not provided"}</td>

                          <td>{patient.current_clinic_name || "Unassigned"}</td>

                          <td>{patient.total_assignments}</td>

                          <td>
                            <span
                              className={`status-badge ${
                                patient.historical_assignments > 0
                                  ? "status-pending"
                                  : "status-completed"
                              }`}
                            >
                              {patient.historical_assignments}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => loadHistory(patient.patient_id)}
                              disabled={
                                loadingHistory &&
                                Number(selectedPatientId) ===
                                  Number(patient.patient_id)
                              }
                            >
                              {loadingHistory &&
                              Number(selectedPatientId) ===
                                Number(patient.patient_id)
                                ? "Opening..."
                                : "View History"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {loadingHistory ? (
          <div className="loading-message">Loading historical records...</div>
        ) : !data ? (
          !isPatient && (
            <div className="historical-selection-empty">
              <h3>Select a Patient</h3>
              <p>
                Use the Patient list above to view current and historical care
                episodes.
              </p>
            </div>
          )
        ) : (
          <section className="historical-record-results">
            <div className="appointments-header">
              <div>
                <h2>{data.patient.patient_name}</h2>
                <p>
                  {data.patient.patient_email} · Patient ID{" "}
                  {data.patient.patient_id}
                </p>
              </div>

              <span className="status-badge status-completed">
                Current Clinic: {data.patient.current_clinic_name || "N/A"}
              </span>
            </div>

            <div className="patient-dashboard-summary-grid">
              <div className="patient-dashboard-card">
                <span>Current Clinic</span>
                <strong>{data.patient.current_clinic_name || "N/A"}</strong>
                <p>Active clinic assignment</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Care Episodes</span>
                <strong>{episodes.length}</strong>
                <p>Complete clinic timeline</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Historical Episodes</span>
                <strong>{historicalCount}</strong>
                <p>Read-only previous care periods</p>
              </div>
            </div>

            <div className="historical-record-timeline">
              {episodes.map((episode) => {
                const expanded =
                  Number(expandedEpisode) === Number(episode.care_episode_id);

                return (
                  <article
                    key={episode.care_episode_id}
                    className={`historical-episode-card ${
                      episode.episode_status === "Active" ? "active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="historical-episode-header"
                      onClick={() =>
                        setExpandedEpisode(
                          expanded ? null : episode.care_episode_id,
                        )
                      }
                    >
                      <div>
                        <span
                          className={`status-badge ${
                            episode.episode_status === "Active"
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {episode.episode_status}
                        </span>

                        <h2>{episode.clinic_name}</h2>
                        <p>
                          {formatDate(episode.started_at)} –{" "}
                          {formatDate(episode.ended_at)}
                        </p>
                      </div>

                      <strong>{expanded ? "−" : "+"}</strong>
                    </button>

                    {expanded && (
                      <div className="historical-episode-content">
                        <section>
                          <h3>Dental Records ({episode.records.length})</h3>

                          {episode.records.length === 0 ? (
                            <div className="empty-state">
                              No dental records in this care episode.
                            </div>
                          ) : (
                            <div className="historical-record-grid">
                              {episode.records.map((record) => (
                                <article
                                  className="historical-record-card"
                                  key={record.record_id}
                                >
                                  <div>
                                    <strong>Record #{record.record_id}</strong>
                                    <span>
                                      {record.is_historical
                                        ? "Historical"
                                        : "Current"}
                                    </span>
                                  </div>

                                  <p>Dentist: {record.dentist_name}</p>
                                  <p>
                                    Created:{" "}
                                    {formatDate(record.date_created, true)}
                                  </p>
                                  <p>
                                    Source: {record.record_source || "System"}
                                  </p>
                                  <p>Notes: {record.source_notes || "None"}</p>

                                  <div className="historical-record-actions">
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() =>
                                        navigate(
                                          getRecordDetailPath(record.record_id),
                                        )
                                      }
                                    >
                                      View Full Record
                                    </button>
                                  </div>

                                  <div className="historical-tooth-grid">
                                    {(record.teeth || []).map((tooth) => (
                                      <div
                                        key={tooth.tooth_id}
                                        className="historical-tooth-card"
                                      >
                                        <strong>
                                          Tooth {tooth.tooth_number}
                                        </strong>
                                        <span>{tooth.tooth_status}</span>

                                        {(tooth.treatments || []).map(
                                          (treatment) => (
                                            <small key={treatment.treatment_id}>
                                              {treatment.procedure_type}
                                            </small>
                                          ),
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {(record.xrays || []).length > 0 && (
                                    <div className="historical-xray-list">
                                      {(record.xrays || []).map((xray) => (
                                        <a
                                          key={xray.xray_id}
                                          href={getFileUrl(xray.file_path)}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Open X-ray #{xray.xray_id}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </article>
                              ))}
                            </div>
                          )}
                        </section>

                        <section>
                          <h3>Appointments ({episode.appointments.length})</h3>

                          {episode.appointments.length === 0 ? (
                            <div className="empty-state">
                              No appointments in this care episode.
                            </div>
                          ) : (
                            <div className="patient-transfer-table-wrap">
                              <table className="patient-transfer-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Dentist</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {episode.appointments.map((appointment) => (
                                    <tr key={appointment.appointment_id}>
                                      <td>
                                        {formatDate(
                                          appointment.appointment_date,
                                          true,
                                        )}
                                      </td>
                                      <td>
                                        {appointment.appointment_type || "N/A"}
                                      </td>
                                      <td>{appointment.dentist_name}</td>
                                      <td>{appointment.status}</td>
                                      <td>{appointment.notes || "None"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientHistoricalRecords;
