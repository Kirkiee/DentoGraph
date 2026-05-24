const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// ADMIN: CREATE CLINIC
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const {
      clinic_name,
      address,
      contact_number,
      email,
      operating_hours,
      status,
    } = req.body || {};

    if (!clinic_name) {
      return res.status(400).json({
        error: "Clinic name is required",
      });
    }

    try {
      const newClinic = await pool.query(
        `INSERT INTO public.clinics
         (clinic_name, address, contact_number, email, operating_hours, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          clinic_name,
          address || null,
          contact_number || null,
          email || null,
          operating_hours || null,
          status || "Active",
        ],
      );

      res.status(201).json({
        message: "Clinic created successfully",
        clinic: newClinic.rows[0],
      });
    } catch (err) {
      console.error("Create clinic error:", err.message);
      res.status(500).json({ error: "Error creating clinic" });
    }
  },
);

// ADMIN / DENTIST: GET CLINICS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Dentist", "Assistant"),
  async (req, res) => {
    try {
      let clinics;

      if (req.user.role === "Dentist") {
        clinics = await pool.query(
          `SELECT *
           FROM public.clinics
           WHERE status = 'Active'
           ORDER BY clinic_name ASC`,
        );
      } else {
        clinics = await pool.query(
          `SELECT *
           FROM public.clinics
           ORDER BY clinic_id DESC`,
        );
      }

      res.status(200).json({
        message: "Clinics retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Get clinics error:", err.message);
      res.status(500).json({ error: "Error retrieving clinics" });
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

// ADMIN: GET SINGLE CLINIC
router.get(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinic = await pool.query(
        `SELECT *
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinic.rows.length === 0) {
        return res.status(404).json({ error: "Clinic not found" });
      }

      res.status(200).json({
        message: "Clinic retrieved successfully",
        clinic: clinic.rows[0],
      });
    } catch (err) {
      console.error("Get clinic error:", err.message);
      res.status(500).json({ error: "Error retrieving clinic" });
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
      contact_number,
      email,
      operating_hours,
      status,
    } = req.body || {};

    if (!clinic_name) {
      return res.status(400).json({
        error: "Clinic name is required",
      });
    }

    try {
      const updatedClinic = await pool.query(
        `UPDATE public.clinics
         SET clinic_name = $1,
             address = $2,
             contact_number = $3,
             email = $4,
             operating_hours = $5,
             status = $6
         WHERE clinic_id = $7
         RETURNING *`,
        [
          clinic_name,
          address || null,
          contact_number || null,
          email || null,
          operating_hours || null,
          status || "Active",
          clinic_id,
        ],
      );

      if (updatedClinic.rows.length === 0) {
        return res.status(404).json({ error: "Clinic not found" });
      }

      res.status(200).json({
        message: "Clinic updated successfully",
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic error:", err.message);
      res.status(500).json({ error: "Error updating clinic" });
    }
  },
);

// ADMIN: UPDATE CLINIC STATUS
router.put(
  "/:clinic_id/status",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const { status } = req.body || {};

    const allowedStatuses = ["Active", "Inactive"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required. Use Active or Inactive.",
      });
    }

    try {
      const updatedClinic = await pool.query(
        `UPDATE public.clinics
         SET status = $1
         WHERE clinic_id = $2
         RETURNING *`,
        [status, clinic_id],
      );

      if (updatedClinic.rows.length === 0) {
        return res.status(404).json({ error: "Clinic not found" });
      }

      res.status(200).json({
        message: `Clinic status updated to ${status}`,
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic status error:", err.message);
      res.status(500).json({ error: "Error updating clinic status" });
    }
  },
);

module.exports = router;
