import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);

  const [clinicSubscriptions, setClinicSubscriptions] = useState([]);
  const [filteredClinicSubscriptions, setFilteredClinicSubscriptions] =
    useState([]);
  const [subscriptionSummary, setSubscriptionSummary] = useState({
    total: 0,
    active: 0,
    expiring_soon: 0,
    expired: 0,
    no_plan: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [clinicSearchTerm, setClinicSearchTerm] = useState("");
  const [clinicStatusFilter, setClinicStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [planForm, setPlanForm] = useState({
    plan_name: "",
    plan_tier: "Standard",
    price: "",
    billing_cycle: "Monthly",
    max_clinics: 1,
    max_dentists: 1,
    max_assistants: 1,
    max_patients: 50,
    max_records: 100,
    max_xrays: 100,
    storage_limit_mb: 500,
    features: "",
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
    fetchPlans();
    fetchClinicSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, searchTerm, statusFilter]);

  useEffect(() => {
    filterClinicSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicSubscriptions, clinicSearchTerm, clinicStatusFilter]);

  useEffect(() => {
    const isAnyModalOpen = showPlanModal || showStatusModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showPlanModal, showStatusModal]);

  const resetPlanForm = () => {
    setPlanForm({
      plan_name: "",
      plan_tier: "Standard",
      price: "",
      billing_cycle: "Monthly",
      max_clinics: 1,
      max_dentists: 1,
      max_assistants: 1,
      max_patients: 50,
      max_records: 100,
      max_xrays: 100,
      storage_limit_mb: 500,
      features: "",
      status: "Active",
    });
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/subscriptions", authHeaders);
      setPlans(response.data.plans || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load shared subscription plans.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicSubscriptions = async () => {
    try {
      setClinicLoading(true);
      setError("");

      const response = await API.get(
        "/api/clinics/admin/subscriptions",
        authHeaders,
      );

      setClinicSubscriptions(response.data.subscriptions || []);
      setSubscriptionSummary(
        response.data.summary || {
          total: 0,
          active: 0,
          expiring_soon: 0,
          expired: 0,
          no_plan: 0,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load clinic owner subscription monitoring.",
      );
    } finally {
      setClinicLoading(false);
    }
  };

  const filterPlans = () => {
    let filtered = [...plans];

    if (statusFilter !== "All") {
      filtered = filtered.filter((plan) => plan.status === statusFilter);
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(
        (plan) =>
          plan.plan_name?.toLowerCase().includes(term) ||
          plan.plan_tier?.toLowerCase().includes(term) ||
          plan.billing_cycle?.toLowerCase().includes(term) ||
          plan.features?.toLowerCase().includes(term) ||
          String(plan.price || "").includes(term) ||
          String(plan.max_clinics || "").includes(term) ||
          String(plan.max_dentists || "").includes(term) ||
          String(plan.max_assistants || "").includes(term) ||
          String(plan.max_patients || "").includes(term) ||
          String(plan.max_records || "").includes(term) ||
          String(plan.max_xrays || "").includes(term) ||
          String(plan.storage_limit_mb || "").includes(term),
      );
    }

    setFilteredPlans(filtered);
  };

  const filterClinicSubscriptions = () => {
    let filtered = [...clinicSubscriptions];

    if (clinicStatusFilter !== "All") {
      filtered = filtered.filter(
        (subscription) => subscription.monitoring_status === clinicStatusFilter,
      );
    }

    if (clinicSearchTerm.trim() !== "") {
      const term = clinicSearchTerm.toLowerCase();

      filtered = filtered.filter(
        (subscription) =>
          subscription.clinic_name?.toLowerCase().includes(term) ||
          subscription.owner_name?.toLowerCase().includes(term) ||
          subscription.owner_email?.toLowerCase().includes(term) ||
          subscription.plan_name?.toLowerCase().includes(term) ||
          subscription.monitoring_status?.toLowerCase().includes(term) ||
          subscription.subscription_status?.toLowerCase().includes(term),
      );
    }

    setFilteredClinicSubscriptions(filtered);
  };

  const openCreateModal = () => {
    setSelectedPlan(null);
    resetPlanForm();
    setMessage("");
    setError("");
    setModalError("");
    setShowPlanModal(true);
  };

  const openEditModal = (plan) => {
    setSelectedPlan(plan);

    setPlanForm({
      plan_name: plan.plan_name || "",
      plan_tier: plan.plan_tier || "Standard",
      price: plan.price || "",
      billing_cycle: plan.billing_cycle || "Monthly",
      max_clinics: plan.max_clinics ?? 1,
      max_dentists: plan.max_dentists ?? 1,
      max_assistants: plan.max_assistants ?? 1,
      max_patients: plan.max_patients ?? 50,
      max_records: plan.max_records ?? 100,
      max_xrays: plan.max_xrays ?? 100,
      storage_limit_mb: plan.storage_limit_mb ?? 500,
      features: plan.features || "",
      status: plan.status || "Active",
    });

    setMessage("");
    setError("");
    setModalError("");
    setShowPlanModal(true);
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setSelectedPlan(null);
    resetPlanForm();
    setModalError("");
  };

  const handlePlanChange = (e) => {
    setModalError("");

    setPlanForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validatePlanForm = () => {
    if (!planForm.plan_name.trim()) {
      setModalError("Plan name is required.");
      return false;
    }

    if (Number(planForm.price) < 0) {
      setModalError("Price cannot be negative.");
      return false;
    }

    const numericFields = [
      "max_clinics",
      "max_dentists",
      "max_assistants",
      "max_patients",
      "max_records",
      "max_xrays",
      "storage_limit_mb",
    ];

    for (const field of numericFields) {
      if (Number(planForm[field]) < 0) {
        setModalError("Plan limits cannot be negative.");
        return false;
      }
    }

    if (Number(planForm.max_clinics || 0) <= 0) {
      setModalError("Max clinic locations must be at least 1.");
      return false;
    }

    return true;
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();

    if (!validatePlanForm()) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");
      setModalError("");

      const payload = {
        plan_name: planForm.plan_name,
        plan_tier: planForm.plan_tier,
        price: Number(planForm.price || 0),
        billing_cycle: planForm.billing_cycle,
        max_clinics: Number(planForm.max_clinics || 0),
        max_dentists: Number(planForm.max_dentists || 0),
        max_assistants: Number(planForm.max_assistants || 0),
        max_patients: Number(planForm.max_patients || 0),
        max_records: Number(planForm.max_records || 0),
        max_xrays: Number(planForm.max_xrays || 0),
        storage_limit_mb: Number(planForm.storage_limit_mb || 0),
        features: planForm.features,
        status: planForm.status,
      };

      if (selectedPlan) {
        await API.put(
          `/api/subscriptions/${selectedPlan.plan_id}`,
          payload,
          authHeaders,
        );

        setMessage("Shared subscription plan updated successfully.");
      } else {
        await API.post("/api/subscriptions", payload, authHeaders);
        setMessage("Shared subscription plan created successfully.");
      }

      closePlanModal();
      fetchPlans();
      fetchClinicSubscriptions();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to save shared subscription plan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (plan, status) => {
    setSelectedPlan(plan);
    setSelectedStatus(status);
    setMessage("");
    setError("");
    setModalError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedPlan(null);
    setSelectedStatus("");
    setModalError("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedPlan || !selectedStatus) {
      setModalError("Please select a valid subscription status.");
      return;
    }

    try {
      setUpdatingStatus(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/subscriptions/${selectedPlan.plan_id}/status`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`Shared subscription plan marked as ${selectedStatus}.`);
      closeStatusModal();
      fetchPlans();
      fetchClinicSubscriptions();
    } catch (err) {
      setModalError(
        err.response?.data?.error ||
          "Unable to update shared subscription plan status.",
      );
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

  const getMonitoringStatusClass = (status) => {
    switch (status) {
      case "Active":
        return "status-badge status-completed";
      case "Expiring Soon":
        return "status-badge status-pending";
      case "Expired":
        return "status-badge status-cancelled";
      case "No Plan":
        return "status-badge status-scheduled";
      case "No End Date":
        return "status-badge status-pending";
      default:
        return "status-badge status-scheduled";
    }
  };

  const formatPrice = (price) => {
    const amount = Number(price || 0);

    return amount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  };

  const formatLimit = (value) => {
    if (value === null || value === undefined) return "Unlimited";
    return value;
  };

  const formatStorage = (mb) => {
    if (mb === null || mb === undefined) return "Unlimited";

    const storage = Number(mb || 0);

    if (storage >= 1024) {
      return `${(storage / 1024).toFixed(1)} GB`;
    }

    return `${storage} MB`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString();
  };

  const formatDaysRemaining = (days) => {
    if (days === null || days === undefined) return "N/A";

    const numberDays = Number(days);

    if (numberDays < 0) return "Expired";
    if (numberDays === 0) return "Expires today";

    return `${numberDays} day${numberDays === 1 ? "" : "s"} remaining`;
  };

  const totalPlans = plans.length;
  const activePlans = plans.filter((plan) => plan.status === "Active").length;
  const inactivePlans = plans.filter(
    (plan) => plan.status === "Inactive",
  ).length;

  const totalLocationCapacity = plans.reduce(
    (sum, plan) => sum + Number(plan.max_clinics || 0),
    0,
  );

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-subscriptions-page">
        <div className="appointments-header">
          <div>
            <h2>Shared Subscription Management</h2>
            <p>
              Manage SaaS subscription plans and monitor clinic owner accounts
              using shared subscriptions across multiple clinic locations.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button className="primary-button" onClick={openCreateModal}>
              Add Plan
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                fetchPlans();
                fetchClinicSubscriptions();
              }}
              disabled={loading || clinicLoading}
            >
              {loading || clinicLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          These limits are shared across all clinic locations owned by one
          Clinic Owner account. They are enforced when adding locations, staff,
          patients, dental records, X-rays, and uploaded files.
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="report-section">
          <div className="appointments-header">
            <div>
              <h2>Clinic Owner Subscription Monitoring</h2>
              <p>
                Monitor subscription status, expiration dates, and subscribed
                plans for clinic owner accounts and their locations.
              </p>
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
            <div className="dashboard-card">
              <h3>Owner Accounts</h3>
              <strong>
                {subscriptionSummary.total_owner_accounts ||
                  subscriptionSummary.total ||
                  0}
              </strong>
            </div>

            <div className="dashboard-card">
              <h3>Clinic Locations</h3>
              <strong>
                {subscriptionSummary.total_clinic_locations ||
                  subscriptionSummary.total ||
                  0}
              </strong>
            </div>

            <div className="dashboard-card">
              <h3>Active</h3>
              <strong>{subscriptionSummary.active}</strong>
            </div>

            <div className="dashboard-card">
              <h3>Expiring Soon</h3>
              <strong>{subscriptionSummary.expiring_soon}</strong>
            </div>

            <div className="dashboard-card">
              <h3>Expired</h3>
              <strong>{subscriptionSummary.expired}</strong>
            </div>

            <div className="dashboard-card">
              <h3>No Plan</h3>
              <strong>{subscriptionSummary.no_plan}</strong>
            </div>
          </div>

          <div className="appointment-filters">
            <div className="form-group">
              <label>Search Clinic Owners / Locations</label>
              <input
                type="text"
                value={clinicSearchTerm}
                onChange={(e) => setClinicSearchTerm(e.target.value)}
                placeholder="Search clinic, owner, email, plan, or status"
              />
            </div>

            <div className="form-group">
              <label>Subscription Status</label>
              <select
                value={clinicStatusFilter}
                onChange={(e) => setClinicStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
                <option value="No Plan">No Plan</option>
                <option value="No End Date">No End Date</option>
              </select>
            </div>
          </div>

          {clinicLoading ? (
            <div className="payment-loading-card">
              <p>Loading clinic owner subscriptions...</p>
            </div>
          ) : filteredClinicSubscriptions.length === 0 ? (
            <div className="empty-state">
              <h3>No subscriptions found</h3>
              <p>No records match the current subscription filter.</p>
            </div>
          ) : (
            <div className="payment-table-wrapper admin-subscription-table-wrapper">
              <table className="payment-table admin-subscription-table">
                <thead>
                  <tr>
                    <th>Clinic Location</th>
                    <th>Owner</th>
                    <th>Location Count</th>
                    <th>Scope</th>
                    <th>Shared Plan</th>
                    <th>Max Locations</th>
                    <th>Price</th>
                    <th>Subscription</th>
                    <th>End Date</th>
                    <th>Time Remaining</th>
                    <th>Location Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClinicSubscriptions.map((subscription) => (
                    <tr key={subscription.clinic_id}>
                      <td>
                        <strong>
                          {subscription.clinic_name || "Clinic Location"}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {subscription.owner_name || "No owner assigned"}
                        </strong>
                        <br />
                        <span className="muted-text">
                          {subscription.owner_email || "N/A"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {subscription.owner_active_location_count ||
                            subscription.owner_location_count ||
                            1}
                        </strong>
                        <br />
                        <span className="muted-text">
                          active of {subscription.owner_location_count || 1}{" "}
                          total
                        </span>
                      </td>

                      <td>
                        <span className="status-badge status-scheduled">
                          {subscription.subscription_scope || "Single location"}
                        </span>
                      </td>

                      <td>{subscription.plan_name || "No Plan"}</td>

                      <td>{formatLimit(subscription.max_clinics)}</td>

                      <td>
                        {subscription.price !== null &&
                        subscription.price !== undefined
                          ? `${formatPrice(subscription.price)} / ${
                              subscription.billing_cycle || "Monthly"
                            }`
                          : "N/A"}
                      </td>

                      <td>
                        <span
                          className={getMonitoringStatusClass(
                            subscription.monitoring_status,
                          )}
                        >
                          {subscription.monitoring_status}
                        </span>
                        <br />
                        <span className="muted-text">
                          {subscription.subscription_status || "Active"}
                        </span>
                      </td>

                      <td>{formatDate(subscription.subscription_end_date)}</td>

                      <td>
                        {formatDaysRemaining(subscription.days_remaining)}
                      </td>

                      <td>{subscription.clinic_status || "Active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="report-section">
          <div className="appointments-header">
            <div>
              <h2>Shared Plan Management</h2>
              <p>
                Create, edit, activate, or deactivate subscription plans and
                their enforceable shared limits.
              </p>
            </div>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
            <div className="dashboard-card">
              <h3>Total Plans</h3>
              <strong>{totalPlans}</strong>
            </div>

            <div className="dashboard-card">
              <h3>Active Plans</h3>
              <strong>{activePlans}</strong>
            </div>

            <div className="dashboard-card">
              <h3>Inactive Plans</h3>
              <strong>{inactivePlans}</strong>
            </div>

            <div className="dashboard-card">
              <h3>Location Capacity</h3>
              <strong>{totalLocationCapacity}</strong>
            </div>
          </div>

          <div className="appointment-filters">
            <div className="form-group">
              <label>Search Plans</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search plan name, tier, billing cycle, limits, features, or storage"
              />
            </div>

            <div className="form-group">
              <label>Plan Status</label>
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
            <p>Loading shared subscription plans...</p>
          ) : filteredPlans.length === 0 ? (
            <div className="empty-state">
              <h3>No subscription plans found</h3>
              <p>
                Add a subscription plan to start managing shared plan limits.
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {filteredPlans.map((plan) => (
                <div className="appointment-item" key={plan.plan_id}>
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>{plan.plan_name}</h3>

                      <span className={getStatusClass(plan.status)}>
                        {plan.status || "Active"}
                      </span>
                    </div>

                    <div className="subscription-detail-grid">
                      <p>
                        <strong>Plan ID:</strong> {plan.plan_id}
                      </p>

                      <p>
                        <strong>Tier:</strong> {plan.plan_tier || "Standard"}
                      </p>

                      <p>
                        <strong>Price:</strong> {formatPrice(plan.price)} /{" "}
                        {plan.billing_cycle || "Monthly"}
                      </p>

                      <p>
                        <strong>Max Clinic Locations:</strong>{" "}
                        {formatLimit(plan.max_clinics)}
                      </p>

                      <p>
                        <strong>Max Dentists:</strong>{" "}
                        {formatLimit(plan.max_dentists)}
                      </p>

                      <p>
                        <strong>Max Assistants:</strong>{" "}
                        {formatLimit(plan.max_assistants)}
                      </p>

                      <p>
                        <strong>Max Patients:</strong>{" "}
                        {formatLimit(plan.max_patients)}
                      </p>

                      <p>
                        <strong>Max Dental Records:</strong>{" "}
                        {formatLimit(plan.max_records)}
                      </p>

                      <p>
                        <strong>Max X-rays:</strong>{" "}
                        {formatLimit(plan.max_xrays)}
                      </p>

                      <p>
                        <strong>Storage Limit:</strong>{" "}
                        {formatStorage(plan.storage_limit_mb)}
                      </p>

                      <p>
                        <strong>Created:</strong>{" "}
                        {plan.created_at
                          ? new Date(plan.created_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>

                    {plan.features && (
                      <p>
                        <strong>Features:</strong> {plan.features}
                      </p>
                    )}
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="secondary-button"
                      onClick={() => openEditModal(plan)}
                    >
                      Edit
                    </button>

                    {plan.status === "Active" ? (
                      <button
                        className="danger-button"
                        disabled={updatingStatus}
                        onClick={() => openStatusModal(plan, "Inactive")}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        disabled={updatingStatus}
                        onClick={() => openStatusModal(plan, "Active")}
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
      </div>

      {showPlanModal && (
        <div className="modal-overlay">
          <div className="modal-card admin-subscription-modal">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedPlan
                    ? "Edit Shared Subscription Plan"
                    : "Add Shared Subscription Plan"}
                </h3>
                <p>
                  {selectedPlan
                    ? "Update pricing and shared enforcement limits for this plan."
                    : "Create a new SaaS plan with limits shared across clinic locations."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closePlanModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSavePlan}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    name="plan_name"
                    value={planForm.plan_name}
                    onChange={handlePlanChange}
                    placeholder="Example: Growth Plan"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Plan Tier</label>
                  <input
                    type="text"
                    name="plan_tier"
                    value={planForm.plan_tier}
                    onChange={handlePlanChange}
                    placeholder="Example: Basic, Standard, Premium"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price</label>
                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    value={planForm.price}
                    onChange={handlePlanChange}
                    placeholder="Example: 999.00"
                  />
                </div>

                <div className="form-group">
                  <label>Billing Cycle</label>
                  <select
                    name="billing_cycle"
                    value={planForm.billing_cycle}
                    onChange={handlePlanChange}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="info-message">
                Limits below are shared across all clinic locations under one
                Clinic Owner account.
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Clinic Locations</label>
                  <input
                    type="number"
                    name="max_clinics"
                    min="1"
                    value={planForm.max_clinics}
                    onChange={handlePlanChange}
                  />
                </div>

                <div className="form-group">
                  <label>Max Dentists</label>
                  <input
                    type="number"
                    name="max_dentists"
                    min="0"
                    value={planForm.max_dentists}
                    onChange={handlePlanChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Assistants</label>
                  <input
                    type="number"
                    name="max_assistants"
                    min="0"
                    value={planForm.max_assistants}
                    onChange={handlePlanChange}
                  />
                </div>

                <div className="form-group">
                  <label>Max Patients</label>
                  <input
                    type="number"
                    name="max_patients"
                    min="0"
                    value={planForm.max_patients}
                    onChange={handlePlanChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Dental Records</label>
                  <input
                    type="number"
                    name="max_records"
                    min="0"
                    value={planForm.max_records}
                    onChange={handlePlanChange}
                  />
                </div>

                <div className="form-group">
                  <label>Max X-rays</label>
                  <input
                    type="number"
                    name="max_xrays"
                    min="0"
                    value={planForm.max_xrays}
                    onChange={handlePlanChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Storage Limit in MB</label>
                  <input
                    type="number"
                    name="storage_limit_mb"
                    min="0"
                    value={planForm.storage_limit_mb}
                    onChange={handlePlanChange}
                    placeholder="Example: 500"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={planForm.status}
                    onChange={handlePlanChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Features</label>
                <textarea
                  name="features"
                  value={planForm.features}
                  onChange={handlePlanChange}
                  placeholder="Example: Multi-location support, X-ray uploads, AI assist"
                  rows="4"
                />
              </div>

              <div className="info-message">
                These values are not just labels. They are used by the backend
                when adding clinic locations, assigning staff, creating dental
                records, and uploading X-rays.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closePlanModal}
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
                    : selectedPlan
                      ? "Save Changes"
                      : "Add Plan"}
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
                <h3>Update Plan Status</h3>
                <p>
                  Confirm that you want to mark this shared subscription plan as{" "}
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
                <label>Plan</label>
                <input
                  type="text"
                  value={selectedPlan?.plan_name || ""}
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

export default AdminSubscriptions;
