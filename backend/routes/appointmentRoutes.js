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
          d.status
       FROM public.dentists d
       JOIN public.users u ON d.user_id = u.user_id
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
        (patient_id, dentist_id, appointment_date, status, notes, appointment_type, reschedule_request)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
        [
          patient_id,
          dentist_id,
          appointment_date,
          "Pending",
          notes || null,
          appointment_type || "Consultation",
          false,
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
            a.appointment_date,
            a.status,
            a.notes,
            a.appointment_type,
            a.cancellation_reason,
            a.reschedule_request
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
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
            a.appointment_date,
            a.status,
            a.notes,
            a.appointment_type,
            a.cancellation_reason,
            a.reschedule_request
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
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

// ADMIN / ASSISTANT: VIEW ALL APPOINTMENTS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Assistant"),
  async (req, res) => {
    try {
      const appointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.patient_id,
            pu.name AS patient_name,
            a.dentist_id,
            du.name AS dentist_name,
            a.appointment_date,
            a.status,
            a.notes,
            a.appointment_type,
            a.cancellation_reason,
            a.reschedule_request
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         ORDER BY a.appointment_date DESC`,
      );

      res.status(200).json({
        message: "All appointments retrieved successfully",
        appointments: appointments.rows,
      });
    } catch (err) {
      console.error("Get all appointments error:", err.message);
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
             cancellation_reason = $2
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

      const rescheduledAppointment = await pool.query(
        `UPDATE public.appointments
         SET appointment_date = $1,
             reschedule_request = $2,
             status = $3
         WHERE appointment_id = $4
         AND patient_id = $5
         RETURNING *`,
        [new_appointment_date, true, "Pending", appointment_id, patient_id],
      );

      if (rescheduledAppointment.rows.length === 0) {
        return res.status(404).json({
          error: "Appointment not found or does not belong to this patient",
        });
      }

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

module.exports = router;
