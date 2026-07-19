import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthLabel = (date) =>
  date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
  });

const getCalendarCells = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const formatDisplayDate = (value, compact = false) => {
  if (!value) return "";

  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    year: compact ? undefined : "numeric",
    month: compact ? "short" : "long",
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

const StepSummary = ({
  number,
  title,
  value,
  active,
  completed,
  disabled,
  onPress,
}) => (
  <Pressable
    style={[
      styles.stepSummary,
      active && styles.stepSummaryActive,
      disabled && styles.stepSummaryDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <View
      style={[
        styles.stepCircle,
        active && styles.stepCircleActive,
        completed && styles.stepCircleCompleted,
      ]}
    >
      {completed ? (
        <Ionicons name="checkmark" size={16} color="#ffffff" />
      ) : (
        <Text style={styles.stepCircleText}>{number}</Text>
      )}
    </View>

    <View style={styles.stepSummaryText}>
      <Text style={styles.stepSummaryTitle}>{title}</Text>
      <Text
        style={[
          styles.stepSummaryValue,
          !value && styles.stepSummaryPlaceholder,
        ]}
        numberOfLines={1}
      >
        {value || "Not selected"}
      </Text>
    </View>

    <Ionicons
      name={active ? "chevron-up" : "chevron-down"}
      size={20}
      color={disabled ? "#cbd5e1" : "#64748b"}
    />
  </Pressable>
);

const OptionCard = ({
  title,
  subtitle,
  details,
  selected,
  onPress,
}) => (
  <Pressable
    style={[
      styles.optionCard,
      selected && styles.optionCardSelected,
    ]}
    onPress={onPress}
  >
    <View style={styles.optionCardText}>
      <Text style={styles.optionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
      {details ? <Text style={styles.optionDetails}>{details}</Text> : null}
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

const LoadingState = ({ label }) => (
  <View style={styles.loadingCard}>
    <ActivityIndicator color="#2563eb" />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

const EmptyState = ({ title, message }) => (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const SearchableServiceModal = ({
  visible,
  services,
  selectedServiceId,
  onClose,
  onSelect,
}) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) {
      setSearch("");
    }
  }, [visible]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();

    return services.filter((service) => {
      if (!term) return true;

      return [
        service.service_name,
        service.service_category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [search, services]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Choose Dental Service</Text>
              <Text style={styles.modalSubtitle}>
                Search instead of scrolling through every service.
              </Text>
            </View>

            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#475569" />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search service or category"
              placeholderTextColor="#94a3b8"
              autoFocus
            />
            {search ? (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={19} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.modalResultCount}>
            {filteredServices.length} service
            {filteredServices.length === 1 ? "" : "s"}
          </Text>

          <ScrollView
            style={styles.modalList}
            contentContainerStyle={styles.modalListContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredServices.length === 0 ? (
              <EmptyState
                title="No matching service"
                message="Try a different service name or category."
              />
            ) : (
              filteredServices.map((service) => (
                <OptionCard
                  key={service.service_id}
                  title={service.service_name}
                  subtitle={service.service_category || "Dental Service"}
                  selected={
                    Number(selectedServiceId) === Number(service.service_id)
                  }
                  onPress={() => onSelect(service)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default function BookAppointmentScreen({ token, onBack, onBooked }) {
  const [selection, setSelection] = useState(INITIAL_SELECTION);
  const [activeStep, setActiveStep] = useState(1);

  const [services, setServices] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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

  const availableDateSet = useMemo(
    () => new Set(availableDates),
    [availableDates],
  );

  const calendarCells = useMemo(
    () => getCalendarCells(calendarMonth),
    [calendarMonth],
  );

  const firstAvailableDate = availableDates[0]
    ? new Date(`${availableDates[0]}T00:00:00+08:00`)
    : null;

  const lastAvailableDate = availableDates.length
    ? new Date(
        `${availableDates[availableDates.length - 1]}T00:00:00+08:00`,
      )
    : null;

  const canGoToPreviousMonth = firstAvailableDate
    ? calendarMonth >
      new Date(
        firstAvailableDate.getFullYear(),
        firstAvailableDate.getMonth(),
        1,
      )
    : false;

  const canGoToNextMonth = lastAvailableDate
    ? calendarMonth <
      new Date(
        lastAvailableDate.getFullYear(),
        lastAvailableDate.getMonth(),
        1,
      )
    : false;

  const completedSteps = {
    1: Boolean(selection.service_id),
    2: Boolean(selection.clinic_id),
    3: Boolean(selection.dentist_id),
    4: Boolean(selection.appointment_date && selection.appointment_time),
  };

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
    {
      const now = new Date();
      setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setAppointmentType(service.service_name || "");
    setServiceModalVisible(false);
    setActiveStep(2);

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
    {
      const now = new Date();
      setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setActiveStep(3);

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
    {
      const now = new Date();
      setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
    setActiveStep(4);

    try {
      setLoadingDates(true);
      const data = await getBookingAvailableDates({
        token,
        clinic_id: selection.clinic_id,
        dentist_id: dentist.dentist_id,
        service_id: selection.service_id,
      });
      const nextAvailableDates = Array.isArray(data.available_dates)
        ? data.available_dates
        : [];

      setAvailableDates(nextAvailableDates);

      if (nextAvailableDates.length > 0) {
        const firstDate = new Date(
          `${nextAvailableDates[0]}T00:00:00+08:00`,
        );
        setCalendarMonth(
          new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
        );
      }
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

  const selectTime = (appointmentTime) => {
    setSelection((current) => ({
      ...current,
      appointment_time: appointmentTime,
    }));
    setActiveStep(5);
  };

  const handleSubmit = () => {
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
        { text: "Back", style: "cancel" },
        { text: "Submit", onPress: submitAppointment },
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
        [{ text: "View Appointments", onPress: onBooked }],
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

  const renderCurrentStep = () => {
    if (activeStep === 1) {
      return (
        <View style={styles.stepBody}>
          <Text style={styles.stepBodyTitle}>Dental Service</Text>
          <Text style={styles.stepBodyDescription}>
            Use search to quickly find a service without scrolling through the
            full clinic catalog.
          </Text>

          {loadingServices ? (
            <LoadingState label="Loading dental services..." />
          ) : services.length === 0 ? (
            <EmptyState
              title="No services available"
              message="Your assigned clinic has no active dental services."
            />
          ) : (
            <>
              <Pressable
                style={styles.primarySelectionButton}
                onPress={() => setServiceModalVisible(true)}
              >
                <Ionicons name="search-outline" size={20} color="#1d4ed8" />
                <View style={styles.primarySelectionText}>
                  <Text style={styles.primarySelectionLabel}>
                    {selectedService
                      ? "Change selected service"
                      : "Search dental services"}
                  </Text>
                  <Text style={styles.primarySelectionValue}>
                    {selectedService?.service_name ||
                      `${services.length} services available`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </Pressable>

              {selectedService ? (
                <View style={styles.selectedInfoCard}>
                  <Text style={styles.selectedInfoTitle}>
                    {selectedService.service_name}
                  </Text>
                  <Text style={styles.selectedInfoText}>
                    {selectedService.service_category || "Dental Service"}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      );
    }

    if (activeStep === 2) {
      return (
        <View style={styles.stepBody}>
          <Text style={styles.stepBodyTitle}>Clinic Location</Text>
          <Text style={styles.stepBodyDescription}>
            Booking remains limited to your assigned clinic location.
          </Text>

          {loadingClinics ? (
            <LoadingState label="Loading clinic availability..." />
          ) : clinics.length === 0 ? (
            <EmptyState
              title="No clinic availability"
              message="The selected service is not currently available at your assigned clinic."
            />
          ) : (
            clinics.map((clinic) => (
              <OptionCard
                key={clinic.clinic_id}
                title={clinic.clinic_name}
                subtitle={clinic.address}
                details={formatSchedule(clinic.availability)}
                selected={
                  Number(selection.clinic_id) === Number(clinic.clinic_id)
                }
                onPress={() => selectClinic(clinic)}
              />
            ))
          )}
        </View>
      );
    }

    if (activeStep === 3) {
      return (
        <View style={styles.stepBody}>
          <Text style={styles.stepBodyTitle}>Select Dentist</Text>
          <Text style={styles.stepBodyDescription}>
            Only Dentists assigned to this service and clinic are shown.
          </Text>

          {loadingDentists ? (
            <LoadingState label="Loading eligible Dentists..." />
          ) : dentists.length === 0 ? (
            <EmptyState
              title="No eligible Dentist"
              message="No active Dentist is currently assigned to this service."
            />
          ) : (
            dentists.map((dentist) => (
              <OptionCard
                key={dentist.dentist_id}
                title={dentist.dentist_name}
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
      );
    }

    if (activeStep === 4) {
      return (
        <View style={styles.stepBody}>
          <Text style={styles.stepBodyTitle}>Choose Date and Time</Text>
          <Text style={styles.stepBodyDescription}>
            Choose an available date from the calendar. Unavailable dates are crossed out.
          </Text>

          {loadingDates ? (
            <LoadingState label="Loading available dates..." />
          ) : availableDates.length === 0 ? (
            <EmptyState
              title="No available dates"
              message="The selected Dentist has no open schedule in the next 90 days."
            />
          ) : (
            <>
              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <Pressable
                    style={[
                      styles.calendarNavButton,
                      !canGoToPreviousMonth &&
                        styles.calendarNavButtonDisabled,
                    ]}
                    disabled={!canGoToPreviousMonth}
                    onPress={() =>
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() - 1,
                            1,
                          ),
                      )
                    }
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color="#1d4ed8"
                    />
                  </Pressable>

                  <Text style={styles.calendarMonthLabel}>
                    {getMonthLabel(calendarMonth)}
                  </Text>

                  <Pressable
                    style={[
                      styles.calendarNavButton,
                      !canGoToNextMonth &&
                        styles.calendarNavButtonDisabled,
                    ]}
                    disabled={!canGoToNextMonth}
                    onPress={() =>
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + 1,
                            1,
                          ),
                      )
                    }
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#1d4ed8"
                    />
                  </Pressable>
                </View>

                <View style={styles.weekdayRow}>
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <Text key={weekday} style={styles.weekdayText}>
                      {weekday}
                    </Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {calendarCells.map((date, index) => {
                    if (!date) {
                      return (
                        <View
                          key={`empty-${index}`}
                          style={styles.calendarDayCell}
                        />
                      );
                    }

                    const dateKey = toDateKey(date);
                    const available = availableDateSet.has(dateKey);
                    const selected =
                      selection.appointment_date === dateKey;

                    return (
                      <Pressable
                        key={dateKey}
                        style={[
                          styles.calendarDayCell,
                          selected && styles.calendarDaySelected,
                          !available && styles.calendarDayUnavailable,
                        ]}
                        disabled={!available}
                        onPress={() => selectDate(dateKey)}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            selected && styles.calendarDayTextSelected,
                            !available &&
                              styles.calendarDayTextUnavailable,
                          ]}
                        >
                          {date.getDate()}
                        </Text>

                        {!available ? (
                          <View style={styles.calendarStrikeLine} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.calendarLegend}>
                  <View style={styles.legendItem}>
                    <View style={styles.legendAvailable} />
                    <Text style={styles.legendText}>Available</Text>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={styles.legendUnavailable}>
                      <View style={styles.legendStrikeLine} />
                    </View>
                    <Text style={styles.legendText}>Unavailable</Text>
                  </View>
                </View>
              </View>

              {selection.appointment_date ? (
                <View style={styles.timeSection}>
                  <Text style={styles.timeSectionTitle}>
                    Available times for{" "}
                    {formatDisplayDate(selection.appointment_date)}
                  </Text>

                  {loadingTimes ? (
                    <LoadingState label="Loading available times..." />
                  ) : availableTimes.length === 0 ? (
                    <EmptyState
                      title="No time slots"
                      message="Choose another available date."
                    />
                  ) : (
                    <View style={styles.timeGrid}>
                      {availableTimes.map((time) => {
                        const selected =
                          selection.appointment_time === time;

                        return (
                          <Pressable
                            key={time}
                            style={[
                              styles.timeOption,
                              selected && styles.timeOptionSelected,
                            ]}
                            onPress={() => selectTime(time)}
                          >
                            <Text
                              style={[
                                styles.timeOptionText,
                                selected && styles.selectedOptionText,
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
              ) : null}
            </>
          )}
        </View>
      );
    }

    return (
      <View style={styles.stepBody}>
        <Text style={styles.stepBodyTitle}>Review and Submit</Text>
        <Text style={styles.stepBodyDescription}>
          Review your selections and add optional notes.
        </Text>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewLine}>
            <Text style={styles.reviewLabel}>Service: </Text>
            {selectedService?.service_name}
          </Text>
          <Text style={styles.reviewLine}>
            <Text style={styles.reviewLabel}>Clinic: </Text>
            {selectedClinic?.clinic_name}
          </Text>
          <Text style={styles.reviewLine}>
            <Text style={styles.reviewLabel}>Dentist: </Text>
            {selectedDentist?.dentist_name}
          </Text>
          <Text style={styles.reviewLine}>
            <Text style={styles.reviewLabel}>Schedule: </Text>
            {formatDisplayDate(selection.appointment_date)} at{" "}
            {formatDisplayTime(selection.appointment_time)}
          </Text>
        </View>

        <Text style={styles.inputLabel}>Appointment Type</Text>
        <TextInput
          style={styles.input}
          value={appointmentType}
          onChangeText={setAppointmentType}
          placeholder="Appointment type"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.inputLabel}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Symptoms, concerns, or requests"
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

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
      </View>
    );
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#1d4ed8" />
          <Text style={styles.backButtonText}>Appointments</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Book Appointment</Text>
          <Text style={styles.subtitle}>
            Complete one step at a time. Finished steps collapse automatically
            to reduce screen clutter.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, ((activeStep - 1) / 4) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {Math.min(activeStep, 5)} of 5
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <StepSummary
            number={1}
            title="Service"
            value={selectedService?.service_name}
            active={activeStep === 1}
            completed={completedSteps[1]}
            onPress={() => setActiveStep(1)}
          />
          <StepSummary
            number={2}
            title="Clinic"
            value={selectedClinic?.clinic_name}
            active={activeStep === 2}
            completed={completedSteps[2]}
            disabled={!selection.service_id}
            onPress={() => setActiveStep(2)}
          />
          <StepSummary
            number={3}
            title="Dentist"
            value={selectedDentist?.dentist_name}
            active={activeStep === 3}
            completed={completedSteps[3]}
            disabled={!selection.clinic_id}
            onPress={() => setActiveStep(3)}
          />
          <StepSummary
            number={4}
            title="Schedule"
            value={
              selection.appointment_date && selection.appointment_time
                ? `${formatDisplayDate(
                    selection.appointment_date,
                    true,
                  )} · ${formatDisplayTime(selection.appointment_time)}`
                : ""
            }
            active={activeStep === 4}
            completed={completedSteps[4]}
            disabled={!selection.dentist_id}
            onPress={() => setActiveStep(4)}
          />
          <StepSummary
            number={5}
            title="Review"
            value={completedSteps[4] ? "Ready to submit" : ""}
            active={activeStep === 5}
            completed={false}
            disabled={!completedSteps[4]}
            onPress={() => setActiveStep(5)}
          />
        </View>

        {renderCurrentStep()}
      </ScrollView>

      <SearchableServiceModal
        visible={serviceModalVisible}
        services={services}
        selectedServiceId={selection.service_id}
        onClose={() => setServiceModalVisible(false)}
        onSelect={selectService}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 18, paddingBottom: 40 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 10,
    paddingVertical: 7,
  },
  backButtonText: { color: "#1d4ed8", fontWeight: "800" },
  header: { marginBottom: 14 },
  title: { color: "#0f172a", fontSize: 27, fontWeight: "900" },
  subtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  progressCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 13,
  },
  progressTrack: {
    height: 7,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 999,
  },
  progressText: {
    marginTop: 7,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right",
  },
  stepsCard: {
    marginBottom: 13,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  stepSummary: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  stepSummaryActive: { backgroundColor: "#eff6ff" },
  stepSummaryDisabled: { opacity: 0.45 },
  stepCircle: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#94a3b8",
    borderRadius: 15,
  },
  stepCircleActive: { backgroundColor: "#2563eb" },
  stepCircleCompleted: { backgroundColor: "#16a34a" },
  stepCircleText: { color: "#ffffff", fontSize: 12, fontWeight: "900" },
  stepSummaryText: { flex: 1 },
  stepSummaryTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  stepSummaryValue: { marginTop: 3, color: "#475569", fontSize: 11 },
  stepSummaryPlaceholder: { color: "#94a3b8" },
  stepBody: {
    gap: 11,
    padding: 15,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 16,
  },
  stepBodyTitle: { color: "#0f172a", fontSize: 18, fontWeight: "900" },
  stepBodyDescription: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  primarySelectionButton: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 13,
  },
  primarySelectionText: { flex: 1 },
  primarySelectionLabel: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
  primarySelectionValue: {
    marginTop: 3,
    color: "#334155",
    fontSize: 11,
  },
  selectedInfoCard: {
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 11,
  },
  selectedInfoTitle: { color: "#166534", fontSize: 13, fontWeight: "800" },
  selectedInfoText: { marginTop: 3, color: "#15803d", fontSize: 11 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
  },
  optionCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  optionCardText: { flex: 1 },
  optionTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  optionSubtitle: { marginTop: 3, color: "#475569", fontSize: 11 },
  optionDetails: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
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
  radioCircleSelected: { borderColor: "#2563eb" },
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
  loadingText: { color: "#64748b" },
  emptyCard: {
    padding: 15,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  emptyTitle: { color: "#334155", fontWeight: "800" },
  emptyText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  calendarCard: {
    padding: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 13,
  },
  calendarNavButton: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  calendarNavButtonDisabled: { opacity: 0.3 },
  calendarMonthLabel: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 7,
  },
  weekdayText: {
    width: "14.2857%",
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 10,
  },
  calendarDaySelected: {
    backgroundColor: "#2563eb",
  },
  calendarDayUnavailable: {
    opacity: 0.52,
  },
  calendarDayText: {
    color: "#1e293b",
    fontSize: 12,
    fontWeight: "800",
  },
  calendarDayTextSelected: {
    color: "#ffffff",
  },
  calendarDayTextUnavailable: {
    color: "#94a3b8",
  },
  calendarStrikeLine: {
    position: "absolute",
    width: 22,
    height: 1.5,
    backgroundColor: "#ef4444",
    transform: [{ rotate: "-35deg" }],
  },
  calendarLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendAvailable: {
    width: 14,
    height: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 4,
  },
  legendUnavailable: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  legendStrikeLine: {
    width: 15,
    height: 1.5,
    backgroundColor: "#ef4444",
    transform: [{ rotate: "-35deg" }],
  },
  legendText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  selectedOptionText: { color: "#ffffff" },
  timeSection: {
    gap: 9,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  timeSectionTitle: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeOption: {
    minWidth: 92,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
  },
  timeOptionSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  timeOptionText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  reviewCard: {
    gap: 7,
    padding: 13,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  reviewLine: { color: "#475569", fontSize: 12, lineHeight: 18 },
  reviewLabel: { color: "#0f172a", fontWeight: "800" },
  inputLabel: { color: "#334155", fontSize: 12, fontWeight: "800" },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  notesInput: { minHeight: 100, paddingTop: 12 },
  submitButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 13,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  modalSheet: {
    height: "82%",
    paddingTop: 17,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingHorizontal: 18,
    paddingBottom: 13,
  },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: "#0f172a", fontSize: 19, fontWeight: "900" },
  modalSubtitle: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 19,
  },
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 18,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  searchInput: { flex: 1, color: "#0f172a" },
  modalResultCount: {
    marginTop: 10,
    marginHorizontal: 18,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  modalList: { flex: 1, marginTop: 8 },
  modalListContent: { gap: 9, padding: 18, paddingTop: 5, paddingBottom: 30 },
});