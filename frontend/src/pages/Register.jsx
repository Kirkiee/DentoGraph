import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import PhilippineAddressSelector from "../components/PhilippineAddressSelector";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/registerClinicLocator.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_MAP_CENTER = [14.5995, 120.9842];
const NEARBY_RADIUS_KM = 25;

const CLINIC_COORDINATE_FALLBACKS = {
  7: {
    latitude: 14.5828936,
    longitude: 121.1756235,
  },
  10: {
    latitude: 14.2892997,
    longitude: 121.4573182,
  },
};

const getClinicLatitude = (clinic) => {
  if (!clinic) return null;

  const clinicId = Number(clinic.clinic_id);
  const fallbackLatitude =
    CLINIC_COORDINATE_FALLBACKS[clinicId]?.latitude ?? null;

  const rawValue =
    clinic.latitude ??
    clinic.lat ??
    clinic.clinic_latitude ??
    clinic.location_latitude ??
    clinic.map_latitude ??
    fallbackLatitude;

  if (
    rawValue === null ||
    rawValue === undefined ||
    String(rawValue).trim() === ""
  ) {
    return null;
  }

  const latitude = parseFloat(String(rawValue).trim());

  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    ? latitude
    : fallbackLatitude;
};

const getClinicLongitude = (clinic) => {
  if (!clinic) return null;

  const clinicId = Number(clinic.clinic_id);
  const fallbackLongitude =
    CLINIC_COORDINATE_FALLBACKS[clinicId]?.longitude ?? null;

  const rawValue =
    clinic.longitude ??
    clinic.lng ??
    clinic.lon ??
    clinic.clinic_longitude ??
    clinic.location_longitude ??
    clinic.map_longitude ??
    fallbackLongitude;

  if (
    rawValue === null ||
    rawValue === undefined ||
    String(rawValue).trim() === ""
  ) {
    return null;
  }

  const longitude = parseFloat(String(rawValue).trim());

  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? longitude
    : fallbackLongitude;
};

const getClinicServices = (clinic) => {
  if (Array.isArray(clinic?.services)) {
    return clinic.services
      .map((service) => String(service).trim())
      .filter(Boolean);
  }

  if (typeof clinic?.services === "string") {
    const trimmed = clinic.services.trim();

    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.map((service) => String(service).trim()).filter(Boolean);
      }
    } catch {
      // Continue with comma-separated parsing.
    }

    return trimmed
      .split(",")
      .map((service) => service.trim())
      .filter(Boolean);
  }

  return [];
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const deltaLatitude = toRadians(lat2 - lat1);
  const deltaLongitude = toRadians(lon2 - lon1);

  const calculation =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation))
  );
};

function RegistrationMapController({
  selectedClinic,
  userLocation,
  markerClinics,
}) {
  const map = useMap();

  useEffect(() => {
    const selectedLatitude = getClinicLatitude(selectedClinic);
    const selectedLongitude = getClinicLongitude(selectedClinic);

    if (selectedLatitude !== null && selectedLongitude !== null) {
      map.setView([selectedLatitude, selectedLongitude], 14);
      return;
    }

    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 12);
      return;
    }

    const markerPositions = markerClinics
      .map((clinic) => {
        const latitude = getClinicLatitude(clinic);
        const longitude = getClinicLongitude(clinic);

        return latitude !== null && longitude !== null
          ? [latitude, longitude]
          : null;
      })
      .filter(Boolean);

    if (markerPositions.length === 1) {
      map.setView(markerPositions[0], 13);
    } else if (markerPositions.length > 1) {
      map.fitBounds(markerPositions, {
        padding: [28, 28],
        maxZoom: 13,
      });
    } else {
      map.setView(DEFAULT_MAP_CENTER, 11);
    }
  }, [selectedClinic, userLocation, markerClinics, map]);

  return null;
}

function Register() {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);

  // Public registration should only create Patient accounts.
  // Make sure this matches the Patient role_id in your roles table.
  const PATIENT_ROLE_ID = 3;

  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    email: "",
    contact_number: "",
    house_unit_number: "",
    street_name: "",
    subdivision: "",
    region_designation: "",
    region: "",
    province: "",
    city_municipality: "",
    barangay: "",
    barangay_code: "",
    postal_code: "",
    country: "Philippines",
    clinic_id: "",
    password: "",
    confirmPassword: "",
  });

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicSearch, setClinicSearch] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [agree, setAgree] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [error, setError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);
      setError("");

      const response = await API.get("/api/clinics/public/list");

      let clinicList = [];

      if (Array.isArray(response.data)) {
        clinicList = response.data;
      } else if (Array.isArray(response.data?.clinics)) {
        clinicList = response.data.clinics;
      } else if (Array.isArray(response.data?.data)) {
        clinicList = response.data.data;
      }

      const normalizedClinics = clinicList.map((clinic) => {
        const clinicId = Number(clinic.clinic_id);
        const fallback = CLINIC_COORDINATE_FALLBACKS[clinicId] || {};

        const latitude = parseFloat(
          String(
            clinic.latitude ??
              clinic.lat ??
              clinic.clinic_latitude ??
              clinic.location_latitude ??
              clinic.map_latitude ??
              fallback.latitude ??
              "",
          ).trim(),
        );

        const longitude = parseFloat(
          String(
            clinic.longitude ??
              clinic.lng ??
              clinic.lon ??
              clinic.clinic_longitude ??
              clinic.location_longitude ??
              clinic.map_longitude ??
              fallback.longitude ??
              "",
          ).trim(),
        );

        return {
          ...clinic,
          clinic_id: clinicId,
          latitude: Number.isFinite(latitude)
            ? latitude
            : (fallback.latitude ?? null),
          longitude: Number.isFinite(longitude)
            ? longitude
            : (fallback.longitude ?? null),
          services: getClinicServices(clinic),
        };
      });

      setClinics(normalizedClinics);
    } catch (err) {
      console.error("Fetch public clinics error:", err);
      setClinics([]);
      setError(
        err.response?.data?.error ||
          "Unable to load clinic locations. Please refresh and try again.",
      );
    } finally {
      setLoadingClinics(false);
    }
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  };

  const validatePasswordStrength = (password) => {
    const value = String(password || "");

    if (value.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (!/[A-Z]/.test(value)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(value)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(value)) {
      return "Password must contain at least one number.";
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      return "Password must contain at least one special character.";
    }

    return null;
  };

  const cleanPhoneNumber = (value) => {
    return String(value || "").trim();
  };

  const resetTurnstile = () => {
    setTurnstileToken("");

    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const handleChange = (e) => {
    setError("");
    setPasswordRules([]);
    setSuccess("");

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      email: "",
      contact_number: "",
      house_unit_number: "",
      street_name: "",
      subdivision: "",
      barangay: "",
      city_municipality: "",
      province: "",
      region: "",
      postal_code: "",
      country: "Philippines",
      clinic_id: "",
      password: "",
      confirmPassword: "",
    });

    setAgree(false);
    resetTurnstile();
  };

  const selectedClinic = clinics.find(
    (clinic) => Number(clinic.clinic_id) === Number(formData.clinic_id),
  );

  const activeClinics = useMemo(() => {
    return clinics.filter(
      (clinic) =>
        String(clinic.status || "Active").toLowerCase() !== "inactive",
    );
  }, [clinics]);

  const availableServiceOptions = useMemo(() => {
    const uniqueServices = new Set();

    activeClinics.forEach((clinic) => {
      getClinicServices(clinic).forEach((service) => {
        const cleanedService = String(service || "").trim();

        if (cleanedService) {
          uniqueServices.add(cleanedService);
        }
      });
    });

    return Array.from(uniqueServices).sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" }),
    );
  }, [activeClinics]);

  const searchableClinics = useMemo(() => {
    const term = clinicSearch.trim().toLowerCase();
    const selectedServiceValue = selectedService.trim().toLowerCase();

    return activeClinics.filter((clinic) => {
      const clinicName = String(clinic.clinic_name || "").toLowerCase();
      const address = String(clinic.address || "").toLowerCase();
      const services = getClinicServices(clinic);
      const servicesText = services.join(" ").toLowerCase();

      const matchesTextSearch =
        !term ||
        clinicName.includes(term) ||
        address.includes(term) ||
        servicesText.includes(term);

      const matchesSelectedService =
        !selectedServiceValue ||
        services.some(
          (service) =>
            String(service || "")
              .trim()
              .toLowerCase() === selectedServiceValue,
        );

      return matchesTextSearch && matchesSelectedService;
    });
  }, [activeClinics, clinicSearch, selectedService]);

  const markerClinics = useMemo(() => {
    return searchableClinics.filter((clinic) => {
      return (
        getClinicLatitude(clinic) !== null &&
        getClinicLongitude(clinic) !== null
      );
    });
  }, [searchableClinics]);

  const nearbyClinics = useMemo(() => {
    if (!userLocation) return [];

    return activeClinics
      .map((clinic) => {
        const latitude = getClinicLatitude(clinic);
        const longitude = getClinicLongitude(clinic);

        if (latitude === null || longitude === null) return null;

        return {
          ...clinic,
          distanceKm: calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            latitude,
            longitude,
          ),
        };
      })
      .filter(Boolean)
      .filter((clinic) => clinic.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [activeClinics, userLocation]);

  const serviceSuggestedClinics = useMemo(() => {
    const selectedServiceValue = selectedService.trim().toLowerCase();

    const clinicsWithServices = activeClinics.filter(
      (clinic) => getClinicServices(clinic).length > 0,
    );

    if (!selectedServiceValue) {
      return clinicsWithServices;
    }

    return clinicsWithServices.filter((clinic) =>
      getClinicServices(clinic).some(
        (service) =>
          String(service || "")
            .trim()
            .toLowerCase() === selectedServiceValue,
      ),
    );
  }, [activeClinics, selectedService]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setGettingLocation(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGettingLocation(false);
      },
      () => {
        setError(
          "Unable to get your current location. You can still search and select a clinic manually.",
        );
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const selectClinic = (clinicId) => {
    setFormData((prev) => ({
      ...prev,
      clinic_id: String(clinicId),
    }));
    setError("");
    setSuccess("");
  };

  const mapCenter = (() => {
    const selectedLatitude = getClinicLatitude(selectedClinic);
    const selectedLongitude = getClinicLongitude(selectedClinic);

    if (selectedLatitude !== null && selectedLongitude !== null) {
      return [selectedLatitude, selectedLongitude];
    }

    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude];
    }

    if (markerClinics.length > 0) {
      return [
        getClinicLatitude(markerClinics[0]),
        getClinicLongitude(markerClinics[0]),
      ];
    }

    return DEFAULT_MAP_CENTER;
  })();

  const handleAddressSelectionChange = (updates) => {
    setFormData((current) => ({
      ...current,
      ...updates,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setPasswordRules([]);
    setSuccess("");

    const clean = (value) =>
      String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");

    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ.' -]+$/;
    const addressRegex = /^[A-Za-z0-9À-ÖØ-öø-ÿÑñ.,'#/() -]+$/;
    const phoneRegex = /^(09\d{9}|\+639\d{9})$/;
    const postalCodeRegex = /^\d{4}$/;

    const firstName = clean(formData.firstName);
    const middleName = clean(formData.middleName);
    const lastName = clean(formData.lastName);
    const suffix = clean(formData.suffix);
    const cleanEmail = clean(formData.email).toLowerCase();
    const contactNumber = cleanPhoneNumber(formData.contact_number);
    const houseUnitNumber = clean(formData.house_unit_number);
    const streetName = clean(formData.street_name);
    const subdivision = clean(formData.subdivision);
    const regionDesignation = clean(formData.region_designation);
    const region = clean(formData.region);
    const province = clean(formData.province);
    const cityMunicipality = clean(formData.city_municipality);
    const barangay = clean(formData.barangay);
    const barangayCode = clean(formData.barangay_code);
    const postalCode = clean(formData.postal_code);
    const country = clean(formData.country) || "Philippines";
    const clinicId = formData.clinic_id;
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    const nameFields = [
      ["First name", firstName, true, 50],
      ["Middle name", middleName, false, 50],
      ["Last name", lastName, true, 50],
    ];

    for (const [label, value, required, maxLength] of nameFields) {
      if (required && !value) {
        setError(`${label} is required.`);
        return;
      }

      if (value && value.length > maxLength) {
        setError(`${label} must not exceed ${maxLength} characters.`);
        return;
      }

      if (value && !nameRegex.test(value)) {
        setError(
          `${label} may only contain letters, spaces, apostrophes, periods, and hyphens.`,
        );
        return;
      }
    }

    const allowedSuffixes = ["", "Jr.", "Sr.", "II", "III", "IV", "V"];

    if (!allowedSuffixes.includes(suffix)) {
      setError("Please select a valid suffix.");
      return;
    }

    if (!cleanEmail) {
      setError("Email address is required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (contactNumber && !phoneRegex.test(contactNumber)) {
      setError("Phone number must use 09XXXXXXXXX or +639XXXXXXXXX format.");
      return;
    }

    const optionalAddressFields = [
      ["House or unit number", houseUnitNumber, 30],
      ["Street name", streetName, 100],
      ["Subdivision or village", subdivision, 100],
    ];

    for (const [label, value, maxLength] of optionalAddressFields) {
      if (value && value.length > maxLength) {
        setError(`${label} must not exceed ${maxLength} characters.`);
        return;
      }

      if (value && !addressRegex.test(value)) {
        setError(`${label} contains invalid characters.`);
        return;
      }
    }

    const requiredAddressSelections = [
      ["Region", regionDesignation, region],
      ["Province", province, province],
      ["City or municipality", cityMunicipality, cityMunicipality],
      ["Barangay", barangay, barangay],
    ];

    for (const [label, identifier, displayName] of requiredAddressSelections) {
      if (!identifier || !displayName) {
        setError(`Please select a valid ${label.toLowerCase()}.`);
        return;
      }
    }

    if (!postalCodeRegex.test(postalCode)) {
      setError("Postal code must contain exactly four digits.");
      return;
    }

    if (!clinicId) {
      setError("Please select the clinic you are registering under.");
      return;
    }

    const passwordError = validatePasswordStrength(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agree) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/api/users/register", {
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: suffix || null,
        email: cleanEmail,
        password,
        role_id: PATIENT_ROLE_ID,
        clinic_id: Number(clinicId),
        contact_number: contactNumber || null,
        house_unit_number: houseUnitNumber || null,
        street_name: streetName || null,
        subdivision: subdivision || null,
        region_designation: regionDesignation,
        region,
        province,
        city_municipality: cityMunicipality,
        barangay,
        barangay_code: barangayCode || null,
        postal_code: postalCode,
        country,
        turnstileToken,
      });

      setSuccess(
        response.data?.message ||
          "Patient account created successfully. Please check your email to verify your account.",
      );

      resetForm();
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data || {};
      const apiError = responseData.error;
      const apiPasswordRules = responseData.password_rules;
      const fieldErrors = responseData.fields;

      if (Array.isArray(apiPasswordRules)) {
        setPasswordRules(apiPasswordRules);
      }

      if (fieldErrors && typeof fieldErrors === "object") {
        const firstFieldError = Object.values(fieldErrors).find(Boolean);
        setError(
          firstFieldError || apiError || "Please correct the invalid fields.",
        );
      } else if (status === 429) {
        setError("Too many registration attempts. Please try again later.");
      } else if (status === 403) {
        setError(
          apiError ||
            "Public registration is only allowed for patient accounts.",
        );
      } else if (status === 400 && responseData.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else if (status === 400) {
        setError(apiError || "Please check your registration details.");
      } else {
        setError(apiError || "Registration failed. Please try again.");
      }

      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Patient Account"
      subtitle="Register under your selected clinic location workspace"
      wide
    >
      <ThemeToggle />

      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}

      {passwordRules.length > 0 && (
        <div className="auth-error">
          <strong>Password must follow these rules:</strong>
          <ul>
            {passwordRules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {success && <div className="auth-success">{success}</div>}

      {!success && (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-required-note">
            Fields marked with <span>*</span> are required.
          </div>

          <div className="auth-row">
            <AuthInput
              label="First Name"
              name="firstName"
              placeholder="Juan"
              value={formData.firstName}
              onChange={handleChange}
              icon="👤"
              autoComplete="given-name"
              maxLength={50}
              disabled={loading}
              required
            />

            <AuthInput
              label="Middle Name"
              name="middleName"
              placeholder="Santos"
              value={formData.middleName}
              onChange={handleChange}
              autoComplete="additional-name"
              maxLength={50}
              disabled={loading}
            />
          </div>

          <div className="auth-row">
            <AuthInput
              label="Last Name"
              name="lastName"
              placeholder="Dela Cruz"
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              maxLength={50}
              disabled={loading}
              required
            />

            <div className="auth-field">
              <label htmlFor="suffix">Suffix</label>
              <select
                id="suffix"
                name="suffix"
                className="auth-input"
                value={formData.suffix}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">None</option>
                <option value="Jr.">Jr.</option>
                <option value="Sr.">Sr.</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
              </select>
            </div>
          </div>

          <AuthInput
            label="Email Address"
            type="email"
            name="email"
            placeholder="juan@example.com"
            value={formData.email}
            onChange={handleChange}
            icon="✉"
            autoComplete="email"
            disabled={loading}
            required
          />

          <AuthInput
            label="Phone Number"
            type="tel"
            name="contact_number"
            placeholder="09123456789"
            value={formData.contact_number}
            onChange={handleChange}
            icon="☎"
            required={false}
            autoComplete="tel"
            disabled={loading}
          />

          <div className="auth-section-heading">
            <h3>Residential Address</h3>
            <p>Enter each part of your address in its proper field.</p>
          </div>

          <div className="auth-row">
            <AuthInput
              label="House/Unit Number"
              name="house_unit_number"
              placeholder="Unit 2B or 123"
              value={formData.house_unit_number}
              onChange={handleChange}
              maxLength={30}
              disabled={loading}
            />

            <AuthInput
              label="Street Name"
              name="street_name"
              placeholder="Rizal Street"
              value={formData.street_name}
              onChange={handleChange}
              maxLength={100}
              disabled={loading}
            />
          </div>

          <AuthInput
            label="Subdivision/Village"
            name="subdivision"
            placeholder="Sample Village"
            value={formData.subdivision}
            onChange={handleChange}
            maxLength={100}
            disabled={loading}
          />

          <PhilippineAddressSelector
            value={{
              region_designation: formData.region_designation,
              region: formData.region,
              province: formData.province,
              city_municipality: formData.city_municipality,
              barangay: formData.barangay,
              barangay_code: formData.barangay_code,
            }}
            onChange={handleAddressSelectionChange}
            disabled={loading}
          />

          <div className="auth-row">
            <AuthInput
              label="Postal Code"
              name="postal_code"
              placeholder="1100"
              value={formData.postal_code}
              onChange={(event) => {
                const digitsOnly = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4);
                handleChange({
                  target: {
                    name: "postal_code",
                    value: digitsOnly,
                  },
                });
              }}
              inputMode="numeric"
              maxLength={4}
              disabled={loading}
              required
            />

            <AuthInput
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              maxLength={50}
              disabled
              required
            />
          </div>

          <div className="registration-clinic-locator">
            <div className="registration-clinic-header">
              <div>
                <h3>Select Your Clinic Location</h3>
                <p>
                  Choose the clinic where your appointments and dental records
                  will be managed.
                </p>
              </div>

              <button
                type="button"
                className="registration-location-button"
                onClick={getCurrentLocation}
                disabled={gettingLocation || loadingClinics || loading}
              >
                {gettingLocation ? "Detecting..." : "Use My Location"}
              </button>
            </div>

            {selectedClinic ? (
              <div
                className="registration-selected-clinic-banner"
                role="status"
                aria-live="polite"
              >
                <div className="registration-selected-clinic-icon">✓</div>

                <div className="registration-selected-clinic-content">
                  <span className="registration-selected-clinic-label">
                    Currently Selected Clinic
                  </span>
                  <strong>{selectedClinic.clinic_name}</strong>
                  <small>
                    {selectedClinic.address || "No address provided"}
                  </small>
                </div>

                <button
                  type="button"
                  className="registration-change-clinic-button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      clinic_id: "",
                    }));
                  }}
                  disabled={loading}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="registration-selected-clinic-empty">
                No clinic selected yet. Choose one from the map or clinic lists
                below.
              </div>
            )}

            <div className="registration-clinic-filter-grid">
              <div className="auth-field">
                <label htmlFor="clinic-search">Search Clinic or Location</label>
                <input
                  id="clinic-search"
                  type="search"
                  className="auth-input"
                  placeholder="Search clinic name, city, or address"
                  value={clinicSearch}
                  onChange={(event) => setClinicSearch(event.target.value)}
                  disabled={loadingClinics || loading}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="clinic-service-filter">
                  Select a Service Offered
                </label>
                <select
                  id="clinic-service-filter"
                  className="auth-input registration-service-select"
                  value={selectedService}
                  onChange={(event) => setSelectedService(event.target.value)}
                  disabled={loadingClinics || loading}
                >
                  <option value="">All Available Services</option>

                  {availableServiceOptions.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>

                <small className="registration-service-filter-note">
                  {availableServiceOptions.length > 0
                    ? "This list only shows services currently offered by active registered clinics."
                    : "No clinic services are available yet. You may still search and select a clinic location."}
                </small>
              </div>
            </div>

            <div className="registration-clinic-map">
              <MapContainer
                center={mapCenter}
                zoom={selectedClinic ? 14 : 11}
                scrollWheelZoom
                className="registration-leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <RegistrationMapController
                  selectedClinic={selectedClinic}
                  userLocation={userLocation}
                  markerClinics={markerClinics}
                />

                {markerClinics.map((clinic) => {
                  const latitude = getClinicLatitude(clinic);
                  const longitude = getClinicLongitude(clinic);
                  const distanceKm = userLocation
                    ? calculateDistanceKm(
                        userLocation.latitude,
                        userLocation.longitude,
                        latitude,
                        longitude,
                      )
                    : null;

                  return (
                    <Marker
                      key={clinic.clinic_id}
                      position={[latitude, longitude]}
                      eventHandlers={{
                        click: () => selectClinic(clinic.clinic_id),
                      }}
                    >
                      <Popup>
                        <strong>{clinic.clinic_name}</strong>
                        <br />
                        {clinic.address || "No address provided"}

                        {distanceKm !== null && (
                          <>
                            <br />
                            {distanceKm.toFixed(2)} km away
                          </>
                        )}

                        <br />

                        <button
                          type="button"
                          className="registration-popup-select"
                          onClick={() => selectClinic(clinic.clinic_id)}
                        >
                          Select this clinic
                        </button>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            <div className="registration-clinic-suggestions">
              <section className="registration-suggestion-section">
                <div className="registration-suggestion-heading">
                  <h4>1. Nearby Clinics</h4>
                  <p>
                    {userLocation
                      ? `Clinics within ${NEARBY_RADIUS_KM} km are ordered from nearest to farthest.`
                      : 'Select "Use My Location" to view nearby clinic suggestions.'}
                  </p>
                </div>

                {loadingClinics ? (
                  <div className="auth-note">Loading clinic locations...</div>
                ) : !userLocation ? (
                  <div className="auth-note">
                    Location access has not been enabled.
                  </div>
                ) : nearbyClinics.length === 0 ? (
                  <div className="auth-note">
                    No clinic is available within the nearby distance.
                  </div>
                ) : (
                  <div className="registration-clinic-list">
                    {nearbyClinics.map((clinic) => {
                      const isSelected =
                        Number(formData.clinic_id) === Number(clinic.clinic_id);

                      return (
                        <button
                          key={`nearby-${clinic.clinic_id}`}
                          type="button"
                          className={
                            isSelected
                              ? "registration-clinic-option selected"
                              : "registration-clinic-option"
                          }
                          onClick={() => selectClinic(clinic.clinic_id)}
                          disabled={loading}
                        >
                          <span className="registration-clinic-option-main">
                            <strong>{clinic.clinic_name}</strong>
                            <small>
                              {clinic.address || "No address provided"}
                            </small>
                            <small>
                              {clinic.distanceKm.toFixed(2)} km away
                            </small>
                          </span>

                          <span className="registration-clinic-select-label">
                            {isSelected ? "Selected" : "Select"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="registration-suggestion-section">
                <div className="registration-suggestion-heading">
                  <h4>2. Services Available</h4>
                  <p>
                    Select a service from the list above to view clinics that
                    currently offer it.
                  </p>
                </div>

                {loadingClinics ? (
                  <div className="auth-note">Loading clinic services...</div>
                ) : serviceSuggestedClinics.length === 0 ? (
                  <div className="auth-note">
                    {selectedService
                      ? `No active clinic currently offers ${selectedService}.`
                      : "No clinic services have been listed yet."}
                  </div>
                ) : (
                  <>
                    {selectedService && (
                      <div className="registration-selected-service-banner">
                        Showing clinics offering:{" "}
                        <strong>{selectedService}</strong>
                      </div>
                    )}

                    <div className="registration-clinic-list">
                      {serviceSuggestedClinics.map((clinic) => {
                        const isSelected =
                          Number(formData.clinic_id) ===
                          Number(clinic.clinic_id);
                        const services = getClinicServices(clinic);

                        return (
                          <button
                            key={`service-${clinic.clinic_id}`}
                            type="button"
                            className={
                              isSelected
                                ? "registration-clinic-option selected"
                                : "registration-clinic-option"
                            }
                            onClick={() => selectClinic(clinic.clinic_id)}
                            disabled={loading}
                          >
                            <span className="registration-clinic-option-main">
                              <strong>{clinic.clinic_name}</strong>
                              <small>
                                {clinic.address || "No address provided"}
                              </small>
                              <small>Services: {services.join(", ")}</small>
                            </span>

                            <span className="registration-clinic-select-label">
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              {(clinicSearch.trim() || selectedService) && (
                <section className="registration-suggestion-section">
                  <div className="registration-suggestion-heading">
                    <h4>Search Results</h4>
                    <p>
                      Select any clinic matching the entered location and
                      selected service, even when it is outside the nearby
                      distance.
                    </p>
                  </div>

                  {loadingClinics ? (
                    <div className="auth-note">
                      Searching clinic locations...
                    </div>
                  ) : searchableClinics.length === 0 ? (
                    <div className="auth-note">
                      No clinic matches your search.
                    </div>
                  ) : (
                    <div className="registration-clinic-list">
                      {searchableClinics.map((clinic) => {
                        const isSelected =
                          Number(formData.clinic_id) ===
                          Number(clinic.clinic_id);

                        const latitude = getClinicLatitude(clinic);
                        const longitude = getClinicLongitude(clinic);

                        const distanceKm =
                          userLocation &&
                          latitude !== null &&
                          longitude !== null
                            ? calculateDistanceKm(
                                userLocation.latitude,
                                userLocation.longitude,
                                latitude,
                                longitude,
                              )
                            : null;

                        return (
                          <button
                            key={`search-${clinic.clinic_id}`}
                            type="button"
                            className={
                              isSelected
                                ? "registration-clinic-option selected"
                                : "registration-clinic-option"
                            }
                            onClick={() => selectClinic(clinic.clinic_id)}
                            aria-pressed={isSelected}
                            disabled={loading}
                          >
                            <span className="registration-clinic-option-main">
                              <strong>{clinic.clinic_name}</strong>
                              <small>
                                {clinic.address || "No address provided"}
                              </small>

                              {distanceKm !== null && (
                                <small>
                                  {distanceKm.toFixed(2)} km away
                                  {distanceKm > NEARBY_RADIUS_KM
                                    ? " · Outside nearby range"
                                    : ""}
                                </small>
                              )}
                            </span>

                            <span className="registration-clinic-select-label">
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>

            <input
              type="hidden"
              name="clinic_id"
              value={formData.clinic_id}
              required
            />
          </div>

          {!loadingClinics && clinics.length === 0 && (
            <div className="auth-error">
              No active clinic locations are available for registration yet.
            </div>
          )}

          <div className="auth-row">
            <PasswordInput
              label="Password"
              name="password"
              placeholder="Create password"
              value={formData.password}
              onChange={handleChange}
              icon="🔒"
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              icon="🔒"
              autoComplete="new-password"
              disabled={loading}
              required
            />
          </div>

          <div className="auth-note">
            Password must have at least 8 characters, one uppercase letter, one
            lowercase letter, one number, and one special character.
          </div>

          <label className="auth-check">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked);
                setError("");
              }}
              disabled={loading}
            />
            <span>
              I agree to the{" "}
              <Link
                className="auth-policy-link"
                to="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                className="auth-policy-link"
                to="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>{" "}
              <strong className="auth-required">*</strong>
            </span>
          </label>

          {siteKey ? (
            <div className="turnstile-wrapper">
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setError("");
                }}
                onExpire={() => {
                  setTurnstileToken("");
                }}
                onError={() => {
                  setTurnstileToken("");
                  setError(
                    "CAPTCHA failed to load. Please refresh and try again.",
                  );
                }}
                options={{
                  theme: "auto",
                  size: "normal",
                }}
              />
            </div>
          ) : (
            <div className="auth-error">
              Turnstile site key is missing. Please check frontend .env.
            </div>
          )}

          <AuthButton
            type="submit"
            disabled={
              loading || loadingClinics || clinics.length === 0 || !siteKey
            }
          >
            {loading ? "Creating Account..." : "Create Patient Account"}
          </AuthButton>
        </form>
      )}

      {success && (
        <div className="auth-form">
          <AuthButton type="button" onClick={() => navigate("/auth/login")}>
            Go to Login
          </AuthButton>

          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setSuccess("");
              setError("");
              setPasswordRules([]);
              resetTurnstile();
            }}
          >
            Register another patient
          </button>
        </div>
      )}

      <p className="auth-footer">
        Already have an account?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => navigate("/auth/login")}
          disabled={loading}
        >
          Sign in
        </button>
      </p>

      <div className="auth-note">
        Dentists and dental assistants are registered through a subscribed
        clinic owner account and assigned to a specific clinic location.
      </div>
    </AuthLayout>
  );
}

export default Register;
