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

const normalizeNullableNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return fallback;

  return numberValue;
};

const normalizeFeatures = (features) => {
  if (Array.isArray(features)) {
    return features
      .map((feature) => String(feature || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return normalizeText(features, null);
};

const validatePlanInput = ({
  plan_name,
  price,
  max_clinics,
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
    max_clinics,
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

const planSelectFields = `
  plan_id,
  plan_name,
  plan_tier,
  price,
  billing_cycle,
  storage_limit,
  max_clinics,
  max_dentists,
  max_assistants,
  max_patients,
  max_records,
  max_xrays,
  storage_limit_mb,
  features,
  status,
  created_at
`;

const buildStorageLabel = (storageLimitMb) => {
  if (storageLimitMb === null || storageLimitMb === undefined) return null;

  const value = Number(storageLimitMb);

  if (Number.isNaN(value)) return null;

  if (value >= 1024) {
    const gb = value / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }

  return `${value} MB`;
};

// GET ACTIVE SUBSCRIPTION PLANS
router.get("/active-plans", async (req, res) => {
  try {
    const plans = await pool.query(
      `SELECT 
          ${planSelectFields}
       FROM public.subscription_plans
       WHERE status = 'Active'
       ORDER BY price ASC, plan_id ASC`,
    );

    res.status(200).json({
      message: "Active shared subscription plans retrieved successfully.",
      plans: plans.rows,
    });
  } catch (err) {
    console.error("Get active subscription plans error:", err.message);
    res.status(500).json({
      error: err.message || "Error retrieving active subscription plans.",
    });
  }
});

// ADMIN: CREATE SUBSCRIPTION PLAN
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const {
      plan_name,
      plan_tier,
      price,
      billing_cycle,
      storage_limit,
      max_clinics,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
      features,
      status,
    } = req.body || {};

    const validationError = validatePlanInput({
      plan_name,
      price,
      max_clinics,
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

      const normalizedStorageLimitMb = normalizeNullableNumber(
        storage_limit_mb,
        500,
      );

      const newPlan = await pool.query(
        `INSERT INTO public.subscription_plans
         (
           plan_name,
           plan_tier,
           price,
           billing_cycle,
           storage_limit,
           max_clinics,
           max_dentists,
           max_assistants,
           max_patients,
           max_records,
           max_xrays,
           storage_limit_mb,
           features,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          plan_name.trim(),
          normalizeText(plan_tier, "Standard"),
          normalizeNumber(price, 0),
          normalizeText(billing_cycle, "Monthly"),
          normalizeText(
            storage_limit,
            buildStorageLabel(normalizedStorageLimitMb),
          ),
          normalizeNullableNumber(max_clinics, 1),
          normalizeNullableNumber(max_dentists, 1),
          normalizeNullableNumber(max_assistants, 1),
          normalizeNullableNumber(max_patients, 50),
          normalizeNullableNumber(max_records, 100),
          normalizeNullableNumber(max_xrays, 100),
          normalizedStorageLimitMb,
          normalizeFeatures(features),
          normalizeText(status, "Active"),
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_SHARED_SUBSCRIPTION_PLAN",
        module: "Subscription Management",
        description: `Created shared subscription plan: ${newPlan.rows[0].plan_name}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Shared subscription plan created successfully.",
        plan: newPlan.rows[0],
      });
    } catch (err) {
      console.error("Create subscription plan error:", err.message);
      res.status(500).json({
        error: err.message || "Error creating subscription plan.",
      });
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
            ${planSelectFields}
         FROM public.subscription_plans
         ORDER BY plan_id DESC`,
      );

      res.status(200).json({
        message: "Shared subscription plans retrieved successfully.",
        plans: plans.rows,
      });
    } catch (err) {
      console.error("Get subscription plans error:", err.message);
      res.status(500).json({
        error: err.message || "Error retrieving subscription plans.",
      });
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
            ${planSelectFields}
         FROM public.subscription_plans
         WHERE plan_id = $1`,
        [plan_id],
      );

      if (plan.rows.length === 0) {
        return res.status(404).json({
          error: "Subscription plan not found.",
        });
      }

      res.status(200).json({
        message: "Shared subscription plan retrieved successfully.",
        plan: plan.rows[0],
      });
    } catch (err) {
      console.error("Get subscription plan error:", err.message);
      res.status(500).json({
        error: err.message || "Error retrieving subscription plan.",
      });
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
      plan_tier,
      price,
      billing_cycle,
      storage_limit,
      max_clinics,
      max_dentists,
      max_assistants,
      max_patients,
      max_records,
      max_xrays,
      storage_limit_mb,
      features,
      status,
    } = req.body || {};

    const validationError = validatePlanInput({
      plan_name,
      price,
      max_clinics,
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
        return res.status(404).json({
          error: "Subscription plan not found.",
        });
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

      const normalizedStorageLimitMb = normalizeNullableNumber(
        storage_limit_mb,
        500,
      );

      const updatedPlan = await pool.query(
        `UPDATE public.subscription_plans
         SET plan_name = $1,
             plan_tier = $2,
             price = $3,
             billing_cycle = $4,
             storage_limit = $5,
             max_clinics = $6,
             max_dentists = $7,
             max_assistants = $8,
             max_patients = $9,
             max_records = $10,
             max_xrays = $11,
             storage_limit_mb = $12,
             features = $13,
             status = $14
         WHERE plan_id = $15
         RETURNING *`,
        [
          plan_name.trim(),
          normalizeText(plan_tier, "Standard"),
          normalizeNumber(price, 0),
          normalizeText(billing_cycle, "Monthly"),
          normalizeText(
            storage_limit,
            buildStorageLabel(normalizedStorageLimitMb),
          ),
          normalizeNullableNumber(max_clinics, 1),
          normalizeNullableNumber(max_dentists, 1),
          normalizeNullableNumber(max_assistants, 1),
          normalizeNullableNumber(max_patients, 50),
          normalizeNullableNumber(max_records, 100),
          normalizeNullableNumber(max_xrays, 100),
          normalizedStorageLimitMb,
          normalizeFeatures(features),
          normalizeText(status, "Active"),
          plan_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_SHARED_SUBSCRIPTION_PLAN",
        module: "Subscription Management",
        description: `Updated shared subscription plan: ${updatedPlan.rows[0].plan_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Shared subscription plan updated successfully.",
        plan: updatedPlan.rows[0],
      });
    } catch (err) {
      console.error("Update subscription plan error:", err.message);
      res.status(500).json({
        error: err.message || "Error updating subscription plan.",
      });
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
        return res.status(404).json({
          error: "Subscription plan not found.",
        });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_SHARED_PLAN_STATUS",
        module: "Subscription Management",
        description: `Updated shared subscription plan ${updatedPlan.rows[0].plan_name} status to ${status}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Shared subscription plan status updated to ${status}.`,
        plan: updatedPlan.rows[0],
      });
    } catch (err) {
      console.error("Update subscription plan status error:", err.message);
      res.status(500).json({
        error: err.message || "Error updating subscription plan status.",
      });
    }
  },
);

module.exports = router;
