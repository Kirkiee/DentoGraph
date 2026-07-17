import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import dentoGraphLogo from "../../assets/dentograph-logo.png";

function Sidebar({ role, mobileMenuOpen, setMobileMenuOpen, closeMobileMenu }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const openLogoutModal = () => {
    setShowLogoutModal(true);
    closeMobileMenu?.();
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

  const handleNavigate = (path) => {
    navigate(path);
    closeMobileMenu?.();
  };

  const linksByRole = {
    Patient: [
      { label: "Dashboard", path: "/patient/dashboard" },
      { label: "My Profile", path: "/patient/profile" },
      { label: "Appointments", path: "/patient/appointments" },
      { label: "Dental Records", path: "/patient/records" },
      { label: "X-rays", path: "/patient/xrays" },
      { label: "AR Braces Simulation", path: "/patient/ar-braces" },
      { label: "Clinic Discovery", path: "/patient/clinics" },
      { label: "Information Transfers", path: "/patient/transfers" },
      { label: "Historical Records", path: "/patient/historical-records" },
    ],

    Dentist: [
      { label: "Dashboard", path: "/dentist/dashboard" },
      { label: "My Profile", path: "/dentist/profile" },
      { label: "Appointments", path: "/dentist/appointments" },
      {
        label: "Walk-in Registration",
        path: "/dentist/walk-in-registration",
      },
      { label: "Dental Records", path: "/dentist/dental-records" },
      { label: "X-rays", path: "/dentist/xrays" },
      { label: "Patient Transfers", path: "/dentist/patient-transfers" },
      {
        label: "Historical Records",
        path: "/dentist/patient-historical-records",
      },
    ],

    Assistant: [
      { label: "Dashboard", path: "/assistant/dashboard" },
      { label: "My Profile", path: "/assistant/profile" },
      { label: "Appointments", path: "/assistant/appointments" },
      {
        label: "Walk-in Registration",
        path: "/assistant/walk-in-registration",
      },
      { label: "Dental Records", path: "/assistant/dental-records" },
      { label: "X-rays", path: "/assistant/xrays" },
      { label: "Patient Transfers", path: "/assistant/patient-transfers" },
      {
        label: "Historical Records",
        path: "/assistant/patient-historical-records",
      },
    ],

    "Dental Assistant": [
      { label: "Dashboard", path: "/assistant/dashboard" },
      { label: "My Profile", path: "/assistant/profile" },
      { label: "Appointments", path: "/assistant/appointments" },
      {
        label: "Walk-in Registration",
        path: "/assistant/walk-in-registration",
      },
      { label: "Dental Records", path: "/assistant/dental-records" },
      { label: "X-rays", path: "/assistant/xrays" },
      { label: "Patient Transfers", path: "/assistant/patient-transfers" },
      {
        label: "Historical Records",
        path: "/assistant/patient-historical-records",
      },
    ],

    Admin: [
      { label: "Dashboard", path: "/admin/dashboard" },
      { label: "My Profile", path: "/admin/profile" },
      { label: "User Management", path: "/admin/users" },
      {
        label: "Staff Credential Review",
        path: "/admin/staff-credentials",
      },
      { label: "Clinic Locations", path: "/admin/clinics" },
      {
        label: "Document Renewals",
        path: "/admin/document-renewals",
      },
      { label: "Shared Subscriptions", path: "/admin/subscriptions" },
      { label: "Subscription Payments", path: "/admin/payments" },
      { label: "Reports & Analytics", path: "/admin/reports" },
      { label: "Audit Logs", path: "/admin/audit-logs" },
      { label: "Dental Records", path: "/admin/dental-records" },
    ],

    "Clinic Owner": [
      { label: "Dashboard", path: "/clinic-owner/dashboard" },
      { label: "Clinic Locations", path: "/clinic-owner/profile" },
      { label: "Clinic Customization", path: "/clinic-owner/branding" },
      { label: "Staff Management", path: "/clinic-owner/staff" },
      {
        label: "Walk-in Registration",
        path: "/clinic-owner/walk-in-registration",
      },
      { label: "Shared Subscription", path: "/clinic-owner/subscription" },
      { label: "Payment History", path: "/clinic-owner/payments" },
      { label: "Dental Records", path: "/clinic-owner/dental-records" },
      { label: "Patient Transfers", path: "/clinic-owner/patient-transfers" },
      {
        label: "Historical Records",
        path: "/clinic-owner/patient-historical-records",
      },
    ],
  };

  const links = linksByRole[role] || [];

  const isActiveLink = (path) => {
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <>
      <aside
        className={
          mobileMenuOpen ? "dashboard-sidebar mobile-open" : "dashboard-sidebar"
        }
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo-box">
            <img
              src={dentoGraphLogo}
              alt="DentoGraph Logo"
              className="sidebar-logo-image"
            />
          </div>

          <div className="sidebar-brand-text">
            <h2>DentoGraph</h2>
            <p>{role} Portal</p>
          </div>

          <button
            type="button"
            className="sidebar-hamburger"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <button
              key={link.path}
              className={
                isActiveLink(link.path) ? "sidebar-link active" : "sidebar-link"
              }
              onClick={() => handleNavigate(link.path)}
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
