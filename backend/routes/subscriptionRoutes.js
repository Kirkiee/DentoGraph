const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const normalizeNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return fallback;

  return numberValue;
};

const normalizeText = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value;
};

const validatePlanInput = ({
  plan_name,
  price,
  max_dentists,
  max_assistants,
  max_patients,
  max_records,
  max_xrays,
  storage_limit_mb,
}) => {
  if (!plan_name || !plan_name.trim()) {
    return "Plan name is required.";
  }

  const numericValues = {
    price,
    max_dentists,
    max_assistants,
    max_patients,
    max_records,
    max_xrays,
    storage_limit_mb,
  };

  for (const [field, value] of Object.entries(numericValues)) {
    if (value !== undefined && value !== null && value !== "") {
      const numberValue = Number(value);

      if (Number.isNaN(numberValue) || numberValue < 0) {
        return `${field} must be a valid non-negative number.`;
      }
    }
  }

  return null;
};

// ADMIN: CREATE SUBSCRIPTION PLAN
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const {
      plan_name,
      price,
      billing_cycle,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
      status,
    } = req.body || {};

    const validationError = validatePlanInput({
      plan_name,
      price,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
    });

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    try {
      const duplicateCheck = await pool.query(
        `SELECT plan_id
         FROM public.subscription_plans
         WHERE LOWER(plan_name) = LOWER($1)`,
        [plan_name.trim()],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error: "A subscription plan with this name already exists.",
        });
      }

      const newPlan = await pool.query(
        `INSERT INTO public.subscription_plans
         (
          plan_name,
          price,
          billing_cycle,
          max_dentists,
          max_assistants,
          max_patients,
          max_records,
          max_xrays,
          storage_limit_mb,
          status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          plan_name.trim(),
          normalizeNumber(price, 0),
          normalizeText(billing_cycle, "Monthly"),
          normalizeNumber(max_dentists, 1),
          normalizeNumber(max_assistants, 1),
          normalizeNumber(max_patients, 50),
          normalizeNumber(max_records, 100),
          normalizeNumber(max_xrays, 100),
          normalizeNumber(storage_limit_mb, 500),
          normalizeText(status, "Active"),
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_PLAN",
        module: "Subscription Management",
        description: `Created subscription plan: ${newPlan.rows[0].plan_name}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Subscription plan created successfully",
        plan: newPlan.rows[0],
      });
    } catch (err) {
      console.error("Create subscription plan error:", err.message);
      res.status(500).json({ error: "Error creating subscription plan" });
    }
  },
);

// ADMIN: GET ALL SUBSCRIPTION PLANS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const plans = await pool.query(
        `SELECT
            plan_id,
            plan_name,
            price,
            billing_cycle,
            max_dentists,
            max_assistants,
            max_patients,
            max_records,
            max_xrays,
            storage_limit_mb,
            status,
            created_at
         FROM public.subscription_plans
         ORDER BY plan_id DESC`,
      );

      res.status(200).json({
        message: "Subscription plans retrieved successfully",
        plans: plans.rows,
      });
    } catch (err) {
      console.error("Get subscription plans error:", err.message);
      res.status(500).json({ error: "Error retrieving subscription plans" });
    }
  },
);

// ADMIN: GET SINGLE SUBSCRIPTION PLAN
router.get(
  "/:plan_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { plan_id } = req.params;

    try {
      const plan = await pool.query(
        `SELECT
            plan_id,
            plan_name,
            price,
            billing_cycle,
            max_dentists,
            max_assistants,
            max_patients,
            max_records,
            max_xrays,
            storage_limit_mb,
            status,
            created_at
         FROM public.subscription_plans
         WHERE plan_id = $1`,
        [plan_id],
      );

      if (plan.rows.length === 0) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

      res.status(200).json({
        message: "Subscription plan retrieved successfully",
        plan: plan.rows[0],
      });
    } catch (err) {
      console.error("Get subscription plan error:", err.message);
      res.status(500).json({ error: "Error retrieving subscription plan" });
    }
  },
);

// ADMIN: UPDATE SUBSCRIPTION PLAN
router.put(
  "/:plan_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { plan_id } = req.params;

    const {
      plan_name,
      price,
      billing_cycle,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
      status,
    } = req.body || {};

    const validationError = validatePlanInput({
      plan_name,
      price,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
    });

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    try {
      const planCheck = await pool.query(
        `SELECT plan_id
         FROM public.subscription_plans
         WHERE plan_id = $1`,
        [plan_id],
      );

      if (planCheck.rows.length === 0) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

      const duplicateCheck = await pool.query(
        `SELECT plan_id
         FROM public.subscription_plans
         WHERE LOWER(plan_name) = LOWER($1)
         AND plan_id <> $2`,
        [plan_name.trim(), plan_id],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error: "Another subscription plan with this name already exists.",
        });
      }

      const updatedPlan = await pool.query(
        `UPDATE public.subscription_plans
         SET plan_name = $1,
             price = $2,
             billing_cycle = $3,
             max_dentists = $4,
             max_assistants = $5,
             max_patients = $6,
             max_records = $7,
             max_xrays = $8,
             storage_limit_mb = $9,
             status = $10
         WHERE plan_id = $11
         RETURNING *`,
        [
          plan_name.trim(),
          normalizeNumber(price, 0),
          normalizeText(billing_cycle, "Monthly"),
          normalizeNumber(max_dentists, 1),
          normalizeNumber(max_assistants, 1),
          normalizeNumber(max_patients, 50),
          normalizeNumber(max_records, 100),
          normalizeNumber(max_xrays, 100),
          normalizeNumber(storage_limit_mb, 500),
          normalizeText(status, "Active"),
          plan_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_PLAN",
        module: "Subscription Management",
        description: `Updated subscription plan: ${updatedPlan.rows[0].plan_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Subscription plan updated successfully",
        plan: updatedPlan.rows[0],
      });
    } catch (err) {
      console.error("Update subscription plan error:", err.message);
      res.status(500).json({ error: "Error updating subscription plan" });
    }
  },
);

// ADMIN: UPDATE SUBSCRIPTION PLAN STATUS
router.put(
  "/:plan_id/status",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { plan_id } = req.params;
    const { status } = req.body || {};

    const allowedStatuses = ["Active", "Inactive"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required. Use Active or Inactive.",
      });
    }

    try {
      const updatedPlan = await pool.query(
        `UPDATE public.subscription_plans
         SET status = $1
         WHERE plan_id = $2
         RETURNING *`,
        [status, plan_id],
      );

      if (updatedPlan.rows.length === 0) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_PLAN_STATUS",
        module: "Subscription Management",
        description: `Updated subscription plan ${updatedPlan.rows[0].plan_name} status to ${status}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Subscription plan status updated to ${status}`,
        plan: updatedPlan.rows[0],
      });
    } catch (err) {
      console.error("Update subscription plan status error:", err.message);
      res
        .status(500)
        .json({ error: "Error updating subscription plan status" });
    }
  },
);

module.exports = router;
