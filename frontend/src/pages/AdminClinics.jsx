import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  CLINIC_SERVICE_CATEGORIES,
  getClinicServiceNames,
} from "../utils/clinicServices";
import ClinicOperatingHoursEditor from "../components/ClinicOperatingHoursEditor";
import {
  clinicOperatingHoursToSummary,
  createDefaultClinicOperatingHours,
  normalizeClinicOperatingHours,
  validateClinicOperatingHours,
} from "../utils/clinicOperatingHours";
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

  const [clinicApplications, setClinicApplications] = useState([]);
  const [applicationStatusFilter, setApplicationStatusFilter] =
    useState("Pending");
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [reviewingApplicationId, setReviewingApplicationId] = useState(null);
  const [openingApplicationDocument, setOpeningApplicationDocument] =
    useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showClinicModal, setShowClinicModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showApplicationReviewModal, setShowApplicationReviewModal] =
    useState(false);

  const [usageLoading, setUsageLoading] = useState(false);
  const [clinicUsage, setClinicUsage] = useState(null);

  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applicationDecision, setApplicationDecision] = useState("Approved");
  const [applicationRejectionReason, setApplicationRejectionReason] =
    useState("");

  const [clinicForm, setClinicForm] = useState({
    clinic_name: "",
    address: "",
    latitude: "",
    longitude: "",
    services: [],
    contact_number: "",
    opening_hours: "",
    operating_hours_schedule: createDefaultClinicOperatingHours(),
    subscription_plan_id: "",
    status: "Active",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

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
    fetchClinicApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationStatusFilter]);

  useEffect(() => {
    filterClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinics, searchTerm, statusFilter]);

  useEffect(() => {
    const isAnyModalOpen =
      showClinicModal ||
      showStatusModal ||
      showUsageModal ||
      showApplicationReviewModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [
    showClinicModal,
    showStatusModal,
    showUsageModal,
    showApplicationReviewModal,
  ]);

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

  const fetchClinicApplications = async () => {
    try {
      setApplicationsLoading(true);
      setError("");

      const response = await API.get(
        "/api/clinics/admin/verification-applications",
        {
          ...authHeaders,
          params: {
            status: applicationStatusFilter,
          },
        },
      );

      setClinicApplications(response.data?.applications || []);
    } catch (err) {
      setClinicApplications([]);
      setError(
        err.response?.data?.error ||
          "Unable to load clinic verification applications.",
      );
    } finally {
      setApplicationsLoading(false);
    }
  };

  const formatApplicationDate = (value) => {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const openClinicApplicationDocument = async (application, documentType) => {
    const documentKey = `${application.application_id}-${documentType}`;

    try {
      setOpeningApplicationDocument(documentKey);
      setError("");

      const response = await API.get(
        `/api/clinics/admin/verification-applications/${application.application_id}/document/${documentType}`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const objectUrl = URL.createObjectURL(response.data);
      const openedWindow = window.open(
        objectUrl,
        "_blank",
        "noopener,noreferrer",
      );

      if (!openedWindow) {
        URL.revokeObjectURL(objectUrl);
        setError("The document popup was blocked. Allow popups and try again.");
        return;
      }

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to open the clinic verification document.",
      );
    } finally {
      setOpeningApplicationDocument("");
    }
  };

  const openApplicationReviewModal = (application, decision) => {
    setSelectedApplication(application);
    setApplicationDecision(decision);
    setApplicationRejectionReason("");
    setModalError("");
    setError("");
    setMessage("");
    setShowApplicationReviewModal(true);
  };

  const closeApplicationReviewModal = () => {
    if (reviewingApplicationId) return;

    setShowApplicationReviewModal(false);
    setSelectedApplication(null);
    setApplicationDecision("Approved");
    setApplicationRejectionReason("");
    setModalError("");
  };

  const handleClinicApplicationReview = async (event) => {
    event.preventDefault();

    if (!selectedApplication) {
      setModalError("No clinic application was selected.");
      return;
    }

    const cleanReason = applicationRejectionReason.trim();

    if (applicationDecision === "Rejected" && cleanReason.length < 5) {
      setModalError(
        "Enter a clear rejection reason with at least 5 characters.",
      );
      return;
    }

    try {
      setReviewingApplicationId(selectedApplication.application_id);
      setModalError("");
      setError("");
      setMessage("");

      const response = await API.put(
        `/api/clinics/admin/verification-applications/${selectedApplication.application_id}/review`,
        {
          decision: applicationDecision,
          rejection_reason:
            applicationDecision === "Rejected" ? cleanReason : null,
        },
        authHeaders,
      );

      setMessage(
        response.data?.message ||
          (applicationDecision === "Approved"
            ? "Clinic application approved successfully."
            : "Clinic application rejected and permanently deleted."),
      );

      setShowApplicationReviewModal(false);
      setSelectedApplication(null);
      setApplicationDecision("Approved");
      setApplicationRejectionReason("");
      setModalError("");

      await Promise.all([fetchClinicApplications(), fetchClinics()]);
    } catch (err) {
      setModalError(
        err.response?.data?.error ||
          `Unable to ${applicationDecision.toLowerCase()} the clinic application.`,
      );
    } finally {
      setReviewingApplicationId(null);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      setLoadingPlans(true);

      const response = await API.get("/api/subscriptions", authHeaders);

      setSubscriptionPlans(response.data.plans || []);
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
          getClinicServiceNames(clinic)
            .join(" ")
            .toLowerCase()
            .includes(term) ||
          clinic.owner_name?.toLowerCase().includes(term) ||
          clinic.owner_email?.toLowerCase().includes(term) ||
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
      services: [],
      contact_number: "",
      opening_hours: "",
      operating_hours_schedule: createDefaultClinicOperatingHours(),
      subscription_plan_id: "",
      status: "Active",
    });
  };

  const openCreateModal = () => {
    setSelectedClinic(null);
    resetClinicForm();
    setMessage("");
    setError("");
    setModalError("");
    setLocationMessage("");
    setAddressSuggestions([]);
    setShowClinicModal(true);
  };

  const openEditModal = (clinic) => {
    setSelectedClinic(clinic);

    setClinicForm({
      clinic_name: clinic.clinic_name || "",
      address: clinic.address || "",
      latitude: clinic.latitude || "",
      longitude: clinic.longitude || "",
      services: getClinicServiceNames(clinic),
      contact_number: clinic.contact_number || "",
      opening_hours: clinic.opening_hours || "",
      operating_hours_schedule: normalizeClinicOperatingHours(clinic),
      subscription_plan_id: clinic.subscription_plan_id || "",
      status: clinic.status || "Active",
    });

    setMessage("");
    setError("");
    setModalError("");
    setAddressSuggestions([]);
    setLocationMessage(
      clinic.latitude && clinic.longitude
        ? "Saved map location is available. Change the address to locate it again."
        : "The map location will be found automatically from the address.",
    );
    setShowClinicModal(true);
  };

  const closeClinicModal = () => {
    setShowClinicModal(false);
    setSelectedClinic(null);
    resetClinicForm();
    setModalError("");
    setLocationMessage("");
    setAddressSuggestions([]);
    setLocatingAddress(false);
  };

  const handleClinicChange = (e) => {
    const { name, value } = e.target;

    setModalError("");

    setClinicForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "address"
        ? {
            latitude: "",
            longitude: "",
          }
        : {}),
    }));

    if (name === "address") {
      setAddressSuggestions([]);
      setLocationMessage(
        value.trim()
          ? "Search the address, then choose the correct result from the list."
          : "",
      );
    }
  };

  const toggleClinicService = (serviceName) => {
    setModalError("");

    setClinicForm((previous) => {
      const currentServices = Array.isArray(previous.services)
        ? previous.services
        : getClinicServiceNames(previous.services);

      return {
        ...previous,
        services: currentServices.includes(serviceName)
          ? currentServices.filter((service) => service !== serviceName)
          : [...currentServices, serviceName],
      };
    });
  };

  const searchClinicAddress = async () => {
    const address = clinicForm.address.trim();

    if (address.length < 3) {
      setAddressSuggestions([]);
      setModalError("Enter a more complete clinic address before searching.");
      return;
    }

    try {
      setLocatingAddress(true);
      setAddressSuggestions([]);
      setLocationMessage("Searching for matching Philippine addresses...");

      const response = await API.get("/api/clinics/geocode", {
        params: { address },
      });

      const results = Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      if (results.length === 0) {
        setLocationMessage("");
        setModalError(
          "No matching Philippine address was found. Add more address details and search again.",
        );
        return;
      }

      setAddressSuggestions(results);
      setLocationMessage(
        `Found ${results.length} possible address${
          results.length === 1 ? "" : "es"
        }. Choose the correct location below.`,
      );
      setModalError("");
    } catch (err) {
      setAddressSuggestions([]);
      setLocationMessage("");
      setModalError(
        err.response?.data?.error ||
          "Unable to search for this address. Please try again.",
      );
    } finally {
      setLocatingAddress(false);
    }
  };

  const selectAddressSuggestion = (suggestion) => {
    const selectedAddress =
      suggestion.display_name ||
      suggestion.formatted_address ||
      clinicForm.address.trim();

    setClinicForm((previous) => ({
      ...previous,
      address: selectedAddress,
      latitude: String(suggestion.latitude),
      longitude: String(suggestion.longitude),
    }));

    setAddressSuggestions([]);
    setLocationMessage(`Selected map location: ${selectedAddress}`);
    setModalError("");
  };

  const handleSaveClinic = async (e) => {
    e.preventDefault();

    if (!clinicForm.clinic_name.trim()) {
      setModalError("Clinic name is required.");
      return;
    }

    if (!clinicForm.address.trim()) {
      setModalError("Clinic address is required.");
      return;
    }

    if (
      !Array.isArray(clinicForm.services) ||
      clinicForm.services.length === 0
    ) {
      setModalError("Select at least one clinic service.");
      return;
    }

    const operatingHoursError = validateClinicOperatingHours(
      clinicForm.operating_hours_schedule,
    );

    if (operatingHoursError) {
      setModalError(operatingHoursError);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");
      setModalError("");

      const resolvedCoordinates = {
        latitude: clinicForm.latitude,
        longitude: clinicForm.longitude,
      };

      if (!resolvedCoordinates.latitude || !resolvedCoordinates.longitude) {
        setModalError(
          "Search the clinic address and select the correct result before saving.",
        );
        return;
      }

      const payload = {
        clinic_name: clinicForm.clinic_name,
        address: clinicForm.address,
        latitude: resolvedCoordinates.latitude,
        longitude: resolvedCoordinates.longitude,
        services: clinicForm.services,
        contact_number: clinicForm.contact_number,
        opening_hours: clinicOperatingHoursToSummary(
          clinicForm.operating_hours_schedule,
        ),
        operating_hours_schedule: clinicForm.operating_hours_schedule,
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
      setModalError(err.response?.data?.error || "Unable to save clinic.");
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (clinic, status) => {
    setSelectedClinic(clinic);
    setSelectedStatus(status);
    setMessage("");
    setError("");
    setModalError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedClinic(null);
    setSelectedStatus("");
    setModalError("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedClinic || !selectedStatus) {
      setModalError("Please select a valid clinic status.");
      return;
    }

    try {
      setUpdatingStatus(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/clinics/${selectedClinic.clinic_id}`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`Clinic marked as ${selectedStatus}.`);
      closeStatusModal();
      fetchClinics();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to update clinic status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openUsageModal = async (clinic) => {
    try {
      setSelectedClinic(clinic);
      setClinicUsage(null);
      setUsageLoading(true);
      setMessage("");
      setError("");
      setModalError("");
      setShowUsageModal(true);

      const response = await API.get(
        `/api/clinics/${clinic.clinic_id}/subscription-usage`,
        authHeaders,
      );

      setClinicUsage(response.data);
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to load subscription usage.",
      );
    } finally {
      setUsageLoading(false);
    }
  };

  const closeUsageModal = () => {
    setShowUsageModal(false);
    setSelectedClinic(null);
    setClinicUsage(null);
    setModalError("");
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

  const getUsagePercent = (used, max) => {
    const usedNumber = Number(used || 0);
    const maxNumber = Number(max || 0);

    if (maxNumber <= 0) return 0;

    return Math.min((usedNumber / maxNumber) * 100, 100);
  };

  const formatUsage = (used, max, unit = "") => {
    const usedValue = used ?? 0;

    if (max === null || max === undefined) {
      return `${usedValue}${unit} / No limit`;
    }

    return `${usedValue}${unit} / ${max}${unit}`;
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
  const pendingReviewClinics = clinics.filter(
    (clinic) => clinic.status === "Pending Review",
  ).length;
  const pendingApplicationCount =
    applicationStatusFilter === "Pending"
      ? clinicApplications.length
      : clinicApplications.filter(
          (application) => application.verification_status === "Pending",
        ).length;
  const mappedClinics = clinics.filter(
    (clinic) => clinic.latitude && clinic.longitude,
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-clinics-page">
        <div className="appointments-header">
          <div>
            <h2>Clinic Management</h2>
            <p>
              Manage clinic locations, clinic owners, shared subscription
              details, map coordinates, contact details, and status.
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
                fetchClinicApplications();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          Each row represents a clinic location. Subscription plans are shared
          under the Clinic Owner account when the location has an assigned
          owner.
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Clinic Locations</h3>
            <strong>{totalClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Active Locations</h3>
            <strong>{activeClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Inactive Locations</h3>
            <strong>{inactiveClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Pending Review</h3>
            <strong>{pendingReviewClinics}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Pending Applications</h3>
            <strong>{pendingApplicationCount}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Mapped Locations</h3>
            <strong>{mappedClinics}</strong>
          </div>
        </div>

        <section className="admin-clinic-applications-section">
          <div className="appointments-header">
            <div>
              <h2>Clinic Verification Applications</h2>
              <p>
                Validate clinic information and securely review submitted
                documents before approving access.
              </p>
            </div>

            <div className="admin-clinic-application-controls">
              <select
                value={applicationStatusFilter}
                onChange={(event) =>
                  setApplicationStatusFilter(event.target.value)
                }
                disabled={applicationsLoading}
                aria-label="Clinic application status"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="All">All Applications</option>
              </select>

              <button
                type="button"
                className="secondary-button"
                onClick={fetchClinicApplications}
                disabled={applicationsLoading}
              >
                {applicationsLoading ? "Refreshing..." : "Refresh Applications"}
              </button>
            </div>
          </div>

          <div className="info-message">
            Only an Administrator can approve a clinic application. Rejecting a
            pending application permanently deletes the Clinic Owner account,
            clinic record, verification application, and uploaded documents.
          </div>

          {applicationsLoading ? (
            <div className="payment-loading-card">
              <p>Loading clinic verification applications...</p>
            </div>
          ) : clinicApplications.length === 0 ? (
            <div className="empty-state admin-clinic-application-empty">
              <h3>No {applicationStatusFilter.toLowerCase()} applications</h3>
              <p>
                Clinic applications matching the selected status will appear
                here.
              </p>
            </div>
          ) : (
            <div className="admin-clinic-application-list">
              {clinicApplications.map((application) => (
                <article
                  className="admin-clinic-application-card"
                  key={application.application_id}
                >
                  <div className="admin-clinic-application-card-header">
                    <div>
                      <span className="muted-text">
                        Application #{application.application_id}
                      </span>
                      <h3>{application.clinic_name || "Clinic Application"}</h3>
                      <p>{application.address || "No address provided"}</p>
                    </div>

                    <span
                      className={`status-badge clinic-application-status-${String(
                        application.verification_status || "Pending",
                      ).toLowerCase()}`}
                    >
                      {application.verification_status || "Pending"}
                    </span>
                  </div>

                  <div className="admin-clinic-application-details">
                    <div>
                      <span>Clinic Owner</span>
                      <strong>{application.owner_name || "N/A"}</strong>
                      <small>{application.owner_email || "N/A"}</small>
                    </div>

                    <div>
                      <span>Contact</span>
                      <strong>{application.contact_number || "N/A"}</strong>
                      <small>
                        {application.opening_hours || "No hours listed"}
                      </small>
                    </div>

                    <div>
                      <span>Coordinates</span>
                      <strong>
                        {application.latitude && application.longitude
                          ? `${application.latitude}, ${application.longitude}`
                          : "Not available"}
                      </strong>
                      <small>Clinic location</small>
                    </div>

                    <div>
                      <span>Submitted</span>
                      <strong>
                        {formatApplicationDate(application.submitted_at)}
                      </strong>
                      <small>
                        Clinic: {application.clinic_status || "Pending Review"}{" "}
                        · Owner: {application.owner_status || "Inactive"}
                      </small>
                    </div>
                  </div>

                  <div className="admin-clinic-application-services">
                    <span>Services Offered</span>
                    <p>{application.services || "No services listed"}</p>
                  </div>

                  <div className="admin-clinic-application-documents">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        openClinicApplicationDocument(
                          application,
                          "business_registration",
                        )
                      }
                      disabled={Boolean(openingApplicationDocument)}
                    >
                      {openingApplicationDocument ===
                      `${application.application_id}-business_registration`
                        ? "Opening..."
                        : "Business Registration"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        openClinicApplicationDocument(
                          application,
                          "business_permit",
                        )
                      }
                      disabled={Boolean(openingApplicationDocument)}
                    >
                      {openingApplicationDocument ===
                      `${application.application_id}-business_permit`
                        ? "Opening..."
                        : "Business Permit"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        openClinicApplicationDocument(
                          application,
                          "owner_government_id",
                        )
                      }
                      disabled={Boolean(openingApplicationDocument)}
                    >
                      {openingApplicationDocument ===
                      `${application.application_id}-owner_government_id`
                        ? "Opening..."
                        : "Owner Government ID"}
                    </button>

                    {application.clinic_license_original_name && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          openClinicApplicationDocument(
                            application,
                            "clinic_license",
                          )
                        }
                        disabled={Boolean(openingApplicationDocument)}
                      >
                        {openingApplicationDocument ===
                        `${application.application_id}-clinic_license`
                          ? "Opening..."
                          : "Clinic License"}
                      </button>
                    )}
                  </div>

                  {application.verification_status === "Approved" && (
                    <div className="success-message admin-clinic-reviewed-message">
                      Approved by {application.reviewed_by_name || "Admin"} on{" "}
                      {formatApplicationDate(application.reviewed_at)}.
                    </div>
                  )}

                  {application.verification_status === "Pending" && (
                    <div className="admin-clinic-application-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          openApplicationReviewModal(application, "Approved")
                        }
                        disabled={Boolean(reviewingApplicationId)}
                      >
                        Approve Application
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          openApplicationReviewModal(application, "Rejected")
                        }
                        disabled={Boolean(reviewingApplicationId)}
                      >
                        Reject and Delete
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search location, owner, address, service, contact, or plan"
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
              <option value="Pending Review">Pending Review</option>
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

        <div className="admin-clinics-table-section">
          <div className="appointments-header">
            <div>
              <h2>Clinic Location List</h2>
              <p>
                Scan clinic locations in table form. Use Edit for full details
                and View Usage for subscription limit checks.
              </p>
            </div>

            <span className="status-badge status-scheduled">
              {filteredClinics.length} shown
            </span>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading clinic locations...</p>
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="empty-state">
              <h3>No clinic locations found</h3>
              <p>Add a clinic location to start managing clinic information.</p>
            </div>
          ) : (
            <div className="payment-table-wrapper admin-clinics-table-wrapper">
              <table className="payment-table admin-clinics-table">
                <thead>
                  <tr>
                    <th>Clinic Location</th>
                    <th>Owner</th>
                    <th>Shared Plan</th>
                    <th>Contact</th>
                    <th>Map</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClinics.map((clinic) => (
                    <tr key={clinic.clinic_id}>
                      <td>
                        <strong>
                          {clinic.clinic_name || "Clinic Location"}
                        </strong>
                        <br />
                        <span className="muted-text">
                          ID: {clinic.clinic_id}
                        </span>
                        <br />
                        <span className="muted-text">
                          {clinic.address || "No address provided"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {clinic.owner_name || "No owner assigned"}
                        </strong>
                        <br />
                        <span className="muted-text">
                          {clinic.owner_email || "N/A"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {clinic.plan_name || "No plan assigned"}
                        </strong>
                        <br />
                        <span className="muted-text">
                          {clinic.owner_user_id
                            ? "Shared owner subscription"
                            : "Standalone location"}
                        </span>
                      </td>

                      <td>
                        <strong>{clinic.contact_number || "No contact"}</strong>
                        <br />
                        <span className="muted-text">
                          {clinic.opening_hours || "No opening hours"}
                        </span>
                      </td>

                      <td>
                        {clinic.latitude && clinic.longitude ? (
                          <>
                            <span className="status-badge status-completed">
                              Mapped
                            </span>
                            <br />
                            <span className="muted-text">
                              {clinic.latitude}, {clinic.longitude}
                            </span>
                          </>
                        ) : (
                          <span className="status-badge status-pending">
                            No coordinates
                          </span>
                        )}
                      </td>

                      <td>
                        <span className={getStatusClass(clinic.status)}>
                          {clinic.status || "Active"}
                        </span>
                      </td>

                      <td>
                        <div className="payment-table-actions admin-clinics-actions">
                          <button
                            className="secondary-button"
                            onClick={() => openEditModal(clinic)}
                          >
                            Edit
                          </button>

                          <button
                            className="secondary-button"
                            onClick={() => openUsageModal(clinic)}
                          >
                            Usage
                          </button>

                          <a
                            className="secondary-button"
                            href={getMapSearchLink(clinic)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Map
                          </a>

                          {clinic.status === "Pending Review" ? (
                            <span className="status-badge status-pending">
                              Admin Review Required
                            </span>
                          ) : clinic.status === "Active" ? (
                            <button
                              className="danger-button"
                              disabled={updatingStatus}
                              onClick={() =>
                                openStatusModal(clinic, "Inactive")
                              }
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showApplicationReviewModal && selectedApplication && (
        <div className="modal-overlay">
          <div className="modal-card admin-clinic-review-modal">
            <div className="modal-header">
              <div>
                <h3>
                  {applicationDecision === "Approved"
                    ? "Approve Clinic Application"
                    : "Reject Clinic Application"}
                </h3>
                <p>
                  {selectedApplication.clinic_name} ·{" "}
                  {selectedApplication.owner_name}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeApplicationReviewModal}
                disabled={Boolean(reviewingApplicationId)}
                aria-label="Close clinic application review"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleClinicApplicationReview}>
              <div className="admin-clinic-review-summary">
                <div>
                  <span>Clinic</span>
                  <strong>{selectedApplication.clinic_name}</strong>
                </div>
                <div>
                  <span>Clinic Owner</span>
                  <strong>{selectedApplication.owner_name}</strong>
                </div>
                <div>
                  <span>Owner Email</span>
                  <strong>{selectedApplication.owner_email}</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>
                    {formatApplicationDate(selectedApplication.submitted_at)}
                  </strong>
                </div>
              </div>

              {applicationDecision === "Approved" ? (
                <div className="info-message">
                  Approval will activate the clinic location and Clinic Owner
                  account. The Clinic Owner can sign in immediately after this
                  action succeeds.
                </div>
              ) : (
                <>
                  <div className="error-message">
                    Permanent deletion warning: rejecting this application
                    removes the pending Clinic Owner account, clinic record,
                    verification application, role assignment, and all uploaded
                    verification documents. This action cannot be undone.
                  </div>

                  <div className="form-group">
                    <label htmlFor="clinic_application_rejection_reason">
                      Rejection Reason
                    </label>
                    <textarea
                      id="clinic_application_rejection_reason"
                      value={applicationRejectionReason}
                      onChange={(event) => {
                        setApplicationRejectionReason(event.target.value);
                        setModalError("");
                      }}
                      placeholder="Explain why the clinic application is being rejected."
                      minLength={5}
                      maxLength={1000}
                      rows={4}
                      disabled={Boolean(reviewingApplicationId)}
                      required
                    />
                    <small>
                      This reason is recorded in the Administrator audit log
                      before the application is deleted.
                    </small>
                  </div>
                </>
              )}

              {modalError && <div className="error-message">{modalError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeApplicationReviewModal}
                  disabled={Boolean(reviewingApplicationId)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    applicationDecision === "Approved"
                      ? "primary-button"
                      : "danger-button"
                  }
                  disabled={Boolean(reviewingApplicationId)}
                >
                  {reviewingApplicationId
                    ? applicationDecision === "Approved"
                      ? "Approving..."
                      : "Rejecting and Deleting..."
                    : applicationDecision === "Approved"
                      ? "Confirm Approval"
                      : "Confirm Rejection and Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClinicModal && (
        <div className="modal-overlay">
          <div className="modal-card admin-clinic-editor-modal">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedClinic
                    ? "Edit Clinic Location"
                    : "Add Clinic Location"}
                </h3>
                <p>
                  {selectedClinic
                    ? "Update the clinic information. The map location is generated automatically from the address."
                    : "Create a clinic location. The map location is generated automatically from the address."}
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

            <form
              className="modal-form admin-clinic-editor-form"
              onSubmit={handleSaveClinic}
            >
              {modalError && <div className="error-message">{modalError}</div>}

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
                  placeholder="Type the clinic address, then search and choose a result"
                  rows="3"
                  required
                />

                <div className="admin-clinic-address-tools">
                  <button
                    type="button"
                    className="secondary-button admin-clinic-locate-button"
                    onClick={searchClinicAddress}
                    disabled={
                      locatingAddress || saving || !clinicForm.address.trim()
                    }
                  >
                    {locatingAddress ? "Searching..." : "Search Address"}
                  </button>

                  <span className="admin-clinic-location-status">
                    {locationMessage ||
                      "Search the address and select the correct result from the list."}
                  </span>
                </div>

                {addressSuggestions.length > 0 && (
                  <div
                    className="admin-clinic-address-suggestions"
                    role="listbox"
                    aria-label="Matching clinic addresses"
                  >
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        type="button"
                        className="admin-clinic-address-suggestion"
                        key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
                        onClick={() => selectAddressSuggestion(suggestion)}
                      >
                        <span className="admin-clinic-address-suggestion-title">
                          {suggestion.display_name ||
                            suggestion.formatted_address ||
                            `Address result ${index + 1}`}
                        </span>
                        <span className="admin-clinic-address-suggestion-coordinates">
                          {suggestion.latitude}, {suggestion.longitude}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <fieldset className="clinic-service-selector admin-clinic-service-selector">
                <legend>Services Offered</legend>
                <p className="clinic-service-selector-help">
                  Select all dental services available at this clinic location.
                </p>

                <div className="clinic-service-category-list">
                  {CLINIC_SERVICE_CATEGORIES.map((group) => (
                    <section
                      className="clinic-service-category"
                      key={group.category}
                    >
                      <h4>{group.category}</h4>

                      <div className="clinic-service-options">
                        {group.services.map((service) => {
                          const isSelected =
                            clinicForm.services.includes(service);

                          return (
                            <label
                              className={`clinic-service-option ${
                                isSelected ? "selected" : ""
                              }`}
                              key={service}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleClinicService(service)}
                                disabled={saving}
                              />
                              <span
                                className="clinic-service-option-check"
                                aria-hidden="true"
                              >
                                {isSelected ? "✓" : ""}
                              </span>
                              <span>{service}</span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="clinic-service-selection-summary">
                  <strong>{clinicForm.services.length}</strong>{" "}
                  {clinicForm.services.length === 1
                    ? "service selected"
                    : "services selected"}
                </div>
              </fieldset>

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

              <ClinicOperatingHoursEditor
                value={clinicForm.operating_hours_schedule}
                onChange={(operatingHoursSchedule) =>
                  setClinicForm((previous) => ({
                    ...previous,
                    operating_hours_schedule: operatingHoursSchedule,
                    opening_hours: clinicOperatingHoursToSummary(
                      operatingHoursSchedule,
                    ),
                  }))
                }
                disabled={saving}
                compact
              />

              <div className="form-group">
                <label>Shared Subscription Plan</label>
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
                  disabled={saving || locatingAddress}
                >
                  {saving || locatingAddress
                    ? locatingAddress
                      ? "Locating..."
                      : "Saving..."
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
              {modalError && <div className="error-message">{modalError}</div>}

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

      {showUsageModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Subscription Usage</h3>
                <p>
                  View how much of this clinic’s subscription plan is currently
                  being used.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeUsageModal}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              {modalError && <div className="error-message">{modalError}</div>}

              {usageLoading ? (
                <p>Loading subscription usage...</p>
              ) : !clinicUsage ? (
                <div className="empty-state">
                  <h3>No usage data found</h3>
                  <p>Usage details could not be loaded for this clinic.</p>
                </div>
              ) : (
                <>
                  <div className="usage-summary-card">
                    <h3>{clinicUsage.clinic.clinic_name}</h3>
                    <p>
                      <strong>Plan:</strong>{" "}
                      {clinicUsage.clinic.plan_name || "No plan assigned"}
                    </p>
                  </div>

                  <div className="usage-grid">
                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>Dentists</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.dentists,
                            clinicUsage.clinic.max_dentists,
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.dentists,
                              clinicUsage.clinic.max_dentists,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>Assistants</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.assistants,
                            clinicUsage.clinic.max_assistants,
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.assistants,
                              clinicUsage.clinic.max_assistants,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>Patients</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.patients,
                            clinicUsage.clinic.max_patients,
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.patients,
                              clinicUsage.clinic.max_patients,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>Dental Records</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.records,
                            clinicUsage.clinic.max_records,
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.records,
                              clinicUsage.clinic.max_records,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>X-rays</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.xrays,
                            clinicUsage.clinic.max_xrays,
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.xrays,
                              clinicUsage.clinic.max_xrays,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="usage-card">
                      <div className="usage-card-header">
                        <h4>Storage</h4>
                        <span>
                          {formatUsage(
                            clinicUsage.usage.storage_used_mb,
                            clinicUsage.clinic.storage_limit_mb,
                            " MB",
                          )}
                        </span>
                      </div>
                      <div className="usage-bar">
                        <div
                          className="usage-bar-fill"
                          style={{
                            width: `${getUsagePercent(
                              clinicUsage.usage.storage_used_mb,
                              clinicUsage.clinic.storage_limit_mb,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="info-message">
                    These values are calculated from the current database
                    records and are used to enforce the shared subscription
                    limits for this clinic location.
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={closeUsageModal}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminClinics;
