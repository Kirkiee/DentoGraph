const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const { sendVerificationEmail } = require("../utils/emailSender");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const { verifyTurnstileMiddleware } = require("../utils/verifyTurnstile");

// ===============================
// PUBLIC: GET ACTIVE CLINICS FOR PATIENT REGISTRATION
// ===============================
router.get("/public/list", async (req, res) => {
  try {
    const clinics = await pool.query(
      `SELECT 
          clinic_id,
          clinic_name,
          address,
          contact_number,
          status
       FROM public.clinics
       WHERE status = 'Active'
       ORDER BY clinic_name ASC`,
    );

    res.status(200).json({
      message: "Public clinic list retrieved successfully.",
      clinics: clinics.rows,
    });
  } catch (err) {
    console.error("Get public clinic list error:", err.message);
    res.status(500).json({
      error: "Error retrieving public clinic list.",
    });
  }
});

// ===============================
// RATE LIMITERS
// ===============================

const clinicRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many clinic registration attempts. Please try again later.",
  },
});

// ===============================
// HELPER FUNCTIONS
// ===============================

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const cleanText = (value) => {
  return String(value || "").trim();
};

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
};

const validatePasswordStrength = (password) => {
  const value = String(password || "");

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must contain at least one special character.";
  }

  return null;
};

const getPasswordRules = () => {
  return [
    "At least 8 characters long.",
    "At least one uppercase letter.",
    "At least one lowercase letter.",
    "At least one number.",
    "At least one special character.",
  ];
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const getFrontendBaseUrl = () => {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
};

const generateEmailVerification = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expiresAt,
  };
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

const markExpiredSubscriptionIfNeeded = async (clinicId) => {
  const result = await pool.query(
    `UPDATE public.clinics
     SET subscription_status = 'Expired'
     WHERE clinic_id = $1
     AND subscription_end_date IS NOT NULL
     AND subscription_end_date < CURRENT_TIMESTAMP
     AND COALESCE(subscription_status, 'Active') <> 'Expired'
     RETURNING clinic_id, subscription_status`,
    [clinicId],
  );

  return result.rows[0] || null;
};

const getOwnerSubscriptionSource = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT
        c.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        c.subscription_start_date,
        c.subscription_end_date,
        COALESCE(c.subscription_status, 'Active') AS subscription_status,
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
     LEFT JOIN public.subscription_plans sp
       ON c.subscription_plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     AND COALESCE(c.status, 'Active') = 'Active'
     ORDER BY
       CASE WHEN c.subscription_plan_id IS NULL THEN 1 ELSE 0 END,
       c.created_at ASC NULLS LAST,
       c.clinic_id ASC
     LIMIT 1`,
    [ownerUserId],
  );

  return result.rows[0] || null;
};

const getOwnerLocations = async (client, ownerUserId) => {
  const result = await client.query(
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
        c.subscription_start_date,
        c.subscription_end_date,
        COALESCE(c.subscription_status, 'Active') AS subscription_status,
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
     ORDER BY c.created_at ASC NULLS LAST, c.clinic_id ASC`,
    [ownerUserId],
  );

  return result.rows;
};

const getOwnerLocationById = async (client, ownerUserId, clinicId) => {
  const result = await client.query(
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
        c.subscription_start_date,
        c.subscription_end_date,
        COALESCE(c.subscription_status, 'Active') AS subscription_status,
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
     AND c.clinic_id = $2
     LIMIT 1`,
    [ownerUserId, clinicId],
  );

  return result.rows[0] || null;
};

const getLocationUsage = async (client, clinicId) => {
  const dentistCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.dentists
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const assistantCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.assistants
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const patientCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.patients
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const fallbackPatientCount = await client.query(
    `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND COALESCE(dr.status, 'Active') = 'Active'`,
    [clinicId],
  );

  const recordCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND COALESCE(dr.status, 'Active') = 'Active'`,
    [clinicId],
  );

  const xrayCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [clinicId],
  );

  const storageUsage = await client.query(
    `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [clinicId],
  );

  const directPatients = Number(patientCount.rows[0].count || 0);
  const fallbackPatients = Number(fallbackPatientCount.rows[0].count || 0);
  const totalBytes = Number(storageUsage.rows[0].total_bytes || 0);
  const storageUsedMb = totalBytes / 1024 / 1024;

  return {
    dentists: dentistCount.rows[0].count,
    assistants: assistantCount.rows[0].count,
    patients: Math.max(directPatients, fallbackPatients),
    records: recordCount.rows[0].count,
    xrays: xrayCount.rows[0].count,
    storage_used_mb: Number(storageUsedMb.toFixed(2)),
    storage_used_bytes: totalBytes,
  };
};

const getOwnerAggregateUsage = async (client, ownerUserId) => {
  const locations = await getOwnerLocations(client, ownerUserId);

  const activeLocations = locations.filter((location) => {
    return String(location.status || "Active") === "Active";
  });

  const usageByLocation = [];
  const totalUsage = {
    dentists: 0,
    assistants: 0,
    patients: 0,
    records: 0,
    xrays: 0,
    storage_used_mb: 0,
    storage_used_bytes: 0,
  };

  for (const location of activeLocations) {
    const usage = await getLocationUsage(client, location.clinic_id);

    usageByLocation.push({
      clinic_id: location.clinic_id,
      clinic_name: location.clinic_name,
      usage,
    });

    totalUsage.dentists += Number(usage.dentists || 0);
    totalUsage.assistants += Number(usage.assistants || 0);
    totalUsage.patients += Number(usage.patients || 0);
    totalUsage.records += Number(usage.records || 0);
    totalUsage.xrays += Number(usage.xrays || 0);
    totalUsage.storage_used_bytes += Number(usage.storage_used_bytes || 0);
  }

  totalUsage.storage_used_mb = Number(
    (totalUsage.storage_used_bytes / 1024 / 1024).toFixed(2),
  );

  return {
    locations,
    usage_by_location: usageByLocation,
    usage: totalUsage,
  };
};

const syncOwnerLocationSubscriptions = async (
  client,
  ownerUserId,
  subscriptionSource,
) => {
  if (!subscriptionSource) return;

  await client.query(
    `UPDATE public.clinics
     SET subscription_plan_id = $1,
         subscription_start_date = $2,
         subscription_end_date = $3,
         subscription_status = $4
     WHERE owner_user_id = $5`,
    [
      subscriptionSource.subscription_plan_id || null,
      subscriptionSource.subscription_start_date || null,
      subscriptionSource.subscription_end_date || null,
      subscriptionSource.subscription_status || "Active",
      ownerUserId,
    ],
  );
};

// ===============================
// PUBLIC: REGISTER CLINIC OWNER + CLINIC WITH FREE PLAN
// ===============================

router.post(
  "/register",
  clinicRegisterLimiter,
  verifyTurnstileMiddleware,
  async (req, res) => {
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

    const cleanOwnerName = cleanText(owner_name);
    const cleanOwnerEmail = normalizeEmail(owner_email);
    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);
    const cleanServices = cleanText(services);
    const cleanContactNumber = cleanText(contact_number);
    const cleanOpeningHours = cleanText(opening_hours);
    const passwordError = validatePasswordStrength(password);

    if (
      !cleanOwnerName ||
      !cleanOwnerEmail ||
      !password ||
      !cleanClinicName ||
      !cleanAddress
    ) {
      return res.status(400).json({
        error:
          "Owner name, owner email, password, clinic name, and address are required.",
      });
    }

    if (!isValidEmail(cleanOwnerEmail)) {
      return res.status(400).json({
        error: "Please enter a valid owner email address.",
      });
    }

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
        password_rules: getPasswordRules(),
      });
    }

    if (!cleanServices) {
      return res.status(400).json({
        error: "Please enter at least one clinic service.",
      });
    }

    if (!cleanOpeningHours) {
      return res.status(400).json({
        error: "Opening hours are required.",
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
        [cleanOwnerEmail],
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
        [cleanClinicName, cleanAddress],
      );

      if (duplicateClinicCheck.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "A clinic with the same name and address already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const emailVerification = generateEmailVerification();

      const newOwner = await client.query(
        `INSERT INTO public.users
         (
           name,
           email,
           password,
           status,
           email_verified,
           email_verification_token,
           email_verification_expires
         )
         VALUES ($1, $2, $3, 'Active', $4, $5, $6)
         RETURNING user_id, name, email, status, email_verified, created_at`,
        [
          cleanOwnerName,
          cleanOwnerEmail,
          hashedPassword,
          false,
          emailVerification.hashedToken,
          emailVerification.expiresAt,
        ],
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
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanContactNumber),
          normalizeNullable(cleanOpeningHours),
          freePlan.plan_id,
          ownerUserId,
        ],
      );

      await client.query("COMMIT");

      const verificationUrl = `${getFrontendBaseUrl()}/verify-email/${emailVerification.rawToken}`;

      await sendVerificationEmail({
        to: cleanOwnerEmail,
        name: cleanOwnerName,
        verificationUrl,
      });

      await createAuditLog({
        user_id: ownerUserId,
        action: "REGISTER_CLINIC",
        module: "Clinic Registration",
        description: `Clinic owner ${cleanOwnerName} registered clinic ${cleanClinicName} with the Free plan.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message:
          "Clinic registered successfully. Your clinic has been assigned the Free plan by default. A verification email has been sent to the clinic owner email address. You may now log in.",
        owner: newOwner.rows[0],
        role: role.role_name,
        clinic: newClinic.rows[0],
        subscription_plan: freePlan,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Clinic registration error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A duplicate record already exists.",
        });
      }

      res.status(500).json({
        error: "Error registering clinic.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN / STAFF: GET ALL CLINICS
// ===============================

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

// ===============================
// PATIENT / ADMIN / DENTIST / ASSISTANT: CLINIC DISCOVERY LIST
// ===============================

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

// ===============================
// CLINIC OWNER: GET ALL OWN CLINIC LOCATIONS
// ===============================

router.get(
  "/owner/locations",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
        await syncOwnerLocationSubscriptions(
          client,
          req.user.user_id,
          subscriptionSource,
        );
      }

      const locations = await getOwnerLocations(client, req.user.user_id);

      res.status(200).json({
        message: "Clinic owner locations retrieved successfully.",
        shared_subscription: subscriptionSource,
        locations,
      });
    } catch (err) {
      console.error("Get clinic owner locations error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner locations.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET SINGLE OWN LOCATION
// ===============================

router.get(
  "/owner/locations/:clinic_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const client = await pool.connect();

    try {
      const location = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!location) {
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      res.status(200).json({
        message: "Clinic owner location retrieved successfully.",
        shared_subscription: subscriptionSource,
        location,
        clinic: location,
      });
    } catch (err) {
      console.error("Get clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: CREATE NEW LOCATION UNDER SAME SUBSCRIPTION
// ===============================

router.post(
  "/owner/locations",
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

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);
    const cleanServices = cleanText(services);
    const cleanContactNumber = cleanText(contact_number);
    const cleanOpeningHours = cleanText(opening_hours);

    if (!cleanClinicName || !cleanAddress) {
      return res.status(400).json({
        error: "Clinic location name and address are required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (!subscriptionSource) {
        const freePlan = await getFreePlan(client);

        if (!freePlan) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "No shared subscription was found and the Free plan is unavailable.",
          });
        }

        subscriptionSource = {
          subscription_plan_id: freePlan.plan_id,
          subscription_start_date: null,
          subscription_end_date: null,
          subscription_status: "Active",
          ...freePlan,
        };
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         LIMIT 1`,
        [cleanClinicName, cleanAddress],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "A clinic location with the same name and address already exists.",
        });
      }

      await syncOwnerLocationSubscriptions(
        client,
        req.user.user_id,
        subscriptionSource,
      );

      const newLocation = await client.query(
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
           subscription_start_date,
           subscription_end_date,
           subscription_status,
           owner_user_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Active', CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanContactNumber),
          normalizeNullable(cleanOpeningHours),
          subscriptionSource.subscription_plan_id || null,
          subscriptionSource.subscription_start_date || null,
          subscriptionSource.subscription_end_date || null,
          subscriptionSource.subscription_status || "Active",
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_CLINIC_LOCATION",
        module: "Clinic Owner Locations",
        description: `Clinic owner created location ${newLocation.rows[0].clinic_name} under the shared subscription.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      res.status(201).json({
        message:
          "Clinic location created successfully under the same clinic owner subscription.",
        shared_subscription: subscriptionSource,
        location: newLocation.rows[0],
        clinic: newLocation.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Create clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error creating clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN LOCATION
// ===============================

router.put(
  "/owner/locations/:clinic_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
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
      status,
    } = req.body || {};

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);

    if (!cleanClinicName || !cleanAddress) {
      return res.status(400).json({
        error: "Clinic location name and address are required.",
      });
    }

    const allowedStatuses = ["Active", "Inactive"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use Active or Inactive.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!existingLocation) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         AND clinic_id <> $3
         LIMIT 1`,
        [cleanClinicName, cleanAddress, clinic_id],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "Another clinic location with the same name and address already exists.",
        });
      }

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
        await syncOwnerLocationSubscriptions(
          client,
          req.user.user_id,
          subscriptionSource,
        );
      }

      const updatedLocation = await client.query(
        `UPDATE public.clinics
         SET clinic_name = $1,
             address = $2,
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7,
             status = COALESCE($8, status)
         WHERE clinic_id = $9
         AND owner_user_id = $10
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanText(services)),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanText(opening_hours)),
          normalizeNullable(status),
          clinic_id,
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_LOCATION",
        module: "Clinic Owner Locations",
        description: `Clinic owner updated location ${updatedLocation.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      res.status(200).json({
        message: "Clinic location updated successfully.",
        shared_subscription: subscriptionSource,
        location: updatedLocation.rows[0],
        clinic: updatedLocation.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Update clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error updating clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET SINGLE LOCATION USAGE
// ===============================

router.get(
  "/owner/locations/:clinic_id/usage",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const client = await pool.connect();

    try {
      const location = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!location) {
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const expiredSubscription =
        await markExpiredSubscriptionIfNeeded(clinic_id);

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      const usage = await getLocationUsage(client, clinic_id);

      res.status(200).json({
        message: "Clinic owner location usage retrieved successfully.",
        shared_subscription: subscriptionSource,
        location: expiredSubscription
          ? {
              ...location,
              subscription_status: expiredSubscription.subscription_status,
            }
          : location,
        clinic: expiredSubscription
          ? {
              ...location,
              subscription_status: expiredSubscription.subscription_status,
            }
          : location,
        usage,
      });
    } catch (err) {
      console.error("Get clinic owner location usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner location usage.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN CLINIC
// Backward compatible: returns first owned location and all locations.
// ===============================

router.get(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
        await syncOwnerLocationSubscriptions(
          client,
          req.user.user_id,
          subscriptionSource,
        );
      }

      const locations = await getOwnerLocations(client, req.user.user_id);

      if (locations.length === 0) {
        return res.status(404).json({
          error: "No clinic location is linked to this clinic owner account.",
        });
      }

      res.status(200).json({
        message: "Clinic owner clinic locations retrieved successfully.",
        clinic: locations[0],
        locations,
        shared_subscription: subscriptionSource,
      });
    } catch (err) {
      console.error("Get clinic owner clinic error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner clinic locations.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN CLINIC PROFILE
// Backward compatible: updates first owned location.
// ===============================

router.put(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const locations = await getOwnerLocations(client, req.user.user_id);

      if (locations.length === 0) {
        return res.status(404).json({
          error: "No clinic location is linked to this clinic owner account.",
        });
      }

      req.params.clinic_id = locations[0].clinic_id;

      const {
        clinic_name,
        address,
        latitude,
        longitude,
        services,
        contact_number,
        opening_hours,
      } = req.body || {};

      const cleanClinicName = cleanText(clinic_name);
      const cleanAddress = cleanText(address);

      if (!cleanClinicName || !cleanAddress) {
        return res.status(400).json({
          error: "Clinic name and address are required.",
        });
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         AND clinic_id <> $3
         LIMIT 1`,
        [cleanClinicName, cleanAddress, locations[0].clinic_id],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Another clinic location with the same name and address already exists.",
        });
      }

      const updatedClinic = await client.query(
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
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanText(services)),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanText(opening_hours)),
          locations[0].clinic_id,
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
        error: "Error updating clinic profile.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN SHARED SUBSCRIPTION USAGE
// Aggregates usage across all owned clinic locations.
// ===============================

router.get(
  "/owner/usage",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (!subscriptionSource) {
        return res.status(404).json({
          error:
            "No active clinic location is linked to this clinic owner account.",
        });
      }

      await markExpiredSubscriptionIfNeeded(subscriptionSource.clinic_id);
      await syncOwnerLocationSubscriptions(
        client,
        req.user.user_id,
        subscriptionSource,
      );

      const aggregate = await getOwnerAggregateUsage(client, req.user.user_id);

      res.status(200).json({
        message:
          "Clinic owner shared subscription usage retrieved successfully.",
        clinic: subscriptionSource,
        shared_subscription: subscriptionSource,
        locations: aggregate.locations,
        usage_by_location: aggregate.usage_by_location,
        usage: aggregate.usage,
      });
    } catch (err) {
      console.error("Get clinic owner usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner usage.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: MONITOR CLINIC SUBSCRIPTIONS
// ===============================

router.get(
  "/admin/subscriptions",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE public.clinics
         SET subscription_status = 'Expired'
         WHERE subscription_end_date IS NOT NULL
         AND subscription_end_date < CURRENT_TIMESTAMP
         AND COALESCE(subscription_status, 'Active') <> 'Expired'`,
      );

      const subscriptions = await pool.query(
        `SELECT
            c.clinic_id,
            c.clinic_name,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            c.subscription_plan_id,
            sp.plan_name,
            sp.plan_tier,
            sp.price,
            sp.billing_cycle,
            c.subscription_start_date,
            c.subscription_end_date,
            COALESCE(c.subscription_status, 'Active') AS subscription_status,
            CASE
              WHEN c.subscription_plan_id IS NULL THEN 'No Plan'
              WHEN c.subscription_end_date IS NULL THEN 'No End Date'
              WHEN c.subscription_end_date < CURRENT_TIMESTAMP THEN 'Expired'
              WHEN c.subscription_end_date <= CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 'Expiring Soon'
              ELSE COALESCE(c.subscription_status, 'Active')
            END AS monitoring_status,
            CASE
              WHEN c.subscription_end_date IS NULL THEN NULL
              ELSE CEIL(EXTRACT(EPOCH FROM (c.subscription_end_date - CURRENT_TIMESTAMP)) / 86400)::int
            END AS days_remaining,
            c.status AS clinic_status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.subscription_plans sp
           ON c.subscription_plan_id = sp.plan_id
         ORDER BY
           CASE
             WHEN c.subscription_plan_id IS NULL THEN 1
             WHEN c.subscription_end_date < CURRENT_TIMESTAMP THEN 2
             WHEN c.subscription_end_date <= CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 3
             ELSE 4
           END,
           c.subscription_end_date ASC NULLS LAST,
           c.clinic_name ASC`,
      );

      const rows = subscriptions.rows;

      res.status(200).json({
        message: "Clinic subscription monitoring retrieved successfully",
        subscriptions: rows,
        summary: {
          total: rows.length,
          active: rows.filter((item) => item.monitoring_status === "Active")
            .length,
          expiring_soon: rows.filter(
            (item) => item.monitoring_status === "Expiring Soon",
          ).length,
          expired: rows.filter((item) => item.monitoring_status === "Expired")
            .length,
          no_plan: rows.filter((item) => item.monitoring_status === "No Plan")
            .length,
        },
      });
    } catch (err) {
      console.error("Admin subscription monitoring error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic subscription monitoring",
      });
    }
  },
);

// ===============================
// ADMIN: GET CLINIC SUBSCRIPTION USAGE
// ===============================

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

// ===============================
// ADMIN / STAFF: GET SINGLE CLINIC
// ===============================

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

// ===============================
// ADMIN: CREATE CLINIC
// ===============================

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

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);

    if (!cleanClinicName || !cleanAddress) {
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
        [cleanClinicName, cleanAddress],
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
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanText(services)),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanText(opening_hours)),
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
        error: "Error creating clinic",
      });
    }
  },
);

// ===============================
// ADMIN: UPDATE CLINIC
// ===============================

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
          normalizeNullable(cleanText(clinic_name)),
          normalizeNullable(cleanText(address)),
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanText(services)),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanText(opening_hours)),
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
        error: "Error updating clinic",
      });
    }
  },
);

// ===============================
// ADMIN: ARCHIVE / DEACTIVATE CLINIC
// ===============================

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
        error: "Error archiving clinic",
      });
    }
  },
);

// ===============================
// ADMIN: RESTORE / ACTIVATE CLINIC
// ===============================

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
        error: "Error restoring clinic",
      });
    }
  },
);

// ===============================
// ADMIN: DELETE CLINIC PERMANENTLY
// ===============================

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
        error: "Error deleting clinic",
      });
    }
  },
);

module.exports = router;
