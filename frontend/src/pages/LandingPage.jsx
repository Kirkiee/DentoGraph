import React from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";

function LandingPage() {
  const features = [
    {
      title: "Multi-Clinic Records",
      description:
        "Manage patient dental records, appointments, staff access, and clinic data in one connected system.",
    },
    {
      title: "3D Dental Visualization",
      description:
        "View adult or child dental charts using interactive 3D tooth models with dental status legends.",
    },
    {
      title: "AI-Assisted X-ray Review",
      description:
        "Upload dental X-rays and generate AI-assisted suggestions with interpretation, confidence, and dentist review.",
    },
    {
      title: "Appointment Management",
      description:
        "Patients can book appointments while dentists and assistants manage schedules, status updates, and cancellation remarks.",
    },
    {
      title: "Patient PDA Form Upload",
      description:
        "Patients can download, complete, and upload their Philippine Dental Association dental chart form.",
    },
    {
      title: "Printable Reports",
      description:
        "Generate printable dental record reports for tangible documentation and clinical review.",
    },
  ];

  const plans = [
    {
      name: "Free",
      price: "₱0",
      description: "For small clinics starting with digital records.",
      items: [
        "Basic clinic profile",
        "Limited records",
        "Limited X-ray uploads",
      ],
    },
    {
      name: "Standard",
      price: "Monthly",
      description: "For growing clinics that need more storage and users.",
      items: ["More patient records", "More X-ray storage", "Staff management"],
    },
    {
      name: "Premium",
      price: "Custom",
      description: "For multi-clinic dental groups with larger operations.",
      items: ["Multi-clinic support", "Advanced reports", "Higher limits"],
    },
  ];

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <span className="landing-logo-mark">D</span>
          <span>DentoGraph</span>
        </Link>

        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#plans">Plans</a>
          <a href="#workflow">Workflow</a>
          <Link to="/auth/login">Login</Link>
          <Link to="/auth/register" className="landing-nav-button">
            Register
          </Link>
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <div className="landing-pill">
              Dental Records • 3D • X-rays • Reports
            </div>

            <h1>Digital dental record management built for modern clinics.</h1>

            <p>
              DentoGraph is a subscription-based dental record management system
              with appointment handling, 3D dental visualization, X-ray
              integration, AI-assisted interpretation, patient document uploads,
              and printable reports.
            </p>

            <div className="landing-hero-actions">
              <Link to="/auth/login" className="landing-primary-button">
                Login to DentoGraph
              </Link>

              <Link to="/auth/register" className="landing-secondary-button">
                Create Account
              </Link>
            </div>

            <div className="landing-hero-stats">
              <div>
                <strong>4</strong>
                <span>User Roles</span>
              </div>

              <div>
                <strong>3D</strong>
                <span>Dental Chart</span>
              </div>

              <div>
                <strong>AI</strong>
                <span>X-ray Support</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-card">
            <div className="landing-dashboard-preview">
              <div className="preview-topbar">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div className="preview-header">
                <div>
                  <p>Dental Record</p>
                  <h3>Patient Overview</h3>
                </div>

                <span>Active</span>
              </div>

              <div className="preview-grid">
                <div className="preview-box large">
                  <p>3D Tooth Chart</p>

                  <div className="tooth-preview-row">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                  <div className="tooth-preview-row lower">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>

                <div className="preview-box">
                  <p>X-ray AI</p>
                  <h4>82.4%</h4>
                  <small>High confidence</small>
                </div>

                <div className="preview-box">
                  <p>Report</p>
                  <h4>Print Ready</h4>
                  <small>A4 format</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-section-heading">
            <span>Core Features</span>
            <h2>Everything needed for digital dental workflow.</h2>
            <p>
              DentoGraph connects dental records, appointments, staff access,
              visual charting, X-ray support, and patient-facing tools.
            </p>
          </div>

          <div className="landing-feature-grid">
            {features.map((feature, index) => (
              <div className="landing-feature-card" key={feature.title}>
                <div className="feature-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-workflow" id="workflow">
          <div className="landing-section-heading">
            <span>Workflow</span>
            <h2>From registration to printable clinical records.</h2>
          </div>

          <div className="workflow-steps">
            <div>
              <strong>01</strong>
              <h3>Register and manage users</h3>
              <p>
                Admins manage clinics, users, subscriptions, and access roles.
              </p>
            </div>

            <div>
              <strong>02</strong>
              <h3>Create dental records</h3>
              <p>Dentists create policy-based records for assigned patients.</p>
            </div>

            <div>
              <strong>03</strong>
              <h3>Record findings and X-rays</h3>
              <p>
                Use adult or child tooth charts, treatments, and X-ray
                annotations.
              </p>
            </div>

            <div>
              <strong>04</strong>
              <h3>Print reports</h3>
              <p>
                Generate tangible dental record summaries for documentation.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-section" id="plans">
          <div className="landing-section-heading">
            <span>Subscription Preview</span>
            <h2>Flexible plans for different clinic sizes.</h2>
            <p>
              Start with basic access, then upgrade clinic limits through
              subscription management and future payment gateway integration.
            </p>
          </div>

          <div className="landing-plan-grid">
            {plans.map((plan) => (
              <div className="landing-plan-card" key={plan.name}>
                <h3>{plan.name}</h3>

                <div className="plan-price">{plan.price}</div>

                <p>{plan.description}</p>

                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <h2>Ready to manage dental records digitally?</h2>
          <p>
            Access your dashboard or create an account to begin using
            DentoGraph.
          </p>

          <div className="landing-hero-actions center">
            <Link to="/auth/login" className="landing-primary-button">
              Login
            </Link>

            <Link to="/auth/register" className="landing-secondary-button">
              Register
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2026 DentoGraph. Digital Dental Record Management System.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
