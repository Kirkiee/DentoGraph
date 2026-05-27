const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// ADMIN: REPORTS SUMMARY
router.get(
  "/admin-summary",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const appointmentSummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_appointments,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled
         FROM public.appointments`,
      );

      const recordSummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_records,
            COUNT(*) FILTER (WHERE COALESCE(status, 'Active') = 'Active')::int AS active_records,
            COUNT(*) FILTER (WHERE COALESCE(status, 'Active') = 'Archived')::int AS archived_records
         FROM public.dental_records`,
      );

      const xraySummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_xrays,
            COALESCE(SUM(COALESCE(file_size_bytes, 0)), 0)::bigint AS total_storage_bytes
         FROM public.xray_images`,
      );

      const annotationSummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_annotations,
            COUNT(*) FILTER (WHERE status = 'Suggested')::int AS suggested,
            COUNT(*) FILTER (WHERE status = 'Confirmed')::int AS confirmed,
            COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE source = 'AI')::int AS ai_generated,
            COUNT(*) FILTER (WHERE source = 'Manual')::int AS manual_annotations
         FROM public.xray_annotations`,
      );

      const clinicSummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_clinics,
            COUNT(*) FILTER (WHERE status = 'Active')::int AS active_clinics,
            COUNT(*) FILTER (WHERE status = 'Inactive')::int AS inactive_clinics,
            COUNT(*) FILTER (WHERE subscription_plan_id IS NOT NULL)::int AS subscribed_clinics
         FROM public.clinics`,
      );

      const userSummary = await pool.query(
        `SELECT 
            COUNT(*)::int AS total_users,
            COUNT(*) FILTER (WHERE u.status = 'Active')::int AS active_users,
            COUNT(*) FILTER (WHERE u.status = 'Inactive')::int AS inactive_users,
            COUNT(*) FILTER (WHERE r.role_name = 'Admin')::int AS admins,
            COUNT(*) FILTER (WHERE r.role_name = 'Dentist')::int AS dentists,
            COUNT(*) FILTER (WHERE r.role_name IN ('Assistant', 'Dental Assistant'))::int AS assistants,
            COUNT(*) FILTER (WHERE r.role_name = 'Patient')::int AS patients
         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id`,
      );

      const clinicsByPlan = await pool.query(
        `SELECT 
            COALESCE(sp.plan_name, 'No Plan Assigned') AS plan_name,
            COUNT(c.clinic_id)::int AS clinic_count
         FROM public.clinics c
         LEFT JOIN public.subscription_plans sp 
           ON c.subscription_plan_id = sp.plan_id
         GROUP BY COALESCE(sp.plan_name, 'No Plan Assigned')
         ORDER BY clinic_count DESC`,
      );

      const recordsByClinic = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            COUNT(dr.record_id)::int AS record_count
         FROM public.clinics c
         LEFT JOIN public.dentists d 
           ON c.clinic_id = d.clinic_id
         LEFT JOIN public.dental_records dr 
           ON d.dentist_id = dr.dentist_id
          AND COALESCE(dr.status, 'Active') = 'Active'
         GROUP BY c.clinic_id, c.clinic_name
         ORDER BY record_count DESC, c.clinic_name ASC`,
      );

      const xrayByClinic = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            COUNT(x.xray_id)::int AS xray_count,
            COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS storage_bytes
         FROM public.clinics c
         LEFT JOIN public.dentists d 
           ON c.clinic_id = d.clinic_id
         LEFT JOIN public.dental_records dr 
           ON d.dentist_id = dr.dentist_id
         LEFT JOIN public.xray_images x 
           ON dr.record_id = x.record_id
         GROUP BY c.clinic_id, c.clinic_name
         ORDER BY xray_count DESC, c.clinic_name ASC`,
      );

      const subscriptionUsage = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            COALESCE(sp.plan_name, 'No Plan Assigned') AS plan_name,

            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,

            COUNT(DISTINCT d.dentist_id)::int AS dentists_used,
            COUNT(DISTINCT a.assistant_id)::int AS assistants_used,
            COUNT(DISTINCT dr.patient_id)::int AS patients_used,
            COUNT(DISTINCT dr.record_id)::int AS records_used,
            COUNT(DISTINCT x.xray_id)::int AS xrays_used,
            COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS storage_used_bytes

         FROM public.clinics c
         LEFT JOIN public.subscription_plans sp 
           ON c.subscription_plan_id = sp.plan_id
         LEFT JOIN public.dentists d 
           ON c.clinic_id = d.clinic_id
         LEFT JOIN public.assistants a 
           ON c.clinic_id = a.clinic_id
         LEFT JOIN public.dental_records dr 
           ON d.dentist_id = dr.dentist_id
          AND COALESCE(dr.status, 'Active') = 'Active'
         LEFT JOIN public.xray_images x 
           ON dr.record_id = x.record_id

         GROUP BY 
            c.clinic_id,
            c.clinic_name,
            sp.plan_name,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb

         ORDER BY c.clinic_name ASC`,
      );

      const recentAppointments = await pool.query(
        `SELECT 
            a.appointment_id,
            a.appointment_date,
            a.status,
            patient_user.name AS patient_name,
            dentist_user.name AS dentist_name,
            c.clinic_name
         FROM public.appointments a
         JOIN public.patients p 
           ON a.patient_id = p.patient_id
         JOIN public.users patient_user 
           ON p.user_id = patient_user.user_id
         JOIN public.dentists d 
           ON a.dentist_id = d.dentist_id
         JOIN public.users dentist_user 
           ON d.user_id = dentist_user.user_id
         LEFT JOIN public.clinics c 
           ON d.clinic_id = c.clinic_id
         ORDER BY a.appointment_date DESC
         LIMIT 10`,
      );

      const totalStorageBytes = Number(
        xraySummary.rows[0].total_storage_bytes || 0,
      );

      res.status(200).json({
        message: "Admin report summary retrieved successfully",

        summaries: {
          appointments: appointmentSummary.rows[0],
          records: recordSummary.rows[0],
          xrays: {
            ...xraySummary.rows[0],
            total_storage_mb: Number(
              (totalStorageBytes / 1024 / 1024).toFixed(2),
            ),
          },
          annotations: annotationSummary.rows[0],
          clinics: clinicSummary.rows[0],
          users: userSummary.rows[0],
        },

        charts: {
          clinics_by_plan: clinicsByPlan.rows,

          records_by_clinic: recordsByClinic.rows,

          xrays_by_clinic: xrayByClinic.rows.map((item) => ({
            ...item,
            storage_mb: Number(
              (Number(item.storage_bytes || 0) / 1024 / 1024).toFixed(2),
            ),
          })),
        },

        subscription_usage: subscriptionUsage.rows.map((item) => ({
          ...item,
          storage_used_mb: Number(
            (Number(item.storage_used_bytes || 0) / 1024 / 1024).toFixed(2),
          ),
        })),

        recent_appointments: recentAppointments.rows,
      });
    } catch (err) {
      console.error("Admin reports summary error:", err.message);

      res.status(500).json({
        error: "Error retrieving admin reports summary",
      });
    }
  },
);

module.exports = router;
