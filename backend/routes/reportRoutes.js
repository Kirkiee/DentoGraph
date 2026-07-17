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
            COUNT(*)::int AS total_clinic_locations,
            COUNT(DISTINCT c.owner_user_id) FILTER (WHERE c.owner_user_id IS NOT NULL)::int AS total_owner_accounts,
            COUNT(*) FILTER (WHERE status = 'Active')::int AS active_clinics,
            COUNT(*) FILTER (WHERE c.status = 'Inactive')::int AS inactive_clinics,
            COUNT(*) FILTER (WHERE os.owner_subscription_id IS NOT NULL)::int AS subscribed_clinics
         FROM public.clinics c
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id`,
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

      const paymentSummary = await pool.query(
        `SELECT
            COUNT(*)::int AS total_payments,
            COUNT(*) FILTER (WHERE status = 'Paid')::int AS paid_payments,
            COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_payments,
            COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled_payments,
            COUNT(*) FILTER (WHERE status = 'Failed')::int AS failed_payments,
            COALESCE(SUM(amount) FILTER (WHERE status = 'Paid'), 0)::numeric AS total_paid_amount
         FROM public.payments`,
      );

      const clinicsByPlan = await pool.query(
        `SELECT 
            COALESCE(sp.plan_name, 'No Plan Assigned') AS plan_name,
            COUNT(c.clinic_id)::int AS clinic_count,
            COUNT(DISTINCT c.owner_user_id) FILTER (WHERE c.owner_user_id IS NOT NULL)::int AS owner_account_count
         FROM public.clinics c
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp 
           ON os.plan_id = sp.plan_id
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
        `WITH clinic_usage AS (
           SELECT
             c.clinic_id,
             (
               SELECT COUNT(*)::int
               FROM public.dentists d
               WHERE d.clinic_id = c.clinic_id
             ) AS dentists_used,
             (
               SELECT COUNT(*)::int
               FROM public.assistants a
               WHERE a.clinic_id = c.clinic_id
             ) AS assistants_used,
             (
               SELECT COUNT(*)::int
               FROM public.patients p
               WHERE p.clinic_id = c.clinic_id
             ) AS patients_used,
             (
               SELECT COUNT(*)::int
               FROM public.dental_records dr
               JOIN public.dentists d
                 ON dr.dentist_id = d.dentist_id
               JOIN public.patients p
                 ON dr.patient_id = p.patient_id
               WHERE d.clinic_id = c.clinic_id
               AND p.clinic_id = c.clinic_id
               AND COALESCE(dr.status, 'Active') = 'Active'
             ) AS records_used,
             (
               SELECT COUNT(*)::int
               FROM public.xray_images x
               JOIN public.dental_records dr
                 ON x.record_id = dr.record_id
               JOIN public.dentists d
                 ON dr.dentist_id = d.dentist_id
               JOIN public.patients p
                 ON dr.patient_id = p.patient_id
               WHERE d.clinic_id = c.clinic_id
               AND p.clinic_id = c.clinic_id
             ) AS xrays_used,
             (
               SELECT COALESCE(
                 SUM(COALESCE(x.file_size_bytes, 0)),
                 0
               )::bigint
               FROM public.xray_images x
               JOIN public.dental_records dr
                 ON x.record_id = dr.record_id
               JOIN public.dentists d
                 ON dr.dentist_id = d.dentist_id
               JOIN public.patients p
                 ON dr.patient_id = p.patient_id
               WHERE d.clinic_id = c.clinic_id
               AND p.clinic_id = c.clinic_id
             ) AS storage_used_bytes
           FROM public.clinics c
         ),
         owner_location_counts AS (
           SELECT
             owner_user_id,
             COUNT(*)::int AS owner_location_count,
             COUNT(*) FILTER (WHERE COALESCE(status, 'Active') = 'Active')::int AS owner_active_location_count
           FROM public.clinics
           WHERE owner_user_id IS NOT NULL
           GROUP BY owner_user_id
         ),
         owner_usage AS (
           SELECT
             c.owner_user_id,
             COALESCE(SUM(cu.dentists_used), 0)::int AS dentists_used,
             COALESCE(SUM(cu.assistants_used), 0)::int AS assistants_used,
             COALESCE(SUM(cu.patients_used), 0)::int AS patients_used,
             COALESCE(SUM(cu.records_used), 0)::int AS records_used,
             COALESCE(SUM(cu.xrays_used), 0)::int AS xrays_used,
             COALESCE(SUM(cu.storage_used_bytes), 0)::bigint AS storage_used_bytes
           FROM public.clinics c
           LEFT JOIN clinic_usage cu
             ON c.clinic_id = cu.clinic_id
           WHERE c.owner_user_id IS NOT NULL
           GROUP BY c.owner_user_id
         )
         SELECT 
            c.clinic_id,
            c.clinic_name,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            COALESCE(olc.owner_location_count, 1) AS owner_location_count,
            COALESCE(olc.owner_active_location_count, 1) AS owner_active_location_count,
            CASE
              WHEN COALESCE(olc.owner_location_count, 1) > 1
                THEN 'Shared across locations'
              ELSE 'Single location'
            END AS subscription_scope,
            COALESCE(sp.plan_name, 'No Plan Assigned') AS plan_name,

            sp.max_clinics,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,

            COALESCE(ou.dentists_used, cu.dentists_used, 0)::int AS dentists_used,
            COALESCE(ou.assistants_used, cu.assistants_used, 0)::int AS assistants_used,
            COALESCE(ou.patients_used, cu.patients_used, 0)::int AS patients_used,
            COALESCE(ou.records_used, cu.records_used, 0)::int AS records_used,
            COALESCE(ou.xrays_used, cu.xrays_used, 0)::int AS xrays_used,
            COALESCE(ou.storage_used_bytes, cu.storage_used_bytes, 0)::bigint AS storage_used_bytes,

            COALESCE(cu.dentists_used, 0)::int AS location_dentists_used,
            COALESCE(cu.assistants_used, 0)::int AS location_assistants_used,
            COALESCE(cu.patients_used, 0)::int AS location_patients_used,
            COALESCE(cu.records_used, 0)::int AS location_records_used,
            COALESCE(cu.xrays_used, 0)::int AS location_xrays_used,
            COALESCE(cu.storage_used_bytes, 0)::bigint AS location_storage_used_bytes

         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp 
           ON os.plan_id = sp.plan_id
         LEFT JOIN clinic_usage cu
           ON c.clinic_id = cu.clinic_id
         LEFT JOIN owner_location_counts olc
           ON c.owner_user_id = olc.owner_user_id
         LEFT JOIN owner_usage ou
           ON c.owner_user_id = ou.owner_user_id
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
         JOIN public.clinics c
           ON d.clinic_id = c.clinic_id
         WHERE p.clinic_id = d.clinic_id
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
          payments: paymentSummary.rows[0],
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
          location_storage_used_mb: Number(
            (
              Number(item.location_storage_used_bytes || 0) /
              1024 /
              1024
            ).toFixed(2),
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

// CLINIC OWNER: ACCOUNT-WIDE AND SELECTED-LOCATION REPORT
router.get(
  "/clinic-owner-summary",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const requestedClinicId = req.query.clinic_id
      ? Number(req.query.clinic_id)
      : null;

    if (
      req.query.clinic_id &&
      (!Number.isInteger(requestedClinicId) || requestedClinicId <= 0)
    ) {
      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    try {
      const locationsResult = await pool.query(
        `SELECT
            c.clinic_id,
            c.clinic_name,
            c.status,
            c.owner_user_id,
            os.plan_id AS subscription_plan_id,
            os.subscription_status,
            os.end_date AS subscription_end_date,
            sp.plan_name,
            sp.max_clinics,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb
         FROM public.clinics c
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp
           ON os.plan_id = sp.plan_id
         WHERE c.owner_user_id = $1
         ORDER BY c.clinic_name ASC`,
        [req.user.user_id],
      );

      if (locationsResult.rows.length === 0) {
        return res.status(404).json({
          error: "No clinic locations are linked to this Clinic Owner account.",
        });
      }

      const locations = locationsResult.rows;
      let selectedLocation = null;

      if (requestedClinicId) {
        selectedLocation = locations.find(
          (location) =>
            Number(location.clinic_id) === Number(requestedClinicId),
        );

        if (!selectedLocation) {
          return res.status(403).json({
            error:
              "Selected clinic location does not belong to this Clinic Owner account.",
          });
        }
      }

      const scopeClinicIds = selectedLocation
        ? [Number(selectedLocation.clinic_id)]
        : locations.map((location) => Number(location.clinic_id));

      const appointments = await pool.query(
        `SELECT
            COUNT(*)::int AS total_appointments,
            COUNT(*) FILTER (WHERE a.status = 'Pending')::int AS pending,
            COUNT(*) FILTER (WHERE a.status = 'Scheduled')::int AS scheduled,
            COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS completed,
            COUNT(*) FILTER (WHERE a.status = 'Cancelled')::int AS cancelled,
            COUNT(*) FILTER (
              WHERE a.reschedule_request = true
              AND COALESCE(a.reschedule_status, 'Pending') = 'Pending'
            )::int AS reschedule_requests
         FROM public.appointments a
         JOIN public.dentists d
           ON a.dentist_id = d.dentist_id
         JOIN public.patients p
           ON a.patient_id = p.patient_id
         WHERE d.clinic_id = ANY($1::int[])
         AND p.clinic_id = d.clinic_id`,
        [scopeClinicIds],
      );

      const records = await pool.query(
        `SELECT
            COUNT(*)::int AS total_records,
            COUNT(*) FILTER (
              WHERE COALESCE(dr.status, 'Active') = 'Active'
            )::int AS active_records,
            COUNT(*) FILTER (
              WHERE dr.status = 'Archived'
            )::int AS archived_records,
            COUNT(DISTINCT dr.patient_id)::int AS patients_with_records
         FROM public.dental_records dr
         JOIN public.dentists d
           ON dr.dentist_id = d.dentist_id
         JOIN public.patients p
           ON dr.patient_id = p.patient_id
         WHERE d.clinic_id = ANY($1::int[])
         AND p.clinic_id = d.clinic_id`,
        [scopeClinicIds],
      );

      const staff = await pool.query(
        `SELECT
            COUNT(*) FILTER (
              WHERE role_scope.role_name = 'Dentist'
            )::int AS dentists,
            COUNT(*) FILTER (
              WHERE role_scope.role_name IN ('Assistant', 'Dental Assistant')
            )::int AS assistants,
            COUNT(*) FILTER (
              WHERE role_scope.account_status = 'Active'
            )::int AS active_staff,
            COUNT(*) FILTER (
              WHERE role_scope.account_status = 'Inactive'
            )::int AS inactive_staff
         FROM (
           SELECT
             'Dentist'::text AS role_name,
             u.status AS account_status
           FROM public.dentists d
           JOIN public.users u ON d.user_id = u.user_id
           WHERE d.clinic_id = ANY($1::int[])

           UNION ALL

           SELECT
             'Assistant'::text AS role_name,
             u.status AS account_status
           FROM public.assistants a
           JOIN public.users u ON a.user_id = u.user_id
           WHERE a.clinic_id = ANY($1::int[])
         ) role_scope`,
        [scopeClinicIds],
      );

      const xrays = await pool.query(
        `SELECT
            COUNT(*)::int AS total_xrays,
            COALESCE(
              SUM(COALESCE(x.file_size_bytes, 0)),
              0
            )::bigint AS storage_used_bytes
         FROM public.xray_images x
         JOIN public.dental_records dr
           ON x.record_id = dr.record_id
         JOIN public.dentists d
           ON dr.dentist_id = d.dentist_id
         JOIN public.patients p
           ON dr.patient_id = p.patient_id
         WHERE d.clinic_id = ANY($1::int[])
         AND p.clinic_id = d.clinic_id`,
        [scopeClinicIds],
      );

      const activityByLocation = await pool.query(
        `SELECT
            c.clinic_id,
            c.clinic_name,
            c.status,
            (
              SELECT COUNT(*)::int
              FROM public.appointments a
              JOIN public.dentists d
                ON a.dentist_id = d.dentist_id
              JOIN public.patients p
                ON a.patient_id = p.patient_id
              WHERE d.clinic_id = c.clinic_id
              AND p.clinic_id = c.clinic_id
            ) AS appointments,
            (
              SELECT COUNT(*)::int
              FROM public.dental_records dr
              JOIN public.dentists d
                ON dr.dentist_id = d.dentist_id
              JOIN public.patients p
                ON dr.patient_id = p.patient_id
              WHERE d.clinic_id = c.clinic_id
              AND p.clinic_id = c.clinic_id
              AND COALESCE(dr.status, 'Active') = 'Active'
            ) AS active_records,
            (
              SELECT COUNT(*)::int
              FROM public.xray_images x
              JOIN public.dental_records dr
                ON x.record_id = dr.record_id
              JOIN public.dentists d
                ON dr.dentist_id = d.dentist_id
              JOIN public.patients p
                ON dr.patient_id = p.patient_id
              WHERE d.clinic_id = c.clinic_id
              AND p.clinic_id = c.clinic_id
            ) AS xrays
         FROM public.clinics c
         WHERE c.owner_user_id = $1
         ORDER BY c.clinic_name ASC`,
        [req.user.user_id],
      );

      const recentAppointments = await pool.query(
        `SELECT
            a.appointment_id,
            a.appointment_date,
            a.status,
            a.appointment_type,
            pu.name AS patient_name,
            du.name AS dentist_name,
            c.clinic_id,
            c.clinic_name
         FROM public.appointments a
         JOIN public.patients p ON a.patient_id = p.patient_id
         JOIN public.users pu ON p.user_id = pu.user_id
         JOIN public.dentists d ON a.dentist_id = d.dentist_id
         JOIN public.users du ON d.user_id = du.user_id
         JOIN public.clinics c ON d.clinic_id = c.clinic_id
         WHERE c.owner_user_id = $1
         AND p.clinic_id = d.clinic_id
         AND ($2::int IS NULL OR c.clinic_id = $2)
         ORDER BY a.appointment_date DESC
         LIMIT 10`,
        [req.user.user_id, requestedClinicId],
      );

      const storageBytes = Number(xrays.rows[0].storage_used_bytes || 0);

      res.status(200).json({
        message: "Clinic Owner report retrieved successfully.",
        scope: selectedLocation ? "location" : "account",
        selected_location: selectedLocation,
        locations,
        shared_subscription: locations[0],
        summaries: {
          appointments: appointments.rows[0],
          records: records.rows[0],
          staff: staff.rows[0],
          xrays: {
            ...xrays.rows[0],
            storage_used_mb: Number((storageBytes / 1024 / 1024).toFixed(2)),
          },
        },
        activity_by_location: activityByLocation.rows,
        recent_appointments: recentAppointments.rows,
      });
    } catch (err) {
      console.error("Clinic Owner reports error:", err.message);
      res.status(500).json({
        error: "Error retrieving Clinic Owner report.",
      });
    }
  },
);

module.exports = router;
