import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminClinics() {
  const [clinics, setClinics] = useState([]);
  const [filteredClinics, setFilteredClinics] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [clinicForm, setClinicForm] = useState({
    clinic_name: "",
    address: "",
    contact_number: "",
    email: "",
    operating_hours: "",
    status: "Active",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinics, searchTerm, statusFilter]);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/clinics", authHeaders);
      setClinics(response.data.clinics || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinics.");
    } finally {
      setLoading(false);
    }
  };

  const filterClinics = () => {
    let filtered = [...clinics];

    if (statusFilter !== "All") {
      filtered = filtered.filter((clinic) => clinic.status === statusFilter);
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(
        (clinic) =>
          clinic.clinic_name?.toLowerCase().includes(term) ||
          clinic.address?.toLowerCase().includes(term) ||
          clinic.email?.toLowerCase().includes(term) ||
          clinic.contact_number?.toLowerCase().includes(term),
      );
    }

    setFilteredClinics(filtered);
  };

  const openCreateModal = () => {
    setSelectedClinic(null);
    setClinicForm({
      clinic_name: "",
      address: "",
      contact_number: "",
      email: "",
      operating_hours: "",
      status: "Active",
    });
    setMessage("");
    setError("");
    setShowClinicModal(true);
  };

  const openEditModal = (clinic) => {
    setSelectedClinic(clinic);
    setClinicForm({
      clinic_name: clinic.clinic_name || "",
      address: clinic.address || "",
      contact_number: clinic.contact_number || "",
      email: clinic.email || "",
      operating_hours: clinic.operating_hours || "",
      status: clinic.status || "Active",
    });
    setMessage("");
    setError("");
    setShowClinicModal(true);
  };

  const closeClinicModal = () => {
    setShowClinicModal(false);
    setSelectedClinic(null);
    setClinicForm({
      clinic_name: "",
      address: "",
      contact_number: "",
      email: "",
      operating_hours: "",
      status: "Active",
    });
  };

  const handleClinicChange = (e) => {
    setClinicForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveClinic = async (e) => {
    e.preventDefault();

    if (!clinicForm.clinic_name) {
      setError("Clinic name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        clinic_name: clinicForm.clinic_name,
        address: clinicForm.address,
        contact_number: clinicForm.contact_number,
        email: clinicForm.email,
        operating_hours: clinicForm.operating_hours,
        status: clinicForm.status,
      };

      if (selectedClinic) {
        await API.put(
          `/api/clinics/${selectedClinic.clinic_id}`,
          payload,
          authHeaders,
        );

        setMessage("Clinic updated successfully.");
      } else {
        await API.post("/api/clinics", payload, authHeaders);
        setMessage("Clinic created successfully.");
      }

      closeClinicModal();
      fetchClinics();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save clinic.");
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (clinic, status) => {
    setSelectedClinic(clinic);
    setSelectedStatus(status);
    setMessage("");
    setError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedClinic(null);
    setSelectedStatus("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedClinic || !selectedStatus) {
      setError("Please select a valid clinic status.");
      return;
    }

    try {
      setUpdatingStatus(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/clinics/${selectedClinic.clinic_id}/status`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`Clinic marked as ${selectedStatus}.`);
      closeStatusModal();
      fetchClinics();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update clinic status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Active":
        return "status-badge status-completed";
      case "Inactive":
        return "status-badge status-cancelled";
      default:
        return "status-badge status-pending";
    }
  };

  const totalClinics = clinics.length;
  const activeClinics = clinics.filter(
    (clinic) => clinic.status === "Active",
  ).length;
  const inactiveClinics = clinics.filter(
    (clinic) => clinic.status === "Inactive",
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Management</h2>
            <p>
              Manage clinic branches, contact details, operating hours, and
              availability status.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button className="primary-button" onClick={openCreateModal}>
              Add Clinic
            </button>

            <button
              className="secondary-button"
              onClick={fetchClinics}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Total Clinics</h3>
            <strong>{totalClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Active Clinics</h3>
            <strong>{activeClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Inactive Clinics</h3>
            <strong>{inactiveClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Listed Branches</h3>
            <strong>{filteredClinics.length}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clinic name, address, email, or contact"
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading clinics...</p>
        ) : filteredClinics.length === 0 ? (
          <div className="empty-state">
            <h3>No clinics found</h3>
            <p>Add a clinic branch to start managing clinic information.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredClinics.map((clinic) => (
              <div className="appointment-item" key={clinic.clinic_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.clinic_name}</h3>

                    <span className={getStatusClass(clinic.status)}>
                      {clinic.status}
                    </span>
                  </div>

                  <p>
                    <strong>Clinic ID:</strong> {clinic.clinic_id}
                  </p>

                  <p>
                    <strong>Address:</strong>{" "}
                    {clinic.address || "No address provided"}
                  </p>

                  <p>
                    <strong>Contact:</strong>{" "}
                    {clinic.contact_number || "No contact provided"}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {clinic.email || "No email provided"}
                  </p>

                  <p>
                    <strong>Operating Hours:</strong>{" "}
                    {clinic.operating_hours || "No operating hours provided"}
                  </p>

                  <p>
                    <strong>Created:</strong>{" "}
                    {clinic.created_at
                      ? new Date(clinic.created_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>

                <div className="appointment-actions">
                  <button
                    className="secondary-button"
                    onClick={() => openEditModal(clinic)}
                  >
                    Edit
                  </button>

                  {clinic.status === "Active" ? (
                    <button
                      className="danger-button"
                      disabled={updatingStatus}
                      onClick={() => openStatusModal(clinic, "Inactive")}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      className="secondary-button"
                      disabled={updatingStatus}
                      onClick={() => openStatusModal(clinic, "Active")}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showClinicModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{selectedClinic ? "Edit Clinic" : "Add Clinic"}</h3>
                <p>
                  {selectedClinic
                    ? "Update clinic branch information."
                    : "Create a new clinic branch record."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeClinicModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSaveClinic}>
              <div className="form-group">
                <label>Clinic Name</label>
                <input
                  type="text"
                  name="clinic_name"
                  value={clinicForm.clinic_name}
                  onChange={handleClinicChange}
                  placeholder="Example: DentoGraph Manila Clinic"
                  required
                />
              </div>

              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={clinicForm.address}
                  onChange={handleClinicChange}
                  placeholder="Enter clinic address"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="text"
                  name="contact_number"
                  value={clinicForm.contact_number}
                  onChange={handleClinicChange}
                  placeholder="Example: 09123456789"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={clinicForm.email}
                  onChange={handleClinicChange}
                  placeholder="Example: clinic@example.com"
                />
              </div>

              <div className="form-group">
                <label>Operating Hours</label>
                <textarea
                  name="operating_hours"
                  value={clinicForm.operating_hours}
                  onChange={handleClinicChange}
                  placeholder="Example: Monday to Saturday, 9:00 AM - 6:00 PM"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={clinicForm.status}
                  onChange={handleClinicChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeClinicModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : selectedClinic
                      ? "Save Changes"
                      : "Add Clinic"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Clinic Status</h3>
                <p>
                  Confirm that you want to mark this clinic as{" "}
                  <strong>{selectedStatus}</strong>.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeStatusModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateStatus}>
              <div className="form-group">
                <label>Clinic</label>
                <input
                  type="text"
                  value={selectedClinic?.clinic_name || ""}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>New Status</label>
                <input type="text" value={selectedStatus} disabled />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeStatusModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className={
                    selectedStatus === "Inactive"
                      ? "danger-button"
                      : "primary-button"
                  }
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Updating..." : `Confirm ${selectedStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminClinics;
