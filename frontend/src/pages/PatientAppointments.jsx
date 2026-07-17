import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);

  const [formData, setFormData] = useState({
    service_id: "",
    clinic_id: "",
    dentist_id: "",
    appointment_date: "",
    appointment_time: "",
    appointment_type: "Dental Consultation",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [booking, setBooking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showBookingForm, setShowBookingForm] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [newAppointmentDate, setNewAppointmentDate] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const padNumber = (value) => String(value).padStart(2, "0");

  const getCurrentDateLocal = () => {
    const now = new Date();

    return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(
      now.getDate(),
    )}`;
  };

  const getRecommendedAppointmentDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 5);

    return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
      date.getDate(),
    )}`;
  };

  const getCurrentDateTimeLocal = () => {
    const now = new Date();

    return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(
      now.getDate(),
    )}T${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`;
  };

  const isPastDate = (dateValue) => {
    if (!dateValue) return true;

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const today = new Date(`${getCurrentDateLocal()}T00:00:00`);

    return selectedDate.getTime() < today.getTime();
  };

  const isPastDateTime = (dateTimeValue) => {
    if (!dateTimeValue) return true;

    const selectedDate = new Date(dateTimeValue);
    const now = new Date();

    return selectedDate.getTime() < now.getTime();
  };

  const getDaysUntilAppointment = (dateValue) => {
    if (!dateValue) return null;

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const today = new Date(`${getCurrentDateLocal()}T00:00:00`);
    const diff = selectedDate.getTime() - today.getTime();

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const combineDateAndTimeToOffsetISO = (dateValue, timeValue) => {
    if (!dateValue || !timeValue) return "";

    const localDateTime = `${dateValue}T${timeValue}`;
    const selectedDate = new Date(localDateTime);
    const timezoneOffsetMinutes = -selectedDate.getTimezoneOffset();

    const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(timezoneOffsetMinutes);
    const offsetHours = padNumber(Math.floor(absoluteOffset / 60));
    const offsetMinutes = padNumber(absoluteOffset % 60);

    return `${localDateTime}:00${sign}${offsetHours}:${offsetMinutes}`;
  };

  const combineDateTimeLocalToOffsetISO = (dateTimeValue) => {
    if (!dateTimeValue) return "";

    const selectedDate = new Date(dateTimeValue);
    const timezoneOffsetMinutes = -selectedDate.getTimezoneOffset();

    const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(timezoneOffsetMinutes);
    const offsetHours = padNumber(Math.floor(absoluteOffset / 60));
    const offsetMinutes = padNumber(absoluteOffset % 60);

    return `${dateTimeValue}:00${sign}${offsetHours}:${offsetMinutes}`;
  };

  const formatAppointmentDateTime = (dateTimeValue) => {
    if (!dateTimeValue) return "N/A";

    return new Date(dateTimeValue).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Scheduled":
        return "status-badge status-scheduled";
      case "Completed":
        return "status-badge status-completed";
      case "Cancelled":
        return "status-badge status-cancelled";
      default:
        return "status-badge status-pending";
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showCancelModal || showRescheduleModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showCancelModal, showRescheduleModal]);

  useEffect(() => {
    if (formData.service_id) fetchClinicsByService(formData.service_id);
    else {
      setClinics([]);
      setDentists([]);
      setAvailableDates([]);
      setAvailableTimes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id]);

  useEffect(() => {
    if (formData.service_id && formData.clinic_id) fetchDentistsForBooking();
    else {
      setDentists([]);
      setAvailableDates([]);
      setAvailableTimes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id, formData.clinic_id]);

  useEffect(() => {
    if (formData.service_id && formData.clinic_id && formData.dentist_id)
      fetchAvailableDates();
    else {
      setAvailableDates([]);
      setAvailableTimes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.service_id, formData.clinic_id, formData.dentist_id]);

  useEffect(() => {
    if (formData.appointment_date) fetchAvailableTimesPhase11();
    else setAvailableTimes([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.appointment_date]);

  const fetchAppointments = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get(
        "/api/appointments/my-appointments",
        authHeaders,
      );

      setAppointments(response.data.appointments || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const response = await API.get(
        "/api/appointments/booking/services",
        authHeaders,
      );
      setServices(response.data.services || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load services.");
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchClinicsByService = async (serviceId) => {
    try {
      setLoadingClinics(true);
      const response = await API.get("/api/appointments/booking/clinics", {
        ...authHeaders,
        params: { service_id: serviceId },
      });
      const rows = response.data.clinics || [];
      setClinics(rows);
      setFormData((prev) => ({
        ...prev,
        clinic_id: rows.length === 1 ? String(rows[0].clinic_id) : "",
        dentist_id: "",
        appointment_date: "",
        appointment_time: "",
      }));
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load clinic availability.",
      );
    } finally {
      setLoadingClinics(false);
    }
  };

  const fetchDentistsForBooking = async () => {
    try {
      setLoadingDentists(true);
      const response = await API.get("/api/appointments/booking/dentists", {
        ...authHeaders,
        params: {
          service_id: formData.service_id,
          clinic_id: formData.clinic_id,
        },
      });
      setDentists(response.data.dentists || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dentist availability.",
      );
    } finally {
      setLoadingDentists(false);
    }
  };

  const fetchAvailableDates = async () => {
    try {
      setLoadingDates(true);
      const response = await API.get(
        "/api/appointments/booking/available-dates",
        {
          ...authHeaders,
          params: {
            service_id: formData.service_id,
            clinic_id: formData.clinic_id,
            dentist_id: formData.dentist_id,
          },
        },
      );
      setAvailableDates(response.data.available_dates || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load available dates.");
    } finally {
      setLoadingDates(false);
    }
  };

  const fetchAvailableTimesPhase11 = async () => {
    try {
      setLoadingTimes(true);
      const response = await API.get(
        "/api/appointments/booking/available-times",
        {
          ...authHeaders,
          params: {
            service_id: formData.service_id,
            clinic_id: formData.clinic_id,
            dentist_id: formData.dentist_id,
            appointment_date: formData.appointment_date,
          },
        },
      );
      setAvailableTimes(response.data.available_times || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load available times.");
    } finally {
      setLoadingTimes(false);
    }
  };

  const refreshAll = async () => {
    setMessage("");
    setError("");

    await Promise.all([fetchAppointments(true), fetchServices()]);

    if (formData.service_id) {
      await fetchClinicsByService(formData.service_id);
    }

    if (formData.service_id && formData.clinic_id) {
      await fetchDentistsForBooking();
    }

    if (formData.service_id && formData.clinic_id && formData.dentist_id) {
      await fetchAvailableDates();
    }

    if (
      formData.service_id &&
      formData.clinic_id &&
      formData.dentist_id &&
      formData.appointment_date
    ) {
      await fetchAvailableTimesPhase11();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMessage("");
    setError("");
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "service_id")
        Object.assign(next, {
          clinic_id: "",
          dentist_id: "",
          appointment_date: "",
          appointment_time: "",
        });
      if (name === "clinic_id")
        Object.assign(next, {
          dentist_id: "",
          appointment_date: "",
          appointment_time: "",
        });
      if (name === "dentist_id")
        Object.assign(next, { appointment_date: "", appointment_time: "" });
      if (name === "appointment_date") next.appointment_time = "";
      return next;
    });
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (
      !formData.service_id ||
      !formData.clinic_id ||
      !formData.dentist_id ||
      !formData.appointment_date ||
      !formData.appointment_time
    ) {
      setError("Complete each booking step before submitting.");
      return;
    }
    try {
      setBooking(true);
      const response = await API.post(
        "/api/appointments/booking",
        {
          service_id: Number(formData.service_id),
          clinic_id: Number(formData.clinic_id),
          dentist_id: Number(formData.dentist_id),
          appointment_date: formData.appointment_date,
          appointment_time: formData.appointment_time,
          notes: formData.notes,
        },
        authHeaders,
      );
      setMessage(
        response.data.message || "Appointment request submitted successfully.",
      );
      setFormData({
        service_id: "",
        clinic_id: "",
        dentist_id: "",
        appointment_date: "",
        appointment_time: "",
        appointment_type: "Dental Consultation",
        notes: "",
      });
      setClinics([]);
      setDentists([]);
      setAvailableDates([]);
      setAvailableTimes([]);
      await fetchAppointments();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to book appointment.");
    } finally {
      setBooking(false);
    }
  };

  const openCancelModal = (appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason("");
    setMessage("");
    setError("");
    setModalError("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setSelectedAppointment(null);
    setCancellationReason("");
    setModalError("");
  };

  const handleCancelAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment) {
      setModalError("No appointment selected for cancellation.");
      return;
    }

    const trimmedReason = cancellationReason.trim();

    if (!trimmedReason) {
      setModalError("Cancellation remarks are required.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/cancel`,
        {
          cancellation_reason: trimmedReason,
        },
        authHeaders,
      );

      setMessage("Appointment cancelled successfully.");
      closeCancelModal();
      fetchAppointments();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to cancel appointment.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const openRescheduleModal = (appointment) => {
    setSelectedAppointment(appointment);
    setNewAppointmentDate("");
    setMessage("");
    setError("");
    setModalError("");
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setSelectedAppointment(null);
    setNewAppointmentDate("");
    setModalError("");
  };

  const handleRescheduleAppointment = async (e) => {
    e.preventDefault();

    if (!selectedAppointment || !newAppointmentDate) {
      setModalError("Please select a new appointment date.");
      return;
    }

    if (isPastDateTime(newAppointmentDate)) {
      setModalError("You cannot request a reschedule to a past date or time.");
      return;
    }

    try {
      setUpdating(true);
      setMessage("");
      setError("");
      setModalError("");

      await API.put(
        `/api/appointments/${selectedAppointment.appointment_id}/reschedule`,
        {
          new_appointment_date:
            combineDateTimeLocalToOffsetISO(newAppointmentDate),
        },
        authHeaders,
      );

      setMessage("Reschedule request submitted successfully.");
      closeRescheduleModal();
      fetchAppointments();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to submit reschedule request.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const selectedService = services.find(
    (service) => Number(service.service_id) === Number(formData.service_id),
  );

  const selectedClinic = clinics.find(
    (clinic) => Number(clinic.clinic_id) === Number(formData.clinic_id),
  );

  const selectedDentist = dentists.find(
    (dentist) => Number(dentist.dentist_id) === Number(formData.dentist_id),
  );

  const daysUntilAppointment = getDaysUntilAppointment(
    formData.appointment_date,
  );

  const appointmentSummary = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter((item) => item.status === "Pending").length,
      scheduled: appointments.filter((item) => item.status === "Scheduled")
        .length,
      completed: appointments.filter((item) => item.status === "Completed")
        .length,
      cancelled: appointments.filter((item) => item.status === "Cancelled")
        .length,
      reschedule: appointments.filter((item) => item.reschedule_request).length,
    };
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === "All") return appointments;

    if (statusFilter === "Reschedule") {
      return appointments.filter((item) => item.reschedule_request);
    }

    return appointments.filter((item) => item.status === statusFilter);
  }, [appointments, statusFilter]);

  const filterOptions = [
    { label: "All", value: "All", count: appointmentSummary.total },
    { label: "Pending", value: "Pending", count: appointmentSummary.pending },
    {
      label: "Scheduled",
      value: "Scheduled",
      count: appointmentSummary.scheduled,
    },
    {
      label: "Completed",
      value: "Completed",
      count: appointmentSummary.completed,
    },
    {
      label: "Cancelled",
      value: "Cancelled",
      count: appointmentSummary.cancelled,
    },
    {
      label: "Reschedule",
      value: "Reschedule",
      count: appointmentSummary.reschedule,
    },
  ];

  const renderAppointmentSkeletons = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="appointment-item loading-card" key={index}>
            <div className="appointment-info">
              <div className="loading-line loading-title"></div>
              <div className="loading-line loading-text"></div>
              <div className="loading-line loading-text"></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Appointments</h2>
            <p>
              Book appointments, track requests, and manage reschedules or
              cancellations in a cleaner view.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              className="primary-button"
              onClick={() => setShowBookingForm((prev) => !prev)}
            >
              {showBookingForm ? "Hide Booking Form" : "Book Appointment"}
            </button>

            <button
              className="secondary-button"
              onClick={refreshAll}
              disabled={
                loading ||
                refreshing ||
                loadingClinics ||
                loadingDentists ||
                loadingTimes
              }
            >
              {refreshing || loading || loadingServices || loadingClinics
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Appointment notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total</span>
            <strong>{appointmentSummary.total}</strong>
            <p>All appointment records.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Pending</span>
            <strong>{appointmentSummary.pending}</strong>
            <p>Waiting for clinic confirmation.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Scheduled</span>
            <strong>{appointmentSummary.scheduled}</strong>
            <p>Confirmed appointments.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Reschedule Requests</span>
            <strong>{appointmentSummary.reschedule}</strong>
            <p>Requests waiting for review.</p>
          </div>
        </div>

        {showBookingForm && (
          <div className="patient-dashboard-section phase11-booking-section">
            <div className="appointments-header">
              <div>
                <h2>Book New Appointment</h2>
                <p>
                  Follow the guided booking flow. Availability is generated from
                  clinic hours and the dentist's structured weekly schedule.
                </p>
              </div>
            </div>
            <div className="phase11-booking-steps">
              {[
                "Service",
                "Clinic Availability",
                "Clinic",
                "Dentist Availability",
                "Dentist",
                "Date",
                "Time Slot",
              ].map((label, index) => (
                <span key={label} className="phase11-step">
                  <b>{index + 1}</b>
                  {label}
                </span>
              ))}
            </div>
            <form
              className="appointment-form patient-booking-panel"
              onSubmit={handleBookAppointment}
            >
              <div className="patient-booking-grid phase11-booking-grid">
                <div className="form-group">
                  <label>1. Dental Service</label>
                  <select
                    name="service_id"
                    value={formData.service_id}
                    onChange={handleChange}
                    disabled={loadingServices || booking}
                    required
                  >
                    <option value="">
                      {loadingServices
                        ? "Loading services..."
                        : "Select Service"}
                    </option>
                    {services.map((s) => (
                      <option key={s.service_id} value={s.service_id}>
                        {s.service_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group phase11-span-full">
                  <label>2. Clinic Availability</label>
                  {!formData.service_id ? (
                    <div className="phase11-empty">
                      Select a service to view clinic availability.
                    </div>
                  ) : loadingClinics ? (
                    <div className="phase11-empty">
                      Loading clinic schedule...
                    </div>
                  ) : (
                    clinics.map((c) => (
                      <div
                        className="phase11-availability-card"
                        key={c.clinic_id}
                      >
                        <strong>{c.clinic_name}</strong>
                        <div className="phase11-week-grid">
                          {(c.availability || []).map((d) => (
                            <span
                              key={d.day_of_week}
                              className={d.is_open ? "open" : "closed"}
                            >
                              {d.day_name.slice(0, 3)}
                              <small>
                                {d.is_open
                                  ? `${d.opening_time}–${d.closing_time}`
                                  : "Closed"}
                              </small>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="form-group">
                  <label>3. Clinic</label>
                  <select
                    name="clinic_id"
                    value={formData.clinic_id}
                    onChange={handleChange}
                    disabled={!formData.service_id || loadingClinics || booking}
                    required
                  >
                    <option value="">Select Clinic</option>
                    {clinics.map((c) => (
                      <option key={c.clinic_id} value={c.clinic_id}>
                        {c.clinic_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group phase11-span-full">
                  <label>4. Dentist Availability</label>
                  {!formData.clinic_id ? (
                    <div className="phase11-empty">Select a clinic first.</div>
                  ) : loadingDentists ? (
                    <div className="phase11-empty">
                      Loading dentist schedules...
                    </div>
                  ) : dentists.length === 0 ? (
                    <div className="phase11-empty">
                      No active dentist currently provides this service.
                    </div>
                  ) : (
                    <div className="phase11-dentist-cards">
                      {dentists.map((d) => (
                        <button
                          type="button"
                          key={d.dentist_id}
                          className={`phase11-dentist-card ${Number(formData.dentist_id) === Number(d.dentist_id) ? "selected" : ""}`}
                          onClick={() =>
                            handleChange({
                              target: {
                                name: "dentist_id",
                                value: String(d.dentist_id),
                              },
                            })
                          }
                        >
                          <strong>{d.dentist_name}</strong>
                          <span>{d.specialization || "General Dentistry"}</span>
                          <div className="phase11-week-grid compact">
                            {(d.availability || [])
                              .filter((x) => x.is_available)
                              .map((x) => (
                                <span key={x.day_of_week} className="open">
                                  {x.day_name.slice(0, 3)}
                                  <small>
                                    {x.start_time}–{x.end_time}
                                  </small>
                                </span>
                              ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>5. Dentist</label>
                  <select
                    name="dentist_id"
                    value={formData.dentist_id}
                    onChange={handleChange}
                    disabled={!formData.clinic_id || loadingDentists || booking}
                    required
                  >
                    <option value="">Select Dentist</option>
                    {dentists.map((d) => (
                      <option key={d.dentist_id} value={d.dentist_id}>
                        {d.dentist_name} -{" "}
                        {d.specialization || "General Dentistry"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>6. Available Date</label>
                  <select
                    name="appointment_date"
                    value={formData.appointment_date}
                    onChange={handleChange}
                    disabled={!formData.dentist_id || loadingDates || booking}
                    required
                  >
                    <option value="">
                      {loadingDates
                        ? "Loading dates..."
                        : "Select Available Date"}
                    </option>
                    {availableDates.map((date) => (
                      <option key={date} value={date}>
                        {new Date(`${date}T12:00:00`).toLocaleDateString(
                          "en-PH",
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>7. Available Time Slot</label>
                  <select
                    name="appointment_time"
                    value={formData.appointment_time}
                    onChange={handleChange}
                    disabled={
                      !formData.appointment_date || loadingTimes || booking
                    }
                    required
                  >
                    <option value="">
                      {loadingTimes
                        ? "Loading slots..."
                        : availableTimes.length
                          ? "Select Time Slot"
                          : "No available slots"}
                    </option>
                    {availableTimes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group phase11-span-full">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Add concerns or booking notes..."
                    disabled={booking}
                  />
                </div>
              </div>
              {(selectedService || selectedClinic || selectedDentist) && (
                <div className="phase11-selection-summary">
                  <strong>Booking Summary</strong>
                  <span>
                    {selectedService?.service_name || "Service not selected"}
                  </span>
                  <span>
                    {selectedClinic?.clinic_name || "Clinic not selected"}
                  </span>
                  <span>
                    {selectedDentist?.dentist_name || "Dentist not selected"}
                  </span>
                </div>
              )}
              <div className="appointment-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={booking}
                >
                  {booking ? "Submitting..." : "Submit Appointment Request"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Appointment Records</h2>
              <p>Use filters to reduce clutter and focus on one status.</p>
            </div>
          </div>

          <div className="patient-filter-tabs">
            {filterOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={
                  statusFilter === option.value
                    ? "patient-filter-tab active"
                    : "patient-filter-tab"
                }
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
                <span>{option.count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            renderAppointmentSkeletons()
          ) : filteredAppointments.length === 0 ? (
            <div className="empty-state">
              <h3>No appointments found</h3>
              <p>
                {statusFilter === "All"
                  ? "Book your first appointment using the booking form."
                  : `No ${statusFilter.toLowerCase()} appointment records found.`}
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {filteredAppointments.map((appointment) => (
                <div
                  className="appointment-item"
                  key={appointment.appointment_id}
                >
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>
                        {appointment.appointment_type || "Dental Consultation"}
                      </h3>

                      <span className={getStatusClass(appointment.status)}>
                        {appointment.status}
                      </span>

                      {appointment.reschedule_request && (
                        <span className="status-badge status-pending">
                          Reschedule Request
                        </span>
                      )}
                    </div>

                    <div className="patient-appointment-detail-grid">
                      <div className="patient-appointment-left-details">
                        <p>
                          <strong>Dentist:</strong>{" "}
                          {appointment.dentist_name ||
                            `Dentist ID ${appointment.dentist_id}`}
                        </p>

                        <p>
                          <strong>Current Date:</strong>{" "}
                          {formatAppointmentDateTime(
                            appointment.appointment_date,
                          )}
                        </p>

                        {appointment.cancelled_at && (
                          <p>
                            <strong>Cancelled At:</strong>{" "}
                            {formatAppointmentDateTime(
                              appointment.cancelled_at,
                            )}
                          </p>
                        )}
                      </div>

                      <div className="patient-appointment-right-details">
                        <p>
                          <strong>Clinic:</strong>{" "}
                          {appointment.clinic_name || "No assigned clinic"}
                        </p>

                        {appointment.reschedule_request &&
                          appointment.requested_appointment_date && (
                            <p>
                              <strong>Requested New Date:</strong>{" "}
                              {formatAppointmentDateTime(
                                appointment.requested_appointment_date,
                              )}
                            </p>
                          )}

                        {appointment.reschedule_status &&
                          appointment.reschedule_status !== "None" && (
                            <p>
                              <strong>Reschedule Status:</strong>{" "}
                              {appointment.reschedule_status}
                            </p>
                          )}

                        {appointment.notes && (
                          <p>
                            <strong>Notes:</strong> {appointment.notes}
                          </p>
                        )}

                        {appointment.cancellation_reason && (
                          <p>
                            <strong>Cancellation Remarks:</strong>{" "}
                            {appointment.cancellation_reason}
                          </p>
                        )}

                        {appointment.cancelled_by_name && (
                          <p>
                            <strong>Cancelled By:</strong>{" "}
                            {appointment.cancelled_by_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {appointment.status !== "Cancelled" &&
                    appointment.status !== "Completed" && (
                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          disabled={updating}
                          onClick={() => openRescheduleModal(appointment)}
                        >
                          Request Reschedule
                        </button>

                        <button
                          className="danger-button"
                          disabled={updating}
                          onClick={() => openCancelModal(appointment)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Cancel Appointment</h3>
                <p>Please provide remarks for cancelling this appointment.</p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeCancelModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCancelAppointment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Appointment</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? formatAppointmentDateTime(
                          selectedAppointment.appointment_date,
                        )
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Cancellation Remarks</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => {
                    setCancellationReason(e.target.value);
                    setModalError("");
                  }}
                  placeholder="Enter cancellation remarks..."
                  rows="4"
                  required
                />
              </div>

              <div className="info-message">
                Cancellation remarks are required and will be saved in the
                appointment record.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCancelModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={updating}
                >
                  {updating ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Request Reschedule</h3>
                <p>
                  Choose a new preferred appointment date. Your dentist or
                  clinic staff will review the request.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRescheduleModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRescheduleAppointment}>
              {modalError && <div className="error-message">{modalError}</div>}

              <div className="form-group">
                <label>Current Appointment Date</label>
                <input
                  type="text"
                  value={
                    selectedAppointment?.appointment_date
                      ? formatAppointmentDateTime(
                          selectedAppointment.appointment_date,
                        )
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>New Appointment Date</label>
                <input
                  type="datetime-local"
                  value={newAppointmentDate}
                  min={getCurrentDateTimeLocal()}
                  onChange={(e) => {
                    setNewAppointmentDate(e.target.value);
                    setModalError("");
                  }}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeRescheduleModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={updating}
                >
                  {updating ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PatientAppointments;
