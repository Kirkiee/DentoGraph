import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  bookAppointment,
  getActiveDentists,
} from "../services/appointmentService";

export default function BookAppointmentScreen({ token, onBack, onBooked }) {
  const [dentists, setDentists] = useState([]);
  const [selectedDentistId, setSelectedDentistId] = useState(null);

  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [appointmentType, setAppointmentType] = useState("Consultation");
  const [notes, setNotes] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [loadingDentists, setLoadingDentists] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDentists();
  }, []);

  const loadDentists = async () => {
    try {
      setLoadingDentists(true);

      const data = await getActiveDentists(token);

      if (Array.isArray(data.dentists)) {
        setDentists(data.dentists);
      } else {
        setDentists([]);
      }
    } catch (error) {
      Alert.alert("Dentists Error", error.message || "Unable to load dentists.");
    } finally {
      setLoadingDentists(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      const updatedDate = new Date(appointmentDate);
      updatedDate.setFullYear(selectedDate.getFullYear());
      updatedDate.setMonth(selectedDate.getMonth());
      updatedDate.setDate(selectedDate.getDate());
      setAppointmentDate(updatedDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (selectedTime) {
      const updatedDate = new Date(appointmentDate);
      updatedDate.setHours(selectedTime.getHours());
      updatedDate.setMinutes(selectedTime.getMinutes());
      updatedDate.setSeconds(0);
      updatedDate.setMilliseconds(0);
      setAppointmentDate(updatedDate);
    }
  };

  const formatDisplayDate = (value) => {
    return value.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDisplayTime = (value) => {
    return value.toLocaleTimeString(undefined, {
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

  const handleSubmit = async () => {
    if (!selectedDentistId) {
      Alert.alert("Missing Dentist", "Please select a dentist.");
      return;
    }

    const now = new Date();

    if (appointmentDate <= now) {
      Alert.alert(
        "Invalid Schedule",
        "Please choose a future appointment date and time."
      );
      return;
    }

    try {
      setSubmitting(true);

      await bookAppointment({
        token,
        dentist_id: selectedDentistId,
        appointment_date: formatBackendDateTime(appointmentDate),
        appointment_type: appointmentType.trim() || "Consultation",
        notes: notes.trim() || null,
      });

      Alert.alert("Success", "Appointment booked successfully.");
      onBooked();
    } catch (error) {
      Alert.alert(
        "Booking Failed",
        error.message || "Unable to book appointment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Book Appointment</Text>
      <Text style={styles.subtitle}>
        Select a dentist and choose your preferred schedule.
      </Text>

      <Text style={styles.sectionTitle}>Choose Dentist</Text>

      {loadingDentists ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading dentists...</Text>
        </View>
      ) : dentists.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No dentists available</Text>
          <Text style={styles.emptyText}>
            Active dentists will appear here once available.
          </Text>
        </View>
      ) : (
        dentists.map((dentist) => {
          const isSelected = selectedDentistId === dentist.dentist_id;

          return (
            <Pressable
              key={dentist.dentist_id}
              style={[
                styles.dentistCard,
                isSelected && styles.dentistCardSelected,
              ]}
              onPress={() => setSelectedDentistId(dentist.dentist_id)}
            >
              <Text style={styles.dentistName}>
                {dentist.dentist_name || "Unnamed Dentist"}
              </Text>

              <Text style={styles.dentistDetail}>
                {dentist.specialization || "General Dentistry"}
              </Text>

              <Text style={styles.dentistDetail}>
                {dentist.clinic_name || "No clinic assigned"}
              </Text>

              <Text style={styles.dentistAvailability}>
                {dentist.availability || "Availability not specified"}
              </Text>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Appointment Schedule</Text>

      <View style={styles.pickerCard}>
        <Text style={styles.label}>Selected Date</Text>
        <Text style={styles.selectedValue}>
          {formatDisplayDate(appointmentDate)}
        </Text>

        <Pressable
          style={styles.pickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.pickerButtonText}>Choose Date</Text>
        </Pressable>
      </View>

      <View style={styles.pickerCard}>
        <Text style={styles.label}>Selected Time</Text>
        <Text style={styles.selectedValue}>
          {formatDisplayTime(appointmentDate)}
        </Text>

        <Pressable
          style={styles.pickerButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.pickerButtonText}>Choose Time</Text>
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={appointmentDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={appointmentDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      {Platform.OS === "ios" && (showDatePicker || showTimePicker) ? (
        <Pressable
          style={styles.donePickerButton}
          onPress={() => {
            setShowDatePicker(false);
            setShowTimePicker(false);
          }}
        >
          <Text style={styles.donePickerButtonText}>Done</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Appointment Details</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Appointment Type</Text>
        <TextInput
          style={styles.input}
          placeholder="Consultation"
          value={appointmentType}
          onChangeText={setAppointmentType}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Add notes or concern..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Booking Preview</Text>
        <Text style={styles.previewText}>
          {formatBackendDateTime(appointmentDate)}
        </Text>
      </View>

      <Pressable
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Book Appointment</Text>
        )}
      </Pressable>
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
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#edf2f7",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 12,
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 12,
    marginTop: 8,
  },
  loadingBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  loadingText: {
    color: "#718096",
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1a202c",
    marginBottom: 6,
  },
  emptyText: {
    color: "#718096",
    fontSize: 14,
    lineHeight: 20,
  },
  dentistCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  dentistCardSelected: {
    borderColor: "#2b6cb0",
    backgroundColor: "#e3f2fd",
  },
  dentistName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  dentistDetail: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 3,
  },
  dentistAvailability: {
    fontSize: 13,
    color: "#718096",
    marginTop: 4,
  },
  pickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  selectedValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 12,
  },
  pickerButton: {
    backgroundColor: "#edf2f7",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  pickerButtonText: {
    color: "#2b6cb0",
    fontSize: 14,
    fontWeight: "900",
  },
  donePickerButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  donePickerButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1a202c",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1a202c",
  },
  textArea: {
    minHeight: 95,
    textAlignVertical: "top",
  },
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  previewText: {
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "800",
  },
  submitButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});