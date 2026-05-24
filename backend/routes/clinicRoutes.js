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

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
};

// ADMIN / STAFF: GET ALL CLINICS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    try {
      const clinics = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.address,
            c.latitude,
            c.longitude,
            c.services,
            c.contact_number,
            c.opening_hours,
            c.subscription_plan_id,
            sp.plan_name,
            sp.price,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,
            c.status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         ORDER BY c.clinic_id DESC`,
      );

      res.status(200).json({
        message: "Clinics retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Get clinics error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinics",
      });
    }
  },
);

// PATIENT / ADMIN / DENTIST / ASSISTANT: CLINIC DISCOVERY LIST
// IMPORTANT: Keep this above "/:clinic_id"
router.get(
  "/discovery/list",
  authenticateToken,
  authorizeRoles(
    "Patient",
    "Admin",
    "Dentist",
    "Assistant",
    "Dental Assistant",
  ),
  async (req, res) => {
    try {
      const clinics = await pool.query(
        `SELECT 
            clinic_id,
            clinic_name,
            address,
            latitude,
            longitude,
            services,
            contact_number,
            opening_hours,
            status,
            created_at
         FROM public.clinics
         WHERE status = 'Active'
         ORDER BY clinic_name ASC`,
      );

      res.status(200).json({
        message: "Clinic discovery list retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Clinic discovery error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic discovery list",
      });
    }
  },
);

// ADMIN: GET CLINIC SUBSCRIPTION USAGE
router.get(
  "/:clinic_id/subscription-usage",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicResult = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.subscription_plan_id,
            sp.plan_name,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb
         FROM public.clinics c
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         WHERE c.clinic_id = $1`,
        [clinic_id],
      );

      if (clinicResult.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const dentistCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dentists
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      const assistantCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.assistants
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      const patientCount = await pool.query(
        `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      const recordCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      const xrayCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      res.status(200).json({
        message: "Clinic subscription usage retrieved successfully",
        clinic: clinicResult.rows[0],
        usage: {
          dentists: dentistCount.rows[0].count,
          assistants: assistantCount.rows[0].count,
          patients: patientCount.rows[0].count,
          records: recordCount.rows[0].count,
          xrays: xrayCount.rows[0].count,
        },
      });
    } catch (err) {
      console.error("Get clinic subscription usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic subscription usage",
      });
    }
  },
);

// ADMIN / STAFF: GET SINGLE CLINIC
router.get(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles(
    "Admin",
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
  ),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinic = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.address,
            c.latitude,
            c.longitude,
            c.services,
            c.contact_number,
            c.opening_hours,
            c.subscription_plan_id,
            sp.plan_name,
            sp.price,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,
            c.status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         WHERE c.clinic_id = $1`,
        [clinic_id],
      );

      if (clinic.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      res.status(200).json({
        message: "Clinic retrieved successfully",
        clinic: clinic.rows[0],
      });
    } catch (err) {
      console.error("Get clinic error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic",
      });
    }
  },
);

// ADMIN: CREATE CLINIC
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      subscription_plan_id,
      status,
    } = req.body || {};

    if (!clinic_name || !address) {
      return res.status(400).json({
        error: "Clinic name and address are required",
      });
    }

    try {
      if (subscription_plan_id) {
        const planCheck = await pool.query(
          `SELECT plan_id
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        if (planCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Subscription plan not found",
          });
        }
      }

      const duplicateCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)`,
        [clinic_name, address],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error: "A clinic with the same name and address already exists",
        });
      }

      const newClinic = await pool.query(
        `INSERT INTO public.clinics
         (
           clinic_name,
           address,
           latitude,
           longitude,
           services,
           contact_number,
           opening_hours,
           subscription_plan_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'Active'), CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          clinic_name,
          address,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(services),
          normalizeNullable(contact_number),
          normalizeNullable(opening_hours),
          normalizeNumber(subscription_plan_id),
          status || "Active",
        ],
      );

      res.status(201).json({
        message: "Clinic created successfully",
        clinic: newClinic.rows[0],
      });
    } catch (err) {
      console.error("Create clinic error:", err.message);
      res.status(500).json({
        error: "Error creating clinic",
      });
    }
  },
);

// ADMIN: UPDATE CLINIC
router.put(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      subscription_plan_id,
      status,
    } = req.body || {};

    try {
      const clinicCheck = await pool.query(
        `SELECT *
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      if (subscription_plan_id) {
        const planCheck = await pool.query(
          `SELECT plan_id
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        if (planCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Subscription plan not found",
          });
        }
      }

      const updatedClinic = await pool.query(
        `UPDATE public.clinics
         SET clinic_name = COALESCE($1, clinic_name),
             address = COALESCE($2, address),
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7,
             subscription_plan_id = $8,
             status = COALESCE($9, status)
         WHERE clinic_id = $10
         RETURNING *`,
        [
          normalizeNullable(clinic_name),
          normalizeNullable(address),
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(services),
          normalizeNullable(contact_number),
          normalizeNullable(opening_hours),
          normalizeNumber(subscription_plan_id),
          normalizeNullable(status),
          clinic_id,
        ],
      );

      res.status(200).json({
        message: "Clinic updated successfully",
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic error:", err.message);
      res.status(500).json({
        error: "Error updating clinic",
      });
    }
  },
);

// ADMIN: ARCHIVE / DEACTIVATE CLINIC
router.put(
  "/:clinic_id/archive",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const archivedClinic = await pool.query(
        `UPDATE public.clinics
         SET status = 'Inactive'
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      res.status(200).json({
        message: "Clinic archived successfully",
        clinic: archivedClinic.rows[0],
      });
    } catch (err) {
      console.error("Archive clinic error:", err.message);
      res.status(500).json({
        error: "Error archiving clinic",
      });
    }
  },
);

// ADMIN: RESTORE / ACTIVATE CLINIC
router.put(
  "/:clinic_id/restore",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const restoredClinic = await pool.query(
        `UPDATE public.clinics
         SET status = 'Active'
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      res.status(200).json({
        message: "Clinic restored successfully",
        clinic: restoredClinic.rows[0],
      });
    } catch (err) {
      console.error("Restore clinic error:", err.message);
      res.status(500).json({
        error: "Error restoring clinic",
      });
    }
  },
);

// ADMIN: DELETE CLINIC PERMANENTLY
router.delete(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const dentistCheck = await pool.query(
        `SELECT dentist_id
         FROM public.dentists
         WHERE clinic_id = $1
         LIMIT 1`,
        [clinic_id],
      );

      const assistantCheck = await pool.query(
        `SELECT assistant_id
         FROM public.assistants
         WHERE clinic_id = $1
         LIMIT 1`,
        [clinic_id],
      );

      if (dentistCheck.rows.length > 0 || assistantCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Cannot delete this clinic because it still has assigned dentists or assistants. Archive it instead.",
        });
      }

      const deletedClinic = await pool.query(
        `DELETE FROM public.clinics
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      res.status(200).json({
        message: "Clinic deleted permanently",
        clinic: deletedClinic.rows[0],
      });
    } catch (err) {
      console.error("Delete clinic error:", err.message);
      res.status(500).json({
        error: "Error deleting clinic",
      });
    }
  },
);

module.exports = router;
