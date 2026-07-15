const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// ADMIN: GET AUDIT LOGS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { module, action, search } = req.query;

    try {
      let query = `
        SELECT 
          al.log_id,
          al.user_id,
          u.name AS user_name,
          u.email AS user_email,
          r.role_name,
          al.action,
          al.module,
          al.description,
          al.ip_address,
          al.created_at
        FROM public.audit_logs al
        LEFT JOIN public.users u ON al.user_id = u.user_id
        LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
        LEFT JOIN public.roles r ON ur.role_id = r.role_id
        WHERE 1 = 1
      `;

      const values = [];

      if (module && module !== "All") {
        values.push(module);
        query += ` AND al.module = $${values.length}`;
      }

      if (action && action !== "All") {
        values.push(action);
        query += ` AND al.action = $${values.length}`;
      }

      if (search && search.trim() !== "") {
        values.push(`%${search.trim().toLowerCase()}%`);
        query += `
          AND (
            LOWER(COALESCE(u.name, '')) LIKE $${values.length}
            OR LOWER(COALESCE(u.email, '')) LIKE $${values.length}
            OR LOWER(COALESCE(r.role_name, '')) LIKE $${values.length}
            OR LOWER(COALESCE(al.action, '')) LIKE $${values.length}
            OR LOWER(COALESCE(al.module, '')) LIKE $${values.length}
            OR LOWER(COALESCE(al.description, '')) LIKE $${values.length}
            OR LOWER(COALESCE(al.ip_address, '')) LIKE $${values.length}
            OR CAST(al.log_id AS TEXT) LIKE $${values.length}
            OR CAST(al.user_id AS TEXT) LIKE $${values.length}
          )
        `;
      }

      query += ` ORDER BY al.created_at DESC LIMIT 200`;

      const logs = await pool.query(query, values);

      const summary = await pool.query(
        `SELECT
            COUNT(*)::int AS total_logs,
            COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS logs_today,
            COUNT(DISTINCT user_id)::int AS active_users_logged,
            COUNT(*) FILTER (WHERE action ILIKE '%LOGIN%')::int AS login_logs,
            COUNT(*) FILTER (WHERE action ILIKE '%CREATE%')::int AS create_logs,
            COUNT(*) FILTER (
              WHERE action ILIKE '%UPDATE%'
                 OR action ILIKE '%CHANGE%'
                 OR action ILIKE '%SUBSCRIPTION%'
            )::int AS update_logs,
            COUNT(*) FILTER (
              WHERE action ILIKE '%DELETE%'
                 OR action ILIKE '%ARCHIVE%'
                 OR action ILIKE '%DEACTIVATE%'
            )::int AS critical_logs
         FROM public.audit_logs`,
      );

      const modules = await pool.query(
        `SELECT DISTINCT module
         FROM public.audit_logs
         WHERE module IS NOT NULL
         AND TRIM(module) <> ''
         ORDER BY module ASC`,
      );

      const actions = await pool.query(
        `SELECT DISTINCT action
         FROM public.audit_logs
         WHERE action IS NOT NULL
         AND TRIM(action) <> ''
         ORDER BY action ASC`,
      );

      res.status(200).json({
        message: "Audit logs retrieved successfully",
        summary: summary.rows[0],
        modules: modules.rows.map((item) => item.module),
        actions: actions.rows.map((item) => item.action),
        logs: logs.rows,
      });
    } catch (err) {
      console.error("Get audit logs error:", err.message);
      res.status(500).json({
        error: "Error retrieving audit logs",
      });
    }
  },
);

module.exports = router;
