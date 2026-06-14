const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return null;

  return numberValue;
};

const getFreePlan = async (client) => {
  const result = await client.query(
    `SELECT 
        plan_id,
        plan_name,
        plan_tier,
        price,
        billing_cycle,
        max_dentists,
        max_assistants,
        max_patients,
        max_records,
        max_xrays,
        storage_limit_mb,
        status
     FROM public.subscription_plans
     WHERE LOWER(plan_name) = 'free'
     AND COALESCE(status, 'Active') = 'Active'
     ORDER BY plan_id ASC
     LIMIT 1`,
  );

  return result.rows[0] || null;
};

const getClinicOwnerRole = async (client) => {
  const result = await client.query(
    `SELECT role_id, role_name
     FROM public.roles
     WHERE role_name = 'Clinic Owner'
     LIMIT 1`,
  );

  return result.rows[0] || null;
};

// PUBLIC: REGISTER CLINIC OWNER + CLINIC WITH FREE PLAN
router.post("/register", async (req, res) => {
  const {
    owner_name,
    owner_email,
    password,
    clinic_name,
    address,
    latitude,
    longitude,
    services,
    contact_number,
    opening_hours,
  } = req.body || {};

  if (!owner_name || !owner_email || !password || !clinic_name || !address) {
    return res.status(400).json({
      error:
        "Owner name, owner email, password, clinic name, and address are required.",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Password must be at least 6 characters long.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const role = await getClinicOwnerRole(client);

    if (!role) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "Clinic Owner role was not found. Please add the Clinic Owner role first.",
      });
    }

    const freePlan = await getFreePlan(client);

    if (!freePlan) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "Free subscription plan was not found. Please create an active Free plan first.",
      });
    }

    const emailCheck = await client.query(
      `SELECT user_id
       FROM public.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [owner_email],
    );

    if (emailCheck.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Email already exists. Please use another email address.",
      });
    }

    const duplicateClinicCheck = await client.query(
      `SELECT clinic_id
       FROM public.clinics
       WHERE LOWER(clinic_name) = LOWER($1)
       AND LOWER(address) = LOWER($2)
       LIMIT 1`,
      [clinic_name, address],
    );

    if (duplicateClinicCheck.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "A clinic with the same name and address already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newOwner = await client.query(
      `INSERT INTO public.users
       (name, email, password, status)
       VALUES ($1, $2, $3, 'Active')
       RETURNING user_id, name, email, status, created_at`,
      [owner_name, owner_email, hashedPassword],
    );

    const ownerUserId = newOwner.rows[0].user_id;

    await client.query(
      `INSERT INTO public.user_roles
       (user_id, role_id)
       VALUES ($1, $2)`,
      [ownerUserId, role.role_id],
    );

    const newClinic = await client.query(
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
         owner_user_id,
         status,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active', CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        clinic_name,
        address,
        normalizeNumber(latitude),
        normalizeNumber(longitude),
        normalizeNullable(services),
        normalizeNullable(contact_number),
        normalizeNullable(opening_hours),
        freePlan.plan_id,
        ownerUserId,
      ],
    );

    await client.query("COMMIT");

    await createAuditLog({
      user_id: ownerUserId,
      action: "REGISTER_CLINIC",
      module: "Clinic Registration",
      description: `Clinic owner ${owner_name} registered clinic ${clinic_name} with the Free plan.`,
      ip_address: req.ip,
    });

    res.status(201).json({
      message:
        "Clinic registered successfully. Your clinic has been assigned the Free plan by default. You may now log in.",
      owner: newOwner.rows[0],
      role: role.role_name,
      clinic: newClinic.rows[0],
      subscription_plan: freePlan,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Clinic registration error:", err.message);

    if (err.code === "23505") {
      return res.status(400).json({
        error: "A duplicate record already exists.",
      });
    }

    res.status(500).json({
      error: err.message || "Error registering clinic.",
    });
  } finally {
    client.release();
  }
});

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
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
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
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
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

// CLINIC OWNER: GET OWN CLINIC
router.get(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
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
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.plan_tier,
            sp.price,
            sp.billing_cycle,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,
            c.status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         WHERE c.owner_user_id = $1
         LIMIT 1`,
        [req.user.user_id],
      );

      if (clinic.rows.length === 0) {
        return res.status(404).json({
          error: "No clinic is linked to this clinic owner account.",
        });
      }

      res.status(200).json({
        message: "Clinic owner clinic retrieved successfully",
        clinic: clinic.rows[0],
      });
    } catch (err) {
      console.error("Get clinic owner clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error retrieving clinic owner clinic",
      });
    }
  },
);

// CLINIC OWNER: UPDATE OWN CLINIC PROFILE
router.put(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
    } = req.body || {};

    if (!clinic_name || !address) {
      return res.status(400).json({
        error: "Clinic name and address are required.",
      });
    }

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id, clinic_name
         FROM public.clinics
         WHERE owner_user_id = $1
         LIMIT 1`,
        [req.user.user_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "No clinic is linked to this clinic owner account.",
        });
      }

      const clinicId = clinicCheck.rows[0].clinic_id;

      const duplicateCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         AND clinic_id <> $3
         LIMIT 1`,
        [clinic_name, address, clinicId],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Another clinic with the same name and address already exists.",
        });
      }

      const updatedClinic = await pool.query(
        `UPDATE public.clinics
         SET clinic_name = $1,
             address = $2,
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7
         WHERE clinic_id = $8
         AND owner_user_id = $9
         RETURNING 
           clinic_id,
           clinic_name,
           address,
           latitude,
           longitude,
           services,
           contact_number,
           opening_hours,
           subscription_plan_id,
           owner_user_id,
           status,
           created_at`,
        [
          clinic_name,
          address,
          latitude || null,
          longitude || null,
          services || null,
          contact_number || null,
          opening_hours || null,
          clinicId,
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_PROFILE",
        module: "Clinic Owner Profile",
        description: `Clinic owner updated clinic profile for ${updatedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic profile updated successfully.",
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic owner profile error:", err.message);
      res.status(500).json({
        error: err.message || "Error updating clinic profile.",
      });
    }
  },
);

// CLINIC OWNER: GET OWN CLINIC SUBSCRIPTION USAGE
router.get(
  "/owner/usage",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    try {
      const clinicResult = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.subscription_plan_id,
            c.subscription_start_date,
            c.subscription_end_date,
            c.subscription_status,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.plan_tier,
            sp.price,
            sp.billing_cycle,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         WHERE c.owner_user_id = $1
         LIMIT 1`,
        [req.user.user_id],
      );

      if (clinicResult.rows.length === 0) {
        return res.status(404).json({
          error: "No clinic is linked to this clinic owner account.",
        });
      }

      const clinic = clinicResult.rows[0];
      const clinicId = clinic.clinic_id;

      const dentistCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dentists
         WHERE clinic_id = $1`,
        [clinicId],
      );

      const assistantCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.assistants
         WHERE clinic_id = $1`,
        [clinicId],
      );

      const patientCount = await pool.query(
        `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [clinicId],
      );

      const recordCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [clinicId],
      );

      const xrayCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinicId],
      );

      const storageUsage = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinicId],
      );

      const totalBytes = Number(storageUsage.rows[0].total_bytes || 0);
      const storageUsedMb = totalBytes / 1024 / 1024;

      res.status(200).json({
        message: "Clinic owner usage retrieved successfully",
        clinic,
        usage: {
          dentists: dentistCount.rows[0].count,
          assistants: assistantCount.rows[0].count,
          patients: patientCount.rows[0].count,
          records: recordCount.rows[0].count,
          xrays: xrayCount.rows[0].count,
          storage_used_mb: Number(storageUsedMb.toFixed(2)),
          storage_used_bytes: totalBytes,
        },
      });
    } catch (err) {
      console.error("Get clinic owner usage error:", err.message);
      res.status(500).json({
        error: err.message || "Error retrieving clinic owner usage",
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
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
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
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [clinic_id],
      );

      const recordCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
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

      const storageUsage = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      const totalBytes = Number(storageUsage.rows[0].total_bytes || 0);
      const storageUsedMb = totalBytes / 1024 / 1024;

      res.status(200).json({
        message: "Clinic subscription usage retrieved successfully",
        clinic: clinicResult.rows[0],
        usage: {
          dentists: dentistCount.rows[0].count,
          assistants: assistantCount.rows[0].count,
          patients: patientCount.rows[0].count,
          records: recordCount.rows[0].count,
          xrays: xrayCount.rows[0].count,
          storage_used_mb: Number(storageUsedMb.toFixed(2)),
          storage_used_bytes: totalBytes,
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
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
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
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
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
      owner_user_id,
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

      if (owner_user_id) {
        const ownerCheck = await pool.query(
          `SELECT user_id
           FROM public.users
           WHERE user_id = $1`,
          [owner_user_id],
        );

        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Selected clinic owner user not found",
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
           owner_user_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'Active'), CURRENT_TIMESTAMP)
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
          normalizeNumber(owner_user_id),
          status || "Active",
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_CLINIC",
        module: "Clinic Management",
        description: `Created clinic: ${newClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Clinic created successfully",
        clinic: newClinic.rows[0],
      });
    } catch (err) {
      console.error("Create clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error creating clinic",
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
      owner_user_id,
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

      if (owner_user_id) {
        const ownerCheck = await pool.query(
          `SELECT user_id
           FROM public.users
           WHERE user_id = $1`,
          [owner_user_id],
        );

        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Selected clinic owner user not found",
          });
        }
      }

      const oldClinic = clinicCheck.rows[0];

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
             owner_user_id = $9,
             status = COALESCE($10, status)
         WHERE clinic_id = $11
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
          normalizeNumber(owner_user_id),
          normalizeNullable(status),
          clinic_id,
        ],
      );

      const newStatus = updatedClinic.rows[0].status;
      const oldStatus = oldClinic.status;

      let action = "UPDATE_CLINIC";
      let description = `Updated clinic: ${updatedClinic.rows[0].clinic_name}.`;

      if (oldStatus !== newStatus && newStatus === "Inactive") {
        action = "ARCHIVE_CLINIC";
        description = `Deactivated clinic: ${updatedClinic.rows[0].clinic_name}.`;
      }

      if (oldStatus !== newStatus && newStatus === "Active") {
        action = "RESTORE_CLINIC";
        description = `Activated clinic: ${updatedClinic.rows[0].clinic_name}.`;
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action,
        module: "Clinic Management",
        description,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic updated successfully",
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error updating clinic",
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

      await createAuditLog({
        user_id: req.user.user_id,
        action: "ARCHIVE_CLINIC",
        module: "Clinic Management",
        description: `Archived clinic: ${archivedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic archived successfully",
        clinic: archivedClinic.rows[0],
      });
    } catch (err) {
      console.error("Archive clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error archiving clinic",
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

      await createAuditLog({
        user_id: req.user.user_id,
        action: "RESTORE_CLINIC",
        module: "Clinic Management",
        description: `Restored clinic: ${restoredClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic restored successfully",
        clinic: restoredClinic.rows[0],
      });
    } catch (err) {
      console.error("Restore clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error restoring clinic",
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

      await createAuditLog({
        user_id: req.user.user_id,
        action: "DELETE_CLINIC",
        module: "Clinic Management",
        description: `Deleted clinic permanently: ${deletedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic deleted permanently",
        clinic: deletedClinic.rows[0],
      });
    } catch (err) {
      console.error("Delete clinic error:", err.message);
      res.status(500).json({
        error: err.message || "Error deleting clinic",
      });
    }
  },
);

module.exports = router;
