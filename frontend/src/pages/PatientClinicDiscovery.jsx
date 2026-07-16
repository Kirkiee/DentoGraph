import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  clinicServicesToDisplayText,
  getClinicServiceNames,
} from "../utils/clinicServices";
import { clinicOperatingHoursToSummary } from "../utils/clinicOperatingHours";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapRecenter({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 13);
    }
  }, [userLocation, map]);

  return null;
}

function PatientClinicDiscovery() {
  const [clinics, setClinics] = useState([]);
  const [assignedClinicId, setAssignedClinicId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [radiusFilter, setRadiusFilter] = useState("5");

  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [trackingLocation, setTrackingLocation] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const watchIdRef = useRef(null);

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchClinics();
    getCurrentLocation();

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        "/api/clinics/discovery/list",
        authHeaders,
      );
      setClinics(response.data.clinics || []);
      setAssignedClinicId(response.data.assigned_clinic_id || null);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic locations.");
      setClinics([]);
      setAssignedClinicId(null);
    } finally {
      setLoading(false);
    }
  };

  const isAssignedClinic = (clinic) => {
    if (!clinic) return false;

    const clinicId = Number(clinic.clinic_id);
    const assignedId = Number(assignedClinicId);

    if (
      Number.isFinite(clinicId) &&
      Number.isFinite(assignedId) &&
      clinicId === assignedId
    ) {
      return true;
    }

    return clinic.is_assigned_clinic === true;
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    try {
      setGettingLocation(true);
      setMessage("");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          setMessage(
            "Location detected successfully. Clinics are filtered using the selected radius.",
          );
          setGettingLocation(false);
        },
        () => {
          setError(
            "Unable to get your current location. You can still search clinics manually, but radius filtering will be limited.",
          );
          setGettingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    } catch (err) {
      setError("Unable to access location services.");
      setGettingLocation(false);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setTrackingLocation(true);
    setMessage("Real-time location tracking started.");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setError("Unable to track your real-time location.");
        setTrackingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTrackingLocation(false);
    setMessage("Real-time location tracking stopped.");
  };

  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;

    const earthRadiusKm = 6371;

    const toRadians = (degrees) => degrees * (Math.PI / 180);

    const dLat = toRadians(Number(lat2) - Number(lat1));
    const dLon = toRadians(Number(lon2) - Number(lon1));

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(Number(lat1))) *
        Math.cos(toRadians(Number(lat2))) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  };

  const getGoogleMapsLink = (clinic) => {
    if (clinic.latitude && clinic.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      clinic.address || clinic.clinic_name,
    )}`;
  };

  const serviceOptions = useMemo(() => {
    const servicesSet = new Set();

    clinics.forEach((clinic) => {
      getClinicServiceNames(clinic).forEach((serviceName) => {
        servicesSet.add(serviceName);
      });
    });

    return Array.from(servicesSet).sort((first, second) =>
      first.localeCompare(second),
    );
  }, [clinics]);

  const clinicsWithDistance = useMemo(() => {
    return clinics.map((clinic) => {
      const distance =
        userLocation && clinic.latitude && clinic.longitude
          ? calculateDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              clinic.latitude,
              clinic.longitude,
            )
          : null;

      return {
        ...clinic,
        distance,
      };
    });
  }, [clinics, userLocation]);

  const filteredClinics = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const selectedService = serviceFilter.toLowerCase().trim();
    const selectedRadius = radiusFilter === "all" ? null : Number(radiusFilter);

    return clinicsWithDistance
      .filter((clinic) => {
        const clinicServiceNames = getClinicServiceNames(clinic);
        const searchableServices = clinicServiceNames.join(" ").toLowerCase();

        const matchesSearch =
          !term ||
          clinic.clinic_name?.toLowerCase().includes(term) ||
          clinic.address?.toLowerCase().includes(term) ||
          searchableServices.includes(term);

        const matchesService =
          !selectedService ||
          clinicServiceNames.some(
            (serviceName) => serviceName.toLowerCase() === selectedService,
          );

        let matchesRadius = true;

        if (
          userLocation &&
          selectedRadius !== null &&
          !isAssignedClinic(clinic)
        ) {
          matchesRadius =
            clinic.distance !== null && clinic.distance <= selectedRadius;
        }

        return matchesSearch && matchesService && matchesRadius;
      })
      .sort((a, b) => {
        const aAssigned = isAssignedClinic(a);
        const bAssigned = isAssignedClinic(b);

        if (aAssigned !== bAssigned) {
          return aAssigned ? -1 : 1;
        }

        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;

        return a.distance - b.distance;
      });
  }, [
    clinicsWithDistance,
    searchTerm,
    serviceFilter,
    radiusFilter,
    userLocation,
    assignedClinicId,
  ]);

  const clinicsInsideRadius = useMemo(() => {
    if (!userLocation || radiusFilter === "all") return clinicsWithDistance;

    const selectedRadius = Number(radiusFilter);

    return clinicsWithDistance.filter(
      (clinic) => clinic.distance !== null && clinic.distance <= selectedRadius,
    );
  }, [clinicsWithDistance, radiusFilter, userLocation]);

  const mapCenter = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [14.5995, 120.9842];

  const radiusInMeters =
    radiusFilter === "all" ? 5000 : Number(radiusFilter) * 1000;

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Locations</h2>
            <p>
              View your assigned clinic and the other active branches managed by
              the same dental clinic owner.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? "Detecting..." : "Use My Location"}
            </button>

            {!trackingLocation ? (
              <button
                className="primary-button"
                onClick={startLocationTracking}
              >
                Start Live Tracking
              </button>
            ) : (
              <button className="danger-button" onClick={stopLocationTracking}>
                Stop Tracking
              </button>
            )}

            <button
              className="secondary-button"
              onClick={fetchClinics}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          Your account is assigned to one clinic location. Other branches are
          shown for reference and navigation only. Appointments, dental records,
          X-rays, and documents remain connected to your assigned clinic.
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && assignedClinicId && (
          <div className="staff-summary-grid">
            <div className="staff-summary-card">
              <span>Assigned Location</span>
              <strong>
                {clinics.find(
                  (clinic) =>
                    String(clinic.clinic_id) === String(assignedClinicId),
                )?.clinic_name || "Assigned clinic"}
              </strong>
              <p>
                Only one clinic location is assigned to your patient account.
              </p>
            </div>

            <div className="staff-summary-card">
              <span>Available Branches</span>
              <strong>{clinics.length}</strong>
              <p>Active locations under the same clinic owner</p>
            </div>
          </div>
        )}

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search Location or Service</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by branch name, address, or service"
            />
          </div>

          <div className="form-group">
            <label>Filter by Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="">All Services</option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Geofence Radius</label>
            <select
              value={radiusFilter}
              onChange={(e) => setRadiusFilter(e.target.value)}
            >
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="20">Within 20 km</option>
              <option value="50">Within 50 km</option>
              <option value="all">Show all clinics</option>
            </select>
          </div>
        </div>

        <div className="clinic-map-card">
          <div className="appointments-header">
            <div>
              <h2>Real-Time Clinic Map</h2>
              <p>
                Blue marker shows your location. Branch markers show your
                assigned clinic and other active locations under the same owner.
              </p>
            </div>

            {trackingLocation && (
              <span className="status-badge status-scheduled">
                Live tracking active
              </span>
            )}
          </div>

          <div className="clinic-map-wrapper">
            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom={true}
              className="clinic-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {userLocation && (
                <>
                  <MapRecenter userLocation={userLocation} />

                  <Marker
                    position={[userLocation.latitude, userLocation.longitude]}
                  >
                    <Popup>
                      <strong>Your Location</strong>
                      <br />
                      Latitude: {userLocation.latitude.toFixed(6)}
                      <br />
                      Longitude: {userLocation.longitude.toFixed(6)}
                    </Popup>
                  </Marker>

                  {radiusFilter !== "all" && (
                    <Circle
                      center={[userLocation.latitude, userLocation.longitude]}
                      radius={radiusInMeters}
                    />
                  )}
                </>
              )}

              {filteredClinics
                .filter((clinic) => clinic.latitude && clinic.longitude)
                .map((clinic) => (
                  <Marker
                    key={clinic.clinic_id}
                    position={[
                      Number(clinic.latitude),
                      Number(clinic.longitude),
                    ]}
                  >
                    <Popup>
                      <strong>{clinic.clinic_name}</strong>
                      {isAssignedClinic(clinic) && (
                        <>
                          <br />
                          <strong>Your assigned clinic</strong>
                        </>
                      )}
                      <br />
                      {clinic.address || "No address provided"}
                      <br />
                      {clinic.distance !== null
                        ? `${clinic.distance.toFixed(2)} km away`
                        : "Distance unavailable"}
                      <br />
                      <a
                        href={getGoogleMapsLink(clinic)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open navigation
                      </a>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>

        {userLocation && (
          <div className="appointment-item" style={{ marginBottom: "20px" }}>
            <div className="appointment-info">
              <div className="appointment-title-row">
                <h3>Your Current Location</h3>
                <span className="status-badge status-scheduled">
                  GPS Detected
                </span>
              </div>

              <p>
                <strong>Latitude:</strong> {userLocation.latitude.toFixed(6)}
              </p>

              <p>
                <strong>Longitude:</strong> {userLocation.longitude.toFixed(6)}
              </p>

              <p>
                <strong>Selected Radius:</strong>{" "}
                {radiusFilter === "all"
                  ? "All clinics shown"
                  : `${radiusFilter} km geofence`}
              </p>

              <p>
                <strong>Locations inside radius:</strong>{" "}
                {radiusFilter === "all"
                  ? clinicsWithDistance.length
                  : clinicsInsideRadius.length}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p>Loading clinic locations...</p>
        ) : filteredClinics.length === 0 ? (
          <div className="empty-state">
            <h3>No clinic locations found within the selected filter</h3>
            <p>
              Try expanding the radius, selecting “Show all clinics,” or
              changing the search/service filter.
            </p>
          </div>
        ) : (
          <div className="clinic-discovery-grid">
            {filteredClinics.map((clinic) => (
              <div className="clinic-card" key={clinic.clinic_id}>
                <div className="appointment-title-row">
                  <h3>{clinic.clinic_name}</h3>

                  <div
                    className="appointment-actions"
                    style={{ flexDirection: "row", flexWrap: "wrap" }}
                  >
                    {isAssignedClinic(clinic) && (
                      <span className="status-badge status-completed">
                        My Assigned Clinic
                      </span>
                    )}

                    {!isAssignedClinic(clinic) && (
                      <span className="status-badge status-scheduled">
                        Other Branch
                      </span>
                    )}

                    <span
                      className={`status-badge ${
                        clinic.status === "Inactive"
                          ? "status-cancelled"
                          : "status-scheduled"
                      }`}
                    >
                      {clinic.status || "Active"}
                    </span>
                  </div>
                </div>

                <p>
                  <strong>Address:</strong>{" "}
                  {clinic.address || "No address provided"}
                </p>

                <p>
                  <strong>Services:</strong>{" "}
                  {clinicServicesToDisplayText(clinic) || "No services listed"}
                </p>

                <p>
                  <strong>Contact:</strong>{" "}
                  {clinic.contact_number || "No contact number listed"}
                </p>

                <p>
                  <strong>Opening Hours:</strong>{" "}
                  {clinicOperatingHoursToSummary(clinic) ||
                    clinic.opening_hours ||
                    "No schedule listed"}
                </p>

                <p>
                  <strong>Distance:</strong>{" "}
                  {clinic.distance !== null
                    ? `${clinic.distance.toFixed(2)} km away`
                    : "Enable location to estimate distance"}
                </p>

                {userLocation &&
                  radiusFilter !== "all" &&
                  clinic.distance !== null && (
                    <p>
                      <strong>Geofence Status:</strong>{" "}
                      {clinic.distance <= Number(radiusFilter)
                        ? `Inside ${radiusFilter} km radius`
                        : `Outside ${radiusFilter} km radius`}
                    </p>
                  )}

                <div className="info-message" style={{ marginTop: "14px" }}>
                  {isAssignedClinic(clinic)
                    ? "Your patient account, appointments, and dental records are assigned to this location."
                    : "This is another branch under the same clinic owner. Viewing it does not change your assigned clinic."}
                </div>

                <div className="patient-clinic-actions">
                  <a
                    className="primary-button"
                    href={getGoogleMapsLink(clinic)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Navigation
                  </a>

                  <a
                    className="secondary-button"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      clinic.clinic_name + " " + (clinic.address || ""),
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Search Clinic
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientClinicDiscovery;
