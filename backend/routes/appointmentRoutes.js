const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// GET ACTIVE DENTISTS FOR PATIENT APPOINTMENT DROPDOWN
router.get(
  "/dentists/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
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
       LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
       WHERE d.status = 'Active'
       ORDER BY u.name ASC`,
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

// PATIENT: BOOK APPOINTMENT
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { dentist_id, appointment_date, appointment_type, notes } = req.body;

    if (!dentist_id || !appointment_date) {
      return res.status(400).json({
        error: "Dentist and appointment date are required",
      });
    }

    try {
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Patient profile not found. Please create your patient profile first.",
        });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const dentistResult = await pool.query(
        "SELECT dentist_id FROM public.dentists WHERE dentist_id = $1",
        [dentist_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist not found" });
      }

      const conflictCheck = await pool.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE dentist_id = $1
         AND appointment_date = $2
         AND status IN ('Pending', 'Scheduled')`,
        [dentist_id, appointment_date],
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
            reschedule_request,
            requested_appointment_date,
            reschedule_status
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          patient_id,
          dentist_id,
          appointment_date,
          "Pending",
          notes || null,
          appointment_type || "Consultation",
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
      a.reschedule_request,
      a.requested_appointment_date,
      a.reschedule_status
   FROM public.appointments a
   JOIN public.dentists d ON a.dentist_id = d.dentist_id
   JOIN public.users du ON d.user_id = du.user_id
   LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
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
      a.reschedule_request,
      a.requested_appointment_date,
      a.reschedule_status
   FROM public.appointments a
   JOIN public.patients p ON a.patient_id = p.patient_id
   JOIN public.users pu ON p.user_id = pu.user_id
   JOIN public.dentists d ON a.dentist_id = d.dentist_id
   LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
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
  authorizeRoles("Admin", "Assistant"),
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
              a.reschedule_request,
              a.requested_appointment_date,
              a.reschedule_status
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users pu ON p.user_id = pu.user_id
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           JOIN public.users du ON d.user_id = du.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
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
              a.reschedule_request,
              a.requested_appointment_date,
              a.reschedule_status
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users pu ON p.user_id = pu.user_id
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           JOIN public.users du ON d.user_id = du.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
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
  authorizeRoles("Admin", "Assistant", "Dentist"),
  async (req, res) => {
    const { appointment_id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["Pending", "Scheduled", "Completed", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error:
          "Invalid status. Allowed values: Pending, Scheduled, Completed, Cancelled",
      });
    }

    try {
      const updatedAppointment = await pool.query(
        `UPDATE public.appointments
         SET status = $1
         WHERE appointment_id = $2
         RETURNING *`,
        [status, appointment_id],
      );

      if (updatedAppointment.rows.length === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      res.status(200).json({
        message: "Appointment status updated successfully",
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

    try {
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const cancelledAppointment = await pool.query(
        `UPDATE public.appointments
         SET status = $1,
             cancellation_reason = $2,
             reschedule_request = false,
             requested_appointment_date = NULL,
             reschedule_status = 'None'
         WHERE appointment_id = $3
         AND patient_id = $4
         RETURNING *`,
        [
          "Cancelled",
          cancellation_reason || "No reason provided",
          appointment_id,
          patient_id,
        ],
      );

      if (cancelledAppointment.rows.length === 0) {
        return res.status(404).json({
          error: "Appointment not found or does not belong to this patient",
        });
      }

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
        [appointment.dentist_id, new_appointment_date, appointment_id],
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
        [new_appointment_date, appointment_id, patient_id],
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
  authorizeRoles("Admin", "Assistant", "Dentist"),
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
            error: "You can only approve reschedule requests assigned to you",
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
  authorizeRoles("Admin", "Assistant", "Dentist"),
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
