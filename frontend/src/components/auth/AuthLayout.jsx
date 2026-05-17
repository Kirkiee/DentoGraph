import { Stethoscope } from 'lucide-react';
import '../../styles/auth.css';

function AuthLayout({ title, subtitle, wide = false, children }) {
  return (
    <div className="auth-page">
      <div className={wide ? 'auth-card auth-card-wide' : 'auth-card'}>
        <div className="auth-header">
          <div className="auth-logo">
            <Stethoscope size={32} />
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