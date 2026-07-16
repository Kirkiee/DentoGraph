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

const getPatientClinicContext = async (userId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        p.patient_id,
        p.clinic_id,
        c.clinic_name,
        c.status AS clinic_status
     FROM public.patients p
     LEFT JOIN public.clinics c ON p.clinic_id = c.clinic_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Patient profile not found.",
    };
  }

  const patient = result.rows[0];

  if (!patient.clinic_id) {
    return {
      allowed: false,
      status: 400,
      error: "Your patient account is not linked to a clinic location yet.",
    };
  }

  if (!patient.clinic_name) {
    return {
      allowed: false,
      status: 404,
      error: "Your assigned clinic location no longer exists.",
    };
  }

  if (patient.clinic_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your assigned clinic location is currently inactive.",
    };
  }

  return {
    allowed: true,
    patient_id: patient.patient_id,
    clinic_id: patient.clinic_id,
    clinic_name: patient.clinic_name,
  };
};

const getDentistClinicContext = async (userId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        d.dentist_id,
        d.clinic_id,
        d.status AS dentist_status,
        c.clinic_name,
        c.status AS clinic_status
     FROM public.dentists d
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE d.user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Dentist profile not found.",
    };
  }

  const dentist = result.rows[0];

  if (!dentist.clinic_id) {
    return {
      allowed: false,
      status: 400,
      error: "Your dentist account is not assigned to a clinic location yet.",
    };
  }

  if (!dentist.clinic_name) {
    return {
      allowed: false,
      status: 404,
      error: "Your assigned clinic location no longer exists.",
    };
  }

  if (dentist.dentist_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your dentist account is currently inactive.",
    };
  }

  if (dentist.clinic_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your assigned clinic location is currently inactive.",
    };
  }

  return {
    allowed: true,
    dentist_id: dentist.dentist_id,
    clinic_id: dentist.clinic_id,
    clinic_name: dentist.clinic_name,
  };
};

const getAssistantClinicContext = async (userId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        a.assistant_id,
        a.clinic_id,
        a.status AS assistant_status,
        c.clinic_name,
        c.status AS clinic_status
     FROM public.assistants a
     LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
     WHERE a.user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Assistant profile not found.",
    };
  }

  const assistant = result.rows[0];

  if (!assistant.clinic_id) {
    return {
      allowed: false,
      status: 400,
      error: "Your assistant account is not assigned to a clinic location.",
    };
  }

  if (!assistant.clinic_name) {
    return {
      allowed: false,
      status: 404,
      error: "Your assigned clinic location no longer exists.",
    };
  }

  if (assistant.assistant_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your assistant account is currently inactive.",
    };
  }

  if (assistant.clinic_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your assigned clinic location is currently inactive.",
    };
  }

  return {
    allowed: true,
    assistant_id: assistant.assistant_id,
    clinic_id: assistant.clinic_id,
    clinic_name: assistant.clinic_name,
  };
};

const verifyAssistantClinicAccess = async (
  userId,
  dentistId,
  patientId = null,
  queryClient = pool,
) => {
  const context = await getAssistantClinicContext(userId, queryClient);

  if (!context.allowed) {
    return context;
  }

  const accessResult = await queryClient.query(
    `SELECT
        d.dentist_id,
        d.clinic_id AS dentist_clinic_id,
        d.status AS dentist_status,
        p.patient_id,
        p.clinic_id AS patient_clinic_id
     FROM public.dentists d
     LEFT JOIN public.patients p
       ON p.patient_id = $2
     WHERE d.dentist_id = $1
     LIMIT 1`,
    [dentistId, patientId],
  );

  if (accessResult.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Dentist not found.",
    };
  }

  const access = accessResult.rows[0];

  if (access.dentist_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "The assigned dentist is currently inactive.",
    };
  }

  if (Number(access.dentist_clinic_id) !== Number(context.clinic_id)) {
    return {
      allowed: false,
      status: 403,
      error:
        "You can only manage appointments within your assigned clinic location.",
    };
  }

  if (
    patientId !== null &&
    Number(access.patient_clinic_id) !== Number(context.clinic_id)
  ) {
    return {
      allowed: false,
      status: 409,
      error:
        "This appointment has an invalid cross-clinic patient assignment and cannot be managed.",
    };
  }

  return {
    allowed: true,
    assistant_id: context.assistant_id,
    clinic_id: context.clinic_id,
    clinic_name: context.clinic_name,
  };
};

// PATIENT: GET ASSIGNED ACTIVE CLINIC LOCATION
router.get(
  "/clinics/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const context = await getPatientClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const clinicResult = await pool.query(
        `SELECT
            clinic_id,
            clinic_name,
            address,
            contact_number,
            status
         FROM public.clinics
         WHERE clinic_id = $1
         AND status = 'Active'
         LIMIT 1`,
        [context.clinic_id],
      );

      res.status(200).json({
        message: "Assigned clinic location retrieved successfully",
        assigned_clinic_id: context.clinic_id,
        clinics: clinicResult.rows,
      });
    } catch (err) {
      console.error("Get assigned clinic location error:", err.message);
      res.status(500).json({
        error: "Error retrieving assigned clinic location",
      });
    }
  },
);

// PATIENT: GET ACTIVE DENTISTS FROM ASSIGNED CLINIC LOCATION
router.get(
  "/dentists/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const context = await getPatientClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
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
         AND c.status = 'Active'
         AND d.clinic_id = $1
         ORDER BY u.name ASC`,
        [context.clinic_id],
      );

      res.status(200).json({
        message: "Assigned clinic dentists retrieved successfully",
        assigned_clinic_id: context.clinic_id,
        dentists: dentists.rows,
      });
    } catch (err) {
      console.error("Get assigned clinic dentists error:", err.message);
      res.status(500).json({ error: "Error retrieving dentists" });
    }
  },
);

// PATIENT: GET ACTIVE DENTISTS BY ASSIGNED CLINIC LOCATION
router.get(
  "/dentists/by-clinic/:clinic_id",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const requestedClinicId = Number(req.params.clinic_id);

    if (!Number.isInteger(requestedClinicId) || requestedClinicId <= 0) {
      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    try {
      const context = await getPatientClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      if (Number(context.clinic_id) !== requestedClinicId) {
        return res.status(403).json({
          error:
            "You can only view dentists from your assigned clinic location.",
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
         AND c.status = 'Active'
         AND d.clinic_id = $1
         ORDER BY u.name ASC`,
        [context.clinic_id],
      );

      res.status(200).json({
        message: "Dentists retrieved successfully",
        assigned_clinic_id: context.clinic_id,
        dentists: dentists.rows,
      });
    } catch (err) {
      console.error("Get dentists by clinic location error:", err.message);
      res.status(500).json({
        error: "Error retrieving dentists for the clinic location",
      });
    }
  },
);

// PATIENT: GET AVAILABLE TIME SLOTS FOR AN ASSIGNED-CLINIC DENTIST
router.get(
  "/available-times",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const dentistId = Number(req.query.dentist_id);
    const { appointment_date } = req.query;

    if (!Number.isInteger(dentistId) || dentistId <= 0 || !appointment_date) {
      return res.status(400).json({
        error: "A valid dentist and appointment date are required.",
      });
    }

    const dateOnly = formatDateOnly(appointment_date);

    if (!dateOnly) {
      return res.status(400).json({ error: "Invalid appointment date." });
    }

    try {
      const context = await getPatientClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const dentistResult = await pool.query(
        `SELECT
            d.dentist_id,
            d.clinic_id,
            d.status,
            c.status AS clinic_status
         FROM public.dentists d
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.dentist_id = $1`,
        [dentistId],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist not found." });
      }

      const dentist = dentistResult.rows[0];

      if (dentist.status !== "Active" || dentist.clinic_status !== "Active") {
        return res.status(400).json({
          error: "The selected dentist or clinic location is inactive.",
        });
      }

      if (Number(dentist.clinic_id) !== Number(context.clinic_id)) {
        return res.status(403).json({
          error:
            "You can only check schedules for dentists from your assigned clinic location.",
        });
      }

      const allSlots = getDefaultTimeSlots();

      const bookedResult = await pool.query(
        `SELECT appointment_date
         FROM public.appointments
         WHERE dentist_id = $1
         AND DATE(appointment_date AT TIME ZONE 'Asia/Manila') = $2::date
         AND status IN ('Pending', 'Scheduled')`,
        [dentistId, dateOnly],
      );

      const bookedTimes = bookedResult.rows.map((row) =>
        new Date(row.appointment_date).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );

      const now = new Date();
      const todayDateOnly = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

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
        clinic_id: context.clinic_id,
        dentist_id: dentistId,
        appointment_date: dateOnly,
        available_times,
      });
    } catch (err) {
      console.error("Get available times error:", err.message);
      res.status(500).json({ error: "Error retrieving available times" });
    }
  },
);

// PATIENT: BOOK APPOINTMENT WITHIN ASSIGNED CLINIC LOCATION
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const {
      clinic_id,
      dentist_id,
      appointment_date,
      appointment_time,
      appointment_type,
      notes,
    } = req.body;

    const dentistId = Number(dentist_id);

    if (!Number.isInteger(dentistId) || dentistId <= 0) {
      return res.status(400).json({
        error: "A valid dentist is required.",
      });
    }

    let finalAppointmentDate = appointment_date;

    if (!finalAppointmentDate && appointment_time) {
      const dateOnly = formatDateOnly(req.body.date || req.body.selected_date);

      if (!dateOnly) {
        return res.status(400).json({
          error: "Appointment date is required.",
        });
      }

      finalAppointmentDate = combineDateAndTimeToISO(
        dateOnly,
        appointment_time,
      );
    }

    const parsedAppointmentDate = parseAppointmentDate(finalAppointmentDate);

    if (!parsedAppointmentDate) {
      return res.status(400).json({
        error: "A valid appointment date and time are required.",
      });
    }

    if (isPastDate(parsedAppointmentDate)) {
      return res.status(400).json({
        error: "You cannot book an appointment in the past.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const context = await getPatientClinicContext(req.user.user_id, client);

      if (!context.allowed) {
        await client.query("ROLLBACK");
        return res.status(context.status).json({ error: context.error });
      }

      if (
        clinic_id !== undefined &&
        clinic_id !== null &&
        clinic_id !== "" &&
        Number(clinic_id) !== Number(context.clinic_id)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "Selected clinic location does not match your assigned clinic location.",
        });
      }

      /*
       * Lock the selected dentist row. Booking requests for the same dentist
       * are then checked and inserted sequentially, reducing double-booking
       * race conditions when two patients submit the same slot together.
       */
      const dentistResult = await client.query(
        `SELECT
            d.dentist_id,
            d.clinic_id,
            d.status,
            c.status AS clinic_status,
            c.clinic_name
         FROM public.dentists d
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.dentist_id = $1
         FOR UPDATE OF d`,
        [dentistId],
      );

      if (dentistResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Dentist not found." });
      }

      const dentist = dentistResult.rows[0];

      if (dentist.status !== "Active" || dentist.clinic_status !== "Active") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "The selected dentist or clinic location is inactive.",
        });
      }

      if (Number(dentist.clinic_id) !== Number(context.clinic_id)) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "You can only book dentists from your assigned clinic location.",
        });
      }

      const conflictCheck = await client.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE dentist_id = $1
         AND appointment_date = $2
         AND status IN ('Pending', 'Scheduled')
         LIMIT 1`,
        [dentistId, parsedAppointmentDate],
      );

      if (conflictCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "This appointment slot is already taken.",
        });
      }

      const newAppointment = await client.query(
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
         VALUES ($1, $2, $3, 'Pending', $4, $5, NULL, NULL, NULL, false, NULL, 'None')
         RETURNING *`,
        [
          context.patient_id,
          dentistId,
          parsedAppointmentDate,
          isBlank(notes) ? null : String(notes).trim(),
          isBlank(appointment_type)
            ? "Dental Consultation"
            : String(appointment_type).trim(),
        ],
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Appointment request submitted successfully",
        clinic_id: context.clinic_id,
        clinic_name: context.clinic_name,
        appointment: newAppointment.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Book appointment error:", err.message);
      res.status(500).json({ error: "Error booking appointment" });
    } finally {
      client.release();
    }
  },
);

// PATIENT: VIEW OWN APPOINTMENTS FROM ASSIGNED CLINIC LOCATION
router.get(
  "/my-appointments",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const context = await getPatientClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            a.dentist_id,
            d.clinic_id,
            du.name AS dentist_name,
            c.clinic_name,
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
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
         WHERE a.patient_id = $1
         AND d.clinic_id = $2
         ORDER BY a.appointment_date DESC`,
        [context.patient_id, context.clinic_id],
      );

      res.status(200).json({
        message: "Patient appointments retrieved successfully",
        assigned_clinic_id: context.clinic_id,
        assigned_clinic_name: context.clinic_name,
        appointments: appointments.rows,
      });
    } catch (err) {
      console.error("Get patient appointments error:", err.message);
      res.status(500).json({ error: "Error retrieving appointments" });
    }
  },
);

// DENTIST: VIEW APPOINTMENTS ASSIGNED TO THE AUTHENTICATED DENTIST
router.get(
  "/dentist/my-appointments",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    try {
      const context = await getDentistClinicContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            pu.name AS patient_name,
            p.clinic_id AS patient_clinic_id,
            a.dentist_id,
            d.clinic_id,
            c.clinic_name,
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
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
         WHERE a.dentist_id = $1
         AND d.clinic_id = $2
         AND p.clinic_id = $2
         ORDER BY a.appointment_date DESC`,
        [context.dentist_id, context.clinic_id],
      );

      res.status(200).json({
        message: "Dentist appointments retrieved successfully",
        assigned_clinic_id: context.clinic_id,
        assigned_clinic_name: context.clinic_name,
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
      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const context = await getAssistantClinicContext(req.user.user_id);

        if (!context.allowed) {
          return res.status(context.status).json({ error: context.error });
        }

        const appointments = await pool.query(
          `SELECT
              a.appointment_id,
              a.patient_id,
              pu.name AS patient_name,
              p.clinic_id AS patient_clinic_id,
              a.dentist_id,
              du.name AS dentist_name,
              d.clinic_id,
              c.clinic_name,
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
           JOIN public.clinics c ON d.clinic_id = c.clinic_id
           LEFT JOIN public.users cu ON a.cancelled_by = cu.user_id
           WHERE d.clinic_id = $1
           AND p.clinic_id = $1
           ORDER BY a.appointment_date DESC`,
          [context.clinic_id],
        );

        return res.status(200).json({
          message: "Clinic-location appointments retrieved successfully",
          assigned_clinic_id: context.clinic_id,
          assigned_clinic_name: context.clinic_name,
          appointments: appointments.rows,
        });
      }

      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            pu.name AS patient_name,
            p.clinic_id AS patient_clinic_id,
            a.dentist_id,
            du.name AS dentist_name,
            d.clinic_id,
            c.clinic_name,
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
        `SELECT
            a.*,
            d.clinic_id,
            d.status AS dentist_status,
            c.status AS clinic_status,
            p.clinic_id AS patient_clinic_id
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         JOIN public.patients p ON a.patient_id = p.patient_id
         WHERE a.appointment_id = $1`,
        [appointment_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const appointment = appointmentResult.rows[0];

      if (req.user.role === "Dentist") {
        const context = await getDentistClinicContext(req.user.user_id);

        if (!context.allowed) {
          return res.status(context.status).json({ error: context.error });
        }

        if (
          Number(context.dentist_id) !== Number(appointment.dentist_id) ||
          Number(context.clinic_id) !== Number(appointment.clinic_id) ||
          Number(appointment.patient_clinic_id) !== Number(context.clinic_id)
        ) {
          return res.status(403).json({
            error:
              "You can only update appointments assigned to you within your clinic location.",
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
          appointment.patient_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      if (
        appointment.dentist_status !== "Active" ||
        appointment.clinic_status !== "Active"
      ) {
        return res.status(400).json({
          error:
            "This appointment cannot be updated because its dentist or clinic location is inactive.",
        });
      }

      if (
        Number(appointment.patient_clinic_id) !== Number(appointment.clinic_id)
      ) {
        return res.status(409).json({
          error:
            "This appointment has an invalid cross-clinic patient assignment and cannot be updated.",
        });
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
      const context = await getPatientClinicContext(user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const patient_id = context.patient_id;

      const appointmentResult = await pool.query(
        `SELECT a.appointment_id, a.status
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         WHERE a.appointment_id = $1
         AND a.patient_id = $2
         AND d.clinic_id = $3`,
        [appointment_id, patient_id, context.clinic_id],
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
      const context = await getPatientClinicContext(user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const patient_id = context.patient_id;

      const appointmentResult = await pool.query(
        `SELECT
            a.appointment_id,
            a.dentist_id,
            a.status,
            d.status AS dentist_status,
            d.clinic_id,
            c.status AS clinic_status
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE a.appointment_id = $1
         AND a.patient_id = $2
         AND d.clinic_id = $3`,
        [appointment_id, patient_id, context.clinic_id],
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Appointment not found or does not belong to this patient",
        });
      }

      const appointment = appointmentResult.rows[0];

      if (
        appointment.dentist_status !== "Active" ||
        appointment.clinic_status !== "Active"
      ) {
        return res.status(400).json({
          error:
            "This appointment cannot be rescheduled because its dentist or clinic location is inactive.",
        });
      }

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
        `SELECT
            a.*,
            d.clinic_id,
            d.status AS dentist_status,
            c.status AS clinic_status,
            p.clinic_id AS patient_clinic_id
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         JOIN public.patients p ON a.patient_id = p.patient_id
         WHERE a.appointment_id = $1`,
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
        const context = await getDentistClinicContext(req.user.user_id);

        if (!context.allowed) {
          return res.status(context.status).json({ error: context.error });
        }

        if (
          Number(context.dentist_id) !== Number(appointment.dentist_id) ||
          Number(context.clinic_id) !== Number(appointment.clinic_id) ||
          Number(appointment.patient_clinic_id) !== Number(context.clinic_id)
        ) {
          return res.status(403).json({
            error:
              "You can only approve reschedule requests assigned to you within your clinic location.",
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
          appointment.patient_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      if (
        appointment.dentist_status !== "Active" ||
        appointment.clinic_status !== "Active"
      ) {
        return res.status(400).json({
          error:
            "This reschedule request cannot be approved because its dentist or clinic location is inactive.",
        });
      }

      if (
        Number(appointment.patient_clinic_id) !== Number(appointment.clinic_id)
      ) {
        return res.status(409).json({
          error:
            "This appointment has an invalid cross-clinic patient assignment and cannot be rescheduled.",
        });
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
        `SELECT
            a.*,
            d.clinic_id,
            d.status AS dentist_status,
            c.status AS clinic_status,
            p.clinic_id AS patient_clinic_id
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         JOIN public.patients p ON a.patient_id = p.patient_id
         WHERE a.appointment_id = $1`,
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
        const context = await getDentistClinicContext(req.user.user_id);

        if (!context.allowed) {
          return res.status(context.status).json({ error: context.error });
        }

        if (
          Number(context.dentist_id) !== Number(appointment.dentist_id) ||
          Number(context.clinic_id) !== Number(appointment.clinic_id) ||
          Number(appointment.patient_clinic_id) !== Number(context.clinic_id)
        ) {
          return res.status(403).json({
            error:
              "You can only reject reschedule requests assigned to you within your clinic location.",
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
          appointment.patient_id,
        );

        if (!accessCheck.allowed) {
          return res.status(accessCheck.status).json({
            error: accessCheck.error,
          });
        }
      }

      if (
        appointment.dentist_status !== "Active" ||
        appointment.clinic_status !== "Active"
      ) {
        return res.status(400).json({
          error:
            "This reschedule request cannot be rejected because its dentist or clinic location is inactive.",
        });
      }

      if (
        Number(appointment.patient_clinic_id) !== Number(appointment.clinic_id)
      ) {
        return res.status(409).json({
          error:
            "This appointment has an invalid cross-clinic patient assignment and cannot be updated.",
        });
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
