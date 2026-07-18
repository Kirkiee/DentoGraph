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

import { getPatientHistoricalRecords } from "../services/patientHistoryService";

const formatDate = (value, fallback = "Present") => {
  if (!value) return fallback;

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

const SummaryCard = ({ label, value, description }) => (
  <View style={styles.summaryCard}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
    <Text style={styles.summaryDescription}>{description}</Text>
  </View>
);

const RecordCard = ({ record, onOpenRecord, onOpenXray }) => (
  <View style={styles.recordCard}>
    <View style={styles.recordHeader}>
      <View style={styles.recordHeaderText}>
        <Text style={styles.recordTitle}>
          Dental Record #{record.record_id}
        </Text>
        <Text style={styles.recordDate}>
          Created {formatDate(record.date_created)}
        </Text>
      </View>

      <View
        style={[
          styles.smallBadge,
          record.is_historical
            ? styles.historicalBadge
            : styles.activeBadge,
        ]}
      >
        <Text
          style={[
            styles.smallBadgeText,
            record.is_historical
              ? styles.historicalBadgeText
              : styles.activeBadgeText,
          ]}
        >
          {record.is_historical ? "Historical" : record.status || "Active"}
        </Text>
      </View>
    </View>

    <Text style={styles.recordLine}>
      Dentist: {record.dentist_name || "Not available"}
    </Text>
    <Text style={styles.recordLine}>
      Origin clinic: {record.clinic_name || "Not available"}
    </Text>
    <Text style={styles.recordLine}>
      Teeth recorded: {Array.isArray(record.teeth) ? record.teeth.length : 0}
    </Text>
    <Text style={styles.recordLine}>
      X-rays: {Array.isArray(record.xrays) ? record.xrays.length : 0}
    </Text>

    <View style={styles.recordActions}>
      <Pressable
        style={styles.secondaryButton}
        onPress={() => onOpenRecord(record)}
      >
        <Ionicons name="document-text-outline" size={17} color="#1d4ed8" />
        <Text style={styles.secondaryButtonText}>View Record</Text>
      </Pressable>

      {Array.isArray(record.xrays) && record.xrays.length > 0 ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => onOpenXray(record.xrays[0])}
        >
          <Ionicons name="image-outline" size={17} color="#1d4ed8" />
          <Text style={styles.secondaryButtonText}>Open X-ray</Text>
        </Pressable>
      ) : null}
    </View>
  </View>
);

const AppointmentCard = ({ appointment }) => (
  <View style={styles.appointmentCard}>
    <View style={styles.appointmentHeader}>
      <Text style={styles.appointmentTitle}>
        {appointment.appointment_type || "Dental Appointment"}
      </Text>
      <View style={styles.appointmentStatus}>
        <Text style={styles.appointmentStatusText}>
          {appointment.status || "Pending"}
        </Text>
      </View>
    </View>

    <Text style={styles.appointmentLine}>
      {formatDateTime(appointment.appointment_date)}
    </Text>
    <Text style={styles.appointmentLine}>
      Dentist: {appointment.dentist_name || "Not available"}
    </Text>

    {appointment.notes ? (
      <Text style={styles.appointmentNotes}>{appointment.notes}</Text>
    ) : null}
  </View>
);

const EpisodeCard = ({
  episode,
  expanded,
  onToggle,
  onOpenRecord,
  onOpenXray,
}) => {
  const records = Array.isArray(episode.records) ? episode.records : [];
  const appointments = Array.isArray(episode.appointments)
    ? episode.appointments
    : [];

  return (
    <View
      style={[
        styles.episodeCard,
        episode.episode_status === "Active" && styles.activeEpisodeCard,
      ]}
    >
      <Pressable style={styles.episodeHeader} onPress={onToggle}>
        <View style={styles.episodeHeaderText}>
          <View
            style={[
              styles.episodeStatus,
              episode.episode_status === "Active"
                ? styles.activeEpisodeStatus
                : styles.historicalEpisodeStatus,
            ]}
          >
            <Text
              style={[
                styles.episodeStatusText,
                episode.episode_status === "Active"
                  ? styles.activeEpisodeStatusText
                  : styles.historicalEpisodeStatusText,
              ]}
            >
              {episode.episode_status}
            </Text>
          </View>

          <Text style={styles.episodeClinic}>{episode.clinic_name}</Text>
          <Text style={styles.episodeDates}>
            {formatDate(episode.started_at)} – {formatDate(episode.ended_at)}
          </Text>
        </View>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color="#475569"
        />
      </Pressable>

      {expanded ? (
        <View style={styles.episodeContent}>
          <View style={styles.episodeSummaryRow}>
            <Text style={styles.episodeSummaryText}>
              {records.length} dental record{records.length === 1 ? "" : "s"}
            </Text>
            <Text style={styles.episodeSummaryText}>
              {appointments.length} appointment
              {appointments.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Dental Records</Text>

          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              No dental records were created during this care episode.
            </Text>
          ) : (
            records.map((record) => (
              <RecordCard
                key={record.record_id}
                record={record}
                onOpenRecord={onOpenRecord}
                onOpenXray={onOpenXray}
              />
            ))
          )}

          <Text style={styles.subsectionTitle}>Appointments</Text>

          {appointments.length === 0 ? (
            <Text style={styles.emptyText}>
              No appointments were recorded during this care episode.
            </Text>
          ) : (
            appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.appointment_id}
                appointment={appointment}
              />
            ))
          )}
        </View>
      ) : null}
    </View>
  );
};

export default function PatientHistoricalRecordsScreen({
  token,
  onOpenRecord,
  onOpenXray,
}) {
  const [patient, setPatient] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [expandedEpisodeId, setExpandedEpisodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await getPatientHistoricalRecords(token);

      const careEpisodes = Array.isArray(response.care_episodes)
        ? response.care_episodes
        : [];

      setPatient(response.patient || null);
      setAssignments(
        Array.isArray(response.assignments) ? response.assignments : [],
      );
      setEpisodes(careEpisodes);

      setExpandedEpisodeId((current) => {
        if (
          current &&
          careEpisodes.some(
            (episode) =>
              Number(episode.care_episode_id) === Number(current),
          )
        ) {
          return current;
        }

        return careEpisodes[0]?.care_episode_id || null;
      });
    } catch (error) {
      Alert.alert(
        "Historical Records Error",
        error.message || "Unable to load historical dental records.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const historicalCount = useMemo(
    () =>
      episodes.filter(
        (episode) => episode.episode_status === "Historical",
      ).length,
    [episodes],
  );

  const currentAssignment = useMemo(
    () =>
      assignments.find(
        (assignment) => assignment.assignment_status === "Current",
      ) || null,
    [assignments],
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>
          Loading historical records...
        </Text>
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
          onRefresh={() => loadHistory({ refresh: true })}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Historical Records</Text>
        <Text style={styles.subtitle}>
          Review your complete clinic and care-episode timeline.
        </Text>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="lock-closed-outline" size={20} color="#166534" />
        <Text style={styles.readOnlyText}>
          Previous clinic records are preserved as read-only. Their original
          clinic, Dentist, dates, treatments, and X-rays remain unchanged.
        </Text>
      </View>

      <View style={styles.patientCard}>
        <Text style={styles.patientName}>
          {patient?.patient_name || "DentoGraph Patient"}
        </Text>
        <Text style={styles.patientEmail}>
          {patient?.patient_email || ""}
        </Text>
        <Text style={styles.currentClinic}>
          Current clinic:{" "}
          {patient?.current_clinic_name ||
            currentAssignment?.clinic_name ||
            "Not assigned"}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Care Episodes"
          value={episodes.length}
          description="Complete clinic timeline"
        />
        <SummaryCard
          label="Historical"
          value={historicalCount}
          description="Previous care periods"
        />
        <SummaryCard
          label="Assignments"
          value={assignments.length}
          description="Clinic assignment history"
        />
      </View>

      <Text style={styles.timelineTitle}>Care Episode Timeline</Text>

      {episodes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={38} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No care episodes found</Text>
          <Text style={styles.emptyText}>
            Historical records will appear after clinic assignments and
            transfers are recorded.
          </Text>
        </View>
      ) : (
        episodes.map((episode) => (
          <EpisodeCard
            key={episode.care_episode_id}
            episode={episode}
            expanded={
              Number(expandedEpisodeId) ===
              Number(episode.care_episode_id)
            }
            onToggle={() =>
              setExpandedEpisodeId((current) =>
                Number(current) === Number(episode.care_episode_id)
                  ? null
                  : episode.care_episode_id,
              )
            }
            onOpenRecord={onOpenRecord}
            onOpenXray={onOpenXray}
          />
        ))
      )}
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
  patientCard: {
    marginBottom: 14,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 15,
  },
  patientName: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  patientEmail: { marginTop: 3, color: "#64748b", fontSize: 12 },
  currentClinic: {
    marginTop: 9,
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 19,
  },
  summaryCard: {
    flex: 1,
    minHeight: 100,
    padding: 11,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  summaryValue: {
    marginTop: 7,
    color: "#1d4ed8",
    fontSize: 23,
    fontWeight: "900",
  },
  summaryDescription: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 9.5,
    lineHeight: 14,
  },
  timelineTitle: {
    marginBottom: 10,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
  },
  episodeCard: {
    marginBottom: 13,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  activeEpisodeCard: {
    borderColor: "#86efac",
    borderWidth: 2,
  },
  episodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
  },
  episodeHeaderText: { flex: 1 },
  episodeStatus: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  activeEpisodeStatus: { backgroundColor: "#dcfce7" },
  activeEpisodeStatusText: { color: "#15803d" },
  historicalEpisodeStatus: { backgroundColor: "#e2e8f0" },
  historicalEpisodeStatusText: { color: "#475569" },
  episodeStatusText: { fontSize: 10, fontWeight: "800" },
  episodeClinic: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  episodeDates: { marginTop: 4, color: "#64748b", fontSize: 11 },
  episodeContent: {
    gap: 11,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  episodeSummaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  episodeSummaryText: {
    flex: 1,
    padding: 9,
    color: "#475569",
    backgroundColor: "#ffffff",
    borderRadius: 9,
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
  },
  subsectionTitle: {
    marginTop: 4,
    color: "#334155",
    fontSize: 14,
    fontWeight: "900",
  },
  recordCard: {
    gap: 7,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  recordHeaderText: { flex: 1 },
  recordTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  recordDate: { marginTop: 3, color: "#64748b", fontSize: 10 },
  smallBadge: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 999,
  },
  smallBadgeText: { fontSize: 9, fontWeight: "800" },
  activeBadge: { backgroundColor: "#dcfce7" },
  activeBadgeText: { color: "#15803d" },
  historicalBadge: { backgroundColor: "#e2e8f0" },
  historicalBadgeText: { color: "#475569" },
  recordLine: { color: "#475569", fontSize: 11 },
  recordActions: { flexDirection: "row", gap: 7, marginTop: 3 },
  secondaryButton: {
    flex: 1,
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 9,
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontSize: 10.5,
    fontWeight: "800",
  },
  appointmentCard: {
    gap: 6,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 11,
  },
  appointmentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  appointmentTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  appointmentStatus: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  appointmentStatusText: {
    color: "#1d4ed8",
    fontSize: 9,
    fontWeight: "800",
  },
  appointmentLine: { color: "#64748b", fontSize: 10.5 },
  appointmentNotes: {
    padding: 8,
    color: "#475569",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    fontSize: 10.5,
    lineHeight: 16,
  },
  emptyCard: {
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
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
});