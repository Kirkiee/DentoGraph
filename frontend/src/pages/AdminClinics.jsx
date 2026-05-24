import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapFitBounds({ clinics }) {
  const map = useMap();

  useEffect(() => {
    const validClinics = clinics.filter(
      (clinic) => clinic.latitude && clinic.longitude,
    );

    if (validClinics.length === 0) return;

    const bounds = validClinics.map((clinic) => [
      Number(clinic.latitude),
      Number(clinic.longitude),
    ]);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
    });
  }, [clinics, map]);

  return null;
}

function AdminClinics() {
  const [clinics, setClinics] = useState([]);
  const [filteredClinics, setFilteredClinics] = useState([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [clinicForm, setClinicForm] = useState({
    clinic_name: "",
    address: "",
    latitude: "",
    longitude: "",
    services: "",
    contact_number: "",
    opening_hours: "",
    subscription_plan_id: "",
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
    fetchSubscriptionPlans();
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

  const fetchSubscriptionPlans = async () => {
    try {
      setLoadingPlans(true);

      const response = await API.get("/api/subscription-plans", authHeaders);

      setSubscriptionPlans(
        response.data.subscription_plans || response.data.plans || [],
      );
    } catch (err) {
      console.error("Fetch subscription plans error:", err);
      setSubscriptionPlans([]);
    } finally {
      setLoadingPlans(false);
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
          clinic.contact_number?.toLowerCase().includes(term) ||
          clinic.services?.toLowerCase().includes(term) ||
          clinic.plan_name?.toLowerCase().includes(term),
      );
    }

    setFilteredClinics(filtered);
  };

  const resetClinicForm = () => {
    setClinicForm({
      clinic_name: "",
      address: "",
      latitude: "",
      longitude: "",
      services: "",
      contact_number: "",
      opening_hours: "",
      subscription_plan_id: "",
      status: "Active",
    });
  };

  const openCreateModal = () => {
    setSelectedClinic(null);
    resetClinicForm();
    setMessage("");
    setError("");
    setShowClinicModal(true);
  };

  const openEditModal = (clinic) => {
    setSelectedClinic(clinic);

    setClinicForm({
      clinic_name: clinic.clinic_name || "",
      address: clinic.address || "",
      latitude: clinic.latitude || "",
      longitude: clinic.longitude || "",
      services: clinic.services || "",
      contact_number: clinic.contact_number || "",
      opening_hours: clinic.opening_hours || clinic.operating_hours || "",
      subscription_plan_id: clinic.subscription_plan_id || "",
      status: clinic.status || "Active",
    });

    setMessage("");
    setError("");
    setShowClinicModal(true);
  };

  const closeClinicModal = () => {
    setShowClinicModal(false);
    setSelectedClinic(null);
    resetClinicForm();
  };

  const handleClinicChange = (e) => {
    setClinicForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateCoordinates = () => {
    if (clinicForm.latitude !== "") {
      const latitude = Number(clinicForm.latitude);

      if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
        setError("Latitude must be a valid number between -90 and 90.");
        return false;
      }
    }

    if (clinicForm.longitude !== "") {
      const longitude = Number(clinicForm.longitude);

      if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
        setError("Longitude must be a valid number between -180 and 180.");
        return false;
      }
    }

    return true;
  };

  const handleSaveClinic = async (e) => {
    e.preventDefault();

    if (!clinicForm.clinic_name.trim()) {
      setError("Clinic name is required.");
      return;
    }

    if (!clinicForm.address.trim()) {
      setError("Clinic address is required.");
      return;
    }

    if (!validateCoordinates()) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        clinic_name: clinicForm.clinic_name,
        address: clinicForm.address,
        latitude: clinicForm.latitude || null,
        longitude: clinicForm.longitude || null,
        services: clinicForm.services,
        contact_number: clinicForm.contact_number,
        opening_hours: clinicForm.opening_hours,
        subscription_plan_id: clinicForm.subscription_plan_id || null,
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
        `/api/clinics/${selectedClinic.clinic_id}`,
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

  const getMapSearchLink = (clinic) => {
    if (clinic.latitude && clinic.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${clinic.latitude},${clinic.longitude}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${clinic.clinic_name} ${clinic.address || ""}`,
    )}`;
  };

  const validMapClinics = useMemo(() => {
    return filteredClinics.filter(
      (clinic) => clinic.latitude && clinic.longitude,
    );
  }, [filteredClinics]);

  const mapCenter = useMemo(() => {
    if (validMapClinics.length > 0) {
      return [
        Number(validMapClinics[0].latitude),
        Number(validMapClinics[0].longitude),
      ];
    }

    return [14.5995, 120.9842];
  }, [validMapClinics]);

  const totalClinics = clinics.length;
  const activeClinics = clinics.filter(
    (clinic) => clinic.status === "Active",
  ).length;
  const inactiveClinics = clinics.filter(
    (clinic) => clinic.status === "Inactive",
  ).length;
  const mappedClinics = clinics.filter(
    (clinic) => clinic.latitude && clinic.longitude,
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Management</h2>
            <p>
              Manage clinic branches, map coordinates, services, subscription
              plans, contact details, and availability status.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button className="primary-button" onClick={openCreateModal}>
              Add Clinic
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                fetchClinics();
                fetchSubscriptionPlans();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          Clinics with active status and valid latitude/longitude coordinates
          will appear in Patient Clinic Discovery and on the real-time map.
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
            <h3>Mapped Clinics</h3>
            <strong>{mappedClinics}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clinic, address, service, contact, or plan"
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

        <div className="clinic-map-card">
          <div className="appointments-header">
            <div>
              <h2>Clinic Location Map</h2>
              <p>
                View clinic markers based on saved latitude and longitude
                coordinates. The map follows the current search and status
                filters.
              </p>
            </div>

            <span className="status-badge status-scheduled">
              {validMapClinics.length} mapped
            </span>
          </div>

          <div className="clinic-map-wrapper">
            <MapContainer
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={true}
              className="clinic-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapFitBounds clinics={validMapClinics} />

              {validMapClinics.map((clinic) => (
                <Marker
                  key={clinic.clinic_id}
                  position={[Number(clinic.latitude), Number(clinic.longitude)]}
                >
                  <Popup>
                    <strong>{clinic.clinic_name}</strong>
                    <br />
                    Status: {clinic.status || "N/A"}
                    <br />
                    {clinic.address || "No address provided"}
                    <br />
                    Services: {clinic.services || "No services listed"}
                    <br />
                    Plan: {clinic.plan_name || "No plan assigned"}
                    <br />
                    <a
                      href={getMapSearchLink(clinic)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
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
                    <strong>Coordinates:</strong>{" "}
                    {clinic.latitude && clinic.longitude
                      ? `${clinic.latitude}, ${clinic.longitude}`
                      : "No coordinates provided"}
                  </p>

                  <p>
                    <strong>Services:</strong>{" "}
                    {clinic.services || "No services listed"}
                  </p>

                  <p>
                    <strong>Contact:</strong>{" "}
                    {clinic.contact_number || "No contact provided"}
                  </p>

                  <p>
                    <strong>Opening Hours:</strong>{" "}
                    {clinic.opening_hours || "No opening hours provided"}
                  </p>

                  <p>
                    <strong>Subscription Plan:</strong>{" "}
                    {clinic.plan_name || "No plan assigned"}
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

                  <a
                    className="secondary-button"
                    href={getMapSearchLink(clinic)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Map
                  </a>

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
                      className="primary-button"
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
                    ? "Update clinic branch information, map coordinates, and subscription plan."
                    : "Create a new clinic branch record for discovery and map display."}
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
                  required
                />
              </div>

              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  name="latitude"
                  value={clinicForm.latitude}
                  onChange={handleClinicChange}
                  placeholder="Example: 14.5995"
                  step="0.0000001"
                />
              </div>

              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  name="longitude"
                  value={clinicForm.longitude}
                  onChange={handleClinicChange}
                  placeholder="Example: 120.9842"
                  step="0.0000001"
                />
              </div>

              <div className="form-group">
                <label>Services</label>
                <textarea
                  name="services"
                  value={clinicForm.services}
                  onChange={handleClinicChange}
                  placeholder="Example: Dental Consultation, Cleaning, Filling, X-ray"
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
                <label>Opening Hours</label>
                <textarea
                  name="opening_hours"
                  value={clinicForm.opening_hours}
                  onChange={handleClinicChange}
                  placeholder="Example: Monday to Saturday, 9:00 AM - 6:00 PM"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Subscription Plan</label>
                <select
                  name="subscription_plan_id"
                  value={clinicForm.subscription_plan_id}
                  onChange={handleClinicChange}
                  disabled={loadingPlans}
                >
                  <option value="">No Plan Assigned</option>
                  {subscriptionPlans.map((plan) => (
                    <option key={plan.plan_id} value={plan.plan_id}>
                      {plan.plan_name}
                    </option>
                  ))}
                </select>
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

              <div className="info-message">
                Tip: To get coordinates, open Google Maps, right-click the
                clinic location, then copy the latitude and longitude.
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
