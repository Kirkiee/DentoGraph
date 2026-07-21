import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

const DOCUMENTS = [
  {
    key: "business_registration",
    label: "Business Registration",
    hasExpiry: false,
  },
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
  {
    key: "clinic_license",
    label: "Clinic License",
    hasExpiry: false,
  },
];

const ACCEPTED_FILE_TYPES =
  ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

const getTodayDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000)
    .toISOString()
    .split("T")[0];
};

function ClinicVerificationResubmit() {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const [application, setApplication] = useState(null);
  const [files, setFiles] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const rejectedDocuments = useMemo(() => {
    return DOCUMENTS.filter(
      ({ key }) => application?.document_reviews?.[key]?.status === "Rejected",
    );
  }, [application]);

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const handleCredentialChange = (event) => {
    const { name, value } = event.target;

    setCredentials((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleFileChange = (documentKey, selectedFile) => {
    setFiles((current) => ({
      ...current,
      [documentKey]: selectedFile || null,
    }));
  };

  const handleExpiryDateChange = (documentKey, value) => {
    setExpiryDates((current) => ({
      ...current,
      [documentKey]: value,
    }));
  };

  const checkApplication = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!credentials.email.trim() || !credentials.password) {
      setError("Enter the clinic owner email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post(
        "/api/clinics/verification/resubmission-status",
        {
          email: credentials.email.trim().toLowerCase(),
          password: credentials.password,
        },
      );

      const loadedApplication = response.data?.application;

      if (!loadedApplication) {
        throw new Error("The clinic application could not be loaded.");
      }

      setApplication(loadedApplication);
      setFiles({});
      setExpiryDates({});
    } catch (requestError) {
      setApplication(null);
      setError(
        requestError.response?.data?.error ||
          requestError.message ||
          "Unable to load the rejected clinic application.",
      );
    } finally {
      setLoading(false);
    }
  };

  const validateReplacementFiles = () => {
    if (rejectedDocuments.length === 0) {
      return "No rejected documents are available for resubmission.";
    }

    for (const document of rejectedDocuments) {
      const selectedFile = files[document.key];

      if (!selectedFile) {
        return `Select a replacement file for ${document.label}.`;
      }

      if (
        document.hasExpiry &&
        !String(expiryDates[document.key] || "").trim()
      ) {
        return `Enter the expiration date for ${document.label}.`;
      }

      if (document.hasExpiry && expiryDates[document.key] < getTodayDate()) {
        return `The expiration date for ${document.label} cannot be in the past.`;
      }
    }

    return "";
  };

  const submitReplacementFiles = async (event) => {
    event.preventDefault();
    resetMessages();

    const validationError = validateReplacementFiles();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const payload = new FormData();

      payload.append("email", credentials.email.trim().toLowerCase());
      payload.append("password", credentials.password);

      rejectedDocuments.forEach(({ key, hasExpiry }) => {
        payload.append(key, files[key]);

        if (hasExpiry) {
          payload.append(`${key}_expiration_date`, expiryDates[key]);
        }
      });

      const response = await API.put(
        "/api/clinics/verification/resubmit",
        payload,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessage(
        response.data?.message ||
          "Documents resubmitted successfully. Your application is now pending review.",
      );

      setApplication((current) => ({
        ...current,
        verification_status: "Pending",
      }));

      setFiles({});
      setExpiryDates({});
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          "Unable to resubmit the verification documents.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clinic-verification-resubmit-page">
      <AuthLayout
        title="Resubmit Clinic Documents"
        subtitle="Replace only the documents rejected by the Administrator."
      >
        <ThemeToggle />

        <Link to="/auth/login" className="clinic-resubmit-back-link">
          ← Back to Login
        </Link>

        {!application ? (
          <form className="auth-form" onSubmit={checkApplication}>
            {error && (
              <div className="clinic-resubmit-error" role="alert">
                {error}
              </div>
            )}

            <AuthInput
              label="Clinic Owner Email"
              name="email"
              type="email"
              value={credentials.email}
              onChange={handleCredentialChange}
              autoComplete="email"
              required
            />

            <PasswordInput
              label="Password"
              name="password"
              value={credentials.password}
              onChange={handleCredentialChange}
              autoComplete="current-password"
              required
            />

            <button
              type="submit"
              className="clinic-resubmit-submit-button"
              disabled={loading}
            >
              {loading ? "Checking..." : "Check Rejected Documents"}
            </button>
          </form>
        ) : application.verification_status === "Pending" ? (
          <div className="clinic-resubmit-success" role="status">
            Your replacement documents were submitted successfully and are
            pending Administrator review.
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={submitReplacementFiles}
            encType="multipart/form-data"
          >
            {error && (
              <div className="clinic-resubmit-error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="clinic-resubmit-success" role="status">
                {message}
              </div>
            )}

            <div className="clinic-resubmit-clinic-info">
              <strong>{application.clinic_name}</strong>
              <p>Upload a replacement for every rejected document below.</p>
            </div>

            <div className="clinic-resubmit-documents">
              {rejectedDocuments.map(({ key, label, hasExpiry }) => {
                const remark =
                  application.document_reviews?.[key]?.remark ||
                  "The Administrator requested a replacement.";

                return (
                  <section className="clinic-resubmit-document" key={key}>
                    <label
                      className="clinic-resubmit-document-title"
                      htmlFor={`${key}-file`}
                    >
                      {label}
                    </label>

                    <div className="clinic-resubmit-remark">
                      <strong>Administrator remark:</strong> {remark}
                    </div>

                    <div className="clinic-resubmit-file-row">
                      <div className="clinic-resubmit-upload-field">
                        <label htmlFor={`${key}-file`}>Replacement file</label>

                        <input
                          id={`${key}-file`}
                          name={key}
                          type="file"
                          accept={ACCEPTED_FILE_TYPES}
                          onChange={(event) =>
                            handleFileChange(key, event.target.files?.[0])
                          }
                          required
                        />

                        {files[key]?.name && (
                          <span className="clinic-resubmit-selected-file">
                            Selected: {files[key].name}
                          </span>
                        )}
                      </div>

                      {hasExpiry && (
                        <div className="clinic-resubmit-date-field">
                          <label htmlFor={`${key}-expiration-date`}>
                            Expiration date
                          </label>

                          <input
                            id={`${key}-expiration-date`}
                            name={`${key}_expiration_date`}
                            type="date"
                            min={getTodayDate()}
                            value={expiryDates[key] || ""}
                            onChange={(event) =>
                              handleExpiryDateChange(key, event.target.value)
                            }
                            required
                          />
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            <button
              type="submit"
              className="clinic-resubmit-submit-button"
              disabled={loading}
            >
              {loading ? "Resubmitting..." : "Resubmit Documents"}
            </button>
          </form>
        )}
      </AuthLayout>
    </div>
  );
}

export default ClinicVerificationResubmit;
