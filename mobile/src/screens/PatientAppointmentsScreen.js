import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  cancelPatientAppointment,
  getPatientAppointments,
  requestPatientReschedule,
} from "../services/appointmentService";

export default function PatientAppointmentsScreen({
  token,
  onBack,
  onOpenBookAppointment,
}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showRescheduleDatePicker, setShowRescheduleDatePicker] =
    useState(false);
  const [showRescheduleTimePicker, setShowRescheduleTimePicker] =
    useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const normalizeAppointments = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.appointments)) return data.appointments;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await getPatientAppointments(token);
      setAppointments(normalizeAppointments(data));
    } catch (error) {
      Alert.alert(
        "Appointments Error",
        error.message || "Unable to load appointments."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await getPatientAppointments(token);
      setAppointments(normalizeAppointments(data));
    } catch (error) {
      Alert.alert(
        "Appointments Error",
        error.message || "Unable to refresh appointments."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const openCancelModal = (appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason("");
    setCancelModalVisible(true);
  };

  const closeCancelModal = () => {
    if (cancelling) return;

    Keyboard.dismiss();
    setCancelModalVisible(false);
    setSelectedAppointment(null);
    setCancellationReason("");
  };

  const openRescheduleModal = (appointment) => {
    const currentDate = new Date(appointment.appointment_date);
    const fallbackDate = new Date();

    fallbackDate.setDate(fallbackDate.getDate() + 1);
    fallbackDate.setHours(9);
    fallbackDate.setMinutes(0);
    fallbackDate.setSeconds(0);
    fallbackDate.setMilliseconds(0);

    const initialDate = Number.isNaN(currentDate.getTime())
      ? fallbackDate
      : currentDate;

    if (initialDate <= new Date()) {
      setRescheduleDate(fallbackDate);
    } else {
      setRescheduleDate(initialDate);
    }

    setSelectedAppointment(appointment);
    setShowRescheduleDatePicker(false);
    setShowRescheduleTimePicker(false);
    setRescheduleModalVisible(true);
  };

  const closeRescheduleModal = () => {
    if (rescheduling) return;

    setRescheduleModalVisible(false);
    setSelectedAppointment(null);
    setShowRescheduleDatePicker(false);
    setShowRescheduleTimePicker(false);
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment?.appointment_id) {
      Alert.alert("Error", "No appointment selected.");
      return;
    }

    if (!cancellationReason.trim()) {
      Alert.alert(
        "Missing Reason",
        "Please enter a reason for cancelling this appointment."
      );
      return;
    }

    try {
      Keyboard.dismiss();
      setCancelling(true);

      await cancelPatientAppointment({
        token,
        appointment_id: selectedAppointment.appointment_id,
        cancellation_reason: cancellationReason.trim(),
      });

      Alert.alert("Success", "Appointment cancelled successfully.");

      setCancelModalVisible(false);
      setSelectedAppointment(null);
      setCancellationReason("");

      await loadAppointments();
    } catch (error) {
      Alert.alert(
        "Cancellation Failed",
        error.message || "Unable to cancel appointment."
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleRescheduleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowRescheduleDatePicker(false);
    }

    if (selectedDate) {
      const updatedDate = new Date(rescheduleDate);
      updatedDate.setFullYear(selectedDate.getFullYear());
      updatedDate.setMonth(selectedDate.getMonth());
      updatedDate.setDate(selectedDate.getDate());
      setRescheduleDate(updatedDate);
    }
  };

  const handleRescheduleTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowRescheduleTimePicker(false);
    }

    if (selectedTime) {
      const updatedDate = new Date(rescheduleDate);
      updatedDate.setHours(selectedTime.getHours());
      updatedDate.setMinutes(selectedTime.getMinutes());
      updatedDate.setSeconds(0);
      updatedDate.setMilliseconds(0);
      setRescheduleDate(updatedDate);
    }
  };

  const handleRequestReschedule = async () => {
    if (!selectedAppointment?.appointment_id) {
      Alert.alert("Error", "No appointment selected.");
      return;
    }

    if (rescheduleDate <= new Date()) {
      Alert.alert(
        "Invalid Schedule",
        "Please choose a future appointment date and time."
      );
      return;
    }

    try {
      setRescheduling(true);

      await requestPatientReschedule({
        token,
        appointment_id: selectedAppointment.appointment_id,
        new_appointment_date: formatBackendDateTime(rescheduleDate),
      });

      Alert.alert("Success", "Reschedule request submitted successfully.");

      setRescheduleModalVisible(false);
      setSelectedAppointment(null);

      await loadAppointments();
    } catch (error) {
      Alert.alert(
        "Reschedule Failed",
        error.message || "Unable to request reschedule."
      );
    } finally {
      setRescheduling(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "No date set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatBackendDateTime = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const canCancelAppointment = (appointment) => {
    const status = String(appointment.status || "").toLowerCase();

    return status !== "cancelled" && status !== "completed";
  };

  const canRescheduleAppointment = (appointment) => {
    const status = String(appointment.status || "").toLowerCase();

    return status !== "cancelled" && status !== "completed";
  };

  const getStatusBadgeStyle = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "pending") {
      return styles.pendingBadge;
    }

    if (normalizedStatus === "scheduled") {
      return styles.scheduledBadge;
    }

    if (normalizedStatus === "cancelled") {
      return styles.cancelledBadge;
    }

    if (normalizedStatus === "completed") {
      return styles.completedBadge;
    }

    return styles.defaultBadge;
  };

  const getStatusTextStyle = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "pending") {
      return styles.pendingText;
    }

    if (normalizedStatus === "scheduled") {
      return styles.scheduledText;
    }

    if (normalizedStatus === "cancelled") {
      return styles.cancelledText;
    }

    if (normalizedStatus === "completed") {
      return styles.completedText;
    }

    return styles.defaultStatusText;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>

          <Text style={styles.title}>My Appointments</Text>

          <Text style={styles.subtitle}>
            View your upcoming and recent dental visits.
          </Text>

          <Pressable style={styles.bookButton} onPress={onOpenBookAppointment}>
            <Text style={styles.bookButtonText}>Book New Appointment</Text>
          </Pressable>
        </View>

        {appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No appointments found</Text>
            <Text style={styles.emptyText}>
              Your scheduled clinic visits will appear here once available.
            </Text>
          </View>
        ) : (
          appointments.map((appointment, index) => (
            <View
              key={appointment.appointment_id || appointment.id || index}
              style={styles.appointmentCard}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.appointmentType}>
                  {appointment.appointment_type ||
                    appointment.type ||
                    "Dental Appointment"}
                </Text>

                <View style={styles.actionColumn}>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusBadgeStyle(appointment.status),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextStyle(appointment.status),
                      ]}
                    >
                      {appointment.status || "Pending"}
                    </Text>
                  </View>

                  {canCancelAppointment(appointment) ? (
                    <Pressable
                      style={styles.cancelMiniButton}
                      onPress={() => openCancelModal(appointment)}
                    >
                      <Text style={styles.cancelMiniButtonText}>Cancel</Text>
                    </Pressable>
                  ) : null}

                  {canRescheduleAppointment(appointment) ? (
                    <Pressable
                      style={styles.rescheduleMiniButton}
                      onPress={() => openRescheduleModal(appointment)}
                    >
                      <Text style={styles.rescheduleMiniButtonText}>
                        Resched
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <Text style={styles.dateText}>
                {formatDate(appointment.appointment_date || appointment.date)}
              </Text>

              <Text style={styles.timeText}>
                {formatTime(appointment.appointment_date || appointment.date)}
              </Text>

              <Text style={styles.detailText}>
                Dentist:{" "}
                {appointment.dentist_name ||
                  appointment.dentist ||
                  appointment.name ||
                  "Not assigned"}
              </Text>

              {appointment.clinic_name ? (
                <Text style={styles.detailText}>
                  Clinic: {appointment.clinic_name}
                </Text>
              ) : null}

              {appointment.notes ? (
                <Text style={styles.notesText}>{appointment.notes}</Text>
              ) : null}

              {appointment.reschedule_status &&
              appointment.reschedule_status !== "None" ? (
                <View style={styles.rescheduleInfoBox}>
                  <Text style={styles.rescheduleInfoTitle}>
                    Reschedule Status: {appointment.reschedule_status}
                  </Text>

                  {appointment.requested_appointment_date ? (
                    <Text style={styles.rescheduleInfoText}>
                      Requested:{" "}
                      {formatDate(appointment.requested_appointment_date)}{" "}
                      {formatTime(appointment.requested_appointment_date)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {appointment.cancellation_reason ? (
                <View style={styles.cancelInfoBox}>
                  <Text style={styles.cancelInfoTitle}>Cancellation Reason</Text>
                  <Text style={styles.cancelInfoText}>
                    {appointment.cancellation_reason}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCancelModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Cancel Appointment</Text>

                <Text style={styles.modalSubtitle}>
                  Please provide a reason for cancelling this appointment.
                </Text>

                {selectedAppointment ? (
                  <View style={styles.modalAppointmentBox}>
                    <Text style={styles.modalAppointmentText}>
                      {selectedAppointment.appointment_type ||
                        "Dental Appointment"}
                    </Text>

                    <Text style={styles.modalAppointmentDate}>
                      {formatDate(selectedAppointment.appointment_date)}{" "}
                      {formatTime(selectedAppointment.appointment_date)}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.reasonInput}
                  placeholder="Example: I am unavailable on this date."
                  value={cancellationReason}
                  onChangeText={setCancellationReason}
                  multiline
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />

                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalSecondaryButton}
                    onPress={closeCancelModal}
                    disabled={cancelling}
                  >
                    <Text style={styles.modalSecondaryText}>
                      Keep Appointment
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalDangerButton,
                      cancelling && styles.disabledButton,
                    ]}
                    onPress={handleCancelAppointment}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.modalDangerText}>
                        Confirm Cancel
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRescheduleModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Reschedule</Text>

            <Text style={styles.modalSubtitle}>
              Choose your preferred new appointment schedule. This will be sent
              for approval.
            </Text>

            {selectedAppointment ? (
              <View style={styles.modalAppointmentBox}>
                <Text style={styles.modalAppointmentText}>
                  Current Appointment
                </Text>

                <Text style={styles.modalAppointmentDate}>
                  {formatDate(selectedAppointment.appointment_date)}{" "}
                  {formatTime(selectedAppointment.appointment_date)}
                </Text>
              </View>
            ) : null}

            <View style={styles.pickerCard}>
              <Text style={styles.pickerLabel}>New Date</Text>
              <Text style={styles.pickerValue}>
                {formatDate(rescheduleDate)}
              </Text>

              <Pressable
                style={styles.pickerButton}
                onPress={() => {
                  setShowRescheduleDatePicker(true);
                  setShowRescheduleTimePicker(false);
                }}
              >
                <Text style={styles.pickerButtonText}>Choose Date</Text>
              </Pressable>
            </View>

            <View style={styles.pickerCard}>
              <Text style={styles.pickerLabel}>New Time</Text>
              <Text style={styles.pickerValue}>
                {formatTime(rescheduleDate)}
              </Text>

              <Pressable
                style={styles.pickerButton}
                onPress={() => {
                  setShowRescheduleTimePicker(true);
                  setShowRescheduleDatePicker(false);
                }}
              >
                <Text style={styles.pickerButtonText}>Choose Time</Text>
              </Pressable>
            </View>

            {showRescheduleDatePicker ? (
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={handleRescheduleDateChange}
              />
            ) : null}

            {showRescheduleTimePicker ? (
              <DateTimePicker
                value={rescheduleDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleRescheduleTimeChange}
              />
            ) : null}

            {Platform.OS === "ios" &&
            (showRescheduleDatePicker || showRescheduleTimePicker) ? (
              <Pressable
                style={styles.donePickerButton}
                onPress={() => {
                  setShowRescheduleDatePicker(false);
                  setShowRescheduleTimePicker(false);
                }}
              >
                <Text style={styles.donePickerButtonText}>Done</Text>
              </Pressable>
            ) : null}

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Request Preview</Text>
              <Text style={styles.previewText}>
                {formatBackendDateTime(rescheduleDate)}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalSecondaryButton}
                onPress={closeRescheduleModal}
                disabled={rescheduling}
              >
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalPrimaryButton,
                  rescheduling && styles.disabledButton,
                ]}
                onPress={handleRequestReschedule}
                disabled={rescheduling}
              >
                {rescheduling ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Submit Request</Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#718096",
    fontSize: 14,
  },
  header: {
    marginTop: 22,
    marginBottom: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#edf2f7",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginBottom: 18,
  },
  backButtonText: {
    color: "#2b6cb0",
    fontWeight: "800",
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
  bookButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 18,
  },
  bookButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
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
    fontWeight: "800",
    color: "#1a202c",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
  },
  appointmentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  cardTopRow: {
    position: "relative",
    marginBottom: 8,
  },
  appointmentType: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    paddingRight: 128,
    lineHeight: 24,
  },
  actionColumn: {
    position: "absolute",
    top: 0,
    right: 0,
    alignItems: "flex-end",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  defaultBadge: {
    backgroundColor: "#e3f2fd",
  },
  defaultStatusText: {
    color: "#2b6cb0",
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
  },
  pendingText: {
    color: "#92400e",
  },
  scheduledBadge: {
    backgroundColor: "#e3f2fd",
  },
  scheduledText: {
    color: "#2b6cb0",
  },
  cancelledBadge: {
    backgroundColor: "#fed7d7",
  },
  cancelledText: {
    color: "#c53030",
  },
  completedBadge: {
    backgroundColor: "#c6f6d5",
  },
  completedText: {
    color: "#2f855a",
  },
  cancelMiniButton: {
    borderWidth: 1,
    borderColor: "#e53e3e",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelMiniButtonText: {
    color: "#e53e3e",
    fontSize: 12,
    fontWeight: "900",
  },
  rescheduleMiniButton: {
    borderWidth: 1,
    borderColor: "#2b6cb0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 86,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  rescheduleMiniButtonText: {
    color: "#2b6cb0",
    fontSize: 12,
    fontWeight: "900",
  },
  dateText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2d3748",
    marginBottom: 4,
    marginTop: 0,
  },
  timeText: {
    fontSize: 14,
    color: "#718096",
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    marginTop: 6,
  },
  cancelInfoBox: {
    backgroundColor: "#fff5f5",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  cancelInfoTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#c53030",
    marginBottom: 4,
  },
  cancelInfoText: {
    fontSize: 13,
    color: "#742a2a",
    lineHeight: 18,
  },
  rescheduleInfoBox: {
    backgroundColor: "#ebf8ff",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  rescheduleInfoTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 4,
  },
  rescheduleInfoText: {
    fontSize: 13,
    color: "#2c5282",
    lineHeight: 18,
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    marginBottom: 14,
  },
  modalAppointmentBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  modalAppointmentText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  modalAppointmentDate: {
    fontSize: 13,
    color: "#718096",
  },
  reasonInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    maxHeight: 130,
    textAlignVertical: "top",
    fontSize: 14,
    color: "#1a202c",
    marginBottom: 16,
  },
  pickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "800",
    marginBottom: 5,
  },
  pickerValue: {
    fontSize: 16,
    color: "#1a202c",
    fontWeight: "900",
    marginBottom: 10,
  },
  pickerButton: {
    backgroundColor: "#edf2f7",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  pickerButtonText: {
    color: "#2b6cb0",
    fontWeight: "900",
  },
  donePickerButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  donePickerButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  previewCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: "#1a202c",
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  modalSecondaryText: {
    color: "#2b6cb0",
    fontWeight: "900",
    fontSize: 13,
  },
  modalDangerButton: {
    flex: 1,
    backgroundColor: "#e53e3e",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  modalDangerText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  modalPrimaryText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.7,
  },
});