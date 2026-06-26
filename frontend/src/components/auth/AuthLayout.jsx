import "../../styles/auth.css";
import dentoGraphLogo from "../../assets/dentograph-logo.png";

function AuthLayout({ title, subtitle, wide = false, children }) {
  return (
    <div className="auth-page">
      <div className={wide ? "auth-card auth-card-wide" : "auth-card"}>
        <div className="auth-header">
          <div className="auth-logo-box">
            <img
              src={dentoGraphLogo}
              alt="DentoGraph Logo"
              className="auth-logo-image"
            />
          </div>

          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  );
}

export default AuthLayout;
