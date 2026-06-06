import React, { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

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
  }, [users, searchTerm, roleFilter, statusFilter]);

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

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term) ||
          user.role_name?.toLowerCase().includes(term) ||
          user.dentist_clinic_name?.toLowerCase().includes(term) ||
          user.assistant_clinic_name?.toLowerCase().includes(term) ||
          String(user.user_id).includes(term),
      );
    }

    setFilteredUsers(filtered);
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

  const openCreateModal = () => {
    resetCreateForm();
    setMessage("");
    setError("");
    setCreateModalError("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
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

    if (
      !createForm.name ||
      !createForm.email ||
      !createForm.password ||
      !createForm.role_id
    ) {
      setCreateModalError("Please complete all required fields.");
      return;
    }

    if (
      isCreateDentist &&
      (!createForm.license_number ||
        !createForm.specialization ||
        !createForm.availability)
    ) {
      setCreateModalError("Please complete the dentist profile fields.");
      return;
    }

    if (
      isCreateAssistant &&
      (!createForm.license_number || !createForm.availability)
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
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role_id: Number(createForm.role_id),
      };

      if (isCreateDentist) {
        payload.license_number = createForm.license_number;
        payload.specialization = createForm.specialization;
        payload.availability = createForm.availability;
        payload.clinic_id = createForm.clinic_id
          ? Number(createForm.clinic_id)
          : null;
      }

      if (isCreateAssistant) {
        payload.license_number = createForm.license_number;
        payload.availability = createForm.availability;
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
      (!roleProfileForm.license_number ||
        !roleProfileForm.specialization ||
        !roleProfileForm.availability)
    ) {
      setRoleModalError("Please complete the dentist profile fields.");
      return;
    }

    if (
      isChangeAssistant &&
      (!roleProfileForm.license_number || !roleProfileForm.availability)
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
        payload.license_number = roleProfileForm.license_number;
        payload.specialization = roleProfileForm.specialization;
        payload.availability = roleProfileForm.availability;
        payload.clinic_id = roleProfileForm.clinic_id
          ? Number(roleProfileForm.clinic_id)
          : null;
      }

      if (isChangeAssistant) {
        payload.license_number = roleProfileForm.license_number;
        payload.availability = roleProfileForm.availability;
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

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const inactiveUsers = users.filter(
    (user) => user.status === "Inactive",
  ).length;
  const adminUsers = users.filter((user) => user.role_name === "Admin").length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>User Management</h2>
            <p>
              View users, create accounts, manage account status, and update
              user roles.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button className="primary-button" onClick={openCreateModal}>
              Create User
            </button>

            <button
              className="secondary-button"
              onClick={fetchUsers}
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
            <h3>Total Users</h3>
            <strong>{totalUsers}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Active</h3>
            <strong>{activeUsers}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Inactive</h3>
            <strong>{inactiveUsers}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Admins</h3>
            <strong>{adminUsers}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, role, clinic, or user ID"
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
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
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <h3>No users found</h3>
            <p>Users will appear here once accounts are registered.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredUsers.map((user) => (
              <div className="appointment-item" key={user.user_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{user.name}</h3>

                    <span className={getStatusClass(user.status)}>
                      {user.status}
                    </span>

                    <span className="status-badge status-scheduled">
                      {user.role_name || "No Role"}
                    </span>
                  </div>

                  <p>
                    <strong>User ID:</strong> {user.user_id}
                  </p>

                  <p>
                    <strong>Email:</strong> {user.email}
                  </p>

                  {user.dentist_clinic_name && (
                    <p>
                      <strong>Dentist Clinic:</strong>{" "}
                      {user.dentist_clinic_name}
                    </p>
                  )}

                  {user.assistant_clinic_name && (
                    <p>
                      <strong>Assistant Clinic:</strong>{" "}
                      {user.assistant_clinic_name}
                    </p>
                  )}

                  <p>
                    <strong>Created:</strong>{" "}
                    {user.created_at
                      ? new Date(user.created_at).toLocaleString()
                      : "N/A"}
                  </p>
                </div>

                <div className="appointment-actions">
                  <button
                    className="secondary-button"
                    disabled={updating}
                    onClick={() => openRoleModal(user)}
                  >
                    Change Role
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
                      className="secondary-button"
                      disabled={updating}
                      onClick={() => openStatusModal(user, "Active")}
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

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Create User Account</h3>
                <p>
                  Create a new account and provide role-specific details when
                  needed.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCreateModal}
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

              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  placeholder="Enter temporary password"
                  required
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  name="role_id"
                  value={createForm.role_id}
                  onChange={handleCreateChange}
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
                  <label>Clinic</label>
                  <select
                    name="clinic_id"
                    value={createForm.clinic_id}
                    onChange={handleCreateChange}
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

              {isCreateDentist && (
                <>
                  <div className="form-group">
                    <label>License Number</label>
                    <input
                      type="text"
                      name="license_number"
                      value={createForm.license_number}
                      onChange={handleCreateChange}
                      placeholder="Example: DEN-001"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      value={createForm.specialization}
                      onChange={handleCreateChange}
                      placeholder="Example: General Dentistry"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Availability</label>
                    <textarea
                      name="availability"
                      value={createForm.availability}
                      onChange={handleCreateChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      required
                    />
                  </div>
                </>
              )}

              {isCreateAssistant && (
                <>
                  <div className="form-group">
                    <label>License Number</label>
                    <input
                      type="text"
                      name="license_number"
                      value={createForm.license_number}
                      onChange={handleCreateChange}
                      placeholder="Example: AST-001"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Availability</label>
                    <textarea
                      name="availability"
                      value={createForm.availability}
                      onChange={handleCreateChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
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

              <div className="form-group">
                <label>Name</label>
                <input type="text" value={selectedUser?.name || ""} disabled />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="text" value={selectedUser?.email || ""} disabled />
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
                  Select a new role and provide profile details when needed.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRoleModal}
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

              <div className="form-group">
                <label>Name</label>
                <input type="text" value={selectedUser?.name || ""} disabled />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input type="text" value={selectedUser?.email || ""} disabled />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  value={selectedRoleId}
                  onChange={handleRoleChangeInModal}
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

              {(isChangeDentist || isChangeAssistant) && (
                <div className="form-group">
                  <label>Clinic</label>
                  <select
                    name="clinic_id"
                    value={roleProfileForm.clinic_id}
                    onChange={handleRoleProfileChange}
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
                    <label>License Number</label>
                    <input
                      type="text"
                      name="license_number"
                      value={roleProfileForm.license_number}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: DEN-001"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      value={roleProfileForm.specialization}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: General Dentistry"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Availability</label>
                    <textarea
                      name="availability"
                      value={roleProfileForm.availability}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
                      required
                    />
                  </div>
                </>
              )}

              {isChangeAssistant && (
                <>
                  <div className="form-group">
                    <label>License Number</label>
                    <input
                      type="text"
                      name="license_number"
                      value={roleProfileForm.license_number}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: AST-001"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Availability</label>
                    <textarea
                      name="availability"
                      value={roleProfileForm.availability}
                      onChange={handleRoleProfileChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      rows="3"
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
