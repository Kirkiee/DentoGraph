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
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

import { getClinics } from "../services/clinicService";

export default function PatientClinicDiscoveryScreen({ token }) {
  const mapRef = useRef(null);

  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const clinicsWithLocation = useMemo(() => {
    return clinics
      .map((clinic) => {
        const latitude = getClinicLatitude(clinic);
        const longitude = getClinicLongitude(clinic);

        return {
          ...clinic,
          _latitude: latitude,
          _longitude: longitude,
        };
      })
      .filter(
        (clinic) => clinic._latitude !== null && clinic._longitude !== null
      );
  }, [clinics]);

  const defaultRegion = {
    latitude: userLocation?.latitude || 14.5995,
    longitude: userLocation?.longitude || 120.9842,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const getCurrentLocation = async () => {
    try {
      setLocationLoading(true);

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location Permission Needed",
          "Clinic Discovery needs your location to show nearby dental clinics."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(currentLocation);

      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            ...currentLocation,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          },
          600
        );
      }, 300);
    } catch (error) {
      Alert.alert(
        "Location Error",
        error.message || "Unable to get your current location."
      );
    } finally {
      setLocationLoading(false);
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

  const focusClinicOnMap = (clinic) => {
    setSelectedClinic(clinic);

    const latitude = getClinicLatitude(clinic);
    const longitude = getClinicLongitude(clinic);

    if (latitude === null || longitude === null) {
      Alert.alert(
        "No Map Location",
        "This clinic does not have latitude and longitude yet."
      );
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      600
    );
  };

  const openDirections = (clinic) => {
    const latitude = getClinicLatitude(clinic);
    const longitude = getClinicLongitude(clinic);
    const clinicName = encodeURIComponent(getClinicName(clinic));

    if (latitude === null || longitude === null) {
      Alert.alert(
        "No Map Location",
        "Directions are unavailable because this clinic has no map coordinates."
      );
      return;
    }

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${clinicName}`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${clinicName}`;

    Linking.openURL(url);
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
        <Text style={styles.title}>Clinic Discovery</Text>

        <Text style={styles.subtitle}>
          Find nearby dental clinics and view them on the map.
        </Text>
      </View>

      <View style={styles.mapCard}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={defaultRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {clinicsWithLocation.map((clinic, index) => (
            <Marker
              key={clinic.clinic_id || index}
              coordinate={{
                latitude: clinic._latitude,
                longitude: clinic._longitude,
              }}
              title={getClinicName(clinic)}
              description={getClinicAddress(clinic)}
              onPress={() => setSelectedClinic(clinic)}
            />
          ))}
        </MapView>

        <View style={styles.mapFloatingBadge}>
          <Text style={styles.mapFloatingText}>
            {clinicsWithLocation.length} clinic marker
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
            <Text style={styles.locationButtonText}>Use My Location</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Available Clinics</Text>

      {clinics.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No clinics found</Text>
          <Text style={styles.emptyText}>
            Clinics added in DentoGraph will appear here for patients.
          </Text>
        </View>
      ) : (
        clinics.map((clinic, index) => {
          const latitude = getClinicLatitude(clinic);
          const longitude = getClinicLongitude(clinic);
          const hasCoordinates = latitude !== null && longitude !== null;
          const isSelected =
            selectedClinic &&
            (selectedClinic.clinic_id === clinic.clinic_id ||
              selectedClinic === clinic);

          return (
            <View
              key={clinic.clinic_id || index}
              style={[
                styles.clinicCard,
                isSelected && styles.selectedClinicCard,
              ]}
            >
              <View style={styles.clinicTopRow}>
                <View style={styles.clinicTitleBlock}>
                  <Text style={styles.clinicName}>{getClinicName(clinic)}</Text>
                  <Text style={styles.clinicAddress}>
                    {getClinicAddress(clinic)}
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
                    {hasCoordinates ? "Mapped" : "No GPS"}
                  </Text>
                </View>
              </View>

              <Text style={styles.clinicDetail}>
                Contact: {getClinicContact(clinic)}
              </Text>

              {clinic.email ? (
                <Text style={styles.clinicDetail}>Email: {clinic.email}</Text>
              ) : null}

              {clinic.operating_hours ? (
                <Text style={styles.clinicDetail}>
                  Hours: {clinic.operating_hours}
                </Text>
              ) : null}

              <View style={styles.clinicActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => focusClinicOnMap(clinic)}
                >
                  <Text style={styles.secondaryButtonText}>View Map</Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => callClinic(clinic)}
                >
                  <Text style={styles.secondaryButtonText}>Call</Text>
                </Pressable>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => openDirections(clinic)}
                >
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

const styles = StyleSheet.create({
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
    marginTop: 22,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#718096",
    lineHeight: 21,
  },
  mapCard: {
    height: 330,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#edf2f7",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapFloatingBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(26, 32, 44, 0.78)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  mapFloatingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  locationActions: {
    marginBottom: 20,
  },
  locationButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  locationButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
  },
  clinicCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
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
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  clinicTitleBlock: {
    flex: 1,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 5,
  },
  clinicAddress: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
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
  clinicDetail: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 5,
  },
  clinicActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#2b6cb0",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2b6cb0",
    fontSize: 13,
    fontWeight: "900",
  },
});