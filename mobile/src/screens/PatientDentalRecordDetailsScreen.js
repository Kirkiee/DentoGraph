import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getDentalRecordDetails } from "../services/dentalRecordService";

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
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

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || "Not available"}</Text>
  </View>
);

const ToothCard = ({ tooth, history }) => {
  const relatedHistory = history.filter(
    (entry) => String(entry.tooth_number) === String(tooth.tooth_number),
  );
  const latestHistory = relatedHistory[0];

  return (
    <View style={styles.toothCard}>
      <View style={styles.toothHeader}>
        <Text style={styles.toothNumber}>Tooth {tooth.tooth_number}</Text>
        <View style={styles.toothStatusBadge}>
          <Text style={styles.toothStatusText}>
            {tooth.status || "Sound"}
          </Text>
        </View>
      </View>

      {tooth.notes ? (
        <Text style={styles.toothNotes}>{tooth.notes}</Text>
      ) : null}

      {latestHistory ? (
        <View style={styles.latestHistoryBox}>
          <Text style={styles.latestHistoryTitle}>Latest Status Change</Text>
          <Text style={styles.latestHistoryText}>
            {latestHistory.old_status || "Initial"} →{" "}
            {latestHistory.new_status || tooth.status}
          </Text>
          <Text style={styles.latestHistoryMeta}>
            {formatDate(latestHistory.created_at)}
            {latestHistory.changed_by_name
              ? ` · ${latestHistory.changed_by_name}`
              : ""}
          </Text>
          {latestHistory.notes ? (
            <Text style={styles.latestHistoryNotes}>
              {latestHistory.notes}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.noHistoryText}>
          No status-change history recorded.
        </Text>
      )}

      {relatedHistory.length > 1 ? (
        <Text style={styles.historyCountText}>
          {relatedHistory.length} recorded status changes
        </Text>
      ) : null}
    </View>
  );
};

export default function PatientDentalRecordDetailsScreen({
  token,
  recordId,
  onBack,
  onOpen3D,
}) {
  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [history, setHistory] = useState([]);
  const [policy, setPolicy] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDetails();
  }, [recordId]);

  const loadDetails = async ({ refresh = false } = {}) => {
    if (!recordId) {
      Alert.alert("Record Error", "No dental record was selected.");
      onBack?.();
      return;
    }

    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await getDentalRecordDetails({
        token,
        record_id: recordId,
      });

      setRecord(response.dental_record || null);
      setTeeth(Array.isArray(response.teeth) ? response.teeth : []);
      setTreatments(
        Array.isArray(response.treatments) ? response.treatments : [],
      );
      setHistory(
        Array.isArray(response.tooth_status_history)
          ? response.tooth_status_history
          : [],
      );
      setPolicy(response.policy || null);
    } catch (error) {
      Alert.alert(
        "Record Details Error",
        error.message || "Unable to load dental record details.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sortedTeeth = useMemo(
    () =>
      [...teeth].sort(
        (a, b) => Number(a.tooth_number) - Number(b.tooth_number),
      ),
    [teeth],
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading dental record...</Text>
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
        <Text style={styles.centerStateTitle}>Record unavailable</Text>
        <Pressable style={styles.backActionButton} onPress={onBack}>
          <Text style={styles.backActionButtonText}>Back to Records</Text>
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
        <Text style={styles.backButtonText}>Dental Records</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Dental Record #{record.record_id}</Text>
          <Text style={styles.subtitle}>
            Read-only clinical information from the originating clinic.
          </Text>
        </View>

        <View
          style={[
            styles.recordStatusBadge,
            String(record.status).toLowerCase() === "historical"
              ? styles.historicalBadge
              : styles.activeBadge,
          ]}
        >
          <Text
            style={[
              styles.recordStatusText,
              String(record.status).toLowerCase() === "historical"
                ? styles.historicalBadgeText
                : styles.activeBadgeText,
            ]}
          >
            {record.status || "Active"}
          </Text>
        </View>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="lock-closed-outline" size={20} color="#166534" />
        <Text style={styles.readOnlyText}>
          Patient access is read-only. The clinic and Dentist that created this
          record remain permanently identified.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Record Information</Text>
        <InfoRow label="Patient" value={record.patient_name} />
        <InfoRow label="Origin Clinic" value={record.clinic_name} />
        <InfoRow label="Treating Dentist" value={record.dentist_name} />
        <InfoRow
          label="Dentition"
          value={record.dentition_label || record.dentition_type}
        />
        <InfoRow label="Record Source" value={getSourceLabel(record.record_source)} />
        <InfoRow label="Created" value={formatDate(record.date_created)} />
        <InfoRow label="Last Updated" value={formatDate(record.last_updated)} />

        {record.source_notes ? (
          <View style={styles.sourceNotesBox}>
            <Text style={styles.sourceNotesLabel}>Source Notes</Text>
            <Text style={styles.sourceNotesText}>{record.source_notes}</Text>
          </View>
        ) : null}
      </View>

      {onOpen3D ? (
        <Pressable style={styles.threeDButton} onPress={() => onOpen3D(record)}>
          <Ionicons name="cube-outline" size={21} color="#ffffff" />
          <View style={styles.threeDButtonTextBlock}>
            <Text style={styles.threeDButtonTitle}>Open 3D Dental Chart</Text>
            <Text style={styles.threeDButtonSubtitle}>
              View tooth conditions and full status history.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color="#ffffff" />
        </Pressable>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Teeth Overview</Text>
          <Text style={styles.countBadge}>{sortedTeeth.length}</Text>
        </View>

        {sortedTeeth.length === 0 ? (
          <Text style={styles.emptyText}>
            No tooth conditions have been recorded.
          </Text>
        ) : (
          sortedTeeth.map((tooth) => (
            <ToothCard
              key={tooth.tooth_id || tooth.tooth_number}
              tooth={tooth}
              history={history}
            />
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Treatment History</Text>
          <Text style={styles.countBadge}>{treatments.length}</Text>
        </View>

        {treatments.length === 0 ? (
          <Text style={styles.emptyText}>
            No treatments have been recorded for this dental record.
          </Text>
        ) : (
          treatments.map((treatment) => (
            <View
              key={treatment.treatment_id}
              style={styles.treatmentCard}
            >
              <View style={styles.treatmentHeader}>
                <Text style={styles.treatmentTitle}>
                  {treatment.procedure_type || "Dental Treatment"}
                </Text>
                <Text style={styles.treatmentTooth}>
                  Tooth {treatment.tooth_number}
                </Text>
              </View>

              {treatment.description ? (
                <Text style={styles.treatmentDescription}>
                  {treatment.description}
                </Text>
              ) : null}

              <Text style={styles.treatmentDate}>
                {formatDate(treatment.treatment_date)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tooth-Status History</Text>
          <Text style={styles.countBadge}>{history.length}</Text>
        </View>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>
            No tooth-status changes have been recorded.
          </Text>
        ) : (
          history.map((entry) => (
            <View key={entry.history_id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTooth}>
                  Tooth {entry.tooth_number}
                </Text>
                <Text style={styles.historyDate}>
                  {formatDate(entry.created_at)}
                </Text>
              </View>

              <Text style={styles.historyChange}>
                {entry.old_status || "Initial"} → {entry.new_status}
              </Text>

              <Text style={styles.historyActor}>
                {entry.changed_by_name || "System"}
                {entry.changed_by_role ? ` · ${entry.changed_by_role}` : ""}
              </Text>

              {entry.notes ? (
                <Text style={styles.historyNotes}>{entry.notes}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>

      {policy?.applied_rules?.length ? (
        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>
            {policy.name || "Dental Record Policy"}
          </Text>
          {policy.applied_rules.map((rule) => (
            <View key={rule} style={styles.policyRule}>
              <Ionicons name="checkmark-circle" size={17} color="#166534" />
              <Text style={styles.policyRuleText}>{rule}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  centerStateText: {
    color: "#64748b",
  },
  centerStateTitle: {
    color: "#334155",
    fontSize: 18,
    fontWeight: "800",
  },
  backActionButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
    borderRadius: 10,
  },
  backActionButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 11,
    paddingVertical: 7,
  },
  backButtonText: {
    color: "#1d4ed8",
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 25,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  recordStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  recordStatusText: {
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
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 15,
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
  sectionCard: {
    gap: 11,
    marginBottom: 15,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
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
  infoRow: {
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  infoValue: {
    marginTop: 3,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
  sourceNotesBox: {
    padding: 11,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  sourceNotesLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  sourceNotesText: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  threeDButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 15,
    padding: 15,
    backgroundColor: "#2563eb",
    borderRadius: 14,
  },
  threeDButtonTextBlock: {
    flex: 1,
  },
  threeDButtonTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  threeDButtonSubtitle: {
    marginTop: 3,
    color: "#dbeafe",
    fontSize: 11,
  },
  toothCard: {
    gap: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  toothHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  toothNumber: {
    color: "#0f172a",
    fontWeight: "800",
  },
  toothStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  toothStatusText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "800",
  },
  toothNotes: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  latestHistoryBox: {
    padding: 9,
    backgroundColor: "#ffffff",
    borderRadius: 9,
  },
  latestHistoryTitle: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  latestHistoryText: {
    marginTop: 3,
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  latestHistoryMeta: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
  },
  latestHistoryNotes: {
    marginTop: 4,
    color: "#475569",
    fontSize: 11,
  },
  noHistoryText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  historyCountText: {
    color: "#64748b",
    fontSize: 10,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  treatmentCard: {
    gap: 6,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 11,
  },
  treatmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
  },
  treatmentTitle: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "800",
  },
  treatmentTooth: {
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "800",
  },
  treatmentDescription: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  treatmentDate: {
    color: "#64748b",
    fontSize: 10,
  },
  historyCard: {
    gap: 5,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 11,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
  },
  historyTooth: {
    color: "#0f172a",
    fontWeight: "800",
  },
  historyDate: {
    color: "#64748b",
    fontSize: 10,
  },
  historyChange: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  historyActor: {
    color: "#64748b",
    fontSize: 10,
  },
  historyNotes: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 17,
  },
  policyCard: {
    gap: 9,
    padding: 15,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 14,
  },
  policyTitle: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "800",
  },
  policyRule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  policyRuleText: {
    flex: 1,
    color: "#166534",
    fontSize: 11,
    lineHeight: 17,
  },
});