const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

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
      storage_limit,
      max_clinics,
      max_dentists,
      features,
      status,
    } = req.body || {};

    if (!plan_name) {
      return res.status(400).json({
        error: "Plan name is required",
      });
    }

    try {
      const newPlan = await pool.query(
        `INSERT INTO public.subscription_plans
         (
          plan_name,
          price,
          billing_cycle,
          storage_limit,
          max_clinics,
          max_dentists,
          features,
          status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          plan_name,
          price || 0,
          billing_cycle || "Monthly",
          storage_limit || null,
          max_clinics || 1,
          max_dentists || 1,
          features || null,
          status || "Active",
        ],
      );

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
        `SELECT *
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
        `SELECT *
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
      storage_limit,
      max_clinics,
      max_dentists,
      features,
      status,
    } = req.body || {};

    if (!plan_name) {
      return res.status(400).json({
        error: "Plan name is required",
      });
    }

    try {
      const updatedPlan = await pool.query(
        `UPDATE public.subscription_plans
         SET plan_name = $1,
             price = $2,
             billing_cycle = $3,
             storage_limit = $4,
             max_clinics = $5,
             max_dentists = $6,
             features = $7,
             status = $8
         WHERE plan_id = $9
         RETURNING *`,
        [
          plan_name,
          price || 0,
          billing_cycle || "Monthly",
          storage_limit || null,
          max_clinics || 1,
          max_dentists || 1,
          features || null,
          status || "Active",
          plan_id,
        ],
      );

      if (updatedPlan.rows.length === 0) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

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
