import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const openLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
  };

  const confirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("rememberMe");

    setShowLogoutModal(false);
    navigate("/");
  };

  const linksByRole = {
    Patient: [
      { label: "Dashboard", path: "/patient/dashboard" },
      { label: "My Profile", path: "/patient/profile" },
      { label: "Appointments", path: "/patient/appointments" },
      { label: "Dental Records", path: "/patient/records" },
      { label: "X-rays", path: "/patient/xrays" },
      { label: "Clinic Discovery", path: "/patient/clinics" },
    ],

    Dentist: [
      { label: "Dashboard", path: "/dentist/dashboard" },
      { label: "My Profile", path: "/dentist/profile" },
      { label: "Appointments", path: "/dentist/appointments" },
      { label: "Dental Records", path: "/dentist/dental-records" },
      { label: "X-rays", path: "/dentist/xrays" },
    ],

    Assistant: [
      { label: "Dashboard", path: "/assistant/dashboard" },
      { label: "My Profile", path: "/assistant/profile" },
      { label: "Appointments", path: "/assistant/appointments" },
      { label: "Dental Records", path: "/assistant/records" },
      { label: "X-rays", path: "/assistant/xrays" },
    ],

    "Dental Assistant": [
      { label: "Dashboard", path: "/assistant/dashboard" },
      { label: "My Profile", path: "/assistant/profile" },
      { label: "Appointments", path: "/assistant/appointments" },
      { label: "Dental Records", path: "/assistant/records" },
      { label: "X-rays", path: "/assistant/xrays" },
    ],

    Admin: [
      { label: "Dashboard", path: "/admin/dashboard" },
      { label: "Users", path: "/admin/users" },
      { label: "Clinics", path: "/admin/clinics" },
      { label: "Subscriptions", path: "/admin/subscriptions" },
      { label: "Payments", path: "/admin/payments" },
      { label: "Reports", path: "/admin/reports" },
      { label: "Audit Logs", path: "/admin/audit-logs" },
      { label: "Dental Records", path: "/admin/dental-records" },
    ],

    "Clinic Owner": [
      { label: "Dashboard", path: "/clinic-owner/dashboard" },
      { label: "Staff Management", path: "/clinic-owner/staff" },
      { label: "Subscription", path: "/clinic-owner/subscription" },
      { label: "Payment History", path: "/clinic-owner/payments" },
      { label: "Clinic Profile", path: "/clinic-owner/profile" },
    ],
  };

  const links = linksByRole[role] || [];

  return (
    <>
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">DG</div>

          <div className="sidebar-brand-text">
            <h2>DentoGraph</h2>
            <p>{role} Portal</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <button
              key={link.path}
              className={
                location.pathname === link.path
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={openLogoutModal}>
            Logout
          </button>
        </div>
      </aside>

      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-card logout-confirmation-modal">
            <div className="modal-header">
              <div>
                <h3>Confirm Logout</h3>
                <p>Are you sure you want to log out of your account?</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeLogoutModal}
              >
                ×
              </button>
            </div>

            <div className="info-message">
              Any unsaved changes may be lost after logging out.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeLogoutModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={confirmLogout}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
