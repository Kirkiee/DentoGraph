import React, { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PasswordInput from "../components/auth/PasswordInput";

function AdminUsers() {
  const createFormRef = useRef(null);
  const roleFormRef = useRef(null);
  const statusFormRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [clinics, setClinics] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [verificationFilter, setVerificationFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "",
    license_number: "",
    specialization: "",
    availability: "",
    clinic_id: "",
  });

  const [roleProfileForm, setRoleProfileForm] = useState({
    license_number: "",
    specialization: "",
    availability: "",
    clinic_id: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [createModalError, setCreateModalError] = useState("");
  const [roleModalError, setRoleModalError] = useState("");
  const [statusModalError, setStatusModalError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchTerm, roleFilter, statusFilter, verificationFilter]);

  useEffect(() => {
    const isAnyModalOpen = showCreateModal || showStatusModal || showRoleModal;

    if (isAnyModalOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showCreateModal, showStatusModal, showRoleModal]);

  useEffect(() => {
    if (createModalError && createFormRef.current) {
      createFormRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [createModalError]);

  useEffect(() => {
    if (roleModalError && roleFormRef.current) {
      roleFormRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [roleModalError]);

  useEffect(() => {
    if (statusModalError && statusFormRef.current) {
      statusFormRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [statusModalError]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/users/admin/users", authHeaders);
      setUsers(response.data.users || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await API.get("/api/users/roles");
      setRoles(response.data || []);
    } catch (err) {
      console.error("Fetch roles error:", err);
    }
  };

  const fetchClinics = async () => {
    try {
      const response = await API.get("/api/clinics", authHeaders);
      setClinics(response.data.clinics || []);
    } catch (err) {
      console.error("Fetch clinics error:", err);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (roleFilter !== "All") {
      filtered = filtered.filter((user) => user.role_name === roleFilter);
    }

    if (statusFilter !== "All") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    if (verificationFilter !== "All") {
      filtered = filtered.filter((user) => {
        const isVerified = Boolean(user.email_verified);

        if (verificationFilter === "Verified") return isVerified;
        if (verificationFilter === "Unverified") return !isVerified;

        return true;
      });
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.trim().toLowerCase();

      filtered = filtered.filter((user) => {
        return (
          user.name?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term) ||
          user.role_name?.toLowerCase().includes(term) ||
          user.dentist_clinic_name?.toLowerCase().includes(term) ||
          user.assistant_clinic_name?.toLowerCase().includes(term) ||
          String(user.user_id).includes(term)
        );
      });
    }

    setFilteredUsers(filtered);
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  };

  const validatePasswordStrength = (password) => {
    const value = String(password || "");

    if (value.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (!/[A-Z]/.test(value)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(value)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(value)) {
      return "Password must contain at least one number.";
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      return "Password must contain at least one special character.";
    }

    return null;
  };

  const getSelectedCreateRoleName = () => {
    const selectedRole = roles.find(
      (role) => Number(role.role_id) === Number(createForm.role_id),
    );

    return selectedRole?.role_name || "";
  };

  const getSelectedChangeRoleName = () => {
    const selectedRole = roles.find(
      (role) => Number(role.role_id) === Number(selectedRoleId),
    );

    return selectedRole?.role_name || "";
  };

  const selectedCreateRoleName = getSelectedCreateRoleName();
  const selectedChangeRoleName = getSelectedChangeRoleName();

  const isCreateDentist = selectedCreateRoleName === "Dentist";
  const isCreateAssistant =
    selectedCreateRoleName === "Assistant" ||
    selectedCreateRoleName === "Dental Assistant";

  const isChangeDentist = selectedChangeRoleName === "Dentist";
  const isChangeAssistant =
    selectedChangeRoleName === "Assistant" ||
    selectedChangeRoleName === "Dental Assistant";

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      email: "",
      password: "",
      role_id: "",
      license_number: "",
      specialization: "",
      availability: "",
      clinic_id: "",
    });
  };

  const resetRoleProfileForm = () => {
    setRoleProfileForm({
      license_number: "",
      specialization: "",
      availability: "",
      clinic_id: "",
    });
  };

  const getExistingRoleProfile = (user, roleName = user?.role_name) => {
    const isDentistUser = roleName === "Dentist";
    const isAssistantUser =
      roleName === "Assistant" || roleName === "Dental Assistant";

    return {
      license_number: isDentistUser
        ? user?.dentist_license_number || ""
        : isAssistantUser
          ? user?.assistant_license_number || ""
          : "",
      specialization: isDentistUser ? user?.specialization || "" : "",
      availability: isDentistUser
        ? user?.dentist_availability || ""
        : isAssistantUser
          ? user?.assistant_availability || ""
          : "",
      clinic_id: isDentistUser
        ? user?.dentist_clinic_id || ""
        : isAssistantUser
          ? user?.assistant_clinic_id || ""
          : "",
    };
  };

  const getAssignedClinicName = (user) => {
    if (user.dentist_clinic_name) return user.dentist_clinic_name;
    if (user.assistant_clinic_name) return user.assistant_clinic_name;

    if (user.role_name === "Clinic Owner") {
      return "Clinic owner account";
    }

    if (user.role_name === "Patient") {
      return "Patient account";
    }

    if (user.role_name === "Admin") {
      return "System admin";
    }

    return "No assigned clinic";
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

  const openCreateModal = () => {
    resetCreateForm();
    setMessage("");
    setError("");
    setCreateModalError("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;

    setShowCreateModal(false);
    resetCreateForm();
    setCreateModalError("");
  };

  const handleCreateChange = (e) => {
    const { name, value } = e.target;

    setCreateModalError("");

    setCreateForm((prev) => {
      if (name === "role_id") {
        return {
          ...prev,
          role_id: value,
          license_number: "",
          specialization: "",
          availability: "",
          clinic_id: "",
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleRoleProfileChange = (e) => {
    setRoleModalError("");

    setRoleProfileForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    const cleanName = createForm.name.trim();
    const cleanEmail = createForm.email.trim().toLowerCase();
    const cleanPassword = createForm.password;

    if (!cleanName || !cleanEmail || !cleanPassword || !createForm.role_id) {
      setCreateModalError("Please complete all required fields.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setCreateModalError("Please enter a valid email address.");
      return;
    }

    const passwordError = validatePasswordStrength(cleanPassword);

    if (passwordError) {
      setCreateModalError(passwordError);
      return;
    }

    if (
      isCreateDentist &&
      (!createForm.license_number.trim() ||
        !createForm.specialization.trim() ||
        !createForm.availability.trim())
    ) {
      setCreateModalError("Please complete the dentist profile fields.");
      return;
    }

    if (
      isCreateAssistant &&
      (!createForm.license_number.trim() || !createForm.availability.trim())
    ) {
      setCreateModalError("Please complete the assistant profile fields.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");
      setCreateModalError("");

      const payload = {
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role_id: Number(createForm.role_id),
      };

      if (isCreateDentist) {
        payload.license_number = createForm.license_number.trim();
        payload.specialization = createForm.specialization.trim();
        payload.availability = createForm.availability.trim();
        payload.clinic_id = createForm.clinic_id
          ? Number(createForm.clinic_id)
          : null;
      }

      if (isCreateAssistant) {
        payload.license_number = createForm.license_number.trim();
        payload.availability = createForm.availability.trim();
        payload.clinic_id = createForm.clinic_id
          ? Number(createForm.clinic_id)
          : null;
      }

      await API.post("/api/users/register", payload);

      setMessage("User account created successfully.");
      closeCreateModal();
      fetchUsers();
    } catch (err) {
      setCreateModalError(
        err.response?.data?.error || "Unable to create user account.",
      );
    } finally {
      setCreating(false);
    }
  };

  const openStatusModal = (user, status) => {
    setSelectedUser(user);
    setSelectedStatus(status);
    setMessage("");
    setError("");
    setStatusModalError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    if (updating) return;

    setShowStatusModal(false);
    setSelectedUser(null);
    setSelectedStatus("");
    setStatusModalError("");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedUser || !selectedStatus) {
      setStatusModalError("Please select a valid user and status.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setStatusModalError("");

      await API.put(
        `/api/users/admin/users/${selectedUser.user_id}/status`,
        { status: selectedStatus },
        authHeaders,
      );

      setMessage(`User status updated to ${selectedStatus}.`);
      closeStatusModal();
      fetchUsers();
    } catch (err) {
      setStatusModalError(
        err.response?.data?.error || "Unable to update user status.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setSelectedRoleId(user.role_id || "");
    setRoleProfileForm(getExistingRoleProfile(user));

    setMessage("");
    setError("");
    setRoleModalError("");
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    if (updating) return;

    setShowRoleModal(false);
    setSelectedUser(null);
    setSelectedRoleId("");
    resetRoleProfileForm();
    setRoleModalError("");
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();

    if (!selectedUser || !selectedRoleId) {
      setRoleModalError("Please select a valid role.");
      return;
    }

    if (
      isChangeDentist &&
      (!roleProfileForm.license_number.trim() ||
        !roleProfileForm.specialization.trim() ||
        !roleProfileForm.availability.trim())
    ) {
      setRoleModalError("Please complete the dentist profile fields.");
      return;
    }

    if (
      isChangeAssistant &&
      (!roleProfileForm.license_number.trim() ||
        !roleProfileForm.availability.trim())
    ) {
      setRoleModalError("Please complete the assistant profile fields.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setRoleModalError("");

      const payload = {
        role_id: Number(selectedRoleId),
      };

      if (isChangeDentist) {
        payload.license_number = roleProfileForm.license_number.trim();
        payload.specialization = roleProfileForm.specialization.trim();
        payload.availability = roleProfileForm.availability.trim();
        payload.clinic_id = roleProfileForm.clinic_id
          ? Number(roleProfileForm.clinic_id)
          : null;
      }

      if (isChangeAssistant) {
        payload.license_number = roleProfileForm.license_number.trim();
        payload.availability = roleProfileForm.availability.trim();
        payload.clinic_id = roleProfileForm.clinic_id
          ? Number(roleProfileForm.clinic_id)
          : null;
      }

      await API.put(
        `/api/users/admin/users/${selectedUser.user_id}/role`,
        payload,
        authHeaders,
      );

      setMessage("User role updated successfully.");
      closeRoleModal();
      fetchUsers();
    } catch (err) {
      setRoleModalError(
        err.response?.data?.error || "Unable to update user role.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleRoleChangeInModal = (e) => {
    const newRoleId = e.target.value;
    const newRole = roles.find(
      (role) => Number(role.role_id) === Number(newRoleId),
    );

    setSelectedRoleId(newRoleId);
    setRoleModalError("");

    if (newRole?.role_name === selectedUser?.role_name) {
      setRoleProfileForm(
        getExistingRoleProfile(selectedUser, newRole.role_name),
      );
    } else {
      resetRoleProfileForm();
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

  const getEmailVerificationClass = (isVerified) => {
    return isVerified
      ? "status-badge status-completed"
      : "status-badge status-pending";
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const inactiveUsers = users.filter(
    (user) => user.status === "Inactive",
  ).length;
  const verifiedUsers = users.filter((user) =>
    Boolean(user.email_verified),
  ).length;
  const unverifiedUsers = users.filter(
    (user) => !Boolean(user.email_verified),
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>User Management</h2>
            <p>
              Manage system user accounts separately from clinic records. Users
              are login accounts, while clinics are client/business profiles.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="primary-button"
              onClick={openCreateModal}
              disabled={loading || creating || updating}
            >
              Create User
            </button>

            <button
              className="secondary-button"
              onClick={fetchUsers}
              disabled={loading || creating || updating}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="admin-users-section">
          <div className="appointments-header">
            <div>
              <h2>User Summary</h2>
              <p>Quick overview of system user accounts.</p>
            </div>
          </div>

          <div className="admin-users-summary-grid">
            <div className="admin-users-summary-card">
              <span>Total Users</span>
              <strong>{totalUsers}</strong>
              <p>All registered accounts</p>
            </div>

            <div className="admin-users-summary-card">
              <span>Active Users</span>
              <strong>{activeUsers}</strong>
              <p>Can access the system</p>
            </div>

            <div className="admin-users-summary-card">
              <span>Inactive Users</span>
              <strong>{inactiveUsers}</strong>
              <p>Access disabled</p>
            </div>

            <div className="admin-users-summary-card">
              <span>Verified Emails</span>
              <strong>{verifiedUsers}</strong>
              <p>Email-confirmed accounts</p>
            </div>

            <div className="admin-users-summary-card">
              <span>Unverified Emails</span>
              <strong>{unverifiedUsers}</strong>
              <p>Need email verification</p>
            </div>
          </div>
        </div>

        <div className="admin-users-section">
          <div className="appointments-header">
            <div>
              <h2>User Filters</h2>
              <p>Search and filter users by role, status, or verification.</p>
            </div>
          </div>

          <div className="admin-users-filter-card">
            <div className="appointment-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, email, role, clinic, or user ID"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="All">All Roles</option>
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_name}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Email Verification</label>
                  <select
                    value={verificationFilter}
                    onChange={(e) => setVerificationFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="All">All</option>
                    <option value="Verified">Verified</option>
                    <option value="Unverified">Unverified</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Visible Records</label>
                  <input
                    type="text"
                    value={`${filteredUsers.length} of ${users.length}`}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-users-section">
          <div className="appointments-header">
            <div>
              <h2>User Accounts</h2>
              <p>
                Detailed list of login accounts, assigned roles, verification,
                and clinic links.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <h3>No users found</h3>
              <p>Users will appear here once accounts are registered.</p>
            </div>
          ) : (
            <div className="admin-users-table-wrapper">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Email Verification</th>
                    <th>Clinic Link</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        <strong>{user.user_id}</strong>
                      </td>

                      <td>
                        <strong>{user.name}</strong>
                      </td>

                      <td>
                        <span className="admin-users-email-text">
                          {user.email}
                        </span>
                      </td>

                      <td>{user.role_name || "No Role"}</td>

                      <td>
                        <span className={getStatusClass(user.status)}>
                          {user.status || "Pending"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={getEmailVerificationClass(
                            user.email_verified,
                          )}
                        >
                          {user.email_verified ? "Verified" : "Unverified"}
                        </span>
                      </td>

                      <td>{getAssignedClinicName(user)}</td>

                      <td>{formatDate(user.created_at)}</td>

                      <td>
                        <div className="admin-users-table-actions">
                          <button
                            className="secondary-button"
                            disabled={updating}
                            onClick={() => openRoleModal(user)}
                          >
                            Role
                          </button>

                          {user.status === "Active" ? (
                            <button
                              className="danger-button"
                              disabled={updating}
                              onClick={() => openStatusModal(user, "Inactive")}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="primary-button"
                              disabled={updating}
                              onClick={() => openStatusModal(user, "Active")}
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

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Create User Account</h3>
                <p>
                  Create a login account. Dentist and assistant accounts may be
                  linked to a clinic, but the user account remains separate.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCreateModal}
                disabled={creating}
              >
                ×
              </button>
            </div>

            <form
              ref={createFormRef}
              className="modal-form"
              onSubmit={handleCreateUser}
            >
              {createModalError && (
                <div className="error-message">{createModalError}</div>
              )}

              <div className="info-message">
                Fields marked with <span className="auth-required">*</span> are
                required. Staff accounts must verify their email before logging
                in.
              </div>

              <div className="form-group">
                <label>
                  Name
                  <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  placeholder="Enter full name"
                  disabled={creating}
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Email
                  <span className="auth-required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  placeholder="Enter email address"
                  disabled={creating}
                  required
                />
              </div>

              <PasswordInput
                label="Password"
                name="password"
                placeholder="Enter temporary password"
                value={createForm.password}
                onChange={handleCreateChange}
                icon="🔒"
                autoComplete="new-password"
                disabled={creating}
                required
              />

              <div className="form-group">
                <label>
                  Role
                  <span className="auth-required">*</span>
                </label>
                <select
                  name="role_id"
                  value={createForm.role_id}
                  onChange={handleCreateChange}
                  disabled={creating}
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>

              {(isCreateDentist || isCreateAssistant) && (
                <div className="form-group">
                  <label>Clinic Assignment</label>
                  <select
                    name="clinic_id"
                    value={createForm.clinic_id}
                    onChange={handleCreateChange}
                    disabled={creating}
                  >
                    <option value="">No assigned clinic</option>
                    {clinics
                      .filter((clinic) => clinic.status === "Active")
                      .map((clinic) => (
                        <option key={clinic.clinic_id} value={clinic.clinic_id}>
                          {clinic.clinic_name}
                        </option>
                      ))}
                  </select>
                  <small>
                    Clinic assignment links the user to a clinic, but does not
                    turn the clinic record into a user account.
                  </small>
                </div>
              )}

              {isCreateDentist && (
                <>
                  <div className="form-group">
                    <label>
                      License Number
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={createForm.license_number}
                      onChange={handleCreateChange}
                      placeholder="Example: DEN-001"
                      disabled={creating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Specialization
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="specialization"
                      value={createForm.specialization}
                      onChange={handleCreateChange}
                      placeholder="Example: General Dentistry"
                      disabled={creating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Availability
                      <span className="auth-required">*</span>
                    </label>
                    <textarea
                      name="availability"
                      value={createForm.availability}
                      onChange={handleCreateChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      disabled={creating}
                      required
                    />
                  </div>
                </>
              )}

              {isCreateAssistant && (
                <>
                  <div className="form-group">
                    <label>
                      License Number
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={createForm.license_number}
                      onChange={handleCreateChange}
                      placeholder="Example: AST-001"
                      disabled={creating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Availability
                      <span className="auth-required">*</span>
                    </label>
                    <textarea
                      name="availability"
                      value={createForm.availability}
                      onChange={handleCreateChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      disabled={creating}
                      required
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCreateModal}
                  disabled={creating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create User"}
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
                <h3>Update User Status</h3>
                <p>
                  Confirm that you want to set this user as{" "}
                  <strong>{selectedStatus}</strong>.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeStatusModal}
                disabled={updating}
              >
                ×
              </button>
            </div>

            <form
              ref={statusFormRef}
              className="modal-form"
              onSubmit={handleUpdateStatus}
            >
              {statusModalError && (
                <div className="error-message">{statusModalError}</div>
              )}

              <div className="info-message">
                <strong>User:</strong> {selectedUser?.name || "N/A"}
                <br />
                <strong>Email:</strong> {selectedUser?.email || "N/A"}
                <br />
                <strong>Current Role:</strong>{" "}
                {selectedUser?.role_name || "No Role"}
                <br />
                <strong>New Status:</strong> {selectedStatus}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeStatusModal}
                  disabled={updating}
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
                  disabled={updating}
                >
                  {updating ? "Updating..." : `Confirm ${selectedStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Change User Role</h3>
                <p>
                  Select a new role. Dentist and assistant roles can be linked
                  to a clinic record.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRoleModal}
                disabled={updating}
              >
                ×
              </button>
            </div>

            <form
              ref={roleFormRef}
              className="modal-form"
              onSubmit={handleUpdateRole}
            >
              {roleModalError && (
                <div className="error-message">{roleModalError}</div>
              )}

              <div className="info-message">
                <strong>User:</strong> {selectedUser?.name || "N/A"}
                <br />
                <strong>Email:</strong> {selectedUser?.email || "N/A"}
                <br />
                <strong>Current Role:</strong>{" "}
                {selectedUser?.role_name || "No Role"}
                <br />
                <strong>Current Clinic Link:</strong>{" "}
                {selectedUser ? getAssignedClinicName(selectedUser) : "N/A"}
              </div>

              <div className="form-group">
                <label>
                  New Role
                  <span className="auth-required">*</span>
                </label>
                <select
                  value={selectedRoleId}
                  onChange={handleRoleChangeInModal}
                  required
                  disabled={updating}
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>

              {(isChangeDentist || isChangeAssistant) && (
                <div className="form-group">
                  <label>Clinic Assignment</label>
                  <select
                    name="clinic_id"
                    value={roleProfileForm.clinic_id}
                    onChange={handleRoleProfileChange}
                    disabled={updating}
                  >
                    <option value="">No assigned clinic</option>
                    {clinics
                      .filter((clinic) => clinic.status === "Active")
                      .map((clinic) => (
                        <option key={clinic.clinic_id} value={clinic.clinic_id}>
                          {clinic.clinic_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {isChangeDentist && (
                <>
                  <div className="form-group">
                    <label>
                      License Number
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={roleProfileForm.license_number}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: DEN-001"
                      disabled={updating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Specialization
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="specialization"
                      value={roleProfileForm.specialization}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: General Dentistry"
                      disabled={updating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Availability
                      <span className="auth-required">*</span>
                    </label>
                    <textarea
                      name="availability"
                      value={roleProfileForm.availability}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      disabled={updating}
                      required
                    />
                  </div>
                </>
              )}

              {isChangeAssistant && (
                <>
                  <div className="form-group">
                    <label>
                      License Number
                      <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={roleProfileForm.license_number}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: AST-001"
                      disabled={updating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Availability
                      <span className="auth-required">*</span>
                    </label>
                    <textarea
                      name="availability"
                      value={roleProfileForm.availability}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      disabled={updating}
                      required
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRoleModal}
                  disabled={updating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={updating}
                >
                  {updating ? "Updating..." : "Save Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminUsers;
