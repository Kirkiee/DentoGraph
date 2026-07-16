import API from "../../api/axios";

const API_ORIGIN = String(API.defaults.baseURL || "").replace(/\/$/, "");

const resolveLogoUrl = (logoPath) => {
  if (!logoPath) return "";

  if (/^https?:\/\//i.test(logoPath)) {
    return logoPath;
  }

  const normalizedPath = String(logoPath).startsWith("/")
    ? String(logoPath)
    : `/${logoPath}`;

  return `${API_ORIGIN}${normalizedPath}`;
};

function Navbar({ title, subtitle, user, branding, brandingReady = true }) {
  const displayBrand = branding?.brand_name || branding?.clinic_name || "";

  const logoUrl = resolveLogoUrl(branding?.brand_logo_url);

  return (
    <header className="dashboard-navbar">
      <div className="navbar-branding-group">
        {brandingReady && logoUrl && (
          <img
            src={logoUrl}
            alt={`${displayBrand || "Clinic"} logo`}
            className="navbar-clinic-logo"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}

        <div className="navbar-title">
          {brandingReady && displayBrand && (
            <span className="navbar-clinic-brand">{displayBrand}</span>
          )}

          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="navbar-user">
        <strong>{user?.name || "User"}</strong>
        <span>{user?.role || "Role"}</span>
      </div>
    </header>
  );
}

export default Navbar;
