const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// CREATE ASSISTANT PROFILE
router.post(
  "/profile",
  authenticateToken,
  authorizeRoles("Assistant"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { license_number, availability, status, clinic_id } = req.body || {};

    try {
      const existingProfile = await pool.query(
        "SELECT * FROM public.assistants WHERE user_id = $1",
        [user_id],
      );

      if (existingProfile.rows.length > 0) {
        return res.status(400).json({
          error: "Assistant profile already exists",
        });
      }

      const newAssistant = await pool.query(
        `INSERT INTO public.assistants
       (user_id, license_number, availability, status, clinic_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
        [
          user_id,
          license_number || `AST-${user_id}`,
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          status || "Active",
          clinic_id || null,
        ],
      );

      res.status(201).json({
        message: "Assistant profile created successfully",
        assistant: newAssistant.rows[0],
      });
    } catch (err) {
      console.error("Create assistant profile error:", err.message);
      res.status(500).json({ error: "Error creating assistant profile" });
    }
  },
);

// GET OWN ASSISTANT PROFILE
router.get(
  "/profile",
  authenticateToken,
  authorizeRoles("Assistant"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const assistantProfile = await pool.query(
        `SELECT 
          a.assistant_id,
          a.user_id,
          u.name,
          u.email,
          u.status AS account_status,
          a.license_number,
          a.availability,
          a.status AS profile_status,
          a.clinic_id,
          c.clinic_name
       FROM public.assistants a
       JOIN public.users u ON a.user_id = u.user_id
       LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
       WHERE a.user_id = $1`,
        [user_id],
      );

      if (assistantProfile.rows.length === 0) {
        return res.status(404).json({
          error: "Assistant profile not found",
        });
      }

      res.status(200).json({
        message: "Assistant profile retrieved successfully",
        assistant: assistantProfile.rows[0],
      });
    } catch (err) {
      console.error("Get assistant profile error:", err.message);
      res.status(500).json({ error: "Error retrieving assistant profile" });
    }
  },
);

// UPDATE OWN ASSISTANT PROFILE
router.put(
  "/profile",
  authenticateToken,
  authorizeRoles("Assistant"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { name, email, license_number, availability, clinic_id } =
      req.body || {};

    if (!name || !email || !license_number || !availability) {
      return res.status(400).json({
        error: "Name, email, license number, and availability are required",
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

      const updatedAssistant = await client.query(
        `UPDATE public.assistants
       SET license_number = $1,
           availability = $2,
           clinic_id = $3
       WHERE user_id = $4
       RETURNING *`,
        [license_number, availability, clinic_id || null, user_id],
      );

      if (updatedAssistant.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Assistant profile not found",
        });
      }

      const fullProfile = await client.query(
        `SELECT 
          a.assistant_id,
          a.user_id,
          u.name,
          u.email,
          u.status AS account_status,
          a.license_number,
          a.availability,
          a.status AS profile_status,
          a.clinic_id,
          c.clinic_name
       FROM public.assistants a
       JOIN public.users u ON a.user_id = u.user_id
       LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
       WHERE a.user_id = $1`,
        [user_id],
      );

      await client.query("COMMIT");

      res.status(200).json({
        message: "Assistant profile updated successfully",
        assistant: fullProfile.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Update assistant profile error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({ error: "Email already exists" });
      }

      res.status(500).json({ error: "Error updating assistant profile" });
    } finally {
      client.release();
    }
  },
);

// ADMIN: GET ALL ASSISTANT PROFILES
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const assistants = await pool.query(
        `SELECT 
          a.assistant_id,
          a.user_id,
          u.name,
          u.email,
          a.license_number,
          a.availability,
          a.status,
          a.clinic_id,
          c.clinic_name
       FROM public.assistants a
       JOIN public.users u ON a.user_id = u.user_id
       LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
       ORDER BY a.assistant_id`,
      );

      res.status(200).json(assistants.rows);
    } catch (err) {
      console.error("Get all assistants error:", err.message);
      res.status(500).json({ error: "Error retrieving assistants" });
    }
  },
);

module.exports = router;
