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
  getActiveClinics,
  getAvailableTimes,
  getDentistsByClinic,
} from "../services/appointmentService";

export default function BookAppointmentScreen({ token, onBack, onBooked }) {
  const [clinics, setClinics] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [selectedDentistId, setSelectedDentistId] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");

  const [appointmentDate, setAppointmentDate] = useState(new Date());
  const [appointmentType, setAppointmentType] = useState("Consultation");
  const [notes, setNotes] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [loadingClinics, setLoadingClinics] = useState(true);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClinics();
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      loadDentistsByClinic(selectedClinicId);
    } else {
      setDentists([]);
      setSelectedDentistId(null);
      setAvailableTimes([]);
      setSelectedTime("");
    }
  }, [selectedClinicId]);

  useEffect(() => {
    if (selectedDentistId && appointmentDate) {
      loadAvailableTimes();
    } else {
      setAvailableTimes([]);
      setSelectedTime("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDentistId, appointmentDate]);

  const loadClinics = async () => {
    try {
      setLoadingClinics(true);

      const data = await getActiveClinics(token);

      if (Array.isArray(data.clinics)) {
        setClinics(data.clinics);
      } else {
        setClinics([]);
      }
    } catch (error) {
      Alert.alert("Clinics Error", error.message || "Unable to load clinics.");
    } finally {
      setLoadingClinics(false);
    }
  };

  const loadDentistsByClinic = async (clinicId) => {
    try {
      setLoadingDentists(true);
      setSelectedDentistId(null);
      setAvailableTimes([]);
      setSelectedTime("");

      const data = await getDentistsByClinic({
        token,
        clinic_id: clinicId,
      });

      if (Array.isArray(data.dentists)) {
        setDentists(data.dentists);
      } else {
        setDentists([]);
      }
    } catch (error) {
      Alert.alert(
        "Dentists Error",
        error.message || "Unable to load dentists for this clinic."
      );
    } finally {
      setLoadingDentists(false);
    }
  };

  const loadAvailableTimes = async () => {
    if (!selectedDentistId) return;

    try {
      setLoadingTimes(true);
      setSelectedTime("");

      const data = await getAvailableTimes({
        token,
        dentist_id: selectedDentistId,
        appointment_date: formatBackendDateOnly(appointmentDate),
      });

      if (Array.isArray(data.available_times)) {
        setAvailableTimes(data.available_times);
      } else if (Array.isArray(data.time_slots)) {
        setAvailableTimes(data.time_slots);
      } else if (Array.isArray(data.times)) {
        setAvailableTimes(data.times);
      } else {
        setAvailableTimes([]);
      }
    } catch (error) {
      Alert.alert(
        "Available Times Error",
        error.message || "Unable to load available time slots."
      );
    } finally {
      setLoadingTimes(false);
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
      updatedDate.setHours(0);
      updatedDate.setMinutes(0);
      updatedDate.setSeconds(0);
      updatedDate.setMilliseconds(0);

      setAppointmentDate(updatedDate);
      setSelectedTime("");
    }
  };

  const formatDisplayDate = (value) => {
    return value.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatBackendDateOnly = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatBackendDateTime = (dateValue, timeValue) => {
    return `${formatBackendDateOnly(dateValue)} ${timeValue}`;
  };

  const getSelectedClinic = () => {
    return clinics.find(
      (clinic) => Number(clinic.clinic_id) === Number(selectedClinicId)
    );
  };

  const getSelectedDentist = () => {
    return dentists.find(
      (dentist) => Number(dentist.dentist_id) === Number(selectedDentistId)
    );
  };

  const handleSubmit = async () => {
    if (!selectedClinicId) {
      Alert.alert("Missing Clinic", "Please select a clinic first.");
      return;
    }

    if (!selectedDentistId) {
      Alert.alert("Missing Dentist", "Please select a dentist.");
      return;
    }

    if (!selectedTime) {
      Alert.alert("Missing Time", "Please select an available time slot.");
      return;
    }

    const selectedDateTime = new Date(
      `${formatBackendDateOnly(appointmentDate)}T${selectedTime}`
    );

    if (selectedDateTime <= new Date()) {
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
        clinic_id: selectedClinicId,
        dentist_id: selectedDentistId,
        appointment_date: formatBackendDateTime(appointmentDate, selectedTime),
        appointment_time: selectedTime,
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

  const selectedClinic = getSelectedClinic();
  const selectedDentist = getSelectedDentist();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Book Appointment</Text>
      <Text style={styles.subtitle}>
        Select a clinic, choose an available dentist, then pick a date and time.
      </Text>

      <Text style={styles.sectionTitle}>Choose Clinic</Text>

      {loadingClinics ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading clinics...</Text>
        </View>
      ) : clinics.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No clinics available</Text>
          <Text style={styles.emptyText}>
            Active clinics will appear here once available.
          </Text>
        </View>
      ) : (
        clinics.map((clinic) => {
          const isSelected = selectedClinicId === clinic.clinic_id;

          return (
            <Pressable
              key={clinic.clinic_id}
              style={[
                styles.selectionCard,
                isSelected && styles.selectionCardSelected,
              ]}
              onPress={() => setSelectedClinicId(clinic.clinic_id)}
            >
              <Text style={styles.selectionName}>
                {clinic.clinic_name || "Unnamed Clinic"}
              </Text>

              <Text style={styles.selectionDetail}>
                {clinic.address || "No clinic address provided"}
              </Text>

              {clinic.contact_number ? (
                <Text style={styles.selectionSubDetail}>
                  Contact: {clinic.contact_number}
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Choose Dentist</Text>

      {!selectedClinicId ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Select a clinic first</Text>
          <Text style={styles.emptyText}>
            Dentists will load after you choose a clinic.
          </Text>
        </View>
      ) : loadingDentists ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading dentists...</Text>
        </View>
      ) : dentists.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No dentists available</Text>
          <Text style={styles.emptyText}>
            This clinic has no available active dentists yet.
          </Text>
        </View>
      ) : (
        dentists.map((dentist) => {
          const isSelected = selectedDentistId === dentist.dentist_id;

          return (
            <Pressable
              key={dentist.dentist_id}
              style={[
                styles.selectionCard,
                isSelected && styles.selectionCardSelected,
              ]}
              onPress={() => setSelectedDentistId(dentist.dentist_id)}
            >
              <Text style={styles.selectionName}>
                {dentist.dentist_name || "Unnamed Dentist"}
              </Text>

              <Text style={styles.selectionDetail}>
                {dentist.specialization || "General Dentistry"}
              </Text>

              <Text style={styles.selectionSubDetail}>
                {dentist.availability || "Availability not specified"}
              </Text>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Appointment Date</Text>

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

      {showDatePicker && (
        <DateTimePicker
          value={appointmentDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === "ios" && showDatePicker ? (
        <Pressable
          style={styles.donePickerButton}
          onPress={() => setShowDatePicker(false)}
        >
          <Text style={styles.donePickerButtonText}>Done</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Available Time</Text>

      {!selectedDentistId ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Select a dentist first</Text>
          <Text style={styles.emptyText}>
            Available time slots will load after choosing a dentist.
          </Text>
        </View>
      ) : loadingTimes ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading available times...</Text>
        </View>
      ) : availableTimes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No available time slots</Text>
          <Text style={styles.emptyText}>
            Try selecting another date or dentist.
          </Text>
        </View>
      ) : (
        <View style={styles.timeGrid}>
          {availableTimes.map((time) => {
            const timeValue =
              typeof time === "string"
                ? time
                : time.time || time.value || time.appointment_time;

            const isSelected = selectedTime === timeValue;

            return (
              <Pressable
                key={timeValue}
                style={[
                  styles.timeSlot,
                  isSelected && styles.timeSlotSelected,
                ]}
                onPress={() => setSelectedTime(timeValue)}
              >
                <Text
                  style={[
                    styles.timeSlotText,
                    isSelected && styles.timeSlotTextSelected,
                  ]}
                >
                  {timeValue}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

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
          Clinic: {selectedClinic?.clinic_name || "No clinic selected"}
        </Text>

        <Text style={styles.previewText}>
          Dentist: {selectedDentist?.dentist_name || "No dentist selected"}
        </Text>

        <Text style={styles.previewText}>
          Schedule:{" "}
          {selectedTime
            ? formatBackendDateTime(appointmentDate, selectedTime)
            : `${formatBackendDateOnly(appointmentDate)} - No time selected`}
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
  selectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  selectionCardSelected: {
    borderColor: "#2b6cb0",
    backgroundColor: "#e3f2fd",
  },
  selectionName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  selectionDetail: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 3,
  },
  selectionSubDetail: {
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
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  timeSlot: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: "30%",
    alignItems: "center",
  },
  timeSlotSelected: {
    backgroundColor: "#2b6cb0",
    borderColor: "#2b6cb0",
  },
  timeSlotText: {
    color: "#2b6cb0",
    fontWeight: "900",
    fontSize: 13,
  },
  timeSlotTextSelected: {
    color: "#ffffff",
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
    gap: 6,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  previewText: {
    fontSize: 14,
    color: "#1a202c",
    fontWeight: "800",
    lineHeight: 20,
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