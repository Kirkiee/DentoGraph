import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const SOURCE_OPTIONS = [
  { value: "All", label: "All Sources" },
  { value: "NEW_SYSTEM_RECORD", label: "New System" },
  { value: "OLD_ENCODED_RECORD", label: "Old Encoded" },
  { value: "SCANNED_OLD_RECORD", label: "Scanned Old" },
  { value: "PDA_BASED_RECORD", label: "PDA-Based" },
];

const STATUS_OPTIONS = ["All", "Active", "Historical"];

const formatDate = (value) => {
  if (!value) return "No date";

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

const getSourceLabel = (source) => {
  switch (source) {
    case "OLD_ENCODED_RECORD":
      return "Old Encoded Record";
    case "SCANNED_OLD_RECORD":
      return "Scanned Old Record";
    case "PDA_BASED_RECORD":
      return "PDA-Based Record";
    default:
      return "New System Record";
  }
};

const FilterChip = ({ label, selected, onPress }) => (
  <Pressable
    style={[styles.filterChip, selected && styles.filterChipSelected]}
    onPress={onPress}
  >
    <Text
      style={[
        styles.filterChipText,
        selected && styles.filterChipTextSelected,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const RecordCard = ({ record, onOpen }) => {
  const status = record.status || "Active";
  const historical = status.toLowerCase() === "historical";

  return (
    <View style={styles.recordCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.recordTitle}>
            Dental Record #{record.record_id}
          </Text>
          <Text style={styles.recordDate}>
            Created {formatDate(record.date_created)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            historical ? styles.historicalBadge : styles.activeBadge,
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              historical
                ? styles.historicalBadgeText
                : styles.activeBadgeText,
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="business-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Origin Clinic</Text>
          <Text style={styles.detailValue}>
            {record.clinic_name || "Clinic not available"}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="medkit-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Dentist</Text>
          <Text style={styles.detailValue}>
            {record.dentist_name || "Dentist not available"}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="document-text-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Record Source</Text>
          <Text style={styles.detailValue}>
            {getSourceLabel(record.record_source)}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="refresh-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Last Updated</Text>
          <Text style={styles.detailValue}>
            {formatDate(record.last_updated)}
          </Text>
        </View>
      </View>

      {record.source_notes ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Source Notes</Text>
          <Text style={styles.noteText}>{record.source_notes}</Text>
        </View>
      ) : null}

      <Pressable style={styles.openButton} onPress={() => onOpen(record)}>
        <Ionicons name="eye-outline" size={19} color="#ffffff" />
        <Text style={styles.openButtonText}>View Full Record</Text>
      </Pressable>
    </View>
  );
};

export default function PatientDentalRecordsScreen({
  token,
  onOpenRecord,
}) {
  const [records, setRecords] = useState([]);
  const [assignedClinicName, setAssignedClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest");

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await getPatientDentalRecords(token);
      setRecords(
        Array.isArray(response.dental_records)
          ? response.dental_records
          : Array.isArray(response.records)
            ? response.records
            : [],
      );
      setAssignedClinicName(response.assigned_clinic_name || "");
    } catch (error) {
      Alert.alert(
        "Dental Records Error",
        error.message || "Unable to load dental records.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records
      .filter((record) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            record.record_id,
            record.dentist_name,
            record.clinic_name,
            record.record_source,
            record.source_notes,
          ]
            .filter((value) => value !== null && value !== undefined)
            .some((value) =>
              String(value).toLowerCase().includes(normalizedSearch),
            );

        const recordStatus = String(record.status || "Active");
        const matchesStatus =
          statusFilter === "All" || recordStatus === statusFilter;

        const matchesSource =
          sourceFilter === "All" ||
          String(record.record_source || "NEW_SYSTEM_RECORD") === sourceFilter;

        return matchesSearch && matchesStatus && matchesSource;
      })
      .sort((a, b) => {
        const left = new Date(a.date_created).getTime() || 0;
        const right = new Date(b.date_created).getTime() || 0;

        return sortOrder === "Newest" ? right - left : left - right;
      });
  }, [records, search, sourceFilter, sortOrder, statusFilter]);

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading dental records...</Text>
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
          onRefresh={() => loadRecords({ refresh: true })}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Dental Records</Text>
        <Text style={styles.subtitle}>
          {assignedClinicName
            ? `Active records from ${assignedClinicName}`
            : "View your read-only clinical dental records."}
        </Text>
      </View>

      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark-outline" size={21} color="#166534" />
        <Text style={styles.privacyBannerText}>
          Records are read-only and tied to your authenticated Patient account.
          The origin clinic and treating Dentist remain preserved.
        </Text>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search record ID, Dentist, clinic, or notes"
            placeholderTextColor="#94a3b8"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={19} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.filterLabel}>Record Status</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_OPTIONS.map((status) => (
            <FilterChip
              key={status}
              label={status}
              selected={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Record Source</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {SOURCE_OPTIONS.map((source) => (
            <FilterChip
              key={source.value}
              label={source.label}
              selected={sourceFilter === source.value}
              onPress={() => setSourceFilter(source.value)}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Sort</Text>
        <View style={styles.filterRow}>
          {["Newest", "Oldest"].map((option) => (
            <FilterChip
              key={option}
              label={option}
              selected={sortOrder === option}
              onPress={() => setSortOrder(option)}
            />
          ))}
        </View>
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>Records</Text>
        <Text style={styles.resultCount}>{filteredRecords.length}</Text>
      </View>

      {filteredRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={38} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No dental records found</Text>
          <Text style={styles.emptyText}>
            No records match the selected search and filters.
          </Text>
        </View>
      ) : (
        filteredRecords.map((record) => (
          <RecordCard
            key={record.record_id}
            record={record}
            onOpen={onOpenRecord}
          />
        ))
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
    padding: 18,
    paddingBottom: 36,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
  },
  centerStateText: {
    color: "#64748b",
  },
  header: {
    marginBottom: 14,
  },
  title: {
    color: "#0f172a",
    fontSize: 27,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  privacyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 15,
    padding: 13,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 13,
  },
  privacyBannerText: {
    flex: 1,
    color: "#166534",
    fontSize: 12,
    lineHeight: 18,
  },
  filterCard: {
    gap: 11,
    marginBottom: 18,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 15,
  },
  searchBox: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
  },
  filterLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    gap: 7,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
  },
  filterChipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterChipText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextSelected: {
    color: "#ffffff",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  resultTitle: {
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
  },
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
  recordCard: {
    gap: 13,
    marginBottom: 13,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  recordTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  recordDate: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  activeBadge: {
    backgroundColor: "#dcfce7",
  },
  activeBadgeText: {
    color: "#15803d",
  },
  historicalBadge: {
    backgroundColor: "#e2e8f0",
  },
  historicalBadgeText: {
    color: "#475569",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  detailTextBlock: {
    flex: 1,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  detailValue: {
    marginTop: 2,
    color: "#334155",
    fontSize: 13,
  },
  noteBox: {
    padding: 11,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  noteLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  noteText: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  openButton: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  openButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    gap: 7,
    padding: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  emptyTitle: {
    color: "#334155",
    fontWeight: "800",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});