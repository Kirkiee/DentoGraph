import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import PermissionStateCard from "../components/PermissionStateCard";
import {
  getLocationPermissionState,
  getPermissionMessage,
  openApplicationSettings,
  PERMISSION_STATUS,
  requestLocationPermission,
} from "../services/permissionService";

import { getClinics } from "../services/clinicService";

export default function PatientClinicDiscoveryScreen({ token }) {
  const webViewRef = useRef(null);

  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [expandedClinicId, setExpandedClinicId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState({
    status: PERMISSION_STATUS.UNDETERMINED,
    granted: false,
    canAskAgain: true,
  });

  useEffect(() => {
    initializeClinicDiscovery();
  }, []);

  const initializeClinicDiscovery = async () => {
    try {
      setLoading(true);
      await getCurrentLocation();
      await loadClinics();
    } finally {
      setLoading(false);
    }
  };

  const normalizeClinics = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.clinics)) return data.clinics;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const getClinicLatitude = (clinic) => {
    const value =
      clinic.latitude ||
      clinic.lat ||
      clinic.clinic_latitude ||
      clinic.location_latitude;

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getClinicLongitude = (clinic) => {
    const value =
      clinic.longitude ||
      clinic.lng ||
      clinic.lon ||
      clinic.clinic_longitude ||
      clinic.location_longitude;

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getClinicName = (clinic) => {
    return (
      clinic.clinic_name ||
      clinic.name ||
      clinic.business_name ||
      "Dental Clinic"
    );
  };

  const getClinicAddress = (clinic) => {
    return clinic.address || clinic.clinic_address || "No address available";
  };

  const getClinicContact = (clinic) => {
    return (
      clinic.contact_number ||
      clinic.phone ||
      clinic.telephone ||
      clinic.mobile_number ||
      "No contact available"
    );
  };

  const normalizeServices = (clinic) => {
    const rawServices =
      clinic.services ||
      clinic.clinic_services ||
      clinic.service_names ||
      [];

    if (Array.isArray(rawServices)) {
      return rawServices
        .map((service) => {
          if (typeof service === "string") return service.trim();

          return (
            service.service_name ||
            service.name ||
            service.label ||
            ""
          ).trim();
        })
        .filter(Boolean);
    }

    if (typeof rawServices === "string") {
      return rawServices
        .split(/[,;|\n]/)
        .map((service) => service.trim())
        .filter(Boolean);
    }

    return [];
  };

  const DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const DAY_BY_NUMBER = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };

  const normalizeDayName = (value) => {
    if (value === undefined || value === null || value === "") {
      return "";
    }

    if (!Number.isNaN(Number(value))) {
      return DAY_BY_NUMBER[Number(value)] || "";
    }

    const normalized = String(value).trim().toLowerCase();

    return (
      DAY_ORDER.find(
        (day) =>
          day.toLowerCase() === normalized ||
          day.slice(0, 3).toLowerCase() === normalized.slice(0, 3),
      ) || ""
    );
  };

  const parseLegacyHoursText = (value) => {
    const textValue = String(value || "").trim();

    if (!textValue) {
      return [];
    }

    /*
     * The discovery endpoint currently returns clinics.opening_hours as a
     * legacy comma-separated string, for example:
     * "Monday: 9:00 AM - 5:00 PM, Tuesday: 9:00 AM - 5:00 PM".
     *
     * Split only where a new weekday begins so commas inside other text do
     * not create false schedule rows.
     */
    const entries = textValue
      .split(
        /,\s*(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:)/i,
      )
      .map((entry) => entry.trim())
      .filter(Boolean);

    return entries
      .map((entry) => {
        const match = entry.match(
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:\s*(.+)$/i,
        );

        if (!match) {
          return null;
        }

        const day = normalizeDayName(match[1]);
        const hours = String(match[2] || "").trim();
        const isClosed = /\bclosed\b/i.test(hours);

        return {
          day,
          hours: isClosed ? "Closed" : hours,
          isOpen: !isClosed,
        };
      })
      .filter(Boolean);
  };

  const normalizeOperatingHours = (clinic) => {
    const rawHours =
      clinic.operating_hours ||
      clinic.opening_hours ||
      clinic.hours ||
      clinic.availability ||
      [];

    if (Array.isArray(rawHours)) {
      return rawHours
        .map((item) => {
          if (typeof item === "string") {
            return parseLegacyHoursText(item);
          }

          const day = normalizeDayName(
            item.day_name ??
              item.day ??
              item.weekday ??
              item.day_of_week,
          );

          if (!day) {
            return null;
          }

          const rawIsOpen =
            item.is_open ?? item.is_available ?? item.open;

          const isOpen =
            rawIsOpen === undefined
              ? !String(item.hours || "").toLowerCase().includes("closed")
              : rawIsOpen === true ||
                rawIsOpen === 1 ||
                String(rawIsOpen).toLowerCase() === "true";

          const start =
            item.opening_time ||
            item.start_time ||
            item.open_time ||
            "";

          const end =
            item.closing_time ||
            item.end_time ||
            item.close_time ||
            "";

          return {
            day,
            hours: isOpen
              ? start && end
                ? `${start} – ${end}`
                : item.hours || "Open"
              : "Closed",
            isOpen,
          };
        })
        .flat()
        .filter(Boolean)
        .sort(
          (first, second) =>
            DAY_ORDER.indexOf(first.day) - DAY_ORDER.indexOf(second.day),
        );
    }

    if (rawHours && typeof rawHours === "object") {
      return Object.entries(rawHours)
        .map(([dayValue, value]) => {
          const day = normalizeDayName(dayValue);

          if (!day) {
            return null;
          }

          const normalizedValue =
            typeof value === "string"
              ? value
              : value?.hours || value?.label || "Closed";

          const isOpen =
            value?.is_open !== undefined
              ? Boolean(value.is_open)
              : !String(normalizedValue).toLowerCase().includes("closed");

          return {
            day,
            hours: isOpen ? normalizedValue : "Closed",
            isOpen,
          };
        })
        .filter(Boolean)
        .sort(
          (first, second) =>
            DAY_ORDER.indexOf(first.day) - DAY_ORDER.indexOf(second.day),
        );
    }

    if (typeof rawHours === "string") {
      return parseLegacyHoursText(rawHours).sort(
        (first, second) =>
          DAY_ORDER.indexOf(first.day) - DAY_ORDER.indexOf(second.day),
      );
    }

    return [];
  };

  const getGroupedSchedule = (clinic) => {
    const schedule = normalizeOperatingHours(clinic);

    if (schedule.length === 0) {
      return [];
    }

    const groups = [];

    schedule.forEach((item) => {
      const dayIndex = DAY_ORDER.indexOf(item.day);
      const signature = `${item.isOpen ? "open" : "closed"}|${item.hours}`;
      const previous = groups[groups.length - 1];

      const isConsecutive =
        previous && dayIndex === previous.lastDayIndex + 1;

      if (
        previous &&
        previous.signature === signature &&
        isConsecutive
      ) {
        previous.endDay = item.day;
        previous.lastDayIndex = dayIndex;
        return;
      }

      groups.push({
        startDay: item.day,
        endDay: item.day,
        hours: item.hours,
        isOpen: item.isOpen,
        signature,
        lastDayIndex: dayIndex,
      });
    });

    return groups.map((group) => ({
      ...group,
      label:
        group.startDay === group.endDay
          ? group.startDay
          : `${group.startDay.slice(0, 3)}–${group.endDay.slice(0, 3)}`,
    }));
  };

  const getTodayHours = (clinic) => {
    const schedule = normalizeOperatingHours(clinic);

    if (schedule.length === 0) {
      return "Hours unavailable";
    }

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    });

    const todaySchedule = schedule.find(
      (item) =>
        String(item.day).toLowerCase() === today.toLowerCase(),
    );

    if (!todaySchedule) {
      return `${schedule.length} day schedule`;
    }

    return todaySchedule.isOpen
      ? `Today: ${todaySchedule.hours}`
      : "Closed today";
  };

  const calculateDistanceKm = (from, to) => {
    if (!from || !to) return null;

    const earthRadiusKm = 6371;

    const toRadians = (degrees) => {
      return degrees * (Math.PI / 180);
    };

    const lat1 = toRadians(from.latitude);
    const lon1 = toRadians(from.longitude);
    const lat2 = toRadians(to.latitude);
    const lon2 = toRadians(to.longitude);

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  };

  const formatDistance = (distanceKm) => {
    if (distanceKm === null || distanceKm === undefined) {
      return "Distance unavailable";
    }

    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m away`;
    }

    return `${distanceKm.toFixed(1)} km away`;
  };

  const clinicsWithLocation = useMemo(() => {
    return clinics
      .map((clinic) => {
        const latitude = getClinicLatitude(clinic);
        const longitude = getClinicLongitude(clinic);

        const hasLocation = latitude !== null && longitude !== null;

        const distanceKm = hasLocation
          ? calculateDistanceKm(userLocation, { latitude, longitude })
          : null;

        return {
          ...clinic,
          _latitude: latitude,
          _longitude: longitude,
          _distanceKm: distanceKm,
        };
      })
      .filter(
        (clinic) => clinic._latitude !== null && clinic._longitude !== null
      );
  }, [clinics, userLocation]);

  const sortedClinics = useMemo(() => {
    return [...clinics]
      .map((clinic) => {
        const latitude = getClinicLatitude(clinic);
        const longitude = getClinicLongitude(clinic);

        const hasLocation = latitude !== null && longitude !== null;

        const distanceKm = hasLocation
          ? calculateDistanceKm(userLocation, { latitude, longitude })
          : null;

        return {
          ...clinic,
          _latitude: latitude,
          _longitude: longitude,
          _distanceKm: distanceKm,
          _hasLocation: hasLocation,
        };
      })
      .sort((a, b) => {
        if (a._distanceKm === null && b._distanceKm === null) return 0;
        if (a._distanceKm === null) return 1;
        if (b._distanceKm === null) return -1;
        return a._distanceKm - b._distanceKm;
      });
  }, [clinics, userLocation]);

  const nearestClinic = sortedClinics.find(
    (clinic) => clinic._distanceKm !== null
  );

  const mapCenter = useMemo(() => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
    }

    if (clinicsWithLocation.length > 0) {
      return {
        latitude: clinicsWithLocation[0]._latitude,
        longitude: clinicsWithLocation[0]._longitude,
      };
    }

    return {
      latitude: 14.5995,
      longitude: 120.9842,
    };
  }, [userLocation, clinicsWithLocation]);

  const escapeHtml = (value) => {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const mapHtml = useMemo(() => {
    const userMarker = userLocation
      ? `
        L.circleMarker([${userLocation.latitude}, ${userLocation.longitude}], {
          radius: 8,
          color: "#2b6cb0",
          fillColor: "#2b6cb0",
          fillOpacity: 0.95
        })
          .addTo(map)
          .bindPopup("<b>Your Location</b>");
      `
      : "";

    const clinicMarkers = clinicsWithLocation
      .map((clinic) => {
        const clinicName = escapeHtml(getClinicName(clinic));
        const clinicAddress = escapeHtml(getClinicAddress(clinic));
        const distance = escapeHtml(formatDistance(clinic._distanceKm));

        return `
          L.marker([${clinic._latitude}, ${clinic._longitude}], {
            title: "${clinicName}"
          })
            .addTo(map)
            .bindPopup(
              "<b>${clinicName}</b><br/>${clinicAddress}<br/><span>${distance}</span>"
            );
        `;
      })
      .join("\n");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

          <style>
            html, body, #map {
              height: 100%;
              width: 100%;
              margin: 0;
              padding: 0;
              background: #edf2f7;
            }

            .leaflet-popup-content {
              font-family: Arial, sans-serif;
              font-size: 13px;
              line-height: 1.4;
            }

            .leaflet-control-attribution {
              font-size: 10px;
            }
          </style>
        </head>

        <body>
          <div id="map"></div>

          <script>
            var map = L.map("map", {
              zoomControl: true,
              attributionControl: true
            }).setView([${mapCenter.latitude}, ${mapCenter.longitude}], 13);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              maxZoom: 19,
              attribution: "&copy; OpenStreetMap"
            }).addTo(map);

            ${userMarker}
            ${clinicMarkers}

            var bounds = [];

            ${
              userLocation
                ? `bounds.push([${userLocation.latitude}, ${userLocation.longitude}]);`
                : ""
            }

            ${clinicsWithLocation
              .map(
                (clinic) =>
                  `bounds.push([${clinic._latitude}, ${clinic._longitude}]);`
              )
              .join("\n")}

            if (bounds.length > 1) {
              map.fitBounds(bounds, {
                padding: [35, 35]
              });
            }
          </script>
        </body>
      </html>
    `;
  }, [userLocation, clinicsWithLocation, mapCenter]);

  const getCurrentLocation = async ({ request = true } = {}) => {
    try {
      setLocationLoading(true);

      let permission = await getLocationPermissionState();

      if (!permission.granted && request && permission.canAskAgain) {
        permission = await requestLocationPermission();
      }

      setLocationPermission(permission);

      if (!permission.granted) {
        setUserLocation(null);
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(currentLocation);
      return currentLocation;
    } catch (error) {
      Alert.alert(
        "Location Error",
        error.message || "Unable to get your current location.",
      );
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const refreshLocationPermission = async () => {
    const permission = await getLocationPermissionState();
    setLocationPermission(permission);

    if (permission.granted) {
      await getCurrentLocation({ request: false });
    }
  };

  const loadClinics = async () => {
    try {
      const data = await getClinics(token);
      const clinicList = normalizeClinics(data);

      setClinics(clinicList);

      if (clinicList.length > 0 && !selectedClinic) {
        setSelectedClinic(clinicList[0]);
      }
    } catch (error) {
      Alert.alert(
        "Clinic Discovery Error",
        error.message || "Unable to load clinics."
      );
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await getCurrentLocation();
      await loadClinics();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleClinicDetails = (clinic, index) => {
    const clinicKey = clinic.clinic_id || `clinic-${index}`;

    setExpandedClinicId((current) =>
      current === clinicKey ? null : clinicKey,
    );
  };

  const focusClinicOnMap = (clinic) => {
    setSelectedClinic(clinic);

    const latitude = getClinicLatitude(clinic);
    const longitude = getClinicLongitude(clinic);

    if (latitude === null || longitude === null) {
      Alert.alert(
        "No Map Location",
        "This clinic does not have a map location yet."
      );
      return;
    }

    const clinicName = escapeHtml(getClinicName(clinic));
    const clinicAddress = escapeHtml(getClinicAddress(clinic));

    const focusScript = `
      map.setView([${latitude}, ${longitude}], 16);
      L.popup()
        .setLatLng([${latitude}, ${longitude}])
        .setContent("<b>${clinicName}</b><br/>${clinicAddress}")
        .openOn(map);
      true;
    `;

    webViewRef.current?.injectJavaScript(focusScript);
  };

  const openDirections = (clinic) => {
    const latitude = getClinicLatitude(clinic);
    const longitude = getClinicLongitude(clinic);
    const clinicName = encodeURIComponent(getClinicName(clinic));

    if (latitude === null || longitude === null) {
      Alert.alert(
        "No Map Location",
        "Directions are unavailable because this clinic has no map location yet."
      );
      return;
    }

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${clinicName}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${clinicName})`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}`
      );
    });
  };

  const openInBrowserMap = (clinic) => {
    const latitude = getClinicLatitude(clinic);
    const longitude = getClinicLongitude(clinic);

    if (latitude === null || longitude === null) {
      Alert.alert(
        "No Map Location",
        "This clinic does not have a map location yet."
      );
      return;
    }

    Linking.openURL(
      `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
    );
  };

  const callClinic = (clinic) => {
    const contact = getClinicContact(clinic);

    if (!contact || contact === "No contact available") {
      Alert.alert("No Contact", "This clinic has no contact number available.");
      return;
    }

    const cleanedContact = String(contact).replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanedContact}`);
  };

  const focusNearestClinic = () => {
    if (!nearestClinic) {
      Alert.alert(
        "No Nearby Clinic",
        "No nearby clinic with a map location is currently available."
      );
      return;
    }

    focusClinicOnMap(nearestClinic);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading clinic discovery...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="location-outline" size={27} color="#2b6cb0" />
          </View>

          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Clinic Discovery</Text>
            <Text style={styles.subtitle}>
              Find nearby dental clinics and get directions.
            </Text>
          </View>
        </View>
      </View>

      {!locationPermission.granted ? (
        <View style={styles.permissionCardWrapper}>
          <PermissionStateCard
            icon="location-outline"
            title="Location access unavailable"
            message={getPermissionMessage({
              permissionName: "Location",
              status: locationPermission.status,
              purpose: "calculate clinic distance and show your position",
            })}
            actionLabel={
              locationPermission.status === PERMISSION_STATUS.BLOCKED
                ? "Open Settings"
                : "Allow Location"
            }
            secondaryLabel="Check Permission Again"
            busy={locationLoading}
            onAction={
              locationPermission.status === PERMISSION_STATUS.BLOCKED
                ? openApplicationSettings
                : () => getCurrentLocation({ request: true })
            }
            onSecondary={refreshLocationPermission}
          />
        </View>
      ) : null}

      <View style={styles.mapCard}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="small" color="#2b6cb0" />
              <Text style={styles.mapLoadingText}>Loading map...</Text>
            </View>
          )}
          onError={() => {
            Alert.alert(
              "Map Error",
              "Unable to load the map view. You can still use the clinic list below."
            );
          }}
        />

        <View style={styles.mapFloatingBadge}>
          <Ionicons name="map-outline" size={14} color="#ffffff" />
          <Text style={styles.mapFloatingText}>
            {clinicsWithLocation.length} marker
            {clinicsWithLocation.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <View style={styles.locationActions}>
        <Pressable
          style={styles.locationButton}
          onPress={getCurrentLocation}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="locate-outline" size={18} color="#ffffff" />
              <Text style={styles.locationButtonText}>Use My Location</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.nearestButton} onPress={focusNearestClinic}>
          <Ionicons name="navigate-outline" size={18} color="#2b6cb0" />
          <Text style={styles.nearestButtonText}>Nearest</Text>
        </Pressable>
      </View>

      {nearestClinic ? (
        <View style={styles.nearestCard}>
          <View style={styles.nearestIconCircle}>
            <Ionicons name="star-outline" size={20} color="#2b6cb0" />
          </View>

          <View style={styles.nearestTextBlock}>
            <Text style={styles.nearestLabel}>Nearest Clinic</Text>
            <Text style={styles.nearestName} numberOfLines={1}>
              {getClinicName(nearestClinic)}
            </Text>
            <Text style={styles.nearestDistance}>
              {formatDistance(nearestClinic._distanceKm)}
            </Text>
          </View>

          <Pressable
            style={styles.nearestMiniButton}
            onPress={() => focusClinicOnMap(nearestClinic)}
          >
            <Text style={styles.nearestMiniButtonText}>View</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Available Clinics</Text>
        <Text style={styles.sectionSubtitle}>
          {clinics.length} clinic{clinics.length === 1 ? "" : "s"} found
        </Text>
      </View>

      {clinics.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="business-outline" size={30} color="#2b6cb0" />
          </View>

          <Text style={styles.emptyTitle}>No clinics found</Text>
          <Text style={styles.emptyText}>
            Clinics added in DentoGraph will appear here for patients.
          </Text>
        </View>
      ) : (
        sortedClinics.map((clinic, index) => {
          const hasCoordinates = clinic._hasLocation;
          const isSelected =
            selectedClinic &&
            (selectedClinic.clinic_id === clinic.clinic_id ||
              selectedClinic === clinic);

          const isNearest =
            nearestClinic &&
            nearestClinic.clinic_id === clinic.clinic_id &&
            clinic._distanceKm !== null;

          const clinicKey = clinic.clinic_id || `clinic-${index}`;
          const services = normalizeServices(clinic);
          const operatingHours = normalizeOperatingHours(clinic);
          const groupedSchedule = getGroupedSchedule(clinic);
          const isExpanded = expandedClinicId === clinicKey;

          return (
            <View
              key={clinic.clinic_id || index}
              style={[
                styles.clinicCard,
                isSelected && styles.selectedClinicCard,
              ]}
            >
              <View style={styles.clinicTopRow}>
                <View style={styles.clinicIconCircle}>
                  <Ionicons
                    name="business-outline"
                    size={22}
                    color="#2b6cb0"
                  />
                </View>

                <View style={styles.clinicTitleBlock}>
                  <View style={styles.nameRow}>
                    <Text style={styles.clinicName} numberOfLines={2}>
                      {getClinicName(clinic)}
                    </Text>

                    {isNearest ? (
                      <View style={styles.nearestBadge}>
                        <Text style={styles.nearestBadgeText}>Nearest</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.clinicAddress} numberOfLines={2}>
                    {getClinicAddress(clinic)}
                  </Text>
                </View>
              </View>

              <View style={styles.distanceRow}>
                <View style={styles.distancePill}>
                  <Ionicons
                    name="navigate-outline"
                    size={14}
                    color="#2b6cb0"
                  />
                  <Text style={styles.distanceText}>
                    {formatDistance(clinic._distanceKm)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.coordinateBadge,
                    hasCoordinates
                      ? styles.availableBadge
                      : styles.unavailableBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.coordinateBadgeText,
                      hasCoordinates
                        ? styles.availableBadgeText
                        : styles.unavailableBadgeText,
                    ]}
                  >
                    {hasCoordinates ? "Mapped" : "No Map"}
                  </Text>
                </View>
              </View>

              <View style={styles.quickSummaryRow}>
                <View style={styles.quickSummaryItem}>
                  <Ionicons name="time-outline" size={16} color="#2563eb" />
                  <Text style={styles.quickSummaryText} numberOfLines={1}>
                    {getTodayHours(clinic)}
                  </Text>
                </View>

                <View style={styles.quickSummaryItem}>
                  <Ionicons name="medkit-outline" size={16} color="#2563eb" />
                  <Text style={styles.quickSummaryText}>
                    {services.length > 0
                      ? `${services.length} service${
                          services.length === 1 ? "" : "s"
                        }`
                      : "Services unavailable"}
                  </Text>
                </View>
              </View>

              {services.length > 0 ? (
                <View style={styles.servicePreviewRow}>
                  {services.slice(0, 2).map((service) => (
                    <View key={service} style={styles.serviceChip}>
                      <Text style={styles.serviceChipText} numberOfLines={1}>
                        {service}
                      </Text>
                    </View>
                  ))}

                  {services.length > 2 ? (
                    <View style={styles.moreServicesChip}>
                      <Text style={styles.moreServicesText}>
                        +{services.length - 2} more
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                style={styles.detailsToggle}
                onPress={() => toggleClinicDetails(clinic, index)}
              >
                <Text style={styles.detailsToggleText}>
                  {isExpanded ? "Hide clinic details" : "View hours and services"}
                </Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#2563eb"
                />
              </Pressable>

              {isExpanded ? (
                <View style={styles.expandedDetails}>
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Ionicons name="time-outline" size={18} color="#2563eb" />
                      <Text style={styles.detailSectionTitle}>
                        Operating Hours
                      </Text>
                    </View>

                    {groupedSchedule.length === 0 ? (
                      <Text style={styles.noDetailText}>
                        No operating hours are available.
                      </Text>
                    ) : (
                      <View style={styles.scheduleList}>
                        {groupedSchedule.map((item, scheduleIndex) => (
                          <View
                            key={`${item.label}-${scheduleIndex}`}
                            style={styles.scheduleGroupRow}
                          >
                            <View style={styles.scheduleDayBadge}>
                              <Text style={styles.scheduleDayBadgeText}>
                                {item.label}
                              </Text>
                            </View>

                            <View style={styles.scheduleTimeBlock}>
                              <Text
                                style={[
                                  styles.scheduleStatus,
                                  item.isOpen
                                    ? styles.openStatus
                                    : styles.closedStatus,
                                ]}
                              >
                                {item.isOpen ? "Open" : "Closed"}
                              </Text>

                              <Text
                                style={[
                                  styles.scheduleGroupHours,
                                  !item.isOpen &&
                                    styles.closedScheduleText,
                                ]}
                              >
                                {item.isOpen ? item.hours : "Closed"}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <Ionicons
                        name="medkit-outline"
                        size={18}
                        color="#2563eb"
                      />
                      <Text style={styles.detailSectionTitle}>
                        Dental Services
                      </Text>
                    </View>

                    {services.length === 0 ? (
                      <Text style={styles.noDetailText}>
                        No dental services are listed.
                      </Text>
                    ) : (
                      <View style={styles.allServicesWrap}>
                        {services.map((service) => (
                          <View key={service} style={styles.expandedServiceChip}>
                            <Text style={styles.expandedServiceText}>
                              {service}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <InfoRow
                    icon="call-outline"
                    label="Contact"
                    value={getClinicContact(clinic)}
                  />
                </View>
              ) : null}

              <View style={styles.clinicActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => focusClinicOnMap(clinic)}
                >
                  <Ionicons name="map-outline" size={16} color="#2b6cb0" />
                  <Text style={styles.secondaryButtonText}>Map</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => callClinic(clinic)}
                >
                  <Ionicons name="call-outline" size={16} color="#2b6cb0" />
                  <Text style={styles.secondaryButtonText}>Call</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openInBrowserMap(clinic)}
                >
                  <Ionicons name="open-outline" size={16} color="#2b6cb0" />
                  <Text style={styles.secondaryButtonText}>View Map</Text>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => openDirections(clinic)}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color="#ffffff"
                  />
                  <Text style={styles.primaryButtonText}>Directions</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#718096" />
      <Text style={styles.clinicDetail}>
        <Text style={styles.detailLabel}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionCardWrapper: {
    marginBottom: 14,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#718096",
    fontSize: 14,
  },
  header: {
    marginTop: 18,
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    fontWeight: "600",
  },
  mapCard: {
    height: 315,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#edf2f7",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  map: {
    width: "100%",
    height: "100%",
    backgroundColor: "#edf2f7",
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#edf2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  mapLoadingText: {
    marginTop: 8,
    color: "#718096",
    fontSize: 12,
    fontWeight: "700",
  },
  mapFloatingBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(26, 32, 44, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapFloatingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  locationActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  locationButton: {
    flex: 1.4,
    backgroundColor: "#2b6cb0",
    paddingVertical: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  locationButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  nearestButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    paddingVertical: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  nearestButtonText: {
    color: "#2b6cb0",
    fontSize: 14,
    fontWeight: "900",
  },
  nearestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nearestIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  nearestTextBlock: {
    flex: 1,
  },
  nearestLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "900",
    marginBottom: 2,
  },
  nearestName: {
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "900",
    marginBottom: 2,
  },
  nearestDistance: {
    fontSize: 13,
    color: "#2b6cb0",
    fontWeight: "900",
  },
  nearestMiniButton: {
    backgroundColor: "#2b6cb0",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 13,
  },
  nearestMiniButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    textAlign: "center",
  },
  clinicCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  selectedClinicCard: {
    borderColor: "#2b6cb0",
    backgroundColor: "#f7fbff",
  },
  clinicTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  clinicIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicTitleBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 5,
  },
  clinicName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    lineHeight: 23,
  },
  nearestBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  nearestBadgeText: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: "900",
  },
  clinicAddress: {
    fontSize: 13,
    color: "#718096",
    lineHeight: 19,
    fontWeight: "600",
  },
  distanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  distancePill: {
    backgroundColor: "#edf2f7",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  distanceText: {
    fontSize: 13,
    color: "#2b6cb0",
    fontWeight: "900",
  },
  coordinateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  coordinateBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  availableBadge: {
    backgroundColor: "#c6f6d5",
  },
  availableBadgeText: {
    color: "#2f855a",
  },
  unavailableBadge: {
    backgroundColor: "#fed7d7",
  },
  unavailableBadgeText: {
    color: "#c53030",
  },
  infoList: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  clinicDetail: {
    flex: 1,
    fontSize: 14,
    color: "#4a5568",
    lineHeight: 20,
    fontWeight: "600",
  },
  detailLabel: {
    color: "#2d3748",
    fontWeight: "900",
  },
  quickSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  quickSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
  },
  quickSummaryText: {
    color: "#1e40af",
    fontSize: 11,
    fontWeight: "800",
  },
  servicePreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  serviceChip: {
    maxWidth: "42%",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  serviceChipText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "700",
  },
  moreServicesChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  moreServicesText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "900",
  },
  detailsToggle: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  detailsToggleText: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: "900",
  },
  expandedDetails: {
    gap: 13,
    marginTop: 10,
    padding: 13,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
  },
  detailSection: {
    gap: 8,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailSectionTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
  scheduleList: {
    gap: 8,
  },
  scheduleGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  scheduleDayBadge: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 9,
  },
  scheduleDayBadgeText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  scheduleTimeBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  scheduleStatus: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  openStatus: {
    color: "#15803d",
  },
  closedStatus: {
    color: "#b91c1c",
  },
  scheduleGroupHours: {
    marginTop: 3,
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  closedScheduleText: {
    color: "#b91c1c",
  },
  noDetailText: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 17,
  },
  allServicesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  expandedServiceChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
  },
  expandedServiceText: {
    color: "#1e40af",
    fontSize: 10,
    fontWeight: "800",
  },
  clinicActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  primaryButton: {
    flexGrow: 1.4,
    backgroundColor: "#2b6cb0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  secondaryButton: {
    flexGrow: 1,
    backgroundColor: "#edf2f7",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  secondaryButtonText: {
    color: "#2b6cb0",
    fontSize: 12,
    fontWeight: "900",
  },
});