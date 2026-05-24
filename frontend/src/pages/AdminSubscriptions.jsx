import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  const [planForm, setPlanForm] = useState({
    plan_name: "",
    price: "",
    billing_cycle: "Monthly",
    storage_limit: "",
    max_clinics: 1,
    max_dentists: 1,
    features: "",
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
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, searchTerm, statusFilter]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/subscriptions", authHeaders);
      setPlans(response.data.plans || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load subscription plans.",
      );
    } finally {
      setLoading(false);
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
          plan.billing_cycle?.toLowerCase().includes(term) ||
          plan.storage_limit?.toLowerCase().includes(term) ||
          plan.features?.toLowerCase().includes(term),
      );
    }

    setFilteredPlans(filtered);
  };

  const openCreateModal = () => {
    setSelectedPlan(null);
    setPlanForm({
      plan_name: "",
      price: "",
      billing_cycle: "Monthly",
      storage_limit: "",
      max_clinics: 1,
      max_dentists: 1,
      features: "",
      status: "Active",
    });
    setMessage("");
    setError("");
    setShowPlanModal(true);
  };

  const openEditModal = (plan) => {
    setSelectedPlan(plan);
    setPlanForm({
      plan_name: plan.plan_name || "",
      price: plan.price || "",
      billing_cycle: plan.billing_cycle || "Monthly",
      storage_limit: plan.storage_limit || "",
      max_clinics: plan.max_clinics || 1,
      max_dentists: plan.max_dentists || 1,
      features: plan.features || "",
      status: plan.status || "Active",
    });
    setMessage("");
    setError("");
    setShowPlanModal(true);
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setSelectedPlan(null);
    setPlanForm({
      plan_name: "",
      price: "",
      billing_cycle: "Monthly",
      storage_limit: "",
      max_clinics: 1,
      max_dentists: 1,
      features: "",
      status: "Active",
    });
  };

  const handlePlanChange = (e) => {
    setPlanForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();

    if (!planForm.plan_name) {
      setError("Plan name is required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const payload = {
        plan_name: planForm.plan_name,
        price: Number(planForm.price || 0),
        billing_cycle: planForm.billing_cycle,
        storage_limit: planForm.storage_limit,
        max_clinics: Number(planForm.max_clinics || 1),
        max_dentists: Number(planForm.max_dentists || 1),
        features: planForm.features,
        status: planForm.status,
      };

      if (selectedPlan) {
        await API.put(
          `/api/subscriptions/${selectedPlan.plan_id}`,
          payload,
          authHeaders,
        );

        setMessage("Subscription plan updated successfully.");
      } else {
        await API.post("/api/subscriptions", payload, authHeaders);
        setMessage("Subscription plan created successfully.");
      }

      closePlanModal();
      fetchPlans();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to save subscription plan.",
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
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedPlan(null);
    setSelectedStatus("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedPlan || !selectedStatus) {
      setError("Please select a valid subscription status.");
      return;
    }

    try {
      setUpdatingStatus(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/subscriptions/${selectedPlan.plan_id}/status`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`Subscription plan marked as ${selectedStatus}.`);
      closeStatusModal();
      fetchPlans();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to update subscription plan status.",
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

  const formatPrice = (price) => {
    const amount = Number(price || 0);

    return amount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
    });
  };

  const totalPlans = plans.length;
  const activePlans = plans.filter((plan) => plan.status === "Active").length;
  const inactivePlans = plans.filter(
    (plan) => plan.status === "Inactive",
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Subscription Management</h2>
            <p>
              Manage subscription plans, pricing, billing cycles, limits, and
              included features.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button className="primary-button" onClick={openCreateModal}>
              Add Plan
            </button>

            <button
              className="secondary-button"
              onClick={fetchPlans}
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
            <h3>Listed Plans</h3>
            <strong>{filteredPlans.length}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plan name, billing cycle, storage, or features"
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
          <p>Loading subscription plans...</p>
        ) : filteredPlans.length === 0 ? (
          <div className="empty-state">
            <h3>No subscription plans found</h3>
            <p>Add a subscription plan to start managing plan options.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredPlans.map((plan) => (
              <div className="appointment-item" key={plan.plan_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{plan.plan_name}</h3>

                    <span className={getStatusClass(plan.status)}>
                      {plan.status}
                    </span>
                  </div>

                  <p>
                    <strong>Plan ID:</strong> {plan.plan_id}
                  </p>

                  <p>
                    <strong>Price:</strong> {formatPrice(plan.price)} /{" "}
                    {plan.billing_cycle || "Monthly"}
                  </p>

                  <p>
                    <strong>Storage Limit:</strong>{" "}
                    {plan.storage_limit || "Not specified"}
                  </p>

                  <p>
                    <strong>Max Clinics:</strong> {plan.max_clinics}
                  </p>

                  <p>
                    <strong>Max Dentists:</strong> {plan.max_dentists}
                  </p>

                  <p>
                    <strong>Features:</strong>{" "}
                    {plan.features || "No features provided"}
                  </p>

                  <p>
                    <strong>Created:</strong>{" "}
                    {plan.created_at
                      ? new Date(plan.created_at).toLocaleString()
                      : "N/A"}
                  </p>
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

      {showPlanModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {selectedPlan
                    ? "Edit Subscription Plan"
                    : "Add Subscription Plan"}
                </h3>
                <p>
                  {selectedPlan
                    ? "Update subscription plan details."
                    : "Create a new subscription plan."}
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
              <div className="form-group">
                <label>Plan Name</label>
                <input
                  type="text"
                  name="plan_name"
                  value={planForm.plan_name}
                  onChange={handlePlanChange}
                  placeholder="Example: Basic Clinic Plan"
                  required
                />
              </div>

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

              <div className="form-group">
                <label>Storage Limit</label>
                <input
                  type="text"
                  name="storage_limit"
                  value={planForm.storage_limit}
                  onChange={handlePlanChange}
                  placeholder="Example: 10 GB"
                />
              </div>

              <div className="form-group">
                <label>Max Clinics</label>
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
                  min="1"
                  value={planForm.max_dentists}
                  onChange={handlePlanChange}
                />
              </div>

              <div className="form-group">
                <label>Features</label>
                <textarea
                  name="features"
                  value={planForm.features}
                  onChange={handlePlanChange}
                  placeholder="Example: Digital records, X-ray uploads, appointment management"
                  rows="4"
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
                  Confirm that you want to mark this subscription plan as{" "}
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
