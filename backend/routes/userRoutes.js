const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/emailSender");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// ===============================
// STAFF CREDENTIAL DOCUMENT UPLOAD
// ===============================

const staffCredentialDirectory = path.join(
  __dirname,
  "..",
  "uploads",
  "staff-credentials",
);

fs.mkdirSync(staffCredentialDirectory, { recursive: true });

const credentialStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, staffCredentialDirectory);
  },
  filename: (req, file, cb) => {
    const safeExtension = path.extname(file.originalname || "").toLowerCase();
    const randomName = crypto.randomBytes(18).toString("hex");
    cb(null, `${Date.now()}-${randomName}${safeExtension}`);
  },
});

const credentialUpload = multer({
  storage: credentialStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error("Credential documents must be PDF, JPG, or PNG files."),
      );
    }

    cb(null, true);
  },
});

const deleteUploadedCredentialFiles = (files = []) => {
  Object.values(files || {})
    .flat()
    .forEach((file) => {
      if (file?.path) {
        fs.unlink(file.path, () => {});
      }
    });
};

// ===============================
// SECURITY LIMITERS
// ===============================

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many failed login attempts. Please try again after 15 minutes.",
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many forgot password attempts. Please try again later.",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many reset password attempts. Please try again later.",
  },
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many password change attempts. Please try again later.",
  },
});

// ===============================
// HELPER FUNCTIONS
// ===============================

const AUTH_ERROR_MESSAGE = "Invalid email or password.";

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const cleanText = (value) => {
  return String(value || "").trim();
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

const generatePasswordReset = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expiresAt,
  };
};

const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err && user) {
      req.user = user;
    }

    next();
  });
};

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const checkClinicSubscriptionLimit = async (
  client,
  clinic_id,
  limitType,
  excludeUserId = null,
) => {
  if (!clinic_id) {
    return {
      allowed: true,
      message: null,
    };
  }

  const clinicPlanResult = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.owner_user_id,
        os.plan_id AS subscription_plan_id,
        os.subscription_status,
        os.start_date AS subscription_start_date,
        os.end_date AS subscription_end_date,
        sp.plan_name,
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
     WHERE c.clinic_id = $1`,
    [clinic_id],
  );

  if (clinicPlanResult.rows.length === 0) {
    return {
      allowed: false,
      message: "Selected clinic location was not found.",
    };
  }

  const clinic = clinicPlanResult.rows[0];

  if (!clinic.owner_user_id) {
    return {
      allowed: false,
      message: "This clinic location is not linked to a Clinic Owner account.",
    };
  }

  if (!clinic.subscription_plan_id) {
    return {
      allowed: false,
      message:
        "This clinic owner has no shared subscription plan assigned. Please assign a plan before adding staff.",
    };
  }

  const isExpiredByDate =
    clinic.subscription_end_date &&
    new Date(clinic.subscription_end_date) < new Date();

  if (clinic.subscription_status !== "Active" || isExpiredByDate) {
    return {
      allowed: false,
      message:
        "The shared Clinic Owner subscription is inactive or expired. Renew the subscription before adding staff.",
    };
  }

  const sharedScopeValue = clinic.owner_user_id || clinic.clinic_id;
  const sharedScopeColumn = clinic.owner_user_id
    ? "c.owner_user_id = $1"
    : "c.clinic_id = $1";

  if (limitType === "Dentist") {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.dentists d
       JOIN public.clinics c ON d.clinic_id = c.clinic_id
       WHERE ${sharedScopeColumn}
       AND ($2::int IS NULL OR d.user_id <> $2)`,
      [sharedScopeValue, excludeUserId],
    );

    const currentCount = countResult.rows[0].count;
    const maxAllowed = clinic.max_dentists;

    if (maxAllowed !== null && currentCount >= maxAllowed) {
      return {
        allowed: false,
        message: `The shared ${clinic.plan_name} subscription for this clinic owner has reached the dentist limit. Limit: ${maxAllowed}.`,
      };
    }
  }

  if (limitType === "Assistant") {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.assistants a
       JOIN public.clinics c ON a.clinic_id = c.clinic_id
       WHERE ${sharedScopeColumn}
       AND ($2::int IS NULL OR a.user_id <> $2)`,
      [sharedScopeValue, excludeUserId],
    );

    const currentCount = countResult.rows[0].count;
    const maxAllowed = clinic.max_assistants;

    if (maxAllowed !== null && currentCount >= maxAllowed) {
      return {
        allowed: false,
        message: `The shared ${clinic.plan_name} subscription for this clinic owner has reached the assistant limit. Limit: ${maxAllowed}.`,
      };
    }
  }

  return {
    allowed: true,
    message: null,
  };
};

const getClinicsOwnedByUser = async (client, ownerUserId) => {
  const clinicResult = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.address,
        os.plan_id AS subscription_plan_id,
        os.end_date AS subscription_end_date,
        os.subscription_status,
        c.owner_user_id,
        c.status,
        sp.plan_name,
        sp.max_dentists,
        sp.max_assistants
     FROM public.clinics c
     LEFT JOIN public.owner_subscriptions os
       ON os.owner_user_id = c.owner_user_id
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     AND c.status = 'Active'
     ORDER BY c.clinic_name ASC`,
    [ownerUserId],
  );

  return clinicResult.rows;
};

const getClinicOwnedByUser = async (client, ownerUserId, clinicId = null) => {
  const params = [ownerUserId];
  let clinicFilter = "";

  if (clinicId) {
    params.push(clinicId);
    clinicFilter = "AND c.clinic_id = $2";
  }

  const clinicResult = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.address,
        os.plan_id AS subscription_plan_id,
        os.end_date AS subscription_end_date,
        os.subscription_status,
        c.owner_user_id,
        c.status,
        sp.plan_name,
        sp.max_dentists,
        sp.max_assistants
     FROM public.clinics c
     LEFT JOIN public.owner_subscriptions os
       ON os.owner_user_id = c.owner_user_id
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     AND c.status = 'Active'
     ${clinicFilter}
     ORDER BY c.clinic_name ASC
     LIMIT 1`,
    params,
  );

  return clinicResult.rows[0] || null;
};

const getStaffRoleByName = async (client, requestedRole) => {
  const normalizedRole = String(requestedRole || "").trim();

  if (normalizedRole === "Dentist") {
    const result = await client.query(
      `SELECT role_id, role_name
       FROM public.roles
       WHERE role_name = 'Dentist'
       LIMIT 1`,
    );

    return result.rows[0] || null;
  }

  if (normalizedRole === "Assistant" || normalizedRole === "Dental Assistant") {
    const result = await client.query(
      `SELECT role_id, role_name
       FROM public.roles
       WHERE role_name IN ('Assistant', 'Dental Assistant')
       ORDER BY 
         CASE 
           WHEN role_name = 'Assistant' THEN 1
           WHEN role_name = 'Dental Assistant' THEN 2
           ELSE 3
         END
       LIMIT 1`,
    );

    return result.rows[0] || null;
  }

  return null;
};

// ===============================
// PASSWORD RULES
// ===============================

router.get("/password-rules", (req, res) => {
  res.status(200).json({
    message: "Password rules retrieved successfully.",
    rules: getPasswordRules(),
  });
});

// ===============================
// GET ALL ROLES
// ===============================

router.get("/roles", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.roles ORDER BY role_id",
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Roles error:", err.message);
    res.status(500).json({ error: "Error fetching roles" });
  }
});

// ===============================
// REGISTER USER WITH ROLE + CREATE ROLE PROFILE
// ===============================

router.post(
  "/register",
  registerLimiter,
  optionalAuthenticateToken,
  async (req, res) => {
    const {
      name,
      email,
      password,
      role_id,
      license_number,
      specialization,
      availability,
      clinic_id,
    } = req.body || {};

    const cleanName = cleanText(name);
    const cleanEmail = normalizeEmail(email);
    const passwordError = validatePasswordStrength(password);

    if (!cleanName || !cleanEmail || !password || !role_id) {
      return res.status(400).json({
        error: "Name, email, password, and role_id are required.",
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
        password_rules: getPasswordRules(),
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const roleCheck = await client.query(
        "SELECT role_id, role_name FROM public.roles WHERE role_id = $1",
        [role_id],
      );

      if (roleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid role_id" });
      }

      const roleName = roleCheck.rows[0].role_name;
      const normalizedClinicId = normalizeNullable(clinic_id);

      const allowedRoles = [
        "Admin",
        "Clinic Owner",
        "Dentist",
        "Patient",
        "Assistant",
        "Dental Assistant",
      ];

      if (!allowedRoles.includes(roleName)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Invalid role.",
        });
      }

      if (!req.user && roleName !== "Patient") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Public registration is only allowed for patient accounts.",
        });
      }

      if (req.user && req.user.role !== "Admin" && roleName !== "Patient") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "You are not allowed to create this type of account.",
        });
      }

      const emailCheck = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cleanEmail],
      );

      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Email already exists.",
        });
      }

      if (roleName === "Dentist" && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Dentist",
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      if (isAssistantRole(roleName) && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Assistant",
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const emailVerification = generateEmailVerification();

      const newUser = await client.query(
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
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id, name, email, status, email_verified, created_at`,
        [
          cleanName,
          cleanEmail,
          hashedPassword,
          "Active",
          false,
          emailVerification.hashedToken,
          emailVerification.expiresAt,
        ],
      );

      const userId = newUser.rows[0].user_id;

      await client.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [userId, role_id],
      );

      if (roleName === "Dentist") {
        await client.query(
          `INSERT INTO public.dentists
           (user_id, license_number, specialization, availability, status, clinic_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            license_number || `DEN-${userId}`,
            specialization || "General Dentistry",
            availability || "Monday to Friday, 9:00 AM - 5:00 PM",
            "Active",
            normalizedClinicId,
          ],
        );
      }

      if (isAssistantRole(roleName)) {
        await client.query(
          `INSERT INTO public.assistants
           (user_id, license_number, availability, status, clinic_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            license_number || `AST-${userId}`,
            availability || "Monday to Friday, 9:00 AM - 5:00 PM",
            "Active",
            normalizedClinicId,
          ],
        );
      }

      if (roleName === "Patient") {
        if (!normalizedClinicId) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Please select the clinic you are registering under.",
          });
        }

        const clinicCheck = await client.query(
          `SELECT clinic_id, clinic_name, status
           FROM public.clinics
           WHERE clinic_id = $1
           LIMIT 1`,
          [normalizedClinicId],
        );

        if (clinicCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Selected clinic was not found.",
          });
        }

        if (clinicCheck.rows[0].status !== "Active") {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Selected clinic is not currently active.",
          });
        }

        await client.query(
          `INSERT INTO public.patients (user_id, clinic_id)
           VALUES ($1, $2)`,
          [userId, normalizedClinicId],
        );
      }

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user?.user_id || null,
        action: "CREATE_USER",
        module: "User Management",
        description: `Created user account for ${newUser.rows[0].name} as ${roleName}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message:
          "User registered successfully. Please check your email to verify your account.",
        user: newUser.rows[0],
        role: roleName,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Registration error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({ error: "Email already exists" });
      }

      res.status(500).json({ error: "Error registering user" });
    } finally {
      client.release();
    }
  },
);

// ===============================
// LOGIN USER WITH ROLE
// NOTE: Login blocks unverified accounts.
// ===============================

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password) {
    return res.status(400).json({
      error: "Email and password are required.",
    });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      error: AUTH_ERROR_MESSAGE,
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT 
          u.user_id,
          u.name,
          u.email,
          u.password,
          u.status,
          COALESCE(u.email_verified, false) AS email_verified,
          r.role_id,
          r.role_name,
          sc.credential_id,
          sc.verification_status AS credential_verification_status,
          c.clinic_id AS owned_clinic_id,
          c.clinic_name AS owned_clinic_name,
          c.status AS owned_clinic_status,
          cva.verification_status AS clinic_application_status
       FROM public.users u
       JOIN public.user_roles ur ON u.user_id = ur.user_id
       JOIN public.roles r ON ur.role_id = r.role_id
       LEFT JOIN public.staff_credentials sc ON u.user_id = sc.user_id
       LEFT JOIN public.clinics c
         ON c.owner_user_id = u.user_id
       LEFT JOIN public.clinic_verification_applications cva
         ON cva.clinic_id = c.clinic_id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: AUTH_ERROR_MESSAGE });
    }

    const user = userResult.rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: AUTH_ERROR_MESSAGE });
    }

    if (
      ["Dentist", "Assistant", "Dental Assistant"].includes(user.role_name) &&
      user.credential_verification_status &&
      user.credential_verification_status !== "Approved"
    ) {
      const currentStatus = user.credential_verification_status;

      return res.status(403).json({
        error:
          currentStatus === "Rejected"
            ? "Your professional credentials were rejected. Please contact your clinic owner."
            : "Your professional credentials are still pending administrator approval.",
        credential_verification_required: true,
        credential_verification_status: currentStatus,
      });
    }

    if (user.status === "Inactive") {
      if (
        user.role_name === "Clinic Owner" &&
        user.clinic_application_status === "Pending"
      ) {
        return res.status(403).json({
          error:
            "Your clinic application is still pending Administrator review. You will be able to sign in after the clinic is approved.",
          clinic_application_pending: true,
          clinic_application_status: "Pending",
          clinic_name: user.owned_clinic_name || null,
        });
      }

      return res.status(403).json({
        error: "This account is inactive. Please contact the administrator.",
      });
    }

    const isStaffRole = ["Dentist", "Assistant", "Dental Assistant"].includes(
      user.role_name,
    );

    const isLegacyStaffAccount = isStaffRole && !user.credential_id;

    if (!user.email_verified && !isLegacyStaffAccount) {
      return res.status(403).json({
        error:
          "Your email address is not verified. Please verify your email before logging in.",
        email_unverified: true,
      });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role_name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: rememberMe ? "7d" : "2h",
      },
    );

    await createAuditLog({
      user_id: user.user_id,
      action: "LOGIN",
      module: "Authentication",
      description: `${user.name} logged in as ${user.role_name}.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        status: user.status,
        email_verified: user.email_verified,
        role_id: user.role_id,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({
      error: "Server error during login. Please try again later.",
    });
  }
});

// ===============================
// VERIFY EMAIL
// ===============================

router.get("/verify-email/:token", async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      error: "Verification token is required.",
    });
  }

  try {
    const hashedToken = hashToken(token);

    const userResult = await pool.query(
      `SELECT user_id, name, email, COALESCE(email_verified, false) AS email_verified
       FROM public.users
       WHERE email_verification_token = $1
       AND email_verification_expires > CURRENT_TIMESTAMP
       LIMIT 1`,
      [hashedToken],
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: "Email verification link is invalid or expired.",
      });
    }

    const user = userResult.rows[0];

    await pool.query(
      `UPDATE public.users
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE user_id = $1`,
      [user.user_id],
    );

    await createAuditLog({
      user_id: user.user_id,
      action: "VERIFY_EMAIL",
      module: "Authentication",
      description: `${user.name} verified their email address.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message:
        "Email verified successfully. You may continue using your account.",
    });
  } catch (err) {
    console.error("Verify email error:", err.message);
    res.status(500).json({
      error: "Unable to verify email.",
    });
  }
});

// ===============================
// RESEND EMAIL VERIFICATION
// ===============================

router.post("/resend-verification", registerLimiter, async (req, res) => {
  const { email } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return res.status(400).json({
      error: "Email is required.",
    });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address.",
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT user_id, name, email, status, COALESCE(email_verified, false) AS email_verified
       FROM public.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail],
    );

    const genericMessage =
      "If the email exists and is not yet verified, a verification email has been sent.";

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        message: genericMessage,
      });
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.status(200).json({
        message: "This email address is already verified.",
      });
    }

    if (user.status === "Inactive") {
      return res.status(200).json({
        message: genericMessage,
      });
    }

    const emailVerification = generateEmailVerification();

    await pool.query(
      `UPDATE public.users
       SET email_verification_token = $1,
           email_verification_expires = $2
       WHERE user_id = $3`,
      [
        emailVerification.hashedToken,
        emailVerification.expiresAt,
        user.user_id,
      ],
    );

    const verificationUrl = `${getFrontendBaseUrl()}/verify-email/${emailVerification.rawToken}`;

    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
    });

    await createAuditLog({
      user_id: user.user_id,
      action: "RESEND_EMAIL_VERIFICATION",
      module: "Authentication",
      description: `${user.name} requested a new email verification link.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message: genericMessage,
    });
  } catch (err) {
    console.error("Resend verification error:", err.message);
    res.status(500).json({
      error: "Unable to resend verification email.",
    });
  }
});

// ===============================
// FORGOT PASSWORD
// ===============================

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    return res.status(400).json({
      error: "Email is required.",
    });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address.",
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT user_id, name, email, status
       FROM public.users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail],
    );

    const genericMessage =
      "If an account with that email exists, a password reset email has been sent.";

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        message: genericMessage,
      });
    }

    const user = userResult.rows[0];

    if (user.status === "Inactive") {
      return res.status(200).json({
        message: genericMessage,
      });
    }

    const passwordReset = generatePasswordReset();

    await pool.query(
      `UPDATE public.users
       SET password_reset_token = $1,
           password_reset_expires = $2
       WHERE user_id = $3`,
      [passwordReset.hashedToken, passwordReset.expiresAt, user.user_id],
    );

    const resetUrl = `${getFrontendBaseUrl()}/reset-password/${passwordReset.rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    await createAuditLog({
      user_id: user.user_id,
      action: "FORGOT_PASSWORD_REQUEST",
      module: "Authentication",
      description: `${user.name} requested a password reset link.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message: genericMessage,
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({
      error: "Unable to process forgot password request.",
    });
  }
});

// ===============================
// RESET PASSWORD
// ===============================

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const { token, new_password, confirm_password } = req.body || {};

  if (!token || !new_password || !confirm_password) {
    return res.status(400).json({
      error: "Reset token, new password, and confirm password are required.",
    });
  }

  if (new_password !== confirm_password) {
    return res.status(400).json({
      error: "New password and confirm password do not match.",
    });
  }

  const passwordError = validatePasswordStrength(new_password);

  if (passwordError) {
    return res.status(400).json({
      error: passwordError,
      password_rules: getPasswordRules(),
    });
  }

  try {
    const hashedToken = hashToken(token);

    const userResult = await pool.query(
      `SELECT user_id, name, email, status
       FROM public.users
       WHERE password_reset_token = $1
       AND password_reset_expires > CURRENT_TIMESTAMP
       LIMIT 1`,
      [hashedToken],
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: "Password reset link is invalid or expired.",
      });
    }

    const user = userResult.rows[0];

    if (user.status === "Inactive") {
      return res.status(403).json({
        error: "This account is inactive. Please contact the administrator.",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);

    await pool.query(
      `UPDATE public.users
       SET password = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE user_id = $2`,
      [hashedPassword, user.user_id],
    );

    await createAuditLog({
      user_id: user.user_id,
      action: "RESET_PASSWORD",
      module: "Authentication",
      description: `${user.name} reset their password using a reset link.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message: "Password reset successfully. You may now log in.",
    });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({
      error: "Unable to reset password.",
    });
  }
});

// ===============================
// CHANGE PASSWORD
// ===============================

router.put(
  "/change-password",
  changePasswordLimiter,
  authenticateToken,
  async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body || {};

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        error:
          "Current password, new password, and confirm password are required.",
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        error: "New password and confirm password do not match.",
      });
    }

    if (current_password === new_password) {
      return res.status(400).json({
        error: "New password must be different from your current password.",
      });
    }

    const passwordError = validatePasswordStrength(new_password);

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
        password_rules: getPasswordRules(),
      });
    }

    try {
      const userResult = await pool.query(
        `SELECT user_id, name, email, password, status
         FROM public.users
         WHERE user_id = $1
         LIMIT 1`,
        [req.user.user_id],
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "User account not found.",
        });
      }

      const user = userResult.rows[0];

      if (user.status === "Inactive") {
        return res.status(403).json({
          error: "This account is inactive. Please contact the administrator.",
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        current_password,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: "Current password is incorrect.",
        });
      }

      const hashedPassword = await bcrypt.hash(new_password, 12);

      await pool.query(
        `UPDATE public.users
         SET password = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL
         WHERE user_id = $2`,
        [hashedPassword, user.user_id],
      );

      await createAuditLog({
        user_id: user.user_id,
        action: "CHANGE_PASSWORD",
        module: "Authentication",
        description: `${user.name} changed their password from profile settings.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Password changed successfully.",
      });
    } catch (err) {
      console.error("Change password error:", err.message);
      res.status(500).json({
        error: "Unable to change password.",
      });
    }
  },
);

// ===============================
// ADMIN: GET ALL USERS
// ===============================

router.get(
  "/admin/users",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const users = await pool.query(
        `WITH owner_profiles AS (
           SELECT
             c.owner_user_id,
             STRING_AGG(DISTINCT c.clinic_name, ', ' ORDER BY c.clinic_name) AS owner_clinic_name,
             COUNT(*)::int AS owner_clinic_count,
             COUNT(*) FILTER (WHERE COALESCE(c.status, 'Active') = 'Active')::int AS owner_active_clinic_count
           FROM public.clinics c
           WHERE c.owner_user_id IS NOT NULL
           GROUP BY c.owner_user_id
         )
         SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            COALESCE(u.email_verified, false) AS email_verified,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name,

            p.patient_id,
            p.clinic_id AS patient_clinic_id,
            pc.clinic_name AS patient_clinic_name,

            op.owner_clinic_name,
            op.owner_clinic_count,
            op.owner_active_clinic_count,

            COALESCE(
              dc_owner.user_id,
              ac_owner.user_id,
              pc_owner.user_id,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.user_id END
            ) AS owner_user_id,

            COALESCE(
              dc_owner.name,
              ac_owner.name,
              pc_owner.name,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.name END
            ) AS owner_name,

            COALESCE(
              dc_owner.email,
              ac_owner.email,
              pc_owner.email,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.email END
            ) AS owner_email

         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id
         LEFT JOIN public.users dc_owner ON dc.owner_user_id = dc_owner.user_id

         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id
         LEFT JOIN public.users ac_owner ON ac.owner_user_id = ac_owner.user_id

         LEFT JOIN public.patients p ON u.user_id = p.user_id
         LEFT JOIN public.clinics pc ON p.clinic_id = pc.clinic_id
         LEFT JOIN public.users pc_owner ON pc.owner_user_id = pc_owner.user_id

         LEFT JOIN owner_profiles op ON u.user_id = op.owner_user_id

         ORDER BY u.user_id DESC`,
      );

      res.status(200).json({
        message: "Users retrieved successfully",
        users: users.rows,
      });
    } catch (err) {
      console.error("Get users error:", err.message);
      res.status(500).json({ error: "Error retrieving users" });
    }
  },
);

// ===============================
// ADMIN: GET SINGLE USER
// ===============================

router.get(
  "/admin/users/:user_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;

    try {
      const user = await pool.query(
        `WITH owner_profiles AS (
           SELECT
             c.owner_user_id,
             STRING_AGG(DISTINCT c.clinic_name, ', ' ORDER BY c.clinic_name) AS owner_clinic_name,
             COUNT(*)::int AS owner_clinic_count,
             COUNT(*) FILTER (WHERE COALESCE(c.status, 'Active') = 'Active')::int AS owner_active_clinic_count
           FROM public.clinics c
           WHERE c.owner_user_id IS NOT NULL
           GROUP BY c.owner_user_id
         )
         SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            COALESCE(u.email_verified, false) AS email_verified,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name,

            p.patient_id,
            p.clinic_id AS patient_clinic_id,
            pc.clinic_name AS patient_clinic_name,

            op.owner_clinic_name,
            op.owner_clinic_count,
            op.owner_active_clinic_count,

            COALESCE(
              dc_owner.user_id,
              ac_owner.user_id,
              pc_owner.user_id,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.user_id END
            ) AS owner_user_id,

            COALESCE(
              dc_owner.name,
              ac_owner.name,
              pc_owner.name,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.name END
            ) AS owner_name,

            COALESCE(
              dc_owner.email,
              ac_owner.email,
              pc_owner.email,
              CASE WHEN r.role_name = 'Clinic Owner' THEN u.email END
            ) AS owner_email

         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id
         LEFT JOIN public.users dc_owner ON dc.owner_user_id = dc_owner.user_id

         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id
         LEFT JOIN public.users ac_owner ON ac.owner_user_id = ac_owner.user_id

         LEFT JOIN public.patients p ON u.user_id = p.user_id
         LEFT JOIN public.clinics pc ON p.clinic_id = pc.clinic_id
         LEFT JOIN public.users pc_owner ON pc.owner_user_id = pc_owner.user_id

         LEFT JOIN owner_profiles op ON u.user_id = op.owner_user_id

         WHERE u.user_id = $1`,
        [user_id],
      );

      if (user.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        message: "User retrieved successfully",
        user: user.rows[0],
      });
    } catch (err) {
      console.error("Get single user error:", err.message);
      res.status(500).json({ error: "Error retrieving user" });
    }
  },
);

// ===============================
// ADMIN: UPDATE USER STATUS
// ===============================

router.put(
  "/admin/users/:user_id/status",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;
    const { status } = req.body || {};

    const allowedStatuses = ["Active", "Inactive"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required. Use Active or Inactive.",
      });
    }

    try {
      if (Number(user_id) === Number(req.user.user_id)) {
        return res.status(400).json({
          error: "You cannot change your own account status.",
        });
      }

      const updatedUser = await pool.query(
        `UPDATE public.users
         SET status = $1
         WHERE user_id = $2
         RETURNING user_id, name, email, status, created_at`,
        [status, user_id],
      );

      if (updatedUser.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_USER_STATUS",
        module: "User Management",
        description: `Updated user ${updatedUser.rows[0].name} status to ${status}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `User status updated to ${status}`,
        user: updatedUser.rows[0],
      });
    } catch (err) {
      console.error("Update user status error:", err.message);
      res.status(500).json({ error: "Error updating user status" });
    }
  },
);

// ===============================
// ADMIN: UPDATE USER ROLE + ENSURE ROLE PROFILE EXISTS
// ===============================

router.put(
  "/admin/users/:user_id/role",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;

    const { role_id, license_number, specialization, availability, clinic_id } =
      req.body || {};

    if (!role_id) {
      return res.status(400).json({ error: "role_id is required" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const roleCheck = await client.query(
        "SELECT role_id, role_name FROM public.roles WHERE role_id = $1",
        [role_id],
      );

      if (roleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid role_id" });
      }

      const newRole = roleCheck.rows[0];
      const normalizedClinicId = normalizeNullable(clinic_id);

      if (Number(user_id) === Number(req.user.user_id)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "You cannot change your own role.",
        });
      }

      const userCheck = await client.query(
        "SELECT user_id, name, email FROM public.users WHERE user_id = $1",
        [user_id],
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      if (newRole.role_name === "Dentist" && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Dentist",
          user_id,
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      if (isAssistantRole(newRole.role_name) && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Assistant",
          user_id,
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      const existingRole = await client.query(
        "SELECT * FROM public.user_roles WHERE user_id = $1",
        [user_id],
      );

      if (existingRole.rows.length === 0) {
        await client.query(
          `INSERT INTO public.user_roles (user_id, role_id)
           VALUES ($1, $2)`,
          [user_id, role_id],
        );
      } else {
        await client.query(
          `UPDATE public.user_roles
           SET role_id = $1
           WHERE user_id = $2`,
          [role_id, user_id],
        );
      }

      if (newRole.role_name === "Dentist") {
        const dentistCheck = await client.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [user_id],
        );

        if (dentistCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.dentists
             (user_id, license_number, specialization, availability, status, clinic_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user_id,
              license_number || `DEN-${user_id}`,
              specialization || "General Dentistry",
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
              normalizedClinicId,
            ],
          );
        } else {
          await client.query(
            `UPDATE public.dentists
             SET license_number = COALESCE($1, license_number),
                 specialization = COALESCE($2, specialization),
                 availability = COALESCE($3, availability),
                 clinic_id = $4
             WHERE user_id = $5`,
            [
              normalizeNullable(license_number),
              normalizeNullable(specialization),
              normalizeNullable(availability),
              normalizedClinicId,
              user_id,
            ],
          );
        }
      }

      if (isAssistantRole(newRole.role_name)) {
        const assistantCheck = await client.query(
          "SELECT assistant_id FROM public.assistants WHERE user_id = $1",
          [user_id],
        );

        if (assistantCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.assistants
             (user_id, license_number, availability, status, clinic_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user_id,
              license_number || `AST-${user_id}`,
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
              normalizedClinicId,
            ],
          );
        } else {
          await client.query(
            `UPDATE public.assistants
             SET license_number = COALESCE($1, license_number),
                 availability = COALESCE($2, availability),
                 clinic_id = $3
             WHERE user_id = $4`,
            [
              normalizeNullable(license_number),
              normalizeNullable(availability),
              normalizedClinicId,
              user_id,
            ],
          );
        }
      }

      if (newRole.role_name === "Patient") {
        if (!normalizedClinicId) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Please select a clinic before assigning the Patient role.",
          });
        }

        const clinicCheck = await client.query(
          `SELECT clinic_id, clinic_name, status
           FROM public.clinics
           WHERE clinic_id = $1
           LIMIT 1`,
          [normalizedClinicId],
        );

        if (clinicCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Selected clinic was not found.",
          });
        }

        if (clinicCheck.rows[0].status !== "Active") {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Selected clinic is not currently active.",
          });
        }

        const patientCheck = await client.query(
          "SELECT patient_id FROM public.patients WHERE user_id = $1",
          [user_id],
        );

        if (patientCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.patients (user_id, clinic_id)
             VALUES ($1, $2)`,
            [user_id, normalizedClinicId],
          );
        } else {
          await client.query(
            `UPDATE public.patients
             SET clinic_id = $1
             WHERE user_id = $2`,
            [normalizedClinicId, user_id],
          );
        }
      }

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_ROLE",
        module: "User Management",
        description: `Updated user ${userCheck.rows[0].name} to role ${newRole.role_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `User role updated to ${newRole.role_name}`,
        user: userCheck.rows[0],
        role: newRole,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Update user role error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A profile record for this user already exists.",
        });
      }

      res.status(500).json({ error: "Error updating user role" });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN STAFF
// Supports multiple clinic locations. If clinic_id is provided,
// only staff from that clinic location will be returned.
// Otherwise, staff from all active locations owned by the clinic owner is returned.
// ===============================

router.get(
  "/clinic-owner/staff",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.query || {};

    try {
      const ownedClinics = await getClinicsOwnedByUser(pool, req.user.user_id);

      if (ownedClinics.length === 0) {
        return res.status(404).json({
          error:
            "No active clinic locations are linked to this clinic owner account.",
        });
      }

      let selectedClinic = null;
      let clinicIds = ownedClinics.map((clinic) => Number(clinic.clinic_id));

      if (clinic_id) {
        selectedClinic = ownedClinics.find(
          (clinic) => Number(clinic.clinic_id) === Number(clinic_id),
        );

        if (!selectedClinic) {
          return res.status(403).json({
            error: "Selected clinic location does not belong to your account.",
          });
        }

        clinicIds = [Number(selectedClinic.clinic_id)];
      }

      const staff = await pool.query(
        `SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            COALESCE(u.email_verified, false) AS email_verified,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name,

            COALESCE(d.clinic_id, a.clinic_id) AS clinic_id,
            COALESCE(dc.clinic_name, ac.clinic_name) AS clinic_name,

            sc.credential_id,
            sc.credential_number,
            sc.license_expiration_date,
            sc.qualification_name,
            sc.qualification_expiration_date,
            sc.verification_status,
            sc.rejection_reason,
            sc.submitted_at,
            sc.reviewed_at

         FROM public.users u
         JOIN public.user_roles ur ON u.user_id = ur.user_id
         JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id
         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id
         LEFT JOIN public.staff_credentials sc ON u.user_id = sc.user_id

         WHERE 
           (
             d.clinic_id = ANY($1::int[])
             OR a.clinic_id = ANY($1::int[])
           )
         AND r.role_name IN ('Dentist', 'Assistant', 'Dental Assistant')
         ORDER BY COALESCE(dc.clinic_name, ac.clinic_name) ASC, u.created_at DESC`,
        [clinicIds],
      );

      res.status(200).json({
        message: "Clinic staff retrieved successfully",
        clinics: ownedClinics,
        clinic: selectedClinic || ownedClinics[0],
        selected_clinic: selectedClinic,
        staff: staff.rows,
      });
    } catch (err) {
      console.error("Get clinic owner staff error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic staff",
      });
    }
  },
);

// ===============================
// CLINIC OWNER: CREATE OWN STAFF
// Requires clinic_id so staff are assigned to a specific clinic location.
// The subscription limit is checked against the clinic owner's shared subscription.
// ===============================

router.post(
  "/clinic-owner/staff",
  registerLimiter,
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  credentialUpload.fields([
    { name: "primary_credential_document", maxCount: 1 },
    { name: "government_id_document", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      name,
      email,
      password,
      staff_role,
      license_number,
      specialization,
      availability,
      clinic_id,
      license_expiration_date,
      qualification_name,
      qualification_expiration_date,
      credential_number,
    } = req.body || {};

    const cleanName = cleanText(name);
    const cleanEmail = normalizeEmail(email);
    const passwordError = validatePasswordStrength(password);
    const normalizedClinicId = Number(clinic_id);
    const normalizedRole =
      staff_role === "Dental Assistant" ? "Assistant" : staff_role;

    const primaryCredential =
      req.files?.primary_credential_document?.[0] || null;
    const governmentId = req.files?.government_id_document?.[0] || null;

    const failUpload = (status, error, extra = {}) => {
      deleteUploadedCredentialFiles(req.files);
      return res.status(status).json({ error, ...extra });
    };

    if (
      !cleanName ||
      !cleanEmail ||
      !password ||
      !normalizedRole ||
      !clinic_id
    ) {
      return failUpload(
        400,
        "Name, email, password, staff role, and clinic location are required.",
      );
    }

    if (!Number.isInteger(normalizedClinicId) || normalizedClinicId <= 0) {
      return failUpload(400, "Please select a valid clinic location.");
    }

    if (!isValidEmail(cleanEmail)) {
      return failUpload(400, "Please enter a valid email address.");
    }

    if (passwordError) {
      return failUpload(400, passwordError, {
        password_rules: getPasswordRules(),
      });
    }

    if (!primaryCredential || !governmentId) {
      return failUpload(
        400,
        "A professional credential document and a valid government ID are required.",
      );
    }

    if (normalizedRole === "Dentist") {
      if (
        !cleanText(license_number) ||
        !cleanText(license_expiration_date) ||
        !cleanText(specialization)
      ) {
        return failUpload(
          400,
          "Dentists must provide a PRC license number, license expiration date, and specialization.",
        );
      }
    } else if (
      !cleanText(credential_number) ||
      !cleanText(qualification_name)
    ) {
      return failUpload(
        400,
        "Dental assistants must provide a credential or certificate number and qualification name.",
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clinic = await getClinicOwnedByUser(
        client,
        req.user.user_id,
        normalizedClinicId,
      );

      if (!clinic) {
        await client.query("ROLLBACK");
        return failUpload(
          403,
          "Selected clinic location does not belong to your account.",
        );
      }

      if (clinic.status !== "Active") {
        await client.query("ROLLBACK");
        return failUpload(
          403,
          "Staff cannot be added to an inactive clinic location. Activate the location first.",
        );
      }

      const role = await getStaffRoleByName(client, normalizedRole);

      if (!role) {
        await client.query("ROLLBACK");
        return failUpload(400, "Invalid staff role. Use Dentist or Assistant.");
      }

      const emailCheck = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cleanEmail],
      );

      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return failUpload(
          400,
          "Email already exists. Please use another email address.",
        );
      }

      const limitType = role.role_name === "Dentist" ? "Dentist" : "Assistant";
      const limitCheck = await checkClinicSubscriptionLimit(
        client,
        clinic.clinic_id,
        limitType,
      );

      if (!limitCheck.allowed) {
        await client.query("ROLLBACK");
        return failUpload(400, limitCheck.message);
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await client.query(
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
         VALUES ($1, $2, $3, 'Inactive', TRUE, NULL, NULL)
         RETURNING user_id, name, email, status, email_verified, created_at`,
        [cleanName, cleanEmail, hashedPassword],
      );

      const newUserId = newUser.rows[0].user_id;

      await client.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [newUserId, role.role_id],
      );

      if (role.role_name === "Dentist") {
        await client.query(
          `INSERT INTO public.dentists
           (
             user_id,
             license_number,
             specialization,
             availability,
             status,
             clinic_id
           )
           VALUES ($1, $2, $3, $4, 'Inactive', $5)`,
          [
            newUserId,
            cleanText(license_number),
            cleanText(specialization),
            cleanText(availability) || "Monday to Friday, 9:00 AM - 5:00 PM",
            clinic.clinic_id,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO public.assistants
           (
             user_id,
             license_number,
             availability,
             status,
             clinic_id
           )
           VALUES ($1, $2, $3, 'Inactive', $4)`,
          [
            newUserId,
            cleanText(credential_number),
            cleanText(availability) || "Monday to Friday, 9:00 AM - 5:00 PM",
            clinic.clinic_id,
          ],
        );
      }

      const insertedCredential = await client.query(
        `INSERT INTO public.staff_credentials
         (
           user_id,
           clinic_id,
           staff_role,
           credential_number,
           license_expiration_date,
           qualification_name,
           qualification_expiration_date,
           primary_document_path,
           primary_document_original_name,
           primary_document_mime_type,
           government_id_path,
           government_id_original_name,
           government_id_mime_type,
           verification_status,
           submitted_by_user_id,
           submitted_at
         )
         VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Pending', $14, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          newUserId,
          clinic.clinic_id,
          role.role_name,
          role.role_name === "Dentist"
            ? cleanText(license_number)
            : cleanText(credential_number),
          role.role_name === "Dentist"
            ? normalizeNullable(license_expiration_date)
            : null,
          role.role_name === "Dentist"
            ? cleanText(specialization)
            : cleanText(qualification_name),
          role.role_name === "Assistant"
            ? normalizeNullable(qualification_expiration_date)
            : null,
          primaryCredential.filename,
          primaryCredential.originalname,
          primaryCredential.mimetype,
          governmentId.filename,
          governmentId.originalname,
          governmentId.mimetype,
          req.user.user_id,
        ],
      );

      await client.query("COMMIT");

      try {
        await createAuditLog({
          user_id: req.user.user_id,
          action: "SUBMIT_STAFF_CREDENTIALS",
          module: "Staff Credential Verification",
          description: `Clinic owner submitted ${role.role_name} credentials for ${cleanName} under ${clinic.clinic_name}.`,
          ip_address: req.ip,
        });
      } catch (auditError) {
        console.error(
          "Create staff credential audit log error:",
          auditError.message,
        );
      }

      res.status(201).json({
        message: `${role.role_name} account and credentials were submitted successfully. The account is already email-verified because it was created by an authenticated clinic owner, but it will remain inactive until administrator credential approval is completed.`,
        user: newUser.rows[0],
        credential: insertedCredential.rows[0],
        role: role.role_name,
        clinic,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      deleteUploadedCredentialFiles(req.files);

      console.error("Create clinic owner staff error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A duplicate staff or credential record already exists.",
        });
      }

      if (err.code === "42P01") {
        return res.status(500).json({
          error:
            "The staff credential database table is missing. Run the staff credential migration first.",
        });
      }

      if (err.code === "42703") {
        return res.status(500).json({
          error:
            "The staff credential database schema is outdated. Re-run the latest migration.",
        });
      }

      if (err.code === "23503") {
        return res.status(400).json({
          error:
            "A required user, clinic, or staff relationship could not be created. Refresh the page and try again.",
        });
      }

      res.status(500).json({
        error:
          process.env.NODE_ENV === "production"
            ? "Unable to create the staff credential application."
            : `Unable to create the staff credential application: ${err.message}`,
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: REVIEW STAFF CREDENTIAL APPLICATIONS
// ===============================

router.get(
  "/admin/staff-credentials",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const status = cleanText(req.query.status || "All");

    try {
      const values = [];
      let statusFilter = "";

      if (status !== "All") {
        values.push(status);
        statusFilter = `AND sc.verification_status = $${values.length}`;
      }

      const result = await pool.query(
        `SELECT
           sc.*,
           u.name,
           u.email,
           u.status AS account_status,
           COALESCE(u.email_verified, false) AS email_verified,
           c.clinic_name,
           c.address AS clinic_address,
           owner.name AS clinic_owner_name,
           reviewer.name AS reviewed_by_name
         FROM public.staff_credentials sc
         JOIN public.users u ON sc.user_id = u.user_id
         JOIN public.clinics c ON sc.clinic_id = c.clinic_id
         LEFT JOIN public.users owner ON c.owner_user_id = owner.user_id
         LEFT JOIN public.users reviewer ON sc.reviewed_by_user_id = reviewer.user_id
         WHERE 1 = 1
         ${statusFilter}
         ORDER BY
           CASE sc.verification_status
             WHEN 'Pending' THEN 1
             WHEN 'Rejected' THEN 2
             ELSE 3
           END,
           sc.submitted_at DESC`,
        values,
      );

      res.status(200).json({
        applications: result.rows,
      });
    } catch (err) {
      console.error("Get staff credentials error:", err.message);
      res.status(500).json({
        error: "Unable to retrieve staff credential applications.",
      });
    }
  },
);

router.get(
  "/admin/staff-credentials/:credential_id/document/:document_type",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { credential_id, document_type } = req.params;

    try {
      const credential = await pool.query(
        `SELECT
           primary_document_path,
           primary_document_original_name,
           primary_document_mime_type,
           government_id_path,
           government_id_original_name,
           government_id_mime_type
         FROM public.staff_credentials
         WHERE credential_id = $1
         LIMIT 1`,
        [credential_id],
      );

      if (credential.rows.length === 0) {
        return res.status(404).json({
          error: "Credential application not found.",
        });
      }

      const row = credential.rows[0];
      const isGovernmentId = document_type === "government-id";
      const storedName = isGovernmentId
        ? row.government_id_path
        : row.primary_document_path;
      const originalName = isGovernmentId
        ? row.government_id_original_name
        : row.primary_document_original_name;
      const mimeType = isGovernmentId
        ? row.government_id_mime_type
        : row.primary_document_mime_type;

      const absolutePath = path.join(staffCredentialDirectory, storedName);

      if (!storedName || !fs.existsSync(absolutePath)) {
        return res.status(404).json({
          error: "Credential document file was not found.",
        });
      }

      res.setHeader("Content-Type", mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(originalName || "credential-document").replace(/"/g, "")}"`,
      );

      res.sendFile(absolutePath);
    } catch (err) {
      console.error("Read staff credential document error:", err.message);
      res.status(500).json({
        error: "Unable to retrieve the credential document.",
      });
    }
  },
);

router.put(
  "/admin/staff-credentials/:credential_id/review",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { credential_id } = req.params;
    const decision = cleanText(req.body.decision);
    const rejectionReason = cleanText(req.body.rejection_reason);

    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be Approved or Rejected.",
      });
    }

    if (decision === "Rejected" && !rejectionReason) {
      return res.status(400).json({
        error: "A rejection reason is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const application = await client.query(
        `SELECT sc.*, u.name, c.clinic_name
         FROM public.staff_credentials sc
         JOIN public.users u ON sc.user_id = u.user_id
         JOIN public.clinics c ON sc.clinic_id = c.clinic_id
         WHERE sc.credential_id = $1
         FOR UPDATE`,
        [credential_id],
      );

      if (application.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Credential application not found.",
        });
      }

      const row = application.rows[0];

      if (decision === "Approved") {
        const reviewed = await client.query(
          `UPDATE public.staff_credentials
           SET verification_status = 'Approved',
               rejection_reason = NULL,
               reviewed_by_user_id = $1,
               reviewed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE credential_id = $2
           RETURNING *`,
          [req.user.user_id, credential_id],
        );

        await client.query(
          `UPDATE public.users SET status = 'Active' WHERE user_id = $1`,
          [row.user_id],
        );

        if (row.staff_role === "Dentist") {
          await client.query(
            `UPDATE public.dentists SET status = 'Active' WHERE user_id = $1`,
            [row.user_id],
          );
        } else {
          await client.query(
            `UPDATE public.assistants SET status = 'Active' WHERE user_id = $1`,
            [row.user_id],
          );
        }

        await client.query("COMMIT");

        try {
          await createAuditLog({
            user_id: req.user.user_id,
            action: "APPROVE_STAFF_CREDENTIALS",
            module: "Staff Credential Verification",
            description: `Approved ${row.staff_role} credentials for ${row.name} under ${row.clinic_name}.`,
            ip_address: req.ip,
          });
        } catch (auditError) {
          console.error("Approve credential audit error:", auditError.message);
        }

        return res.status(200).json({
          message: "Staff credentials approved and account activated.",
          application: reviewed.rows[0],
        });
      }

      const credentialFiles = [
        row.primary_document_path,
        row.government_id_path,
      ]
        .filter(Boolean)
        .map((fileName) => path.join(staffCredentialDirectory, fileName));

      if (row.staff_role === "Dentist") {
        await client.query(`DELETE FROM public.dentists WHERE user_id = $1`, [
          row.user_id,
        ]);
      } else {
        await client.query(`DELETE FROM public.assistants WHERE user_id = $1`, [
          row.user_id,
        ]);
      }

      await client.query(
        `DELETE FROM public.staff_credentials WHERE credential_id = $1`,
        [credential_id],
      );

      await client.query(`DELETE FROM public.user_roles WHERE user_id = $1`, [
        row.user_id,
      ]);

      await client.query(`DELETE FROM public.users WHERE user_id = $1`, [
        row.user_id,
      ]);

      await client.query("COMMIT");

      credentialFiles.forEach((filePath) => {
        fs.unlink(filePath, () => {});
      });

      try {
        await createAuditLog({
          user_id: req.user.user_id,
          action: "REJECT_AND_DELETE_STAFF_APPLICATION",
          module: "Staff Credential Verification",
          description: `Rejected and deleted the ${row.staff_role} application for ${row.name} under ${row.clinic_name}. Reason: ${rejectionReason}`,
          ip_address: req.ip,
        });
      } catch (auditError) {
        console.error("Reject credential audit error:", auditError.message);
      }

      return res.status(200).json({
        message:
          "Credentials rejected. The pending account, staff profile, credential record, and uploaded documents were deleted.",
        deleted: true,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Review staff credential error:", err.message);
      res.status(500).json({
        error: "Unable to review the credential application.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN STAFF STATUS
// Works across all clinic locations owned by the same clinic owner.
// ===============================

router.put(
  "/clinic-owner/staff/:user_id/status",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { user_id } = req.params;
    const { status } = req.body || {};

    const allowedStatuses = ["Active", "Inactive"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required. Use Active or Inactive.",
      });
    }

    if (Number(user_id) === Number(req.user.user_id)) {
      return res.status(400).json({
        error: "You cannot change your own account status.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const staffCheck = await client.query(
        `SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            r.role_name,

            d.dentist_id,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name,

            COALESCE(d.clinic_id, a.clinic_id) AS clinic_id,
            COALESCE(dc.clinic_name, ac.clinic_name) AS clinic_name

         FROM public.users u
         JOIN public.user_roles ur ON u.user_id = ur.user_id
         JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id
         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id

         WHERE u.user_id = $1
         AND r.role_name IN ('Dentist', 'Assistant', 'Dental Assistant')
         AND (
              dc.owner_user_id = $2
              OR ac.owner_user_id = $2
         )
         LIMIT 1`,
        [user_id, req.user.user_id],
      );

      if (staffCheck.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Staff member not found or does not belong to any of your clinic locations.",
        });
      }

      const staffMember = staffCheck.rows[0];

      const credentialCheck = await client.query(
        `SELECT verification_status
         FROM public.staff_credentials
         WHERE user_id = $1
         LIMIT 1`,
        [user_id],
      );

      const credentialStatus =
        credentialCheck.rows[0]?.verification_status || null;

      if (credentialStatus && credentialStatus !== "Approved") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Only the Admin can approve pending staff credentials. Clinic owners cannot activate or deactivate an unapproved account.",
          credential_verification_status: credentialStatus,
        });
      }

      const updatedUser = await client.query(
        `UPDATE public.users
         SET status = $1
         WHERE user_id = $2
         RETURNING user_id, name, email, status, created_at`,
        [status, user_id],
      );

      if (staffMember.role_name === "Dentist") {
        await client.query(
          `UPDATE public.dentists
           SET status = $1
           WHERE user_id = $2
           AND clinic_id = $3`,
          [status, user_id, staffMember.clinic_id],
        );
      }

      if (isAssistantRole(staffMember.role_name)) {
        await client.query(
          `UPDATE public.assistants
           SET status = $1
           WHERE user_id = $2
           AND clinic_id = $3`,
          [status, user_id, staffMember.clinic_id],
        );
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_STAFF_STATUS",
        module: "Clinic Owner Staff Management",
        description: `Clinic owner updated ${staffMember.name}'s account status to ${status} under ${staffMember.clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      res.status(200).json({
        message: `${staffMember.name}'s account status updated to ${status}.`,
        user: updatedUser.rows[0],
        clinic: {
          clinic_id: staffMember.clinic_id,
          clinic_name: staffMember.clinic_name,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Update clinic staff status error:", err.message);

      res.status(500).json({
        error: "Error updating clinic staff status.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// PROTECTED PROFILE ROUTE
// ===============================

router.get("/profile", authenticateToken, async (req, res) => {
  res.json({
    message: "Protected profile route accessed successfully",
    user: req.user,
  });
});

// ===============================
// DASHBOARD ROUTES
// ===============================

router.get(
  "/admin/dashboard",
  authenticateToken,
  authorizeRoles("Admin"),
  (req, res) => {
    res.json({
      message: "Welcome to the Admin Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/clinic-owner/dashboard",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  (req, res) => {
    res.json({
      message: "Welcome to the Clinic Owner Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/dentist/dashboard",
  authenticateToken,
  authorizeRoles("Dentist"),
  (req, res) => {
    res.json({
      message: "Welcome to the Dentist Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/patient/dashboard",
  authenticateToken,
  authorizeRoles("Patient"),
  (req, res) => {
    res.json({
      message: "Welcome to the Patient Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/assistant/dashboard",
  authenticateToken,
  authorizeRoles("Assistant", "Dental Assistant"),
  (req, res) => {
    res.json({
      message: "Welcome to the Dental Assistant Dashboard",
      user: req.user,
    });
  },
);

// ===============================
// CLINICAL AREA
// ===============================

router.get(
  "/clinical-area",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  (req, res) => {
    res.json({
      message: "Clinical area accessed successfully",
      user: req.user,
    });
  },
);

module.exports = router;
