const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// CREATE DENTIST PROFILE
router.post(
  "/profile",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { license_number, specialization, availability, status, clinic_id } =
      req.body || {};

    try {
      const existingProfile = await pool.query(
        "SELECT * FROM public.dentists WHERE user_id = $1",
        [user_id],
      );

      if (existingProfile.rows.length > 0) {
        return res.status(400).json({
          error: "Dentist profile already exists",
        });
      }

      const newDentist = await pool.query(
        `INSERT INTO public.dentists
       (user_id, license_number, specialization, availability, status, clinic_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
        [
          user_id,
          license_number || `DEN-${user_id}`,
          specialization || "General Dentistry",
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          status || "Active",
          clinic_id || null,
        ],
      );

      res.status(201).json({
        message: "Dentist profile created successfully",
        dentist: newDentist.rows[0],
      });
    } catch (err) {
      console.error("Create dentist profile error:", err.message);
      res.status(500).json({ error: "Error creating dentist profile" });
    }
  },
);

// GET OWN DENTIST PROFILE
router.get(
  "/profile",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const dentistProfile = await pool.query(
        `SELECT 
          d.dentist_id,
          d.user_id,
          u.name,
          u.email,
          u.status AS account_status,
          d.license_number,
          d.specialization,
          d.availability,
          d.status AS profile_status,
          d.clinic_id,
          c.clinic_name
       FROM public.dentists d
       JOIN public.users u ON d.user_id = u.user_id
       LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
       WHERE d.user_id = $1`,
        [user_id],
      );

      if (dentistProfile.rows.length === 0) {
        return res.status(404).json({
          error: "Dentist profile not found",
        });
      }

      res.status(200).json({
        message: "Dentist profile retrieved successfully",
        dentist: dentistProfile.rows[0],
      });
    } catch (err) {
      console.error("Get dentist profile error:", err.message);
      res.status(500).json({ error: "Error retrieving dentist profile" });
    }
  },
);

// UPDATE OWN DENTIST PROFILE
router.put(
  "/profile",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const {
      name,
      email,
      license_number,
      specialization,
      availability,
      clinic_id,
    } = req.body || {};

    if (
      !name ||
      !email ||
      !license_number ||
      !specialization ||
      !availability
    ) {
      return res.status(400).json({
        error:
          "Name, email, license number, specialization, and availability are required",
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

      const updatedDentist = await client.query(
        `UPDATE public.dentists
       SET license_number = $1,
           specialization = $2,
           availability = $3,
           clinic_id = $4
       WHERE user_id = $5
       RETURNING *`,
        [
          license_number,
          specialization,
          availability,
          clinic_id || null,
          user_id,
        ],
      );

      if (updatedDentist.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Dentist profile not found",
        });
      }

      const fullProfile = await client.query(
        `SELECT 
          d.dentist_id,
          d.user_id,
          u.name,
          u.email,
          u.status AS account_status,
          d.license_number,
          d.specialization,
          d.availability,
          d.status AS profile_status,
          d.clinic_id,
          c.clinic_name
       FROM public.dentists d
       JOIN public.users u ON d.user_id = u.user_id
       LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
       WHERE d.user_id = $1`,
        [user_id],
      );

      await client.query("COMMIT");

      res.status(200).json({
        message: "Dentist profile updated successfully",
        dentist: fullProfile.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Update dentist profile error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({ error: "Email already exists" });
      }

      res.status(500).json({ error: "Error updating dentist profile" });
    } finally {
      client.release();
    }
  },
);

// ADMIN: GET ALL DENTIST PROFILES
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const dentists = await pool.query(
        `SELECT 
          d.dentist_id,
          d.user_id,
          u.name,
          u.email,
          d.license_number,
          d.specialization,
          d.availability,
          d.status,
          d.clinic_id,
          c.clinic_name
       FROM public.dentists d
       JOIN public.users u ON d.user_id = u.user_id
       LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
       ORDER BY d.dentist_id`,
      );

      res.status(200).json(dentists.rows);
    } catch (err) {
      console.error("Get all dentists error:", err.message);
      res.status(500).json({ error: "Error retrieving dentists" });
    }
  },
);

module.exports = router;
