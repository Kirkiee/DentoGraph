import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  bookStructuredAppointment,
  getBookingAvailableDates,
  getBookingAvailableTimes,
  getBookingClinics,
  getBookingDentists,
  getBookingServices,
} from "../services/appointmentService";

const INITIAL_SELECTION = {
  service_id: null,
  clinic_id: null,
  dentist_id: null,
  appointment_date: "",
  appointment_time: "",
};

const formatDisplayDate = (value) => {
  if (!value) return "";

  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
};

const formatDisplayTime = (value) => {
  if (!value) return "";

  const [hourString, minuteString] = String(value).split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatSchedule = (availability = []) => {
  const openDays = availability.filter(
    (day) => day.is_open === true || day.is_available === true,
  );

  if (openDays.length === 0) {
    return "No schedule configured";
  }

  return openDays
    .map((day) => {
      const start = day.opening_time || day.start_time;
      const end = day.closing_time || day.end_time;
      return `${day.day_name}: ${start || "—"}–${end || "—"}`;
    })
    .join("\n");
};

const StepHeader = ({ number, title, description, completed }) => (
  <View style={styles.stepHeader}>
    <View style={[styles.stepNumber, completed && styles.stepNumberCompleted]}>
      {completed ? (
        <Ionicons name="checkmark" size={17} color="#ffffff" />
      ) : (
        <Text style={styles.stepNumberText}>{number}</Text>
      )}
    </View>

    <View style={styles.stepHeaderText}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  </View>
);

const SelectionCard = ({
  title,
  subtitle,
  details,
  selected,
  disabled,
  onPress,
}) => (
  <Pressable
    style={[
      styles.selectionCard,
      selected && styles.selectionCardSelected,
      disabled && styles.selectionCardDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={styles.selectionCardText}>
      <Text style={styles.selectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.selectionSubtitle}>{subtitle}</Text> : null}
      {details ? <Text style={styles.selectionDetails}>{details}</Text> : null}
    </View>

    <View
      style={[
        styles.radioCircle,
        selected && styles.radioCircleSelected,
      ]}
    >
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  </Pressable>
);

export default function BookAppointmentScreen({ token, onBack, onBooked }) {
  const [selection, setSelection] = useState(INITIAL_SELECTION);

  const [services, setServices] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [appointmentType, setAppointmentType] = useState("");
  const [notes, setNotes] = useState("");

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () =>
      services.find(
        (service) =>
          Number(service.service_id) === Number(selection.service_id),
      ) || null,
    [services, selection.service_id],
  );

  const selectedClinic = useMemo(
    () =>
      clinics.find(
        (clinic) => Number(clinic.clinic_id) === Number(selection.clinic_id),
      ) || null,
    [clinics, selection.clinic_id],
  );

  const selectedDentist = useMemo(
    () =>
      dentists.find(
        (dentist) =>
          Number(dentist.dentist_id) === Number(selection.dentist_id),
      ) || null,
    [dentists, selection.dentist_id],
  );

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const data = await getBookingServices(token);
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch (error) {
      Alert.alert(
        "Services Error",
        error.message || "Unable to load dental services.",
      );
    } finally {
      setLoadingServices(false);
    }
  };

  const selectService = async (service) => {
    setSelection({
      service_id: service.service_id,
      clinic_id: null,
      dentist_id: null,
      appointment_date: "",
      appointment_time: "",
    });
    setClinics([]);
    setDentists([]);
    setAvailableDates([]);
    setAvailableTimes([]);
    setAppointmentType(service.service_name || "");

    try {
      setLoadingClinics(true);
      const data = await getBookingClinics({
        token,
        service_id: service.service_id,
      });
      setClinics(Array.isArray(data.clinics) ? data.clinics : []);
    } catch (error) {
      Alert.alert(
        "Clinic Availability Error",
        error.message || "Unable to load clinic availability.",
      );
    } finally {
      setLoadingClinics(false);
    }
  };

  const selectClinic = async (clinic) => {
    setSelection((current) => ({
      ...current,
      clinic_id: clinic.clinic_id,
      dentist_id: null,
      appointment_date: "",
      appointment_time: "",
    }));
    setDentists([]);
    setAvailableDates([]);
    setAvailableTimes([]);

    try {
      setLoadingDentists(true);
      const data = await getBookingDentists({
        token,
        clinic_id: clinic.clinic_id,
        service_id: selection.service_id,
      });
      setDentists(Array.isArray(data.dentists) ? data.dentists : []);
    } catch (error) {
      Alert.alert(
        "Dentist Availability Error",
        error.message || "Unable to load eligible Dentists.",
      );
    } finally {
      setLoadingDentists(false);
    }
  };

  const selectDentist = async (dentist) => {
    setSelection((current) => ({
      ...current,
      dentist_id: dentist.dentist_id,
      appointment_date: "",
      appointment_time: "",
    }));
    setAvailableDates([]);
    setAvailableTimes([]);

    try {
      setLoadingDates(true);
      const data = await getBookingAvailableDates({
        token,
        clinic_id: selection.clinic_id,
        dentist_id: dentist.dentist_id,
        service_id: selection.service_id,
      });
      setAvailableDates(
        Array.isArray(data.available_dates) ? data.available_dates : [],
      );
    } catch (error) {
      Alert.alert(
        "Available Dates Error",
        error.message || "Unable to load available appointment dates.",
      );
    } finally {
      setLoadingDates(false);
    }
  };

  const selectDate = async (appointmentDate) => {
    setSelection((current) => ({
      ...current,
      appointment_date: appointmentDate,
      appointment_time: "",
    }));
    setAvailableTimes([]);

    try {
      setLoadingTimes(true);
      const data = await getBookingAvailableTimes({
        token,
        clinic_id: selection.clinic_id,
        dentist_id: selection.dentist_id,
        service_id: selection.service_id,
        appointment_date: appointmentDate,
      });
      setAvailableTimes(
        Array.isArray(data.available_times) ? data.available_times : [],
      );
    } catch (error) {
      Alert.alert(
        "Available Times Error",
        error.message || "Unable to load available appointment times.",
      );
    } finally {
      setLoadingTimes(false);
    }
  };

  const handleSubmit = async () => {
    if (
      !selection.service_id ||
      !selection.clinic_id ||
      !selection.dentist_id ||
      !selection.appointment_date ||
      !selection.appointment_time
    ) {
      Alert.alert(
        "Incomplete Appointment",
        "Complete the service, clinic, Dentist, date, and time selections.",
      );
      return;
    }

    Alert.alert(
      "Confirm Appointment",
      `${selectedService?.service_name || "Dental service"}\n` +
        `${selectedClinic?.clinic_name || "Clinic"}\n` +
        `${selectedDentist?.dentist_name || "Dentist"}\n` +
        `${formatDisplayDate(selection.appointment_date)} at ` +
        `${formatDisplayTime(selection.appointment_time)}`,
      [
        {
          text: "Back",
          style: "cancel",
        },
        {
          text: "Submit",
          onPress: submitAppointment,
        },
      ],
    );
  };

  const submitAppointment = async () => {
    try {
      setSubmitting(true);

      const response = await bookStructuredAppointment({
        token,
        clinic_id: Number(selection.clinic_id),
        dentist_id: Number(selection.dentist_id),
        service_id: Number(selection.service_id),
        appointment_date: selection.appointment_date,
        appointment_time: selection.appointment_time,
        appointment_type:
          appointmentType.trim() ||
          selectedService?.service_name ||
          "Dental Consultation",
        notes: notes.trim() || null,
      });

      Alert.alert(
        "Appointment Submitted",
        response.message || "Your appointment request was submitted.",
        [
          {
            text: "View Appointments",
            onPress: onBooked,
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "Booking Failed",
        error.message || "Unable to submit the appointment request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#1d4ed8" />
          <Text style={styles.backButtonText}>Appointments</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Book an Appointment</Text>
        <Text style={styles.subtitle}>
          Follow the approved service-first booking flow. DentoGraph only shows
          schedules that are valid for your assigned clinic.
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={21} color="#1d4ed8" />
        <Text style={styles.infoBannerText}>
          Your active clinic assignment remains enforced. Clinic availability,
          Dentist schedules, closed days, breaks, unavailable dates, and booked
          time slots are checked before submission.
        </Text>
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="1"
          title="Choose a Dental Service"
          description="Start with the treatment or consultation you need."
          completed={Boolean(selection.service_id)}
        />

        {loadingServices ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading dental services...</Text>
          </View>
        ) : services.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No services available</Text>
            <Text style={styles.emptyText}>
              Your assigned clinic has no active bookable services.
            </Text>
          </View>
        ) : (
          services.map((service) => (
            <SelectionCard
              key={service.service_id}
              title={service.service_name}
              subtitle={service.service_category || "Dental Service"}
              selected={
                Number(selection.service_id) === Number(service.service_id)
              }
              onPress={() => selectService(service)}
            />
          ))
        )}
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="2"
          title="Review Clinic Availability"
          description="Select the eligible assigned clinic location."
          completed={Boolean(selection.clinic_id)}
        />

        {!selection.service_id ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
            <Text style={styles.lockedText}>Choose a service first.</Text>
          </View>
        ) : loadingClinics ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.loadingText}>
              Loading clinic availability...
            </Text>
          </View>
        ) : clinics.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Service unavailable</Text>
            <Text style={styles.emptyText}>
              This service is not currently available at your assigned clinic.
            </Text>
          </View>
        ) : (
          clinics.map((clinic) => (
            <SelectionCard
              key={clinic.clinic_id}
              title={clinic.clinic_name || "Assigned Clinic"}
              subtitle={clinic.address || "No clinic address provided"}
              details={formatSchedule(clinic.availability)}
              selected={
                Number(selection.clinic_id) === Number(clinic.clinic_id)
              }
              onPress={() => selectClinic(clinic)}
            />
          ))
        )}
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="3"
          title="Choose an Available Dentist"
          description="Only Dentists assigned to the service are shown."
          completed={Boolean(selection.dentist_id)}
        />

        {!selection.clinic_id ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
            <Text style={styles.lockedText}>Choose the clinic first.</Text>
          </View>
        ) : loadingDentists ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading Dentists...</Text>
          </View>
        ) : dentists.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No eligible Dentists</Text>
            <Text style={styles.emptyText}>
              No active Dentist is currently assigned to this service.
            </Text>
          </View>
        ) : (
          dentists.map((dentist) => (
            <SelectionCard
              key={dentist.dentist_id}
              title={dentist.dentist_name || "Dentist"}
              subtitle={dentist.specialization || "General Dentistry"}
              details={formatSchedule(dentist.availability)}
              selected={
                Number(selection.dentist_id) === Number(dentist.dentist_id)
              }
              onPress={() => selectDentist(dentist)}
            />
          ))
        )}
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="4"
          title="Choose an Available Date"
          description="Closed days and Dentist unavailable dates are excluded."
          completed={Boolean(selection.appointment_date)}
        />

        {!selection.dentist_id ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
            <Text style={styles.lockedText}>Choose a Dentist first.</Text>
          </View>
        ) : loadingDates ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading available dates...</Text>
          </View>
        ) : availableDates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No available dates</Text>
            <Text style={styles.emptyText}>
              The selected Dentist has no valid dates in the next 90 days.
            </Text>
          </View>
        ) : (
          <View style={styles.optionGrid}>
            {availableDates.map((date) => {
              const selected = selection.appointment_date === date;

              return (
                <Pressable
                  key={date}
                  style={[
                    styles.dateOption,
                    selected && styles.optionSelected,
                  ]}
                  onPress={() => selectDate(date)}
                >
                  <Text
                    style={[
                      styles.dateOptionText,
                      selected && styles.optionSelectedText,
                    ]}
                  >
                    {formatDisplayDate(date)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="5"
          title="Choose an Available Time"
          description="Breaks, past times, and occupied slots are excluded."
          completed={Boolean(selection.appointment_time)}
        />

        {!selection.appointment_date ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
            <Text style={styles.lockedText}>Choose an available date first.</Text>
          </View>
        ) : loadingTimes ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading available times...</Text>
          </View>
        ) : availableTimes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No available time slots</Text>
            <Text style={styles.emptyText}>
              Select another available date.
            </Text>
          </View>
        ) : (
          <View style={styles.timeGrid}>
            {availableTimes.map((time) => {
              const selected = selection.appointment_time === time;

              return (
                <Pressable
                  key={time}
                  style={[
                    styles.timeOption,
                    selected && styles.optionSelected,
                  ]}
                  onPress={() =>
                    setSelection((current) => ({
                      ...current,
                      appointment_time: time,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      selected && styles.optionSelectedText,
                    ]}
                  >
                    {formatDisplayTime(time)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.stepSection}>
        <StepHeader
          number="6"
          title="Appointment Details"
          description="Add optional notes and review your selections."
          completed={Boolean(
            selection.appointment_time &&
              selection.appointment_date &&
              selection.dentist_id,
          )}
        />

        <Text style={styles.inputLabel}>Appointment Type</Text>
        <TextInput
          style={styles.input}
          value={appointmentType}
          onChangeText={setAppointmentType}
          placeholder="Dental Consultation"
        />

        <Text style={styles.inputLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Symptoms, concerns, or information for the clinic"
          multiline
          textAlignVertical="top"
        />

        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Booking Summary</Text>
          <Text style={styles.reviewLine}>
            Service: {selectedService?.service_name || "Not selected"}
          </Text>
          <Text style={styles.reviewLine}>
            Clinic: {selectedClinic?.clinic_name || "Not selected"}
          </Text>
          <Text style={styles.reviewLine}>
            Dentist: {selectedDentist?.dentist_name || "Not selected"}
          </Text>
          <Text style={styles.reviewLine}>
            Date:{" "}
            {selection.appointment_date
              ? formatDisplayDate(selection.appointment_date)
              : "Not selected"}
          </Text>
          <Text style={styles.reviewLine}>
            Time:{" "}
            {selection.appointment_time
              ? formatDisplayTime(selection.appointment_time)
              : "Not selected"}
          </Text>
        </View>
      </View>

      <Pressable
        style={[
          styles.submitButton,
          submitting && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="calendar-outline" size={20} color="#ffffff" />
            <Text style={styles.submitButtonText}>
              Submit Appointment Request
            </Text>
          </>
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
    padding: 18,
    paddingBottom: 40,
  },
  topBar: {
    marginBottom: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#1d4ed8",
    fontSize: 15,
    fontWeight: "700",
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
    marginTop: 7,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
  },
  infoBannerText: {
    flex: 1,
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 19,
  },
  stepSection: {
    marginBottom: 16,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 16,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 13,
  },
  stepNumber: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#64748b",
    borderRadius: 16,
  },
  stepNumberCompleted: {
    backgroundColor: "#16a34a",
  },
  stepNumberText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  stepHeaderText: {
    flex: 1,
  },
  stepTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  stepDescription: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
  },
  selectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 13,
  },
  selectionCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  selectionCardDisabled: {
    opacity: 0.5,
  },
  selectionCardText: {
    flex: 1,
  },
  selectionTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  selectionSubtitle: {
    marginTop: 4,
    color: "#475569",
    fontSize: 13,
  },
  selectionDetails: {
    marginTop: 7,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#94a3b8",
    borderRadius: 11,
  },
  radioCircleSelected: {
    borderColor: "#2563eb",
  },
  radioDot: {
    width: 10,
    height: 10,
    backgroundColor: "#2563eb",
    borderRadius: 5,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  loadingText: {
    color: "#64748b",
  },
  emptyCard: {
    padding: 15,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  emptyTitle: {
    color: "#334155",
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  lockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 14,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
  },
  lockedText: {
    color: "#64748b",
    fontWeight: "600",
  },
  optionGrid: {
    gap: 8,
  },
  dateOption: {
    padding: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  dateOptionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeOption: {
    minWidth: 95,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
  },
  timeOptionText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  optionSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  optionSelectedText: {
    color: "#ffffff",
  },
  inputLabel: {
    marginBottom: 7,
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 46,
    marginBottom: 14,
    paddingHorizontal: 13,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  reviewCard: {
    padding: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  reviewTitle: {
    marginBottom: 8,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  reviewLine: {
    marginBottom: 5,
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#2563eb",
    borderRadius: 14,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});