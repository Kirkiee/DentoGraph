import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  cancelPatientAppointment,
  getBookingAvailableDates,
  getBookingAvailableTimes,
  getPatientAppointments,
  requestPatientReschedule,
} from "../services/appointmentService";

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Scheduled",
  "Completed",
  "Cancelled",
];

const formatDate = (value) => {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
};

const formatTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDateOption = (value) =>
  new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });

const formatTimeOption = (value) => {
  const [hourString, minuteString] = String(value).split(":");
  const date = new Date(2000, 0, 1, Number(hourString), Number(minuteString));

  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const normalizeStatus = (value) =>
  String(value || "Pending").trim().toLowerCase();

const isPastOrCompleted = (appointment) => {
  const status = normalizeStatus(appointment.status);
  const appointmentDate = new Date(appointment.appointment_date);

  return (
    status === "completed" ||
    status === "cancelled" ||
    (!Number.isNaN(appointmentDate.getTime()) &&
      appointmentDate.getTime() < Date.now())
  );
};

const StatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);

  return (
    <View
      style={[
        styles.badge,
        normalized === "pending" && styles.pendingBadge,
        normalized === "scheduled" && styles.scheduledBadge,
        normalized === "completed" && styles.completedBadge,
        normalized === "cancelled" && styles.cancelledBadge,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          normalized === "pending" && styles.pendingBadgeText,
          normalized === "scheduled" && styles.scheduledBadgeText,
          normalized === "completed" && styles.completedBadgeText,
          normalized === "cancelled" && styles.cancelledBadgeText,
        ]}
      >
        {status || "Pending"}
      </Text>
    </View>
  );
};

const RescheduleBadge = ({ status }) => {
  if (!status || status === "None") return null;

  return (
    <View style={styles.rescheduleBadge}>
      <Text style={styles.rescheduleBadgeText}>Reschedule: {status}</Text>
    </View>
  );
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

const AppointmentCard = ({
  appointment,
  onCancel,
  onReschedule,
}) => {
  const status = normalizeStatus(appointment.status);
  const canManage =
    status !== "cancelled" &&
    status !== "completed" &&
    new Date(appointment.appointment_date).getTime() > Date.now();

  const hasPendingReschedule =
    appointment.reschedule_request === true ||
    String(appointment.reschedule_status || "").toLowerCase() === "pending";

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.appointmentType}>
            {appointment.appointment_type || "Dental Appointment"}
          </Text>
          <Text style={styles.appointmentId}>
            Appointment #{appointment.appointment_id}
          </Text>
        </View>

        <StatusBadge status={appointment.status} />
      </View>

      <RescheduleBadge status={appointment.reschedule_status} />

      <View style={styles.detailRow}>
        <Ionicons name="calendar-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Schedule</Text>
          <Text style={styles.detailValue}>
            {formatDate(appointment.appointment_date)} at{" "}
            {formatTime(appointment.appointment_date)}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="medkit-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Dentist</Text>
          <Text style={styles.detailValue}>
            {appointment.dentist_name || "Not assigned"}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Ionicons name="business-outline" size={18} color="#2563eb" />
        <View style={styles.detailTextBlock}>
          <Text style={styles.detailLabel}>Clinic</Text>
          <Text style={styles.detailValue}>
            {appointment.clinic_name || "Assigned clinic"}
          </Text>
        </View>
      </View>

      {appointment.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{appointment.notes}</Text>
        </View>
      ) : null}

      {appointment.requested_appointment_date ? (
        <View style={styles.requestBox}>
          <Text style={styles.requestTitle}>Requested New Schedule</Text>
          <Text style={styles.requestText}>
            {formatDate(appointment.requested_appointment_date)} at{" "}
            {formatTime(appointment.requested_appointment_date)}
          </Text>
        </View>
      ) : null}

      {appointment.cancellation_reason ? (
        <View style={styles.cancelledInfoBox}>
          <Text style={styles.cancelledInfoTitle}>Cancellation Remarks</Text>
          <Text style={styles.cancelledInfoText}>
            {appointment.cancellation_reason}
          </Text>
          {appointment.cancelled_by_name ? (
            <Text style={styles.cancelledByText}>
              Cancelled by {appointment.cancelled_by_name}
            </Text>
          ) : null}
        </View>
      ) : null}

      {canManage ? (
        <View style={styles.cardActions}>
          <Pressable
            style={[
              styles.secondaryButton,
              hasPendingReschedule && styles.disabledButton,
            ]}
            onPress={() => onReschedule(appointment)}
            disabled={hasPendingReschedule}
          >
            <Ionicons name="time-outline" size={18} color="#1d4ed8" />
            <Text style={styles.secondaryButtonText}>
              {hasPendingReschedule ? "Reschedule Pending" : "Reschedule"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.dangerButton}
            onPress={() => onCancel(appointment)}
          >
            <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
            <Text style={styles.dangerButtonText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export default function PatientAppointmentsScreen({
  token,
  onOpenBookAppointment,
}) {
  const [appointments, setAppointments] = useState([]);
  const [assignedClinicName, setAssignedClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dentistFilter, setDentistFilter] = useState("All");

  const [cancelAppointment, setCancelAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [rescheduleAppointment, setRescheduleAppointment] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await getPatientAppointments(token);
      setAppointments(
        Array.isArray(response.appointments) ? response.appointments : [],
      );
      setAssignedClinicName(response.assigned_clinic_name || "");
    } catch (error) {
      Alert.alert(
        "Appointments Error",
        error.message || "Unable to load appointments.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const dentistOptions = useMemo(() => {
    const values = appointments
      .map((appointment) => appointment.dentist_name)
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          appointment.appointment_id,
          appointment.appointment_type,
          appointment.dentist_name,
          appointment.clinic_name,
          appointment.notes,
        ]
          .filter((value) => value !== null && value !== undefined)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          );

      const matchesStatus =
        statusFilter === "All" ||
        normalizeStatus(appointment.status) === statusFilter.toLowerCase();

      const matchesDentist =
        dentistFilter === "All" ||
        appointment.dentist_name === dentistFilter;

      return matchesSearch && matchesStatus && matchesDentist;
    });
  }, [appointments, dentistFilter, search, statusFilter]);

  const upcomingAppointments = useMemo(
    () =>
      filteredAppointments
        .filter((appointment) => !isPastOrCompleted(appointment))
        .sort(
          (a, b) =>
            new Date(a.appointment_date).getTime() -
            new Date(b.appointment_date).getTime(),
        ),
    [filteredAppointments],
  );

  const previousAppointments = useMemo(
    () =>
      filteredAppointments
        .filter(isPastOrCompleted)
        .sort(
          (a, b) =>
            new Date(b.appointment_date).getTime() -
            new Date(a.appointment_date).getTime(),
        ),
    [filteredAppointments],
  );

  const openCancelModal = (appointment) => {
    setCancelAppointment(appointment);
    setCancellationReason("");
  };

  const closeCancelModal = () => {
    if (cancelling) return;
    setCancelAppointment(null);
    setCancellationReason("");
  };

  const submitCancellation = async () => {
    if (!cancellationReason.trim()) {
      Alert.alert(
        "Cancellation Reason Required",
        "Enter a reason before cancelling the appointment.",
      );
      return;
    }

    try {
      setCancelling(true);

      const response = await cancelPatientAppointment({
        token,
        appointment_id: cancelAppointment.appointment_id,
        cancellation_reason: cancellationReason.trim(),
      });

      closeCancelModal();
      Alert.alert(
        "Appointment Cancelled",
        response.message || "The appointment was cancelled successfully.",
      );
      await loadAppointments();
    } catch (error) {
      Alert.alert(
        "Cancellation Failed",
        error.message || "Unable to cancel the appointment.",
      );
    } finally {
      setCancelling(false);
    }
  };

  const openRescheduleModal = async (appointment) => {
    if (!appointment.service_id) {
      Alert.alert(
        "Service Information Missing",
        "This older appointment does not have a linked service. Please contact the clinic to reschedule it.",
      );
      return;
    }

    setRescheduleAppointment(appointment);
    setAvailableDates([]);
    setAvailableTimes([]);
    setSelectedDate("");
    setSelectedTime("");

    try {
      setLoadingDates(true);
      const response = await getBookingAvailableDates({
        token,
        clinic_id: appointment.clinic_id,
        dentist_id: appointment.dentist_id,
        service_id: appointment.service_id,
      });

      setAvailableDates(
        Array.isArray(response.available_dates)
          ? response.available_dates
          : [],
      );
    } catch (error) {
      setRescheduleAppointment(null);
      Alert.alert(
        "Available Dates Error",
        error.message || "Unable to load valid reschedule dates.",
      );
    } finally {
      setLoadingDates(false);
    }
  };

  const selectRescheduleDate = async (date) => {
    setSelectedDate(date);
    setSelectedTime("");
    setAvailableTimes([]);

    try {
      setLoadingTimes(true);

      const response = await getBookingAvailableTimes({
        token,
        clinic_id: rescheduleAppointment.clinic_id,
        dentist_id: rescheduleAppointment.dentist_id,
        service_id: rescheduleAppointment.service_id,
        appointment_date: date,
      });

      setAvailableTimes(
        Array.isArray(response.available_times)
          ? response.available_times
          : [],
      );
    } catch (error) {
      Alert.alert(
        "Available Times Error",
        error.message || "Unable to load valid reschedule times.",
      );
    } finally {
      setLoadingTimes(false);
    }
  };

  const closeRescheduleModal = () => {
    if (rescheduling) return;

    setRescheduleAppointment(null);
    setAvailableDates([]);
    setAvailableTimes([]);
    setSelectedDate("");
    setSelectedTime("");
  };

  const submitReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert(
        "Incomplete Reschedule",
        "Select an available date and time.",
      );
      return;
    }

    try {
      setRescheduling(true);

      const response = await requestPatientReschedule({
        token,
        appointment_id: rescheduleAppointment.appointment_id,
        new_appointment_date: `${selectedDate}T${selectedTime}:00+08:00`,
      });

      closeRescheduleModal();
      Alert.alert(
        "Reschedule Requested",
        response.message || "Your reschedule request was submitted.",
      );
      await loadAppointments();
    } catch (error) {
      Alert.alert(
        "Reschedule Failed",
        error.message || "Unable to submit the reschedule request.",
      );
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAppointments({ refresh: true })}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>My Appointments</Text>
            <Text style={styles.subtitle}>
              {assignedClinicName
                ? `Appointments for ${assignedClinicName}`
                : "Manage upcoming and previous appointments."}
            </Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={onOpenBookAppointment}
          >
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Book</Text>
          </Pressable>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search Dentist, clinic, service, or ID"
              placeholderTextColor="#94a3b8"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={19} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.filterLabel}>Status</Text>
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

          <Text style={styles.filterLabel}>Dentist</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {dentistOptions.map((dentist) => (
              <FilterChip
                key={dentist}
                label={dentist}
                selected={dentistFilter === dentist}
                onPress={() => setDentistFilter(dentist)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <Text style={styles.sectionCount}>{upcomingAppointments.length}</Text>
        </View>

        {upcomingAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={34} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No upcoming appointments</Text>
            <Text style={styles.emptyText}>
              Book a new appointment or change the current filters.
            </Text>
          </View>
        ) : (
          upcomingAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.appointment_id}
              appointment={appointment}
              onCancel={openCancelModal}
              onReschedule={openRescheduleModal}
            />
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Previous</Text>
          <Text style={styles.sectionCount}>{previousAppointments.length}</Text>
        </View>

        {previousAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No previous appointments match the current filters.
            </Text>
          </View>
        ) : (
          previousAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.appointment_id}
              appointment={appointment}
              onCancel={openCancelModal}
              onReschedule={openRescheduleModal}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={Boolean(cancelAppointment)}
        transparent
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Appointment</Text>
            <Text style={styles.modalSubtitle}>
              Cancellation remarks are required and will be saved with the
              appointment history.
            </Text>

            {cancelAppointment ? (
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryTitle}>
                  {cancelAppointment.appointment_type || "Dental Appointment"}
                </Text>
                <Text style={styles.modalSummaryText}>
                  {formatDate(cancelAppointment.appointment_date)} at{" "}
                  {formatTime(cancelAppointment.appointment_date)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Cancellation Reason *</Text>
            <TextInput
              style={styles.reasonInput}
              value={cancellationReason}
              onChangeText={setCancellationReason}
              placeholder="Explain why you need to cancel"
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={closeCancelModal}
                disabled={cancelling}
              >
                <Text style={styles.modalSecondaryButtonText}>
                  Keep Appointment
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalDangerButton}
                onPress={submitCancellation}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalDangerButtonText}>
                    Confirm Cancellation
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={Boolean(rescheduleAppointment)}
        transparent
        animationType="slide"
        onRequestClose={closeRescheduleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.rescheduleModalCard]}>
            <View style={styles.modalTopRow}>
              <View style={styles.modalTopText}>
                <Text style={styles.modalTitle}>Request Reschedule</Text>
                <Text style={styles.modalSubtitle}>
                  Select only from the Dentist's valid available dates and time
                  slots.
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={closeRescheduleModal}
                disabled={rescheduling}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>

            {rescheduleAppointment ? (
              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryTitle}>Current Schedule</Text>
                <Text style={styles.modalSummaryText}>
                  {formatDate(rescheduleAppointment.appointment_date)} at{" "}
                  {formatTime(rescheduleAppointment.appointment_date)}
                </Text>
                <Text style={styles.modalSummaryText}>
                  {rescheduleAppointment.dentist_name} ·{" "}
                  {rescheduleAppointment.clinic_name}
                </Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.rescheduleScroll}
              contentContainerStyle={styles.rescheduleContent}
            >
              <Text style={styles.inputLabel}>Available Dates</Text>

              {loadingDates ? (
                <ActivityIndicator color="#2563eb" />
              ) : availableDates.length === 0 ? (
                <Text style={styles.emptyText}>
                  No valid reschedule dates are currently available.
                </Text>
              ) : (
                <View style={styles.optionGrid}>
                  {availableDates.map((date) => (
                    <Pressable
                      key={date}
                      style={[
                        styles.optionButton,
                        selectedDate === date && styles.optionButtonSelected,
                      ]}
                      onPress={() => selectRescheduleDate(date)}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          selectedDate === date &&
                            styles.optionButtonTextSelected,
                        ]}
                      >
                        {formatDateOption(date)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={[styles.inputLabel, styles.timeLabel]}>
                Available Times
              </Text>

              {!selectedDate ? (
                <Text style={styles.emptyText}>
                  Choose an available date first.
                </Text>
              ) : loadingTimes ? (
                <ActivityIndicator color="#2563eb" />
              ) : availableTimes.length === 0 ? (
                <Text style={styles.emptyText}>
                  No available times remain for this date.
                </Text>
              ) : (
                <View style={styles.optionGrid}>
                  {availableTimes.map((time) => (
                    <Pressable
                      key={time}
                      style={[
                        styles.optionButton,
                        selectedTime === time && styles.optionButtonSelected,
                      ]}
                      onPress={() => setSelectedTime(time)}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          selectedTime === time &&
                            styles.optionButtonTextSelected,
                        ]}
                      >
                        {formatTimeOption(time)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={closeRescheduleModal}
                disabled={rescheduling}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  (!selectedDate || !selectedTime) && styles.disabledButton,
                ]}
                onPress={submitReschedule}
                disabled={rescheduling || !selectedDate || !selectedTime}
              >
                {rescheduling ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>
                    Submit Request
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 15,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 27,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  filterCard: {
    gap: 11,
    marginBottom: 19,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 19,
    fontWeight: "800",
  },
  sectionCount: {
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
  appointmentCard: {
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
  appointmentType: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  appointmentId: {
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 11,
  },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
  },
  pendingBadgeText: {
    color: "#92400e",
  },
  scheduledBadge: {
    backgroundColor: "#dbeafe",
  },
  scheduledBadgeText: {
    color: "#1d4ed8",
  },
  completedBadge: {
    backgroundColor: "#dcfce7",
  },
  completedBadgeText: {
    color: "#15803d",
  },
  cancelledBadge: {
    backgroundColor: "#fee2e2",
  },
  cancelledBadgeText: {
    color: "#b91c1c",
  },
  rescheduleBadge: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: "#ede9fe",
    borderRadius: 999,
  },
  rescheduleBadgeText: {
    color: "#6d28d9",
    fontSize: 11,
    fontWeight: "800",
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
    lineHeight: 19,
  },
  notesBox: {
    padding: 11,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  notesLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  notesText: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  requestBox: {
    padding: 11,
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 10,
  },
  requestTitle: {
    color: "#6d28d9",
    fontSize: 11,
    fontWeight: "800",
  },
  requestText: {
    marginTop: 4,
    color: "#5b21b6",
    fontSize: 12,
  },
  cancelledInfoBox: {
    padding: 11,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  cancelledInfoTitle: {
    color: "#991b1b",
    fontSize: 11,
    fontWeight: "800",
  },
  cancelledInfoText: {
    marginTop: 4,
    color: "#991b1b",
    fontSize: 12,
    lineHeight: 18,
  },
  cancelledByText: {
    marginTop: 4,
    color: "#b91c1c",
    fontSize: 11,
  },
  cardActions: {
    flexDirection: "row",
    gap: 9,
    paddingTop: 3,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  dangerButton: {
    flex: 1,
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  dangerButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: "center",
    gap: 7,
    marginBottom: 18,
    padding: 22,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.58)",
  },
  modalCard: {
    maxHeight: "90%",
    padding: 20,
    backgroundColor: "#ffffff",
    borderRadius: 18,
  },
  rescheduleModalCard: {
    paddingBottom: 16,
  },
  modalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTopText: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 18,
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 21,
    fontWeight: "800",
  },
  modalSubtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  modalSummary: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 11,
  },
  modalSummaryTitle: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  modalSummaryText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  inputLabel: {
    marginTop: 16,
    marginBottom: 7,
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  reasonInput: {
    minHeight: 105,
    padding: 12,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  modalActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 17,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 11,
  },
  modalSecondaryButtonText: {
    color: "#475569",
    fontWeight: "800",
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderRadius: 11,
  },
  modalDangerButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  modalPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  rescheduleScroll: {
    maxHeight: 430,
    marginTop: 4,
  },
  rescheduleContent: {
    paddingBottom: 8,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    minWidth: 94,
    paddingVertical: 10,
    paddingHorizontal: 11,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
  },
  optionButtonSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  optionButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  optionButtonTextSelected: {
    color: "#ffffff",
  },
  timeLabel: {
    marginTop: 20,
  },
});