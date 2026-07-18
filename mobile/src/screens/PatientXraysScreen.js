import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getPatientDentalRecords } from "../services/dentalRecordService";
import {
  buildXrayFileUrl,
  getXraysByRecord,
} from "../services/xrayService";

const formatDate = (value) => {
  if (!value) return "No upload date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isPdf = (xray) =>
  String(xray?.file_path || "").toLowerCase().endsWith(".pdf");

const XrayCard = ({ xray, onOpen }) => (
  <View style={styles.xrayCard}>
    <View style={styles.previewContainer}>
      {isPdf(xray) ? (
        <View style={styles.pdfPreview}>
          <Ionicons name="document-outline" size={42} color="#b91c1c" />
          <Text style={styles.pdfPreviewText}>PDF X-ray</Text>
        </View>
      ) : (
        <Image
          source={{ uri: buildXrayFileUrl(xray.file_path) }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      )}
    </View>

    <View style={styles.cardContent}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>X-ray #{xray.xray_id}</Text>
          <Text style={styles.cardSubtitle}>
            Dental Record #{xray.record_id}
          </Text>
        </View>

        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>
            {isPdf(xray) ? "PDF" : "Image"}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="business-outline" size={17} color="#2563eb" />
        <Text style={styles.detailText}>
          {xray.record_context?.clinic_name || "Origin clinic unavailable"}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="medkit-outline" size={17} color="#2563eb" />
        <Text style={styles.detailText}>
          {xray.record_context?.dentist_name || "Dentist unavailable"}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="calendar-outline" size={17} color="#2563eb" />
        <Text style={styles.detailText}>{formatDate(xray.upload_date)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="scan-outline" size={17} color="#2563eb" />
        <Text style={styles.detailText}>
          {xray.tooth_number ? `Tooth ${xray.tooth_number}` : "General X-ray"}
        </Text>
      </View>

      <Pressable style={styles.openButton} onPress={() => onOpen(xray)}>
        <Ionicons name="expand-outline" size={19} color="#ffffff" />
        <Text style={styles.openButtonText}>Open X-ray Viewer</Text>
      </Pressable>
    </View>
  </View>
);

export default function PatientXraysScreen({
  token,
  onOpenXray,
}) {
  const [xrays, setXrays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPatientXrays();
  }, []);

  const normalizeRecords = (response) => {
    if (Array.isArray(response?.dental_records)) {
      return response.dental_records;
    }

    if (Array.isArray(response?.records)) {
      return response.records;
    }

    return [];
  };

  const loadPatientXrays = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const recordsResponse = await getPatientDentalRecords(token);
      const records = normalizeRecords(recordsResponse);

      const results = await Promise.all(
        records.map(async (record) => {
          try {
            const response = await getXraysByRecord({
              token,
              recordId: record.record_id,
            });

            const recordXrays = Array.isArray(response.xrays)
              ? response.xrays
              : [];

            return recordXrays.map((xray) => ({
              ...xray,
              record_context: record,
            }));
          } catch (error) {
            return [];
          }
        }),
      );

      setXrays(results.flat());
    } catch (error) {
      Alert.alert(
        "X-rays Error",
        error.message || "Unable to load Patient X-rays.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredXrays = useMemo(() => {
    const term = search.trim().toLowerCase();

    return xrays
      .filter((xray) => {
        if (!term) return true;

        return [
          xray.xray_id,
          xray.record_id,
          xray.tooth_number,
          xray.record_context?.clinic_name,
          xray.record_context?.dentist_name,
        ]
          .filter((value) => value !== null && value !== undefined)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort(
        (a, b) =>
          new Date(b.upload_date).getTime() -
          new Date(a.upload_date).getTime(),
      );
  }, [search, xrays]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading X-rays...</Text>
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
          onRefresh={() => loadPatientXrays({ refresh: true })}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>My X-rays</Text>
        <Text style={styles.subtitle}>
          View read-only dental X-rays and Dentist-reviewed findings.
        </Text>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#166534" />
        <Text style={styles.readOnlyText}>
          Patients can view Suggested and Confirmed annotations. Rejected
          findings remain hidden from the Patient view.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color="#64748b" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search X-ray, record, tooth, Dentist, or clinic"
          placeholderTextColor="#94a3b8"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={19} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>Available X-rays</Text>
        <Text style={styles.resultCount}>{filteredXrays.length}</Text>
      </View>

      {filteredXrays.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="image-outline" size={40} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No X-rays found</Text>
          <Text style={styles.emptyText}>
            No X-rays match the current search or dental records.
          </Text>
        </View>
      ) : (
        filteredXrays.map((xray) => (
          <XrayCard
            key={xray.xray_id}
            xray={xray}
            onOpen={onOpenXray}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 18, paddingBottom: 36 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
  },
  centerStateText: { color: "#64748b" },
  header: { marginBottom: 14 },
  title: { color: "#0f172a", fontSize: 27, fontWeight: "800" },
  subtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
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
    fontSize: 12,
    lineHeight: 18,
  },
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
  },
  searchInput: { flex: 1, color: "#0f172a" },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  resultTitle: { color: "#0f172a", fontSize: 19, fontWeight: "800" },
  resultCount: {
    minWidth: 24,
    paddingVertical: 3,
    paddingHorizontal: 7,
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  xrayCard: {
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  previewContainer: {
    height: 190,
    backgroundColor: "#0f172a",
  },
  previewImage: { width: "100%", height: "100%" },
  pdfPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
  },
  pdfPreviewText: { color: "#991b1b", fontWeight: "800" },
  cardContent: { gap: 11, padding: 14 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderText: { flex: 1 },
  cardTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  cardSubtitle: { marginTop: 3, color: "#64748b", fontSize: 11 },
  typeBadge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  typeBadgeText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "800",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  detailText: { flex: 1, color: "#475569", fontSize: 12 },
  openButton: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 2,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  openButtonText: { color: "#ffffff", fontWeight: "800" },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  emptyTitle: { color: "#334155", fontWeight: "800" },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});