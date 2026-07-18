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

import { getPatientDashboard } from "../services/dashboardService";

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

const formatDate = (value) => {
  if (!value) return "Not available";

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

const StatCard = ({ icon, label, value, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.statCard,
      pressed && onPress && styles.pressedCard,
    ]}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.statIcon}>
      <Ionicons name={icon} size={20} color="#1d4ed8" />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </Pressable>
);

const QuickAction = ({ icon, title, description, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.quickAction,
      pressed && styles.pressedCard,
    ]}
    onPress={onPress}
  >
    <View style={styles.quickActionIcon}>
      <Ionicons name={icon} size={22} color="#1d4ed8" />
    </View>

    <View style={styles.quickActionText}>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionDescription}>{description}</Text>
    </View>

    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
  </Pressable>
);

export default function PatientDashboardScreen({
  token,
  user,
  onOpenAppointments,
  onOpenBookAppointment,
  onOpenDentalRecords,
  onOpenXrays,
  onOpenARBraces,
  onOpenClinicDiscovery,
  onOpenProfile,
}) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const response = await getPatientDashboard(token);
      setDashboard(response);
    } catch (error) {
      Alert.alert(
        "Dashboard Error",
        error.message || "Unable to load your dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const patient = dashboard?.patient || {};
  const appointments = dashboard?.appointments || {};
  const records = dashboard?.dental_records || {};
  const xrays = dashboard?.xrays || {};
  const nextAppointment = dashboard?.next_appointment || null;
  const recentRecords = Array.isArray(dashboard?.recent_records)
    ? dashboard.recent_records
    : [];

  const patientName = patient.patient_name || user?.name || "Patient";

  const firstName = useMemo(
    () => String(patientName).trim().split(/\s+/)[0] || "Patient",
    [patientName],
  );

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading your dashboard...</Text>
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
          onRefresh={() => loadDashboard({ refresh: true })}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{firstName}</Text>
        </View>

        <Pressable style={styles.profileButton} onPress={onOpenProfile}>
          <Ionicons name="person-outline" size={22} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.clinicCard}>
        <View style={styles.clinicIcon}>
          <Ionicons name="business-outline" size={25} color="#ffffff" />
        </View>

        <View style={styles.clinicText}>
          <Text style={styles.clinicLabel}>Assigned Clinic</Text>
          <Text style={styles.clinicName}>
            {patient.clinic_name || "No active clinic assignment"}
          </Text>
          {patient.clinic_address ? (
            <Text style={styles.clinicAddress}>{patient.clinic_address}</Text>
          ) : null}
        </View>

        <Pressable
          style={styles.clinicArrow}
          onPress={onOpenClinicDiscovery}
        >
          <Ionicons name="navigate-outline" size={20} color="#ffffff" />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="calendar-outline"
          label="Upcoming"
          value={appointments.upcoming_appointments || 0}
          onPress={onOpenAppointments}
        />
        <StatCard
          icon="document-text-outline"
          label="Records"
          value={records.total_records || 0}
          onPress={onOpenDentalRecords}
        />
        <StatCard
          icon="image-outline"
          label="X-rays"
          value={xrays.total_xrays || 0}
          onPress={onOpenXrays}
        />
        <StatCard
          icon="checkmark-done-outline"
          label="Completed"
          value={appointments.completed_appointments || 0}
          onPress={onOpenAppointments}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Next Appointment</Text>
        <Pressable onPress={onOpenAppointments}>
          <Text style={styles.sectionLink}>View all</Text>
        </Pressable>
      </View>

      {nextAppointment ? (
        <View style={styles.appointmentCard}>
          <View style={styles.appointmentTopRow}>
            <View style={styles.appointmentIcon}>
              <Ionicons name="calendar" size={23} color="#1d4ed8" />
            </View>

            <View style={styles.appointmentText}>
              <Text style={styles.appointmentType}>
                {nextAppointment.appointment_type || "Dental Appointment"}
              </Text>
              <Text style={styles.appointmentDate}>
                {formatDateTime(nextAppointment.appointment_date)}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>
                {nextAppointment.status}
              </Text>
            </View>
          </View>

          <View style={styles.appointmentDivider} />

          <Text style={styles.appointmentDetail}>
            Dentist: {nextAppointment.dentist_name || "Not available"}
          </Text>
          <Text style={styles.appointmentDetail}>
            Clinic: {nextAppointment.clinic_name || "Not available"}
          </Text>

          {nextAppointment.reschedule_status === "Pending" ? (
            <View style={styles.noticeBox}>
              <Ionicons name="time-outline" size={17} color="#92400e" />
              <Text style={styles.noticeText}>
                Your reschedule request is pending clinic review.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-clear-outline" size={34} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No upcoming appointment</Text>
          <Text style={styles.emptyText}>
            Book your next dental visit using available clinic schedules.
          </Text>
          <Pressable style={styles.bookButton} onPress={onOpenBookAppointment}>
            <Text style={styles.bookButtonText}>Book Appointment</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Dental Records</Text>
        <Pressable onPress={onOpenDentalRecords}>
          <Text style={styles.sectionLink}>View all</Text>
        </Pressable>
      </View>

      {recentRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="document-outline" size={34} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No dental records yet</Text>
          <Text style={styles.emptyText}>
            Records created by your Dentist will appear here.
          </Text>
        </View>
      ) : (
        recentRecords.map((record) => (
          <Pressable
            key={record.record_id}
            style={({ pressed }) => [
              styles.recordCard,
              pressed && styles.pressedCard,
            ]}
            onPress={onOpenDentalRecords}
          >
            <View style={styles.recordIcon}>
              <Ionicons name="document-text-outline" size={21} color="#1d4ed8" />
            </View>

            <View style={styles.recordText}>
              <Text style={styles.recordTitle}>
                Dental Record #{record.record_id}
              </Text>
              <Text style={styles.recordMeta}>
                {record.dentist_name || "Dentist unavailable"}
              </Text>
              <Text style={styles.recordMeta}>
                Updated {formatDate(record.last_updated || record.date_created)}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        ))
      )}

      <Text style={styles.quickActionsTitle}>Quick Actions</Text>

      <View style={styles.quickActions}>
        <QuickAction
          icon="add-circle-outline"
          title="Book an Appointment"
          description="Choose a service, Dentist, date, and available time."
          onPress={onOpenBookAppointment}
        />
        <QuickAction
          icon="happy-outline"
          title="Try AR Braces"
          description="Preview Metal, Ceramic, or colored braces."
          onPress={onOpenARBraces}
        />
        <QuickAction
          icon="location-outline"
          title="Clinic Information"
          description="View your assigned clinic location and directions."
          onPress={onOpenClinicDiscovery}
        />
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
    backgroundColor: "#f8fafc",
  },
  centerStateText: { color: "#64748b" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  headerText: { flex: 1 },
  greeting: { color: "#64748b", fontSize: 13, fontWeight: "700" },
  name: { marginTop: 2, color: "#0f172a", fontSize: 28, fontWeight: "900" },
  profileButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 23,
  },
  clinicCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#2563eb",
    borderRadius: 17,
  },
  clinicIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 15,
  },
  clinicText: { flex: 1 },
  clinicLabel: { color: "#bfdbfe", fontSize: 10, fontWeight: "800" },
  clinicName: {
    marginTop: 3,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  clinicAddress: { marginTop: 4, color: "#dbeafe", fontSize: 10 },
  clinicArrow: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 19,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 22,
  },
  statCard: {
    width: "48.6%",
    minHeight: 112,
    padding: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  statIcon: {
    width: 37,
    height: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
  },
  statValue: {
    marginTop: 9,
    color: "#0f172a",
    fontSize: 23,
    fontWeight: "900",
  },
  statLabel: { marginTop: 2, color: "#64748b", fontSize: 11, fontWeight: "700" },
  pressedCard: { opacity: 0.72 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: { color: "#0f172a", fontSize: 18, fontWeight: "900" },
  sectionLink: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  appointmentCard: {
    gap: 10,
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
  },
  appointmentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appointmentIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
  },
  appointmentText: { flex: 1 },
  appointmentType: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  appointmentDate: { marginTop: 3, color: "#64748b", fontSize: 10.5 },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  statusBadgeText: { color: "#1d4ed8", fontSize: 9, fontWeight: "800" },
  appointmentDivider: { height: 1, backgroundColor: "#e2e8f0" },
  appointmentDetail: { color: "#475569", fontSize: 11.5 },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 9,
    backgroundColor: "#fef3c7",
    borderRadius: 9,
  },
  noticeText: { flex: 1, color: "#92400e", fontSize: 10.5 },
  emptyCard: {
    alignItems: "center",
    gap: 7,
    marginBottom: 20,
    padding: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  emptyTitle: { color: "#334155", fontSize: 14, fontWeight: "800" },
  emptyText: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  bookButton: {
    minHeight: 41,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
    borderRadius: 10,
  },
  bookButtonText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  recordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 9,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
  },
  recordIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 13,
  },
  recordText: { flex: 1 },
  recordTitle: { color: "#0f172a", fontSize: 12.5, fontWeight: "800" },
  recordMeta: { marginTop: 3, color: "#64748b", fontSize: 10 },
  quickActionsTitle: {
    marginTop: 13,
    marginBottom: 10,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
  },
  quickActions: { gap: 9 },
  quickAction: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  quickActionIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 13,
  },
  quickActionText: { flex: 1 },
  quickActionTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  quickActionDescription: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
  },
});