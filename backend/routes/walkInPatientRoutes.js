const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");

const WALK_IN_ROLES = [
  "Clinic Owner",
  "Dentist",
  "Assistant",
  "Dental Assistant",
];

const cleanText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeEmail = (value) => cleanText(value).toLowerCase();

const normalizeDentitionType = (value) => {
  const normalized = cleanText(value);
  return normalized === "Adult" || normalized === "Child" ? normalized : null;
};

const generateTemporaryPassword = () => {
  const suffix = crypto.randomBytes(5).toString("base64url");
  return `Dg!${suffix}9a`;
};

const getAuthorizedClinic = async (
  client,
  requestingUser,
  requestedClinicId,
) => {
  const role = requestingUser.role;
  const userId = Number(requestingUser.user_id);

  if (role === "Clinic Owner") {
    const clinicId = Number(requestedClinicId);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return {
        allowed: false,
        status: 400,
        error: "Select a valid owned clinic location.",
      };
    }

    const result = await client.query(
      `SELECT
          c.clinic_id,
          c.clinic_name,
          c.status AS clinic_status,
          c.owner_user_id
       FROM public.clinics c
       WHERE c.clinic_id = $1
         AND c.owner_user_id = $2
       LIMIT 1`,
      [clinicId, userId],
    );

    if (result.rows.length === 0) {
      return {
        allowed: false,
        status: 403,
        error: "You can only register patients for clinic locations you own.",
      };
    }

    return {
      allowed: true,
      clinic: result.rows[0],
    };
  }

  if (role === "Dentist") {
    const result = await client.query(
      `SELECT
          c.clinic_id,
          c.clinic_name,
          c.status AS clinic_status,
          c.owner_user_id,
          d.status AS staff_status
       FROM public.dentists d
       JOIN public.clinics c
         ON c.clinic_id = d.clinic_id
       WHERE d.user_id = $1
       LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return {
        allowed: false,
        status: 404,
        error: "Dentist clinic assignment was not found.",
      };
    }

    return {
      allowed: true,
      clinic: result.rows[0],
    };
  }

  if (role === "Assistant" || role === "Dental Assistant") {
    const result = await client.query(
      `SELECT
          c.clinic_id,
          c.clinic_name,
          c.status AS clinic_status,
          c.owner_user_id,
          a.status AS staff_status
       FROM public.assistants a
       JOIN public.clinics c
         ON c.clinic_id = a.clinic_id
       WHERE a.user_id = $1
       LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return {
        allowed: false,
        status: 404,
        error: "Assistant clinic assignment was not found.",
      };
    }

    return {
      allowed: true,
      clinic: result.rows[0],
    };
  }

  return {
    allowed: false,
    status: 403,
    error: "This role cannot register walk-in patients.",
  };
};

const validateSubscriptionAndPatientLimit = async (client, clinic) => {
  const subscriptionResult = await client.query(
    `SELECT
        os.owner_subscription_id,
        os.subscription_status,
        os.end_date,
        sp.plan_name,
        sp.max_patients,
        COUNT(p.patient_id)::int AS patients_used
     FROM public.owner_subscriptions os
     JOIN public.subscription_plans sp
       ON sp.plan_id = os.plan_id
     LEFT JOIN public.clinics owned_clinic
       ON owned_clinic.owner_user_id = os.owner_user_id
     LEFT JOIN public.patients p
       ON p.clinic_id = owned_clinic.clinic_id
     WHERE os.owner_user_id = $1
     GROUP BY
       os.owner_subscription_id,
       os.subscription_status,
       os.end_date,
       sp.plan_name,
       sp.max_patients
     LIMIT 1`,
    [clinic.owner_user_id],
  );

  if (subscriptionResult.rows.length === 0) {
    return {
      allowed: false,
      status: 403,
      error: "The Clinic Owner has no active shared subscription.",
    };
  }

  const subscription = subscriptionResult.rows[0];
  const isExpired =
    subscription.end_date &&
    new Date(subscription.end_date).getTime() < Date.now();

  if (subscription.subscription_status !== "Active" || isExpired) {
    return {
      allowed: false,
      status: 403,
      error: "The shared Clinic Owner subscription is inactive or expired.",
    };
  }

  const maxPatients = Number(subscription.max_patients || 0);
  const patientsUsed = Number(subscription.patients_used || 0);

  if (maxPatients > 0 && patientsUsed >= maxPatients) {
    return {
      allowed: false,
      status: 409,
      error: `The ${subscription.plan_name} patient limit has been reached.`,
      usage: {
        patients_used: patientsUsed,
        max_patients: maxPatients,
      },
    };
  }

  return {
    allowed: true,
    subscription,
  };
};

// GET CLINIC CONTEXT FOR WALK-IN REGISTRATION
router.get(
  "/context",
  authenticateToken,
  authorizeRoles(...WALK_IN_ROLES),
  async (req, res) => {
    try {
      if (req.user.role === "Clinic Owner") {
        const result = await pool.query(
          `SELECT
              c.clinic_id,
              c.clinic_name,
              c.address,
              c.status
           FROM public.clinics c
           WHERE c.owner_user_id = $1
           ORDER BY c.clinic_name ASC`,
          [req.user.user_id],
        );

        return res.status(200).json({
          registration_mode: "OWNER_LOCATION_SELECTION",
          clinics: result.rows,
        });
      }

      const client = await pool.connect();

      try {
        const clinicAccess = await getAuthorizedClinic(client, req.user, null);

        if (!clinicAccess.allowed) {
          return res
            .status(clinicAccess.status)
            .json({ error: clinicAccess.error });
        }

        return res.status(200).json({
          registration_mode: "ASSIGNED_LOCATION",
          clinics: [
            {
              clinic_id: clinicAccess.clinic.clinic_id,
              clinic_name: clinicAccess.clinic.clinic_name,
              status: clinicAccess.clinic.clinic_status,
            },
          ],
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Walk-in patient context error:", err.message);
      return res.status(500).json({
        error: "Unable to load walk-in registration context.",
      });
    }
  },
);

// CREATE WALK-IN PATIENT ACCOUNT
router.post(
  "/",
  authenticateToken,
  authorizeRoles(...WALK_IN_ROLES),
  async (req, res) => {
    const {
      clinic_id,
      name,
      email,
      contact_number,
      address,
      date_of_birth,
      gender,
      medical_history,
      dentition_type,
      emergency_contact_name,
      emergency_contact_number,
      temporary_password,
      consent_confirmed,
    } = req.body || {};

    const cleanName = cleanText(name);
    const cleanEmail = normalizeEmail(email);
    const cleanContactNumber = cleanText(contact_number);
    const cleanAddress = cleanText(address);
    const cleanGender = cleanText(gender);
    const cleanMedicalHistory = cleanText(medical_history);
    const cleanEmergencyName = cleanText(emergency_contact_name);
    const cleanEmergencyNumber = cleanText(emergency_contact_number);
    const normalizedDentitionType = normalizeDentitionType(dentition_type);

    if (!cleanName || !cleanEmail || !cleanContactNumber) {
      return res.status(400).json({
        error: "Full name, email address, and contact number are required.",
      });
    }

    if (!normalizedDentitionType) {
      return res.status(400).json({
        error: "Dentition type must be Adult or Child.",
      });
    }

    if (consent_confirmed !== true) {
      return res.status(400).json({
        error: "Patient consent must be confirmed before creating the account.",
      });
    }

    const generatedPassword = cleanText(temporary_password)
      ? cleanText(temporary_password)
      : generateTemporaryPassword();

    if (generatedPassword.length < 8) {
      return res.status(400).json({
        error: "The temporary password must contain at least 8 characters.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clinicAccess = await getAuthorizedClinic(
        client,
        req.user,
        clinic_id,
      );

      if (!clinicAccess.allowed) {
        await client.query("ROLLBACK");
        return res
          .status(clinicAccess.status)
          .json({ error: clinicAccess.error });
      }

      const clinic = clinicAccess.clinic;

      if (clinic.clinic_status !== "Active") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Walk-in registration is disabled for an inactive clinic.",
        });
      }

      if (clinic.staff_status && clinic.staff_status !== "Active") {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "Your staff account is inactive.",
        });
      }

      const subscriptionCheck = await validateSubscriptionAndPatientLimit(
        client,
        clinic,
      );

      if (!subscriptionCheck.allowed) {
        await client.query("ROLLBACK");
        return res.status(subscriptionCheck.status).json({
          error: subscriptionCheck.error,
          usage: subscriptionCheck.usage || null,
        });
      }

      const existingEmail = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cleanEmail],
      );

      if (existingEmail.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "An account with this email address already exists.",
        });
      }

      const patientRole = await client.query(
        `SELECT role_id
         FROM public.roles
         WHERE role_name = 'Patient'
         LIMIT 1`,
      );

      if (patientRole.rows.length === 0) {
        throw new Error("Patient role is not configured.");
      }

      const hashedPassword = await bcrypt.hash(generatedPassword, 12);

      const newUser = await client.query(
        `INSERT INTO public.users
         (
           name,
           email,
           password,
           status,
           email_verified,
           email_verification_token,
           email_verification_expires,
           must_change_password
         )
         VALUES ($1, $2, $3, 'Active', TRUE, NULL, NULL, TRUE)
         RETURNING
           user_id,
           name,
           email,
           status,
           email_verified,
           must_change_password,
           created_at`,
        [cleanName, cleanEmail, hashedPassword],
      );

      const newUserId = newUser.rows[0].user_id;

      await client.query(
        `INSERT INTO public.user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [newUserId, patientRole.rows[0].role_id],
      );

      const newPatient = await client.query(
        `INSERT INTO public.patients
         (
           user_id,
           clinic_id,
           contact_number,
           date_of_birth,
           address,
           gender,
           medical_history,
           dentition_type,
           emergency_contact_name,
           emergency_contact_number,
           registration_source,
           registered_by_user_id,
           consent_confirmed_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           NULLIF($4, '')::date,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10,
           'WALK_IN',
           $11,
           CURRENT_TIMESTAMP
         )
         RETURNING
           patient_id,
           user_id,
           clinic_id,
           contact_number,
           TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
           address,
           gender,
           medical_history,
           dentition_type,
           emergency_contact_name,
           emergency_contact_number,
           registration_source,
           registered_by_user_id,
           consent_confirmed_at`,
        [
          newUserId,
          clinic.clinic_id,
          cleanContactNumber,
          cleanText(date_of_birth),
          cleanAddress || null,
          cleanGender || null,
          cleanMedicalHistory || null,
          normalizedDentitionType,
          cleanEmergencyName || null,
          cleanEmergencyNumber || null,
          Number(req.user.user_id),
        ],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_WALK_IN_PATIENT",
        module: "Walk-in Patient Registration",
        description:
          `${req.user.role} created walk-in patient ${cleanName} ` +
          `for ${clinic.clinic_name}.`,
        ip_address: req.ip,
      });

      return res.status(201).json({
        message: "Walk-in patient account created successfully.",
        clinic: {
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.clinic_name,
        },
        user: newUser.rows[0],
        patient: newPatient.rows[0],
        temporary_credentials: {
          email: cleanEmail,
          temporary_password: generatedPassword,
          must_change_password: true,
          display_once: true,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Create walk-in patient error:", err.message);

      if (err.code === "23505") {
        return res.status(409).json({
          error: "A patient account using these details already exists.",
        });
      }

      if (err.code === "22007") {
        return res.status(400).json({
          error: "The date of birth is invalid.",
        });
      }

      return res.status(500).json({
        error: "Unable to create the walk-in patient account.",
      });
    } finally {
      client.release();
    }
  },
);

module.exports = router;
