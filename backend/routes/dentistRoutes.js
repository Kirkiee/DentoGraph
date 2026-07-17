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

    if (!name || !email || !license_number || !specialization) {
      return res.status(400).json({
        error: "Name, email, license number, and specialization are required",
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
          availability || "Managed through structured weekly availability",
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

// DENTIST: GET STRUCTURED WEEKLY AVAILABILITY AND SERVICES
router.get(
  "/availability",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    try {
      const dentistResult = await pool.query(
        `SELECT dentist_id, clinic_id FROM public.dentists WHERE user_id = $1 LIMIT 1`,
        [req.user.user_id],
      );
      if (!dentistResult.rows.length) {
        return res.status(404).json({ error: "Dentist profile not found." });
      }
      const dentist = dentistResult.rows[0];
      const [
        scheduleResult,
        servicesResult,
        selectedServicesResult,
        blockedResult,
      ] = await Promise.all([
        pool.query(
          `SELECT day_of_week,
                  CASE day_of_week WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
                    WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday'
                    WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' ELSE 'Sunday' END AS day_name,
                  is_available,
                  CASE WHEN start_time IS NULL THEN NULL ELSE TO_CHAR(start_time, 'HH24:MI') END AS start_time,
                  CASE WHEN end_time IS NULL THEN NULL ELSE TO_CHAR(end_time, 'HH24:MI') END AS end_time,
                  CASE WHEN break_start_time IS NULL THEN NULL ELSE TO_CHAR(break_start_time, 'HH24:MI') END AS break_start_time,
                  CASE WHEN break_end_time IS NULL THEN NULL ELSE TO_CHAR(break_end_time, 'HH24:MI') END AS break_end_time,
                  slot_duration_minutes
           FROM public.dentist_availability
           WHERE dentist_id = $1 ORDER BY day_of_week`,
          [dentist.dentist_id],
        ),
        pool.query(
          `SELECT ds.service_id, ds.service_name
           FROM public.clinic_services cs
           JOIN public.dental_services ds ON ds.service_id = cs.service_id
           WHERE cs.clinic_id = $1 AND cs.is_active = TRUE AND ds.is_active = TRUE
           ORDER BY ds.service_name`,
          [dentist.clinic_id],
        ),
        pool.query(
          `SELECT service_id FROM public.dentist_services
           WHERE dentist_id = $1 AND is_active = TRUE`,
          [dentist.dentist_id],
        ),
        pool.query(
          `SELECT unavailable_date_id, TO_CHAR(unavailable_date, 'YYYY-MM-DD') AS unavailable_date, reason
           FROM public.dentist_unavailable_dates
           WHERE dentist_id = $1 AND unavailable_date >= CURRENT_DATE
           ORDER BY unavailable_date`,
          [dentist.dentist_id],
        ),
      ]);
      return res.json({
        dentist_id: dentist.dentist_id,
        clinic_id: dentist.clinic_id,
        schedule: scheduleResult.rows,
        clinic_services: servicesResult.rows,
        selected_service_ids: selectedServicesResult.rows.map((row) =>
          Number(row.service_id),
        ),
        unavailable_dates: blockedResult.rows,
      });
    } catch (err) {
      console.error("Get dentist availability error:", err.message);
      return res
        .status(500)
        .json({ error: "Unable to retrieve dentist availability." });
    }
  },
);

// DENTIST: SAVE STRUCTURED WEEKLY AVAILABILITY AND SERVICES
router.put(
  "/availability",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const schedule = Array.isArray(req.body?.schedule) ? req.body.schedule : [];
    const serviceIds = Array.isArray(req.body?.service_ids)
      ? [...new Set(req.body.service_ids.map(Number).filter(Number.isInteger))]
      : [];
    if (schedule.length !== 7) {
      return res
        .status(400)
        .json({ error: "A complete seven-day schedule is required." });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const dentistResult = await client.query(
        `SELECT dentist_id, clinic_id FROM public.dentists WHERE user_id = $1 FOR UPDATE`,
        [req.user.user_id],
      );
      if (!dentistResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Dentist profile not found." });
      }
      const dentist = dentistResult.rows[0];
      for (const item of schedule) {
        const day = Number(item.day_of_week);
        const isAvailable = Boolean(item.is_available);
        if (!Number.isInteger(day) || day < 1 || day > 7) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Invalid day in availability schedule." });
        }
        if (
          isAvailable &&
          (!item.start_time ||
            !item.end_time ||
            item.start_time >= item.end_time)
        ) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              error: "Each available day requires a valid start and end time.",
            });
        }
        if (
          (item.break_start_time || item.break_end_time) &&
          (!item.break_start_time ||
            !item.break_end_time ||
            item.break_start_time >= item.break_end_time)
        ) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Break start and end times must both be valid." });
        }
        await client.query(
          `INSERT INTO public.dentist_availability
             (dentist_id, day_of_week, is_available, start_time, end_time,
              break_start_time, break_end_time, slot_duration_minutes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (dentist_id, day_of_week) DO UPDATE SET
             is_available = EXCLUDED.is_available,
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             break_start_time = EXCLUDED.break_start_time,
             break_end_time = EXCLUDED.break_end_time,
             slot_duration_minutes = EXCLUDED.slot_duration_minutes,
             updated_at = CURRENT_TIMESTAMP`,
          [
            dentist.dentist_id,
            day,
            isAvailable,
            isAvailable ? item.start_time : null,
            isAvailable ? item.end_time : null,
            isAvailable && item.break_start_time ? item.break_start_time : null,
            isAvailable && item.break_end_time ? item.break_end_time : null,
            Number(item.slot_duration_minutes) || 30,
          ],
        );
      }
      await client.query(
        `DELETE FROM public.dentist_services WHERE dentist_id = $1`,
        [dentist.dentist_id],
      );
      if (serviceIds.length) {
        const allowed = await client.query(
          `SELECT service_id FROM public.clinic_services
           WHERE clinic_id = $1 AND is_active = TRUE AND service_id = ANY($2::int[])`,
          [dentist.clinic_id, serviceIds],
        );
        if (allowed.rows.length !== serviceIds.length) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              error:
                "One or more selected services are not offered by the assigned clinic.",
            });
        }
        for (const serviceId of serviceIds) {
          await client.query(
            `INSERT INTO public.dentist_services (dentist_id, service_id, is_active)
             VALUES ($1,$2,TRUE)`,
            [dentist.dentist_id, serviceId],
          );
        }
      }
      await client.query(
        `UPDATE public.dentists SET availability = 'Managed through structured weekly availability' WHERE dentist_id = $1`,
        [dentist.dentist_id],
      );
      await client.query("COMMIT");
      return res.json({ message: "Dentist availability saved successfully." });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Save dentist availability error:", err.message);
      return res
        .status(500)
        .json({ error: "Unable to save dentist availability." });
    } finally {
      client.release();
    }
  },
);

router.post(
  "/availability/unavailable-dates",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { unavailable_date, reason } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(unavailable_date || ""))) {
      return res
        .status(400)
        .json({ error: "A valid unavailable date is required." });
    }
    try {
      const result = await pool.query(
        `INSERT INTO public.dentist_unavailable_dates (dentist_id, unavailable_date, reason)
         SELECT dentist_id, $2::date, NULLIF(TRIM($3), '') FROM public.dentists WHERE user_id = $1
         ON CONFLICT (dentist_id, unavailable_date) DO UPDATE SET reason = EXCLUDED.reason
         RETURNING unavailable_date_id, TO_CHAR(unavailable_date, 'YYYY-MM-DD') AS unavailable_date, reason`,
        [req.user.user_id, unavailable_date, reason || ""],
      );
      return res
        .status(201)
        .json({
          message: "Unavailable date saved.",
          unavailable_date: result.rows[0],
        });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Unable to save unavailable date." });
    }
  },
);

router.delete(
  "/availability/unavailable-dates/:id",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM public.dentist_unavailable_dates dud
         USING public.dentists d
         WHERE dud.unavailable_date_id = $1 AND dud.dentist_id = d.dentist_id AND d.user_id = $2
         RETURNING dud.unavailable_date_id`,
        [Number(req.params.id), req.user.user_id],
      );
      if (!result.rows.length)
        return res.status(404).json({ error: "Unavailable date not found." });
      return res.json({ message: "Unavailable date removed." });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Unable to remove unavailable date." });
    }
  },
);

module.exports = router;
