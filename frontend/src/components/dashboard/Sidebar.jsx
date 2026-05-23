import { useLocation, useNavigate } from "react-router-dom";

function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("rememberMe");
    navigate("/");
  };

  const linksByRole = {
    Patient: [
      { label: "Dashboard", path: "/patient/dashboard" },
      { label: "My Profile", path: "/patient/profile" },
      { label: "Appointments", path: "/patient/appointments" },
      { label: "Dental Records", path: "/patient/records" },
      { label: "X-rays", path: "/patient/xrays" },
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
    Admin: [
      { label: "Dashboard", path: "/admin/dashboard" },
      { label: "Users", path: "/admin/users" },
      { label: "Clinics", path: "/admin/clinics" },
      { label: "Subscriptions", path: "/admin/subscriptions" },
      { label: "Reports", path: "/admin/reports" },
    ],
  };

  const links = linksByRole[role] || [];

  return (
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
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
