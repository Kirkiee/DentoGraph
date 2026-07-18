import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  buildXrayFileUrl,
  getXrayAnnotations,
  getXrayById,
} from "../services/xrayService";

const formatDateTime = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getMarkerColor = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "confirmed") return "#16a34a";
  if (normalized === "rejected") return "#dc2626";
  return "#f59e0b";
};

const isPdf = (xray) =>
  String(xray?.file_path || "").toLowerCase().endsWith(".pdf");

export default function PatientXrayDetailsScreen({
  token,
  xrayId,
  onBack,
}) {
  const [xray, setXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [xrayId]);

  const loadDetails = async ({ refresh = false } = {}) => {
    if (!xrayId) {
      Alert.alert("X-ray Error", "No X-ray was selected.");
      onBack?.();
      return;
    }

    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const [xrayResponse, annotationResponse] = await Promise.all([
        getXrayById({ token, xrayId }),
        getXrayAnnotations({ token, xrayId }),
      ]);

      setXray(xrayResponse.xray || null);
      setAnnotations(
        Array.isArray(annotationResponse.annotations)
          ? annotationResponse.annotations
          : [],
      );
    } catch (error) {
      Alert.alert(
        "X-ray Viewer Error",
        error.message || "Unable to load the selected X-ray.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const visibleAnnotations = useMemo(
    () =>
      annotations.filter((annotation) =>
        ["suggested", "confirmed"].includes(
          String(annotation.status || "").toLowerCase(),
        ),
      ),
    [annotations],
  );

  const selectedAnnotation = useMemo(
    () =>
      visibleAnnotations.find(
        (annotation) =>
          Number(annotation.annotation_id) === Number(selectedAnnotationId),
      ) || null,
    [selectedAnnotationId, visibleAnnotations],
  );

  const openPdf = async () => {
    const url = buildXrayFileUrl(xray?.file_path);

    if (!url) return;

    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("PDF Error", "No application can open this PDF file.");
      return;
    }

    await Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading X-ray viewer...</Text>
      </View>
    );
  }

  if (!xray) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
        <Text style={styles.centerStateTitle}>X-ray unavailable</Text>
        <Pressable style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to X-rays</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDetails({ refresh: true })}
        />
      }
    >
      <Pressable style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color="#1d4ed8" />
        <Text style={styles.backButtonText}>My X-rays</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>X-ray #{xray.xray_id}</Text>
        <Text style={styles.subtitle}>
          Dental Record #{xray.record_id}
          {xray.tooth_number ? ` · Tooth ${xray.tooth_number}` : " · General"}
        </Text>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="lock-closed-outline" size={19} color="#166534" />
        <Text style={styles.readOnlyText}>
          This is a read-only Patient view. Orange markers are Suggested
          findings and green markers are Dentist-confirmed findings.
        </Text>
      </View>

      {isPdf(xray) ? (
        <View style={styles.pdfCard}>
          <Ionicons name="document-text-outline" size={50} color="#b91c1c" />
          <Text style={styles.pdfTitle}>PDF Dental X-ray</Text>
          <Text style={styles.pdfText}>
            PDF files open using your device's supported viewer.
          </Text>
          <Pressable style={styles.primaryButton} onPress={openPdf}>
            <Ionicons name="open-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Open PDF</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={styles.imageStage}
          onLayout={(event) => {
            setImageLayout(event.nativeEvent.layout);
          }}
        >
          <Image
            source={{ uri: buildXrayFileUrl(xray.file_path) }}
            style={styles.xrayImage}
            resizeMode="contain"
          />

          {imageLayout.width > 0
            ? visibleAnnotations.map((annotation) => {
                const left =
                  (Number(annotation.x_position || 0) / 100) *
                  imageLayout.width;
                const top =
                  (Number(annotation.y_position || 0) / 100) *
                  imageLayout.height;
                const selected =
                  Number(selectedAnnotationId) ===
                  Number(annotation.annotation_id);

                return (
                  <Pressable
                    key={annotation.annotation_id}
                    style={[
                      styles.marker,
                      {
                        left: Math.max(0, left - 15),
                        top: Math.max(0, top - 15),
                        backgroundColor: getMarkerColor(annotation.status),
                      },
                      selected && styles.markerSelected,
                    ]}
                    onPress={() =>
                      setSelectedAnnotationId(annotation.annotation_id)
                    }
                  >
                    <Text style={styles.markerText}>!</Text>
                  </Pressable>
                );
              })
            : null}
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>X-ray Information</Text>
        <Text style={styles.infoLine}>
          Uploaded: {formatDateTime(xray.upload_date)}
        </Text>
        <Text style={styles.infoLine}>
          Tooth: {xray.tooth_number ? `Tooth ${xray.tooth_number}` : "General"}
        </Text>
        <Text style={styles.infoLine}>
          File: {String(xray.file_path || "").split("/").pop() || "Unknown"}
        </Text>
      </View>

      {selectedAnnotation ? (
        <View style={styles.selectedFindingCard}>
          <View style={styles.findingHeader}>
            <Text style={styles.findingTitle}>
              {selectedAnnotation.label || "X-ray Finding"}
            </Text>
            <View
              style={[
                styles.findingBadge,
                {
                  backgroundColor: getMarkerColor(selectedAnnotation.status),
                },
              ]}
            >
              <Text style={styles.findingBadgeText}>
                {selectedAnnotation.status || "Suggested"}
              </Text>
            </View>
          </View>

          <Text style={styles.findingText}>
            {selectedAnnotation.note || "No finding note was provided."}
          </Text>

          {selectedAnnotation.dentist_name ? (
            <Text style={styles.findingMeta}>
              Reviewed by {selectedAnnotation.dentist_name}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.annotationCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Visible Findings</Text>
          <Text style={styles.countBadge}>{visibleAnnotations.length}</Text>
        </View>

        {visibleAnnotations.length === 0 ? (
          <Text style={styles.emptyText}>
            No Suggested or Confirmed annotations are available.
          </Text>
        ) : (
          visibleAnnotations.map((annotation) => (
            <Pressable
              key={annotation.annotation_id}
              style={[
                styles.annotationRow,
                Number(selectedAnnotationId) ===
                  Number(annotation.annotation_id) &&
                  styles.annotationRowSelected,
              ]}
              onPress={() =>
                setSelectedAnnotationId(annotation.annotation_id)
              }
            >
              <View
                style={[
                  styles.annotationDot,
                  {
                    backgroundColor: getMarkerColor(annotation.status),
                  },
                ]}
              />

              <View style={styles.annotationTextBlock}>
                <Text style={styles.annotationLabel}>
                  {annotation.label || "X-ray Finding"}
                </Text>
                <Text style={styles.annotationStatus}>
                  {annotation.status || "Suggested"}
                </Text>
                {annotation.note ? (
                  <Text style={styles.annotationNote}>{annotation.note}</Text>
                ) : null}
              </View>

              <Ionicons name="locate-outline" size={20} color="#64748b" />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 18, paddingBottom: 40 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 22,
    backgroundColor: "#f8fafc",
  },
  centerStateText: { color: "#64748b" },
  centerStateTitle: {
    color: "#334155",
    fontSize: 17,
    fontWeight: "800",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 10,
    paddingVertical: 7,
  },
  backButtonText: { color: "#1d4ed8", fontWeight: "800" },
  header: { marginBottom: 13 },
  title: { color: "#0f172a", fontSize: 25, fontWeight: "800" },
  subtitle: { marginTop: 5, color: "#64748b", fontSize: 12 },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 14,
    padding: 13,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 13,
  },
  readOnlyText: {
    flex: 1,
    color: "#166534",
    fontSize: 11,
    lineHeight: 17,
  },
  imageStage: {
    width: "100%",
    height: 330,
    overflow: "hidden",
    marginBottom: 15,
    backgroundColor: "#020617",
    borderRadius: 14,
  },
  xrayImage: { width: "100%", height: "100%" },
  marker: {
    position: "absolute",
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 15,
  },
  markerSelected: {
    width: 36,
    height: 36,
    marginLeft: -3,
    marginTop: -3,
    borderWidth: 3,
  },
  markerText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
  },
  pdfCard: {
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
    padding: 24,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
  },
  pdfTitle: { color: "#991b1b", fontSize: 17, fontWeight: "800" },
  pdfText: {
    color: "#b91c1c",
    fontSize: 12,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 15,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "800" },
  infoCard: {
    gap: 7,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  sectionTitle: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  infoLine: { color: "#475569", fontSize: 12 },
  selectedFindingCard: {
    gap: 8,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
  },
  findingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  findingTitle: {
    flex: 1,
    color: "#1e3a8a",
    fontSize: 15,
    fontWeight: "800",
  },
  findingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  findingBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  findingText: { color: "#1e40af", fontSize: 12, lineHeight: 18 },
  findingMeta: { color: "#3b82f6", fontSize: 10 },
  annotationCard: {
    gap: 10,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    minWidth: 24,
    paddingVertical: 3,
    paddingHorizontal: 7,
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  annotationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  annotationRowSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  annotationDot: { width: 12, height: 12, borderRadius: 6 },
  annotationTextBlock: { flex: 1 },
  annotationLabel: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  annotationStatus: { marginTop: 2, color: "#64748b", fontSize: 10 },
  annotationNote: {
    marginTop: 4,
    color: "#475569",
    fontSize: 11,
    lineHeight: 16,
  },
  emptyText: { color: "#64748b", fontSize: 12, lineHeight: 18 },
});