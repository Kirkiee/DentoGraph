const pool = require("../config/db");

const createAuditLog = async ({
  user_id = null,
  action,
  module,
  description = null,
  ip_address = null,
}) => {
  try {
    if (!action || !module) return;

    await pool.query(
      `INSERT INTO public.audit_logs
       (user_id, action, module, description, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [user_id, action, module, description, ip_address],
    );
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
};

module.exports = createAuditLog;
