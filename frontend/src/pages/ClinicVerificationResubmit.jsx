import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

const DOCUMENTS = [
  { key: "business_registration", label: "Business Registration" },
  {
    key: "business_permit",
    label: "Business / Mayor's Permit",
    hasExpiry: true,
  },
  {
    key: "owner_government_id",
    label: "Clinic Owner Government-Issued ID",
    hasExpiry: true,
  },
  { key: "clinic_license", label: "Clinic License" },
];

function ClinicVerificationResubmit() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [application, setApplication] = useState(null);
  const [files, setFiles] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const rejectedDocuments = useMemo(
    () =>
      DOCUMENTS.filter(
        ({ key }) =>
          application?.document_reviews?.[key]?.status === "Rejected",
      ),
    [application],
  );

  const checkApplication = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      setLoading(true);
      const response = await API.post(
        "/api/clinics/verification/resubmission-status",
        {
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        },
      );
      setApplication(response.data.application);
    } catch (err) {
      setApplication(null);
      setError(
        err.response?.data?.error || "Unable to load the rejected application.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitReplacementFiles = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (rejectedDocuments.some(({ key }) => !files[key])) {
      setError(
        "Replace every document marked as rejected before resubmitting.",
      );
      return;
    }
    try {
      setLoading(true);
      const payload = new FormData();
      payload.append("email", credentials.email.trim().toLowerCase());
      payload.append("password", credentials.password);
      rejectedDocuments.forEach(({ key, hasExpiry }) => {
        payload.append(key, files[key]);
        if (hasExpiry && expiryDates[key])
          payload.append(`${key}_expiration_date`, expiryDates[key]);
      });
      const response = await API.put(
        "/api/clinics/verification/resubmit",
        payload,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setMessage(
        response.data?.message || "Documents resubmitted successfully.",
      );
      setApplication((current) => ({
        ...current,
        verification_status: "Pending",
      }));
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to resubmit the verification documents.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Resubmit Clinic Documents"
      subtitle="Replace only the documents rejected by the Administrator."
    >
      <ThemeToggle />
      <Link to="/auth/login" className="auth-back-link">
        ← Back to Login
      </Link>
      {!application ? (
        <form className="auth-form" onSubmit={checkApplication}>
          {error && <div className="auth-error">{error}</div>}
          <AuthInput
            label="Clinic Owner Email"
            type="email"
            value={credentials.email}
            onChange={(e) =>
              setCredentials((c) => ({ ...c, email: e.target.value }))
            }
            required
          />
          <PasswordInput
            label="Password"
            value={credentials.password}
            onChange={(e) =>
              setCredentials((c) => ({ ...c, password: e.target.value }))
            }
            required
          />
          <button className="auth-button" disabled={loading}>
            {loading ? "Checking..." : "Check Rejected Documents"}
          </button>
        </form>
      ) : application.verification_status === "Pending" ? (
        <div className="auth-success">
          Your replacement documents are pending Administrator review.
        </div>
      ) : (
        <form className="auth-form" onSubmit={submitReplacementFiles}>
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}
          <div className="info-message">
            <strong>{application.clinic_name}</strong>
            <br />
            Upload a replacement for every rejected document below.
          </div>
          {rejectedDocuments.map(({ key, label, hasExpiry }) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <div className="error-message">
                {application.document_reviews[key]?.remark ||
                  "The Administrator requested a replacement."}
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  setFiles((c) => ({
                    ...c,
                    [key]: e.target.files?.[0] || null,
                  }))
                }
                required
              />
              {hasExpiry && (
                <input
                  type="date"
                  value={expiryDates[key] || ""}
                  onChange={(e) =>
                    setExpiryDates((c) => ({ ...c, [key]: e.target.value }))
                  }
                  required
                />
              )}
            </div>
          ))}
          <button className="auth-button" disabled={loading}>
            {loading ? "Resubmitting..." : "Resubmit Documents"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ClinicVerificationResubmit;
