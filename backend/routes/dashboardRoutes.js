const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

// ADMIN DASHBOARD SUMMARY
router.get(
  "/admin",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const usersResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE status = 'Active')::int AS active_users,
          COUNT(*) FILTER (WHERE status = 'Inactive')::int AS inactive_users
        FROM public.users
      `);

      const rolesResult = await pool.query(`
        SELECT
          r.role_name,
          COUNT(ur.user_id)::int AS count
        FROM public.roles r
        LEFT JOIN public.user_roles ur ON r.role_id = ur.role_id
        GROUP BY r.role_name
      `);

      const clinicsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_clinics,
          COUNT(*) FILTER (WHERE status = 'Active')::int AS active_clinics,
          COUNT(*) FILTER (WHERE status = 'Inactive')::int AS inactive_clinics
        FROM public.clinics
      `);

      const appointmentsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_appointments,
          COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_appointments,
          COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled_appointments,
          COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_appointments,
          COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled_appointments,
          COUNT(*) FILTER (WHERE reschedule_request = true)::int AS reschedule_requests
        FROM public.appointments
      `);

      const recordsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_records,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Active') = 'Active')::int AS active_records,
          COUNT(*) FILTER (WHERE status = 'Archived')::int AS archived_records
        FROM public.dental_records
      `);

      const xraysResult = await pool.query(`
        SELECT COUNT(*)::int AS total_xrays
        FROM public.xray_images
      `);

      const subscriptionsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_plans,
          COUNT(*) FILTER (WHERE status = 'Active')::int AS active_plans
        FROM public.subscription_plans
      `);

      const recentAppointments = await pool.query(`
        SELECT
          a.appointment_id,
          a.appointment_date,
          a.status,
          a.appointment_type,
          pu.name AS patient_name,
          du.name AS dentist_name,
          c.clinic_name
        FROM public.appointments a
        JOIN public.patients p ON a.patient_id = p.patient_id
        JOIN public.users pu ON p.user_id = pu.user_id
        JOIN public.dentists d ON a.dentist_id = d.dentist_id
        JOIN public.users du ON d.user_id = du.user_id
        LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
        ORDER BY a.appointment_date DESC
        LIMIT 5
      `);

      res.status(200).json({
        message: "Admin dashboard data retrieved successfully",
        users: usersResult.rows[0],
        roles: rolesResult.rows,
        clinics: clinicsResult.rows[0],
        appointments: appointmentsResult.rows[0],
        dental_records: recordsResult.rows[0],
        xrays: xraysResult.rows[0],
        subscriptions: subscriptionsResult.rows[0],
        recent_appointments: recentAppointments.rows,
      });
    } catch (err) {
      console.error("Admin dashboard error:", err.message);
      res.status(500).json({ error: "Error retrieving admin dashboard data" });
    }
  },
);

// DENTIST DASHBOARD SUMMARY
router.get(
  "/dentist",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const dentistResult = await pool.query(
        `SELECT 
            d.dentist_id,
            d.clinic_id,
            c.clinic_name
         FROM public.dentists d
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE d.user_id = $1`,
        [user_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({ error: "Dentist profile not found" });
      }

      const dentist = dentistResult.rows[0];

      const appointmentsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total_appointments,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_appointments,
            COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled_appointments,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_appointments,
            COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled_appointments,
            COUNT(*) FILTER (WHERE reschedule_request = true)::int AS reschedule_requests
         FROM public.appointments
         WHERE dentist_id = $1`,
        [dentist.dentist_id],
      );

      const recordsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total_records,
            COUNT(*) FILTER (WHERE COALESCE(status, 'Active') = 'Active')::int AS active_records,
            COUNT(*) FILTER (WHERE status = 'Archived')::int AS archived_records
         FROM public.dental_records
         WHERE dentist_id = $1`,
        [dentist.dentist_id],
      );

      const xraysResult = await pool.query(
        `SELECT COUNT(*)::int AS total_xrays
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         WHERE dr.dentist_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [dentist.dentist_id],
      );

      const patientsResult = await pool.query(
        `SELECT COUNT(DISTINCT patient_id)::int AS total_patients
         FROM public.appointments
         WHERE dentist_id = $1`,
        [dentist.dentist_id],
      );

      const upcomingAppointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.appointment_date,
            a.status,
            a.appointment_type,
            pu.name AS patient_name
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
         WHERE a.dentist_id = $1
         AND a.status IN ('Pending', 'Scheduled')
         ORDER BY a.appointment_date ASC
         LIMIT 5`,
        [dentist.dentist_id],
      );

      res.status(200).json({
        message: "Dentist dashboard data retrieved successfully",
        dentist,
        appointments: appointmentsResult.rows[0],
        dental_records: recordsResult.rows[0],
        xrays: xraysResult.rows[0],
        patients: patientsResult.rows[0],
        upcoming_appointments: upcomingAppointments.rows,
      });
    } catch (err) {
      console.error("Dentist dashboard error:", err.message);
      res
        .status(500)
        .json({ error: "Error retrieving dentist dashboard data" });
    }
  },
);

// ASSISTANT DASHBOARD SUMMARY
router.get(
  "/assistant",
  authenticateToken,
  authorizeRoles("Assistant", "Dental Assistant"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const assistantResult = await pool.query(
        `SELECT 
            a.assistant_id,
            a.clinic_id,
            c.clinic_name
         FROM public.assistants a
         LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
         WHERE a.user_id = $1`,
        [user_id],
      );

      if (assistantResult.rows.length === 0) {
        return res.status(404).json({ error: "Assistant profile not found" });
      }

      const assistant = assistantResult.rows[0];

      if (!assistant.clinic_id) {
        return res.status(400).json({
          error: "Assistant is not assigned to a clinic",
        });
      }

      const appointmentsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total_appointments,
            COUNT(*) FILTER (WHERE a.status = 'Pending')::int AS pending_appointments,
            COUNT(*) FILTER (WHERE a.status = 'Scheduled')::int AS scheduled_appointments,
            COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS completed_appointments,
            COUNT(*) FILTER (WHERE a.status = 'Cancelled')::int AS cancelled_appointments,
            COUNT(*) FILTER (WHERE a.reschedule_request = true)::int AS reschedule_requests
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [assistant.clinic_id],
      );

      const recordsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total_records,
            COUNT(*) FILTER (WHERE COALESCE(dr.status, 'Active') = 'Active')::int AS active_records,
            COUNT(*) FILTER (WHERE dr.status = 'Archived')::int AS archived_records
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [assistant.clinic_id],
      );

      const xraysResult = await pool.query(
        `SELECT COUNT(*)::int AS total_xrays
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [assistant.clinic_id],
      );

      const dentistsResult = await pool.query(
        `SELECT COUNT(*)::int AS clinic_dentists
         FROM public.dentists
         WHERE clinic_id = $1`,
        [assistant.clinic_id],
      );

      const recentAppointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.appointment_date,
            a.status,
            a.appointment_type,
            pu.name AS patient_name,
            du.name AS dentist_name
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         WHERE d.clinic_id = $1
         ORDER BY a.appointment_date DESC
         LIMIT 5`,
        [assistant.clinic_id],
      );

      res.status(200).json({
        message: "Assistant dashboard data retrieved successfully",
        assistant,
        appointments: appointmentsResult.rows[0],
        dental_records: recordsResult.rows[0],
        xrays: xraysResult.rows[0],
        dentists: dentistsResult.rows[0],
        recent_appointments: recentAppointments.rows,
      });
    } catch (err) {
      console.error("Assistant dashboard error:", err.message);
      res.status(500).json({
        error: "Error retrieving assistant dashboard data",
      });
    }
  },
);

// PATIENT DASHBOARD SUMMARY
router.get(
  "/patient",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const patientResult = await pool.query(
        `SELECT patient_id
         FROM public.patients
         WHERE user_id = $1`,
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient = patientResult.rows[0];

      const appointmentsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total_appointments,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_appointments,
            COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled_appointments,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_appointments,
            COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled_appointments,
            COUNT(*) FILTER (WHERE reschedule_request = true)::int AS reschedule_requests
         FROM public.appointments
         WHERE patient_id = $1`,
        [patient.patient_id],
      );

      const recordsResult = await pool.query(
        `SELECT COUNT(*)::int AS total_records
         FROM public.dental_records
         WHERE patient_id = $1
         AND COALESCE(status, 'Active') = 'Active'`,
        [patient.patient_id],
      );

      const xraysResult = await pool.query(
        `SELECT COUNT(*)::int AS total_xrays
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         WHERE dr.patient_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [patient.patient_id],
      );

      const upcomingAppointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.appointment_date,
            a.status,
            a.appointment_type,
            du.name AS dentist_name,
            c.clinic_name
         FROM public.appointments a
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE a.patient_id = $1
         AND a.status IN ('Pending', 'Scheduled')
         ORDER BY a.appointment_date ASC
         LIMIT 5`,
        [patient.patient_id],
      );

      const recentRecords = await pool.query(
        `SELECT
            dr.record_id,
            dr.date_created,
            dr.last_updated,
            du.name AS dentist_name,
            c.clinic_name
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE dr.patient_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'
         ORDER BY dr.last_updated DESC
         LIMIT 5`,
        [patient.patient_id],
      );

      res.status(200).json({
        message: "Patient dashboard data retrieved successfully",
        patient,
        appointments: appointmentsResult.rows[0],
        dental_records: recordsResult.rows[0],
        xrays: xraysResult.rows[0],
        upcoming_appointments: upcomingAppointments.rows,
        recent_records: recentRecords.rows,
      });
    } catch (err) {
      console.error("Patient dashboard error:", err.message);
      res
        .status(500)
        .json({ error: "Error retrieving patient dashboard data" });
    }
  },
);

module.exports = router;
