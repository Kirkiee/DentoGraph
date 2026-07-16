const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const normalizeDentitionType = (dentition_type) => {
  if (!dentition_type) return "Adult";

  const value = String(dentition_type).trim();

  if (value === "Adult" || value === "Child") {
    return value;
  }

  return null;
};

// CREATE PATIENT PROFILE
router.post(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

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
      return res.status(400).json({
        error: "Invalid clinic selected.",
      });
    }

    if (!normalizedDentitionType) {
      return res.status(400).json({
        error: "Dentition type must be either Adult or Child.",
      });
    }

    try {
      const existingProfile = await pool.query(
        "SELECT * FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (existingProfile.rows.length > 0) {
        return res.status(400).json({
          error: "Patient profile already exists",
        });
      }

      const newPatient = await pool.query(
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
         RETURNING 
           patient_id,
           user_id,
           clinic_id,
           contact_number,
           TO_CHAR(date_of_birth::date, 'YYYY-MM-DD') AS date_of_birth,
           address,
           gender,
           medical_history,
           COALESCE(dentition_type, 'Adult') AS dentition_type`,
        [
          user_id,
          normalizedClinicId,
          contact_number || null,
          date_of_birth || null,
          address || null,
          gender || null,
          medical_history || null,
          normalizedDentitionType,
        ],
      );

      res.status(201).json({
        message: "Patient profile created successfully",
        patient: newPatient.rows[0],
      });
    } catch (err) {
      console.error("Create patient profile error:", err.message);
      res.status(500).json({ error: "Error creating patient profile" });
    }
  },
);

// GET OWN PATIENT PROFILE
router.get(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const patientProfile = await pool.query(
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
       WHERE p.user_id = $1`,
        [user_id],
      );

      if (patientProfile.rows.length === 0) {
        return res.status(404).json({
          error: "Patient profile not found",
        });
      }

      res.status(200).json({
        message: "Patient profile retrieved successfully",
        patient: patientProfile.rows[0],
      });
    } catch (err) {
      console.error("Get patient profile error:", err.message);
      res.status(500).json({ error: "Error retrieving patient profile" });
    }
  },
);

// UPDATE OWN PATIENT PROFILE
router.put(
  "/profile",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    const {
      name,
      email,
      contact_number,
      date_of_birth,
      address,
      gender,
      medical_history,
      dentition_type,
    } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({
        error: "Name and email are required",
      });
    }

    const normalizedDentitionType = normalizeDentitionType(dentition_type);

    if (!normalizedDentitionType) {
      return res.status(400).json({
        error: "Dentition type must be either Adult or Child.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const emailCheck = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE email = $1 AND user_id <> $2`,
        [email, user_id],
      );

      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Email is already used by another account",
        });
      }

      await client.query(
        `UPDATE public.users
         SET name = $1,
             email = $2
         WHERE user_id = $3`,
        [name, email, user_id],
      );

      const updatedPatient = await client.query(
        `UPDATE public.patients
         SET contact_number = $1,
             date_of_birth = $2::date,
             address = $3,
             gender = $4,
             medical_history = $5,
             dentition_type = $6
         WHERE user_id = $7
         RETURNING *`,
        [
          contact_number || null,
          date_of_birth || null,
          address || null,
          gender || null,
          medical_history || null,
          normalizedDentitionType,
          user_id,
        ],
      );

      if (updatedPatient.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Patient profile not found",
        });
      }

      const fullProfile = await client.query(
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
       WHERE p.user_id = $1`,
        [user_id],
      );

      await client.query("COMMIT");

      res.status(200).json({
        message: "Patient profile updated successfully",
        patient: fullProfile.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Update patient profile error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({ error: "Email already exists" });
      }

      res.status(500).json({ error: "Error updating patient profile" });
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

      res.status(200).json(patients.rows);
    } catch (err) {
      console.error("Get all patients error:", err.message);
      res.status(500).json({ error: "Error retrieving patients" });
    }
  },
);

module.exports = router;
