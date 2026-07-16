import React, { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

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

function ClinicOwnerBranding() {
  const navigate = useNavigate();
  const logoInputRef = useRef(null);

  const [clinicLocations, setClinicLocations] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState(
    () => localStorage.getItem("clinicOwnerSelectedClinicId") || "",
  );

  const [brandingForm, setBrandingForm] = useState({
    brand_name: "",
    brand_logo_url: "",
    primary_color: "#2563EB",
    secondary_color: "#0F172A",
    welcome_message: "",
  });

  const [selectedLogoFile, setSelectedLogoFile] = useState(null);
  const [localLogoPreview, setLocalLogoPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedLocation = useMemo(() => {
    return (
      clinicLocations.find(
        (location) => String(location.clinic_id) === String(selectedClinicId),
      ) || null
    );
  }, [clinicLocations, selectedClinicId]);

  const displayedLogoUrl =
    localLogoPreview || resolveLogoUrl(brandingForm.brand_logo_url);

  useEffect(() => {
    fetchClinicLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      localStorage.setItem(
        "clinicOwnerSelectedClinicId",
        String(selectedClinicId),
      );
    }
  }, [selectedClinicId]);

  useEffect(() => {
    if (!selectedLocation) return;

    setBrandingForm({
      brand_name:
        selectedLocation.brand_name || selectedLocation.clinic_name || "",
      brand_logo_url: selectedLocation.brand_logo_url || "",
      primary_color: selectedLocation.primary_color || "#2563EB",
      secondary_color: selectedLocation.secondary_color || "#0F172A",
      welcome_message: selectedLocation.welcome_message || "",
    });

    setSelectedLogoFile(null);
    setLocalLogoPreview("");

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }

    setMessage("");
    setError("");
  }, [selectedLocation]);

  useEffect(() => {
    return () => {
      if (localLogoPreview) {
        URL.revokeObjectURL(localLogoPreview);
      }
    };
  }, [localLogoPreview]);

  const fetchClinicLocations = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/clinics/owner/locations");

      const locations =
        response.data.locations ||
        response.data.clinics ||
        response.data.clinic_locations ||
        [];

      setClinicLocations(locations);

      if (locations.length > 0) {
        setSelectedClinicId((currentId) => {
          const exists = locations.some(
            (location) => String(location.clinic_id) === String(currentId),
          );

          return exists ? String(currentId) : String(locations[0].clinic_id);
        });
      } else {
        setSelectedClinicId("");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic locations.");
      setClinicLocations([]);
      setSelectedClinicId("");
    } finally {
      setLoading(false);
    }
  };

  const updateLocationBrandingState = (updatedBranding) => {
    if (!updatedBranding) return;

    setClinicLocations((currentLocations) =>
      currentLocations.map((location) =>
        String(location.clinic_id) === String(selectedClinicId)
          ? { ...location, ...updatedBranding }
          : location,
      ),
    );

    setBrandingForm((currentForm) => ({
      ...currentForm,
      ...updatedBranding,
      brand_logo_url:
        updatedBranding.brand_logo_url ?? currentForm.brand_logo_url,
    }));

    window.dispatchEvent(
      new CustomEvent("dentograph-branding-updated", {
        detail: updatedBranding,
      }),
    );
  };

  const handleChange = (event) => {
    setMessage("");
    setError("");

    setBrandingForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleLogoSelection = (event) => {
    const file = event.target.files?.[0] || null;

    setMessage("");
    setError("");

    if (!file) {
      setSelectedLogoFile(null);
      setLocalLogoPreview("");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(file.type)) {
      event.target.value = "";
      setError("Please select a JPG, JPEG, PNG, WEBP, or SVG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      setError("Clinic logo must not exceed 5 MB.");
      return;
    }

    if (localLogoPreview) {
      URL.revokeObjectURL(localLogoPreview);
    }

    setSelectedLogoFile(file);
    setLocalLogoPreview(URL.createObjectURL(file));
  };

  const handleUploadLogo = async () => {
    if (!selectedClinicId) {
      setError("Please select a clinic location.");
      return;
    }

    if (!selectedLogoFile) {
      setError("Please choose a clinic logo first.");
      return;
    }

    const formData = new FormData();
    formData.append("logo", selectedLogoFile);

    try {
      setUploadingLogo(true);
      setMessage("");
      setError("");

      const response = await API.post(
        `/api/clinics/owner/locations/${selectedClinicId}/branding/logo`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const updatedBranding = response.data.branding || null;

      updateLocationBrandingState(updatedBranding);
      setSelectedLogoFile(null);
      setLocalLogoPreview("");

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }

      setMessage(response.data.message || "Clinic logo uploaded successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to upload clinic logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!selectedClinicId) {
      setError("Please select a clinic location.");
      return;
    }

    try {
      setRemovingLogo(true);
      setMessage("");
      setError("");

      const response = await API.delete(
        `/api/clinics/owner/locations/${selectedClinicId}/branding/logo`,
      );

      updateLocationBrandingState(response.data.branding || null);
      setBrandingForm((currentForm) => ({
        ...currentForm,
        brand_logo_url: "",
      }));
      setSelectedLogoFile(null);
      setLocalLogoPreview("");

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }

      setMessage(response.data.message || "Clinic logo removed successfully.");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to remove clinic logo.");
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!selectedClinicId) {
      setError("Please select a clinic location.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/clinics/owner/locations/${selectedClinicId}/branding`,
        {
          brand_name: brandingForm.brand_name,
          primary_color: brandingForm.primary_color,
          secondary_color: brandingForm.secondary_color,
          welcome_message: brandingForm.welcome_message,
        },
      );

      updateLocationBrandingState(response.data.branding || null);

      setMessage(
        response.data.message || "Clinic customization updated successfully.",
      );
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update clinic customization.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setBrandingForm((currentForm) => ({
      ...currentForm,
      brand_name: selectedLocation?.clinic_name || "",
      primary_color: "#2563EB",
      secondary_color: "#0F172A",
      welcome_message: "",
    }));

    setMessage("");
    setError("");
  };

  const busy = saving || uploadingLogo || removingLogo || loading;

  return (
    <DashboardLayout
      title="Clinic Customization"
      subtitle="Manage branding for each clinic location."
    >
      <div className="appointments-list-card clinic-branding-page">
        <div className="appointments-header">
          <div>
            <h2>Clinic Customization</h2>
            <p>
              Apply a clinic-specific name, logo, colors, and welcome message to
              assigned staff and patient dashboards.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/profile")}
              disabled={busy}
            >
              Back to Profile
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={fetchClinicLocations}
              disabled={busy}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Location</h2>
              <p>
                Choose which clinic location will receive these customization
                settings.
              </p>
            </div>
          </div>

          <div className="clinic-location-panel">
            <div className="clinic-location-grid">
              <div className="clinic-location-field">
                <label>Clinic Location</label>

                <select
                  value={selectedClinicId}
                  onChange={(event) => setSelectedClinicId(event.target.value)}
                  disabled={busy}
                >
                  {clinicLocations.length === 0 ? (
                    <option value="">No clinic locations available</option>
                  ) : (
                    clinicLocations.map((location) => (
                      <option
                        key={location.clinic_id}
                        value={location.clinic_id}
                      >
                        {location.clinic_name}
                        {location.status !== "Active"
                          ? ` (${location.status})`
                          : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="clinic-location-field">
                <label>Current Location</label>

                <div className="clinic-location-readonly">
                  {selectedLocation?.clinic_name || "No location selected"}
                </div>
              </div>
            </div>

            {selectedLocation && (
              <div className="clinic-location-note">
                Changes apply only to{" "}
                <strong>{selectedLocation.clinic_name}</strong>.
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <h3>Loading customization settings...</h3>
          </div>
        ) : !selectedLocation ? (
          <div className="empty-state">
            <h3>No clinic location selected</h3>
            <p>Add or select a clinic location before customizing it.</p>
          </div>
        ) : (
          <form className="clinic-branding-form" onSubmit={handleSave}>
            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Brand Identity</h2>
                  <p>
                    Set the name and logo displayed in the dashboard header.
                  </p>
                </div>
              </div>

              <div className="clinic-branding-form-grid">
                <div className="clinic-branding-field">
                  <label htmlFor="brand_name">Brand Display Name</label>

                  <input
                    id="brand_name"
                    type="text"
                    name="brand_name"
                    value={brandingForm.brand_name}
                    onChange={handleChange}
                    placeholder={selectedLocation.clinic_name}
                    disabled={busy}
                  />
                </div>

                <div className="clinic-branding-logo-card">
                  <div className="clinic-branding-logo-preview-box">
                    {displayedLogoUrl ? (
                      <img
                        src={displayedLogoUrl}
                        alt="Clinic logo preview"
                        className="clinic-branding-logo-preview"
                      />
                    ) : (
                      <span>No logo uploaded</span>
                    )}
                  </div>

                  <div className="clinic-branding-logo-controls">
                    <label htmlFor="clinic-logo">Clinic Logo</label>

                    <input
                      ref={logoInputRef}
                      id="clinic-logo"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleLogoSelection}
                      disabled={busy}
                    />

                    <p className="muted-text">
                      JPG, JPEG, PNG, WEBP, or SVG. Maximum size: 5 MB.
                    </p>

                    <div
                      className="appointment-actions"
                      style={{ flexDirection: "row" }}
                    >
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleUploadLogo}
                        disabled={busy || !selectedLogoFile}
                      >
                        {uploadingLogo ? "Uploading..." : "Upload Logo"}
                      </button>

                      {brandingForm.brand_logo_url && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={handleRemoveLogo}
                          disabled={busy}
                        >
                          {removingLogo ? "Removing..." : "Remove Logo"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Brand Colors</h2>
                  <p>
                    Choose colors used by branded buttons, highlights, and
                    welcome elements.
                  </p>
                </div>
              </div>

              <div className="clinic-branding-form-grid">
                <div className="clinic-branding-field">
                  <label htmlFor="primary_color">Primary Brand Color</label>

                  <div className="branding-color-field">
                    <input
                      id="primary_color_picker"
                      type="color"
                      name="primary_color"
                      value={brandingForm.primary_color}
                      onChange={handleChange}
                      disabled={busy}
                    />

                    <input
                      id="primary_color"
                      type="text"
                      name="primary_color"
                      value={brandingForm.primary_color}
                      onChange={handleChange}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="clinic-branding-field">
                  <label htmlFor="secondary_color">Secondary Brand Color</label>

                  <div className="branding-color-field">
                    <input
                      id="secondary_color_picker"
                      type="color"
                      name="secondary_color"
                      value={brandingForm.secondary_color}
                      onChange={handleChange}
                      disabled={busy}
                    />

                    <input
                      id="secondary_color"
                      type="text"
                      name="secondary_color"
                      value={brandingForm.secondary_color}
                      onChange={handleChange}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      disabled={busy}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Welcome Message</h2>
                  <p>Add a short message displayed above dashboard content.</p>
                </div>
              </div>

              <div className="clinic-branding-field">
                <label htmlFor="welcome_message">Welcome Message</label>

                <textarea
                  id="welcome_message"
                  name="welcome_message"
                  value={brandingForm.welcome_message}
                  onChange={handleChange}
                  placeholder="Welcome to our digital dental care portal."
                  rows="4"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Preview</h2>
                  <p>Review the clinic branding before saving.</p>
                </div>
              </div>

              <div
                className="clinic-branding-preview"
                style={{
                  "--preview-primary": brandingForm.primary_color,
                  "--preview-secondary": brandingForm.secondary_color,
                }}
              >
                {displayedLogoUrl && (
                  <img
                    src={displayedLogoUrl}
                    alt="Clinic branding preview"
                    className="clinic-branding-preview-logo"
                  />
                )}

                <div>
                  <strong>
                    {brandingForm.brand_name || selectedLocation.clinic_name}
                  </strong>

                  <p>
                    {brandingForm.welcome_message ||
                      "Your clinic welcome message will appear here."}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="appointment-actions clinic-branding-save-actions"
              style={{ flexDirection: "row" }}
            >
              <button type="submit" className="primary-button" disabled={busy}>
                {saving ? "Saving..." : "Save Customization"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={resetForm}
                disabled={busy}
              >
                Reset Colors and Message
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerBranding;
