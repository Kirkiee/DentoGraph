const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const {
  sendProfileEmailVerificationCode,
} = require("../utils/emailSender");
const {
  normalizePhilippineNumber,
  sendContactVerificationCode,
} = require("../utils/smsSender");

const VERIFICATION_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

const normalizeDentitionType = (dentitionType) => {
  if (!dentitionType) return "Adult";

  const value = String(dentitionType).trim();

  return value === "Adult" || value === "Child" ? value : null;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const hashVerificationCode = ({ userId, changeType, targetValue, code }) =>
  crypto
    .createHash("sha256")
    .update(
      `${userId}:${changeType}:${targetValue}:${code}:` +
        `${process.env.JWT_SECRET || "dentograph"}`,
    )
    .digest("hex");

const createVerificationCode = () =>
  String(crypto.randomInt(100000, 1000000));

const serializeStructuredValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return JSON.stringify(value);
};

const getFullPatientProfile = async (userId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
       p.patient_id,
       p.user_id,
       p.clinic_id,
       c.clinic_name,
       u.name,
       u.email,
       u.status AS account_status,
       p.contact_number,
       p.address,
       p.medical_history,
       COALESCE(p.dentition_type, 'Adult') AS dentition_type,
       EXISTS (
         SELECT 1
         FROM public.patient_profile_verifications pv
         WHERE pv.user_id = p.user_id
           AND pv.change_type = 'email'
           AND pv.verified_at IS NULL
           AND pv.expires_at > CURRENT_TIMESTAMP
       ) AS email_change_pending,
       EXISTS (
         SELECT 1
         FROM public.patient_profile_verifications pv
         WHERE pv.user_id = p.user_id
           AND pv.change_type = 'contact_number'
           AND pv.verified_at IS NULL
           AND pv.expires_at > CURRENT_TIMESTAMP
       ) AS contact_change_pending
     FROM public.patients p
     JOIN public.users u ON p.user_id = u.user_id
     LEFT JOIN public.clinics c ON p.clinic_id = c.clinic_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] || null;
};

// CREATE PATIENT PROFILE
router.post(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const userId = req.user.user_id;
    const {
      contact_number,
      date_of_birth,
      address,
      gender,
      medical_history,
      dentition_type,
      clinic_id,
    } = req.body || {};

    const normalizedDentitionType = normalizeDentitionType(dentition_type);
    const normalizedClinicId =
      clinic_id !== undefined && clinic_id !== null && clinic_id !== ""
        ? Number(clinic_id)
        : null;

    if (normalizedClinicId && Number.isNaN(normalizedClinicId)) {
      return res.status(400).json({ error: "Invalid clinic selected." });
    }

    if (!normalizedDentitionType) {
      return res.status(400).json({
        error: "Dentition type must be either Adult or Child.",
      });
    }

    try {
      const existing = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [userId],
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: "Patient profile already exists",
        });
      }

      const normalizedContact = contact_number
        ? normalizePhilippineNumber(contact_number)
        : null;

      if (contact_number && !normalizedContact) {
        return res.status(400).json({
          error: "A valid Philippine mobile number is required.",
        });
      }

      const created = await pool.query(
        `INSERT INTO public.patients
          (
            user_id,
            clinic_id,
            contact_number,
            date_of_birth,
            address,
            gender,
            medical_history,
            dentition_type
          )
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)
         RETURNING patient_id`,
        [
          userId,
          normalizedClinicId,
          normalizedContact,
          date_of_birth || null,
          serializeStructuredValue(address),
          gender || null,
          serializeStructuredValue(medical_history),
          normalizedDentitionType,
        ],
      );

      const patient = await getFullPatientProfile(userId);

      return res.status(201).json({
        message: "Patient profile created successfully",
        patient,
        patient_id: created.rows[0].patient_id,
      });
    } catch (error) {
      console.error("Create patient profile error:", error.message);
      return res.status(500).json({
        error: "Error creating patient profile",
      });
    }
  },
);

// GET OWN PATIENT PROFILE
router.get(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const patient = await getFullPatientProfile(req.user.user_id);

      if (!patient) {
        return res.status(404).json({
          error: "Patient profile not found",
        });
      }

      return res.status(200).json({
        message: "Patient profile retrieved successfully",
        patient,
      });
    } catch (error) {
      console.error("Get patient profile error:", error.message);
      return res.status(500).json({
        error: "Error retrieving patient profile",
      });
    }
  },
);

// UPDATE NON-SENSITIVE PROFILE FIELDS
router.put(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const userId = req.user.user_id;
    const { name, address, medical_history } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(400).json({
        error: "Name is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const patientResult = await client.query(
        `SELECT patient_id, dentition_type
         FROM public.patients
         WHERE user_id = $1
         FOR UPDATE`,
        [userId],
      );

      if (patientResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Patient profile not found",
        });
      }

      await client.query(
        `UPDATE public.users
         SET name = $1
         WHERE user_id = $2`,
        [String(name).trim(), userId],
      );

      await client.query(
        `UPDATE public.patients
         SET address = $1,
             medical_history = $2
         WHERE user_id = $3`,
        [
          serializeStructuredValue(address),
          serializeStructuredValue(medical_history),
          userId,
        ],
      );

      const patient = await getFullPatientProfile(userId, client);
      await client.query("COMMIT");

      return res.status(200).json({
        message: "Patient profile updated successfully",
        patient,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update patient profile error:", error.message);
      return res.status(500).json({
        error: "Error updating patient profile",
      });
    } finally {
      client.release();
    }
  },
);

// REQUEST EMAIL OR CONTACT NUMBER CHANGE
router.post(
  "/profile/verification/request",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const userId = req.user.user_id;
    const changeType = String(req.body?.type || "").trim();
    let targetValue = String(req.body?.value || "").trim();

    if (!["email", "contact_number"].includes(changeType)) {
      return res.status(400).json({
        error: "Verification type must be email or contact_number.",
      });
    }

    if (changeType === "email") {
      targetValue = normalizeEmail(targetValue);

      if (!isValidEmail(targetValue)) {
        return res.status(400).json({
          error: "Enter a valid email address.",
        });
      }
    } else {
      targetValue = normalizePhilippineNumber(targetValue);

      if (!targetValue) {
        return res.status(400).json({
          error: "Enter a valid Philippine mobile number.",
        });
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const accountResult = await client.query(
        `SELECT u.name, u.email, p.contact_number
         FROM public.users u
         JOIN public.patients p ON p.user_id = u.user_id
         WHERE u.user_id = $1
         FOR UPDATE OF u, p`,
        [userId],
      );

      if (accountResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const account = accountResult.rows[0];

      if (
        (changeType === "email" &&
          normalizeEmail(account.email) === targetValue) ||
        (changeType === "contact_number" &&
          account.contact_number === targetValue)
      ) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "The new value is the same as the current value.",
        });
      }

      if (changeType === "email") {
        const duplicate = await client.query(
          `SELECT user_id
           FROM public.users
           WHERE LOWER(email) = LOWER($1)
             AND user_id <> $2
           LIMIT 1`,
          [targetValue, userId],
        );

        if (duplicate.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Email is already used by another account.",
          });
        }
      } else {
        const duplicate = await client.query(
          `SELECT patient_id
           FROM public.patients
           WHERE contact_number = $1
             AND user_id <> $2
           LIMIT 1`,
          [targetValue, userId],
        );

        if (duplicate.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Contact number is already used by another Patient.",
          });
        }
      }

      const code = createVerificationCode();
      const codeHash = hashVerificationCode({
        userId,
        changeType,
        targetValue,
        code,
      });

      await client.query(
        `INSERT INTO public.patient_profile_verifications
          (
            user_id,
            change_type,
            target_value,
            code_hash,
            expires_at,
            attempts,
            requested_at,
            verified_at
          )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           CURRENT_TIMESTAMP + ($5 || ' minutes')::interval,
           0,
           CURRENT_TIMESTAMP,
           NULL
         )
         ON CONFLICT (user_id, change_type)
         DO UPDATE SET
           target_value = EXCLUDED.target_value,
           code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           requested_at = CURRENT_TIMESTAMP,
           verified_at = NULL`,
        [
          userId,
          changeType,
          targetValue,
          codeHash,
          VERIFICATION_EXPIRY_MINUTES,
        ],
      );

      if (changeType === "email") {
        await sendProfileEmailVerificationCode({
          to: targetValue,
          name: account.name,
          code,
        });
      } else {
        await sendContactVerificationCode({
          number: targetValue,
          code,
        });
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message:
          changeType === "email"
            ? "Verification code sent to the new email address."
            : "Verification code sent to the new contact number.",
        type: changeType,
        expires_in_minutes: VERIFICATION_EXPIRY_MINUTES,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Profile verification request error:", error.message);

      if (error.code === "SMS_NOT_CONFIGURED") {
        return res.status(503).json({
          error:
            "Contact verification is not configured on the server yet.",
        });
      }

      return res.status(500).json({
        error: "Unable to send the verification code.",
      });
    } finally {
      client.release();
    }
  },
);

// CONFIRM EMAIL OR CONTACT NUMBER CHANGE
router.post(
  "/profile/verification/confirm",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const userId = req.user.user_id;
    const changeType = String(req.body?.type || "").trim();
    const code = String(req.body?.code || "").trim();

    if (!["email", "contact_number"].includes(changeType)) {
      return res.status(400).json({
        error: "Verification type must be email or contact_number.",
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: "Enter the six-digit verification code.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const verificationResult = await client.query(
        `SELECT *
         FROM public.patient_profile_verifications
         WHERE user_id = $1
           AND change_type = $2
           AND verified_at IS NULL
         FOR UPDATE`,
        [userId, changeType],
      );

      if (verificationResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "No pending verification request was found.",
        });
      }

      const verification = verificationResult.rows[0];

      if (new Date(verification.expires_at).getTime() <= Date.now()) {
        await client.query(
          `DELETE FROM public.patient_profile_verifications
           WHERE verification_id = $1`,
          [verification.verification_id],
        );
        await client.query("COMMIT");

        return res.status(410).json({
          error: "The verification code has expired. Request a new code.",
        });
      }

      if (Number(verification.attempts) >= MAX_VERIFICATION_ATTEMPTS) {
        await client.query("ROLLBACK");
        return res.status(429).json({
          error: "Too many incorrect attempts. Request a new code.",
        });
      }

      const expectedHash = hashVerificationCode({
        userId,
        changeType,
        targetValue: verification.target_value,
        code,
      });

      if (
        !crypto.timingSafeEqual(
          Buffer.from(expectedHash),
          Buffer.from(verification.code_hash),
        )
      ) {
        await client.query(
          `UPDATE public.patient_profile_verifications
           SET attempts = attempts + 1
           WHERE verification_id = $1`,
          [verification.verification_id],
        );
        await client.query("COMMIT");

        return res.status(400).json({
          error: "Incorrect verification code.",
        });
      }

      if (changeType === "email") {
        await client.query(
          `UPDATE public.users
           SET email = $1
           WHERE user_id = $2`,
          [verification.target_value, userId],
        );
      } else {
        await client.query(
          `UPDATE public.patients
           SET contact_number = $1
           WHERE user_id = $2`,
          [verification.target_value, userId],
        );
      }

      await client.query(
        `UPDATE public.patient_profile_verifications
         SET verified_at = CURRENT_TIMESTAMP
         WHERE verification_id = $1`,
        [verification.verification_id],
      );

      const patient = await getFullPatientProfile(userId, client);
      await client.query("COMMIT");

      return res.status(200).json({
        message:
          changeType === "email"
            ? "Email address verified and updated successfully."
            : "Contact number verified and updated successfully.",
        patient,
        requires_relogin: changeType === "email",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Confirm profile verification error:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          error: "The requested value is already in use.",
        });
      }

      return res.status(500).json({
        error: "Unable to confirm the verification code.",
      });
    } finally {
      client.release();
    }
  },
);

// ADMIN: GET ALL PATIENT PROFILES
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const patients = await pool.query(
        `SELECT
           p.patient_id,
           p.user_id,
           p.clinic_id,
           c.clinic_name,
           u.name,
           u.email,
           u.status AS account_status,
           p.contact_number,
           TO_CHAR(p.date_of_birth::date, 'YYYY-MM-DD') AS date_of_birth,
           p.address,
           p.gender,
           p.medical_history,
           COALESCE(p.dentition_type, 'Adult') AS dentition_type
         FROM public.patients p
         JOIN public.users u ON p.user_id = u.user_id
         LEFT JOIN public.clinics c ON p.clinic_id = c.clinic_id
         ORDER BY p.patient_id`,
      );

      return res.status(200).json(patients.rows);
    } catch (error) {
      console.error("Get all patients error:", error.message);
      return res.status(500).json({
        error: "Error retrieving patients",
      });
    }
  },
);

module.exports = router;