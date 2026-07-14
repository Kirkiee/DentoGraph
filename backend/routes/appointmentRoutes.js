const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const isBlank = (value) => {
  return value === undefined || value === null || String(value).trim() === "";
};

const normalizeCancellationReason = (value) => {
  if (isBlank(value)) return null;
  return String(value).trim();
};

const parseAppointmentDate = (value) => {
  if (isBlank(value)) return null;

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const isPastDate = (dateValue) => {
  const parsedDate = parseAppointmentDate(dateValue);

  if (!parsedDate) return true;

  const now = new Date();

  return parsedDate.getTime() <= now.getTime();
};

const formatDateOnly = (dateValue) => {
  const parsedDate = parseAppointmentDate(dateValue);

  if (!parsedDate) return null;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDefaultTimeSlots = () => {
  return ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];
};

const combineDateAndTimeToISO = (dateValue, timeValue) => {
  if (isBlank(dateValue) || isBlank(timeValue)) return null;

  const dateTimeString = `${dateValue}T${timeValue}:00+08:00`;
  const parsedDate = new Date(dateTimeString);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};

const getUserClinicOwnerClinicId = async (userId) => {
  const ownerResult = await pool.query(
    `SELECT clinic_id
     FROM public.clinics
     WHERE owner_user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (ownerResult.rows.length === 0) {
    return null;
  }

  return ownerResult.rows[0].clinic_id;
};

const verifyAssistantClinicAccess = async (userId, dentistId) => {
  const assistantResult = await pool.query(
    `SELECT clinic_id
     FROM public.assistants
     WHERE user_id = $1`,
    [userId],
  );

  if (assistantResult.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Assistant profile not found",
    };
  }

  const assistant = assistantResult.rows[0];

  if (!assistant.clinic_id) {
    return {
      allowed: false,
      status: 400,
      error: "Assistant is not assigned to a clinic",
    };
  }

  const clinicCheck = await pool.query(
    `SELECT clinic_id
     FROM public.dentists
     WHERE dentist_id = $1`,
    [dentistId],
  );

  if (
    clinicCheck.rows.length === 0 ||
    Number(clinicCheck.rows[0].clinic_id) !== Number(assistant.clinic_id)
  ) {
    return {
      allowed: false,
      status: 403,
      error: "You can only manage appointments under your assigned clinic",
    };
  }

  return {
    allowed: true,
    clinic_id: assistant.clinic_id,
  };
};

// PATIENT: GET ACTIVE CLINICS FOR APPOINTMENT DROPDOWN
router.get(
  "/clinics/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const clinics = await pool.query(
        `SELECT
            c.clinic_id,
            c.clinic_name,
            c.address,
            c.contact_number,
            c.status
         FROM public.patients p
         JOIN public.clinics c ON p.clinic_id = c.clinic_id
         WHERE p.user_id = $1
         AND c.status = 'Active'
         ORDER BY c.clinic_name ASC`,
        [user_id],
      );

      res.status(200).json({
        message: "Assigned clinic retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Get clinics list error:", err.message);
      res.status(500).json({ error: "Error retrieving clinics" });
    }
  },
);

// GET ACTIVE DENTISTS FOR PATIENT APPOINTMENT DROPDOWN
router.get(
  "/dentists/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const patientClinicResult = await pool.query(
        `SELECT clinic_id
         FROM public.patients
         WHERE user_id = $1`,
        [user_id],
      );

      if (patientClinicResult.rows.length === 0) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const patientClinicId = patientClinicResult.rows[0].clinic_id;

      if (!patientClinicId) {
        return res.status(400).json({
          error: "Your patient account is not linked to a clinic yet.",
        });
      }

      const dentists = await pool.query(
        `SELECT
            d.dentist_id,
            d.user_id,
            u.name AS dentist_name,
            d.license_number,
            d.specialization,
            d.availability,
            d.status,
            d.clinic_id,
            c.clinic_name
         FROM public.dentists d
         JOIN public.users u ON d.user_id = u.user_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.status = 'Active'
         AND d.clinic_id = $1
         ORDER BY u.name ASC`,
        [patientClinicId],
      );

      res.status(200).json({
        message: "Dentists retrieved successfully",
        dentists: dentists.rows,
      });
    } catch (err) {
      console.error("Get dentists list error:", err.message);
      res.status(500).json({ error: "Error retrieving dentists" });
    }
  },
);

// PATIENT: GET ACTIVE DENTISTS BY CLINIC
router.get(
  "/dentists/by-clinic/:clinic_id",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { clinic_id } = req.params;

    if (!clinic_id) {
      return res.status(400).json({ error: "Clinic ID is required" });
    }

    try {
      const patientClinicResult = await pool.query(
        `SELECT clinic_id
         FROM public.patients
         WHERE user_id = $1`,
        [user_id],
      );

      if (patientClinicResult.rows.length === 0) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const patientClinicId = patientClinicResult.rows[0].clinic_id;

      if (!patientClinicId) {
        return res.status(400).json({
          error: "Your patient account is not linked to a clinic yet.",
        });
      }

      if (Number(patientClinicId) !== Number(clinic_id)) {
        return res.status(403).json({
          error: "You can only view dentists under your assigned clinic.",
        });
      }

      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1
         AND status = 'Active'`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({ error: "Clinic not found or inactive" });
      }

      const dentists = await pool.query(
        `SELECT
            d.dentist_id,
            d.user_id,
            u.name AS dentist_name,
            d.license_number,
            d.specialization,
            d.availability,
            d.status,
            d.clinic_id,
            c.clinic_name
         FROM public.dentists d
         JOIN public.users u ON d.user_id = u.user_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.status = 'Active'
         AND d.clinic_id = $1
         ORDER BY u.name ASC`,
        [clinic_id],
      );

      res.status(200).json({
        message: "Dentists retrieved successfully",
        dentists: dentists.rows,
      });
    } catch (err) {
      console.error("Get dentists by clinic error:", err.message);
      res.status(500).json({ error: "Error retrieving dentists by clinic" });
    }
  },
);

// PATIENT: GET AVAILABLE TIME SLOTS BY DENTIST AND DATE
router.get(
  "/available-times",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const { dentist_id, appointment_date } = req.query;

    if (!dentist_id || !appointment_date) {
      return res.status(400).json({
        error: "Dentist and appointment date are required",
      });
    }

    const dateOnly = formatDateOnly(appointment_date);

    if (!dateOnly) {
      return res.status(400).json({ error: "Invalid appointment date" });
    }

    try {
      const dentistResult = await pool.query(
        `SELECT dentist_id, status
         FROM public.dentists
         WHERE dentist_id = $1
         AND status = 'Active'`,
        [dentist_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist not found or inactive" });
      }

      const allSlots = getDefaultTimeSlots();

      const bookedResult = await pool.query(
        `SELECT appointment_date
         FROM public.appointments
         WHERE dentist_id = $1
         AND DATE(appointment_date) = $2
         AND status IN ('Pending', 'Scheduled')`,
        [dentist_id, dateOnly],
      );

      const bookedTimes = bookedResult.rows.map((row) => {
        const date = new Date(row.appointment_date);
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${hours}:${minutes}`;
      });

      const now = new Date();
      const todayDateOnly = formatDateOnly(now);

      const available_times = allSlots.filter((slot) => {
        if (bookedTimes.includes(slot)) return false;

        if (dateOnly === todayDateOnly) {
          const slotDate = new Date(`${dateOnly}T${slot}:00+08:00`);
          return slotDate.getTime() > now.getTime();
        }

        return true;
      });

      res.status(200).json({
        message: "Available times retrieved successfully",
        appointment_date: dateOnly,
        available_times,
      });
    } catch (err) {
      console.error("Get available times error:", err.message);
      res.status(500).json({ error: "Error retrieving available times" });
    }
  },
);

// PATIENT: BOOK APPOINTMENT
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const {
      clinic_id,
      dentist_id,
      appointment_date,
      appointment_time,
      appointment_type,
      notes,
    } = req.body;

    if (!dentist_id) {
      return res.status(400).json({
        error: "Dentist is required",
      });
    }

    let finalAppointmentDate = appointment_date;

    if (!finalAppointmentDate && appointment_time) {
      const dateOnly = formatDateOnly(req.body.date || req.body.selected_date);

      if (!dateOnly) {
        return res.status(400).json({
          error: "Appointment date is required",
        });
      }

      finalAppointmentDate = combineDateAndTimeToISO(
        dateOnly,
        appointment_time,
      );
    }

    if (!finalAppointmentDate) {
      return res.status(400).json({
        error: "Appointment date is required",
      });
    }

    const parsedAppointmentDate = parseAppointmentDate(finalAppointmentDate);

    if (!parsedAppointmentDate) {
      return res.status(400).json({
        error: "Invalid appointment date",
      });
    }

    if (isPastDate(finalAppointmentDate)) {
      return res.status(400).json({
        error: "You cannot book an appointment in the past.",
      });
    }

    try {
      const patientResult = await pool.query(
        `SELECT patient_id, clinic_id
         FROM public.patients
         WHERE user_id = $1`,
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Patient profile not found. Please create your patient profile first.",
        });
      }

      const patient_id = patientResult.rows[0].patient_id;
      const patientClinicId = patientResult.rows[0].clinic_id;

      if (!patientClinicId) {
        return res.status(400).json({
          error: "Your patient account is not linked to a clinic yet.",
        });
      }

      const dentistResult = await pool.query(
        `SELECT
            d.dentist_id,
            d.clinic_id,
            d.status,
            c.clinic_name
         FROM public.dentists d
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.dentist_id = $1`,
        [dentist_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist not found" });
      }

      const dentist = dentistResult.rows[0];

      if (dentist.status !== "Active") {
        return res.status(400).json({
          error: "Selected dentist is not active",
        });
      }

      if (Number(dentist.clinic_id) !== Number(patientClinicId)) {
        return res.status(403).json({
          error:
            "You can only book appointments with dentists under your assigned clinic.",
        });
      }

      if (clinic_id && Number(clinic_id) !== Number(patientClinicId)) {
        return res.status(403).json({
          error: "Selected clinic does not match your assigned clinic.",
        });
      }

      const conflictCheck = await pool.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE dentist_id = $1
         AND appointment_date = $2
         AND status IN ('Pending', 'Scheduled')`,
        [dentist_id, parsedAppointmentDate],
      );

      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({
          error: "This appointment slot is already taken",
        });
      }

      const newAppointment = await pool.query(
        `INSERT INTO public.appointments
          (
            patient_id,
            dentist_id,
            appointment_date,
            status,
            notes,
            appointment_type,
            cancellation_reason,
            cancelled_at,
            cancelled_by,
            reschedule_request,
            requested_appointment_date,
            reschedule_status
          )
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, $7, $8, $9)
         RETURNING *`,
        [
          patient_id,
          dentist_id,
          parsedAppointmentDate,
          "Pending",
          notes || null,
          appointment_type || "Dental Consultation",
          false,
          null,
          "None",
        ],
      );

      res.status(201).json({
        message: "Appointment booked successfully",
        appointment: newAppointment.rows[0],
      });
    } catch (err) {
      console.error("Book appointment error:", err.message);
      res.status(500).json({ error: "Error booking appointment" });
    }
  },
);

// PATIENT: VIEW OWN APPOINTMENTS
router.get(
  "/my-appointments",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            a.dentist_id,
            du.name AS dentist_name,
            c.clinic_name AS clinic_name,
            a.appointment_date,
            a.status,
            a.notes,
            a.appointment_type,
            a.cancellation_reason,
            a.cancelled_at,
            a.cancelled_by,
            cu.name AS cancelled_by_name,
            a.reschedule_request,
            a.requested_appointment_date,
            a.reschedule_status
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
         WHERE a.patient_id = $1
         ORDER BY a.appointment_date DESC`,
        [patient_id],
      );

      res.status(200).json({
        message: "Patient appointments retrieved successfully",
        appointments: appointments.rows,
      });
    } catch (err) {
      console.error("Get patient appointments error:", err.message);
      res.status(500).json({ error: "Error retrieving appointments" });
    }
  },
);

// DENTIST: VIEW ASSIGNED APPOINTMENTS
router.get(
  "/dentist/my-appointments",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const dentistResult = await pool.query(
        "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
        [user_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist profile not found" });
      }

      const dentist_id = dentistResult.rows[0].dentist_id;

      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            pu.name AS patient_name,
            a.dentist_id,
            c.clinic_name AS clinic_name,
            a.appointment_date,
            a.status,
            a.notes,
            a.appointment_type,
            a.cancellation_reason,
            a.cancelled_at,
            a.cancelled_by,
            cu.name AS cancelled_by_name,
            a.reschedule_request,
            a.requested_appointment_date,
            a.reschedule_status
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
         WHERE a.dentist_id = $1
         ORDER BY a.appointment_date DESC`,
        [dentist_id],
      );

      res.status(200).json({
        message: "Dentist appointments retrieved successfully",
        appointments: appointments.rows,
      });
    } catch (err) {
      console.error("Get dentist appointments error:", err.message);
      res.status(500).json({ error: "Error retrieving dentist appointments" });
    }
  },
);

// ADMIN / ASSISTANT: VIEW APPOINTMENTS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Assistant", "Dental Assistant"),
  async (req, res) => {
    try {
      let appointments;

      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const assistantResult = await pool.query(
          `SELECT assistant_id, clinic_id
           FROM public.assistants
           WHERE user_id = $1`,
          [req.user.user_id],
        );

        if (assistantResult.rows.length === 0) {
          return res.status(404).json({
            error: "Assistant profile not found",
          });
        }

        const assistant = assistantResult.rows[0];

        if (!assistant.clinic_id) {
          return res.status(400).json({
            error: "Assistant is not assigned to a clinic",
          });
        }

        appointments = await pool.query(
          `SELECT
              a.appointment_id,
              a.patient_id,
              pu.name AS patient_name,
              a.dentist_id,
              du.name AS dentist_name,
              c.clinic_name AS clinic_name,
              a.appointment_date,
              a.status,
              a.notes,
              a.appointment_type,
              a.cancellation_reason,
              a.cancelled_at,
              a.cancelled_by,
              cu.name AS cancelled_by_name,
              a.reschedule_request,
              a.requested_appointment_date,
              a.reschedule_status
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users pu ON p.user_id = pu.user_id
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           JOIN public.users du ON d.user_id = du.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
           LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
           WHERE d.clinic_id = $1
           ORDER BY a.appointment_date DESC`,
          [assistant.clinic_id],
        );
      } else {
        appointments = await pool.query(
          `SELECT
              a.appointment_id,
              a.patient_id,
              pu.name AS patient_name,
              a.dentist_id,
              du.name AS dentist_name,
              c.clinic_name AS clinic_name,
              a.appointment_date,
              a.status,
              a.notes,
              a.appointment_type,
              a.cancellation_reason,
              a.cancelled_at,
              a.cancelled_by,
              cu.name AS cancelled_by_name,
              a.reschedule_request,
              a.requested_appointment_date,
              a.reschedule_status
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users pu ON p.user_id = pu.user_id
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           JOIN public.users du ON d.user_id = du.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
           LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
           ORDER BY a.appointment_date DESC`,
        );
      }

      res.status(200).json({
        message: "Appointments retrieved successfully",
        appointments: appointments.rows,
      });
    } catch (err) {
      console.error("Get appointments error:", err.message);
      res.status(500).json({ error: "Error retrieving appointments" });
    }
  },
);

// ADMIN / ASSISTANT / DENTIST: UPDATE APPOINTMENT STATUS
router.put(
  "/:appointment_id/status",
  authenticateToken,
  authorizeRoles("Admin", "Assistant", "Dental Assistant", "Dentist"),
  async (req, res) => {
    const { appointment_id } = req.params;
    const { status, cancellation_reason } = req.body;

    const allowedStatuses = ["Pending", "Scheduled", "Completed", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error:
          "Invalid status. Allowed values: Pending, Scheduled, Completed, Cancelled",
      });
    }

    const normalizedReason = normalizeCancellationReason(cancellation_reason);

    if (status === "Cancelled" && !normalizedReason) {
      return res.status(400).json({
        error:
          "Cancellation remarks are required when cancelling an appointment.",
      });
    }

    try {
      const appointmentResult = await pool.query(
        `SELECT *
         FROM public.appointments
         WHERE appointment_id = $1`,
        [appointment_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const appointment = appointmentResult.rows[0];

      if (req.user.role === "Dentist") {
        const dentistResult = await pool.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [req.user.user_id],
        );

        if (
          dentistResult.rows.length === 0 ||
          Number(dentistResult.rows[0].dentist_id) !==
            Number(appointment.dentist_id)
        ) {
          return res.status(403).json({
            error: "You can only update appointments assigned to you",
          });
        }
      }

      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const accessCheck = await verifyAssistantClinicAccess(
          req.user.user_id,
          appointment.dentist_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      const isCancelled = status === "Cancelled";

      const updatedAppointment = await pool.query(
        `UPDATE public.appointments
         SET status = $1,
             cancellation_reason = CASE WHEN $5::boolean THEN $2 ELSE NULL END,
             cancelled_at = CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
             cancelled_by = CASE WHEN $5::boolean THEN $3::integer ELSE NULL END,
             reschedule_request = CASE WHEN $5::boolean THEN false ELSE reschedule_request END,
             requested_appointment_date = CASE WHEN $5::boolean THEN NULL ELSE requested_appointment_date END,
             reschedule_status = CASE WHEN $5::boolean THEN 'None' ELSE reschedule_status END
         WHERE appointment_id = $4
         RETURNING *`,
        [
          status,
          normalizedReason,
          Number(req.user.user_id),
          appointment_id,
          isCancelled,
        ],
      );

      res.status(200).json({
        message:
          status === "Cancelled"
            ? "Appointment cancelled successfully"
            : "Appointment status updated successfully",
        appointment: updatedAppointment.rows[0],
      });
    } catch (err) {
      console.error("Update appointment status error:", err.message);
      res.status(500).json({ error: "Error updating appointment status" });
    }
  },
);

// PATIENT: CANCEL OWN APPOINTMENT
router.put(
  "/:appointment_id/cancel",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { appointment_id } = req.params;
    const { cancellation_reason } = req.body;

    const normalizedReason = normalizeCancellationReason(cancellation_reason);

    if (!normalizedReason) {
      return res.status(400).json({
        error: "Cancellation remarks are required.",
      });
    }

    try {
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const appointmentResult = await pool.query(
        `SELECT appointment_id, status
         FROM public.appointments
         WHERE appointment_id = $1
         AND patient_id = $2`,
        [appointment_id, patient_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Appointment not found or does not belong to this patient",
        });
      }

      const appointment = appointmentResult.rows[0];

      if (appointment.status === "Cancelled") {
        return res.status(400).json({
          error: "This appointment is already cancelled.",
        });
      }

      if (appointment.status === "Completed") {
        return res.status(400).json({
          error: "Completed appointments cannot be cancelled.",
        });
      }

      const cancelledAppointment = await pool.query(
        `UPDATE public.appointments
         SET status = 'Cancelled',
             cancellation_reason = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             cancelled_by = $2,
             reschedule_request = false,
             requested_appointment_date = NULL,
             reschedule_status = 'None'
         WHERE appointment_id = $3
         AND patient_id = $4
         RETURNING *`,
        [normalizedReason, user_id, appointment_id, patient_id],
      );

      res.status(200).json({
        message: "Appointment cancelled successfully",
        appointment: cancelledAppointment.rows[0],
      });
    } catch (err) {
      console.error("Cancel appointment error:", err.message);
      res.status(500).json({ error: "Error cancelling appointment" });
    }
  },
);

// PATIENT: REQUEST RESCHEDULE
router.put(
  "/:appointment_id/reschedule",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { appointment_id } = req.params;
    const { new_appointment_date } = req.body;

    if (!new_appointment_date) {
      return res.status(400).json({
        error: "New appointment date is required",
      });
    }

    const parsedNewDate = parseAppointmentDate(new_appointment_date);

    if (!parsedNewDate) {
      return res.status(400).json({
        error: "Invalid new appointment date",
      });
    }

    if (isPastDate(new_appointment_date)) {
      return res.status(400).json({
        error: "You cannot request a reschedule to a past date or time.",
      });
    }

    try {
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const appointmentResult = await pool.query(
        `SELECT appointment_id, dentist_id, status
         FROM public.appointments
         WHERE appointment_id = $1
         AND patient_id = $2`,
        [appointment_id, patient_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Appointment not found or does not belong to this patient",
        });
      }

      const appointment = appointmentResult.rows[0];

      if (
        appointment.status === "Cancelled" ||
        appointment.status === "Completed"
      ) {
        return res.status(400).json({
          error: "Cancelled or completed appointments cannot be rescheduled",
        });
      }

      const conflictCheck = await pool.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE dentist_id = $1
         AND appointment_date = $2
         AND appointment_id <> $3
         AND status IN ('Pending', 'Scheduled')`,
        [appointment.dentist_id, parsedNewDate, appointment_id],
      );

      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({
          error: "This requested appointment slot is already taken",
        });
      }

      const rescheduledAppointment = await pool.query(
        `UPDATE public.appointments
         SET requested_appointment_date = $1,
             reschedule_request = true,
             reschedule_status = 'Pending'
         WHERE appointment_id = $2
         AND patient_id = $3
         RETURNING *`,
        [parsedNewDate, appointment_id, patient_id],
      );

      res.status(200).json({
        message: "Appointment reschedule request submitted successfully",
        appointment: rescheduledAppointment.rows[0],
      });
    } catch (err) {
      console.error("Reschedule appointment error:", err.message);
      res
        .status(500)
        .json({ error: "Error requesting appointment reschedule" });
    }
  },
);

// ADMIN / ASSISTANT / DENTIST: APPROVE RESCHEDULE REQUEST
router.put(
  "/:appointment_id/reschedule/approve",
  authenticateToken,
  authorizeRoles("Admin", "Assistant", "Dental Assistant", "Dentist"),
  async (req, res) => {
    const { appointment_id } = req.params;

    try {
      const appointmentResult = await pool.query(
        `SELECT *
         FROM public.appointments
         WHERE appointment_id = $1`,
        [appointment_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const appointment = appointmentResult.rows[0];

      if (
        !appointment.reschedule_request ||
        !appointment.requested_appointment_date
      ) {
        return res.status(400).json({
          error: "This appointment has no pending reschedule request",
        });
      }

      if (isPastDate(appointment.requested_appointment_date)) {
        return res.status(400).json({
          error: "The requested reschedule date is already in the past.",
        });
      }

      if (req.user.role === "Dentist") {
        const dentistResult = await pool.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [req.user.user_id],
        );

        if (
          dentistResult.rows.length === 0 ||
          Number(dentistResult.rows[0].dentist_id) !==
            Number(appointment.dentist_id)
        ) {
          return res.status(403).json({
            error: "You can only approve reschedule requests assigned to you",
          });
        }
      }

      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const accessCheck = await verifyAssistantClinicAccess(
          req.user.user_id,
          appointment.dentist_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      const conflictCheck = await pool.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE dentist_id = $1
         AND appointment_date = $2
         AND appointment_id <> $3
         AND status IN ('Pending', 'Scheduled')`,
        [
          appointment.dentist_id,
          appointment.requested_appointment_date,
          appointment_id,
        ],
      );

      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({
          error: "The requested appointment slot is already taken",
        });
      }

      const approvedAppointment = await pool.query(
        `UPDATE public.appointments
         SET appointment_date = requested_appointment_date,
             requested_appointment_date = NULL,
             reschedule_request = false,
             reschedule_status = 'Approved',
             status = 'Scheduled'
         WHERE appointment_id = $1
         RETURNING *`,
        [appointment_id],
      );

      res.status(200).json({
        message: "Reschedule request approved successfully",
        appointment: approvedAppointment.rows[0],
      });
    } catch (err) {
      console.error("Approve reschedule error:", err.message);
      res.status(500).json({ error: "Error approving reschedule request" });
    }
  },
);

// ADMIN / ASSISTANT / DENTIST: REJECT RESCHEDULE REQUEST
router.put(
  "/:appointment_id/reschedule/reject",
  authenticateToken,
  authorizeRoles("Admin", "Assistant", "Dental Assistant", "Dentist"),
  async (req, res) => {
    const { appointment_id } = req.params;

    try {
      const appointmentResult = await pool.query(
        `SELECT *
         FROM public.appointments
         WHERE appointment_id = $1`,
        [appointment_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const appointment = appointmentResult.rows[0];

      if (
        !appointment.reschedule_request ||
        !appointment.requested_appointment_date
      ) {
        return res.status(400).json({
          error: "This appointment has no pending reschedule request",
        });
      }

      if (req.user.role === "Dentist") {
        const dentistResult = await pool.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [req.user.user_id],
        );

        if (
          dentistResult.rows.length === 0 ||
          Number(dentistResult.rows[0].dentist_id) !==
            Number(appointment.dentist_id)
        ) {
          return res.status(403).json({
            error: "You can only reject reschedule requests assigned to you",
          });
        }
      }

      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const accessCheck = await verifyAssistantClinicAccess(
          req.user.user_id,
          appointment.dentist_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      const rejectedAppointment = await pool.query(
        `UPDATE public.appointments
         SET requested_appointment_date = NULL,
             reschedule_request = false,
             reschedule_status = 'Rejected'
         WHERE appointment_id = $1
         RETURNING *`,
        [appointment_id],
      );

      res.status(200).json({
        message: "Reschedule request rejected successfully",
        appointment: rejectedAppointment.rows[0],
      });
    } catch (err) {
      console.error("Reject reschedule error:", err.message);
      res.status(500).json({ error: "Error rejecting reschedule request" });
    }
  },
);

module.exports = router;
