const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;

const getPayMongoAuthHeader = () => {
  const encodedKey = Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64");
  return `Basic ${encodedKey}`;
};

const getOwnedClinic = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT 
        clinic_id,
        clinic_name,
        subscription_plan_id,
        owner_user_id
     FROM public.clinics
     WHERE owner_user_id = $1
     AND status = 'Active'
     LIMIT 1`,
    [ownerUserId],
  );

  return result.rows[0] || null;
};

const validateClinicUsageAgainstPlan = async (client, clinicId, plan) => {
  const usageResult = await client.query(
    `SELECT
        (SELECT COUNT(*)::int 
         FROM public.dentists 
         WHERE clinic_id = $1) AS current_dentists,

        (SELECT COUNT(*)::int 
         FROM public.assistants 
         WHERE clinic_id = $1) AS current_assistants,

        (SELECT COUNT(DISTINCT dr.patient_id)::int
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active') AS current_patients,

        (SELECT COUNT(*)::int
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active') AS current_records,

        (SELECT COUNT(*)::int
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1) AS current_xrays,

        (SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1) AS current_storage_bytes`,
    [clinicId],
  );

  const usage = usageResult.rows[0];
  const violations = [];

  const currentDentists = Number(usage.current_dentists || 0);
  const currentAssistants = Number(usage.current_assistants || 0);
  const currentPatients = Number(usage.current_patients || 0);
  const currentRecords = Number(usage.current_records || 0);
  const currentXrays = Number(usage.current_xrays || 0);
  const currentStorageBytes = Number(usage.current_storage_bytes || 0);

  const maxDentists =
    plan.max_dentists === null || plan.max_dentists === undefined
      ? null
      : Number(plan.max_dentists);

  const maxAssistants =
    plan.max_assistants === null || plan.max_assistants === undefined
      ? null
      : Number(plan.max_assistants);

  const maxPatients =
    plan.max_patients === null || plan.max_patients === undefined
      ? null
      : Number(plan.max_patients);

  const maxRecords =
    plan.max_records === null || plan.max_records === undefined
      ? null
      : Number(plan.max_records);

  const maxXrays =
    plan.max_xrays === null || plan.max_xrays === undefined
      ? null
      : Number(plan.max_xrays);

  const storageLimitMb =
    plan.storage_limit_mb === null || plan.storage_limit_mb === undefined
      ? null
      : Number(plan.storage_limit_mb);

  const storageLimitBytes =
    storageLimitMb && storageLimitMb > 0 ? storageLimitMb * 1024 * 1024 : 0;

  if (maxDentists !== null && currentDentists > maxDentists) {
    violations.push(`Dentists: ${currentDentists}/${maxDentists}`);
  }

  if (maxAssistants !== null && currentAssistants > maxAssistants) {
    violations.push(`Assistants: ${currentAssistants}/${maxAssistants}`);
  }

  if (maxPatients !== null && currentPatients > maxPatients) {
    violations.push(`Patients: ${currentPatients}/${maxPatients}`);
  }

  if (maxRecords !== null && currentRecords > maxRecords) {
    violations.push(`Records: ${currentRecords}/${maxRecords}`);
  }

  if (maxXrays !== null && currentXrays > maxXrays) {
    violations.push(`X-rays: ${currentXrays}/${maxXrays}`);
  }

  if (storageLimitBytes > 0 && currentStorageBytes > storageLimitBytes) {
    const usedMb = currentStorageBytes / 1024 / 1024;
    violations.push(`Storage: ${usedMb.toFixed(2)}MB/${storageLimitMb}MB`);
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
};

const verifyPayMongoSignature = (req) => {
  if (!PAYMONGO_WEBHOOK_SECRET) {
    console.warn("PAYMONGO_WEBHOOK_SECRET is missing. Skipping verification.");
    return true;
  }

  const signatureHeader = req.headers["paymongo-signature"];

  if (!signatureHeader || !req.rawBody) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", PAYMONGO_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  return signatureHeader.includes(expectedSignature);
};

const buildSubscriptionDateUpdateSQL = () => {
  return `
    subscription_plan_id = $1,
    subscription_start_date = CURRENT_TIMESTAMP,
    subscription_end_date =
      CASE
        WHEN LOWER(COALESCE($3, 'monthly')) = 'yearly'
          THEN CURRENT_TIMESTAMP + INTERVAL '1 year'
        ELSE CURRENT_TIMESTAMP + INTERVAL '1 month'
      END,
    subscription_status = 'Active'
  `;
};

// CREATE PAYMONGO CHECKOUT SESSION
router.post(
  "/create-checkout",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { plan_id } = req.body || {};

    if (!plan_id) {
      return res.status(400).json({
        error: "plan_id is required.",
      });
    }

    if (!PAYMONGO_SECRET_KEY) {
      return res.status(500).json({
        error: "PAYMONGO_SECRET_KEY is missing in backend .env.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clinic = await getOwnedClinic(client, req.user.user_id);

      if (!clinic) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "No active clinic is linked to this clinic owner account.",
        });
      }

      const planResult = await client.query(
        `SELECT 
            plan_id,
            plan_name,
            plan_tier,
            price,
            billing_cycle,
            status,
            max_clinics,
            max_dentists,
            max_assistants,
            max_patients,
            max_records,
            max_xrays,
            storage_limit_mb
         FROM public.subscription_plans
         WHERE plan_id = $1
         AND status = 'Active'
         LIMIT 1`,
        [plan_id],
      );

      if (planResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Subscription plan not found or inactive.",
        });
      }

      const plan = planResult.rows[0];
      const price = Number(plan.price || 0);

      if (Number(clinic.subscription_plan_id) === Number(plan.plan_id)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This clinic is already subscribed to the selected plan.",
        });
      }

      if (price <= 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Free plan does not require PayMongo checkout.",
        });
      }

      const usageValidation = await validateClinicUsageAgainstPlan(
        client,
        clinic.clinic_id,
        plan,
      );

      if (!usageValidation.allowed) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "This clinic's current usage exceeds the selected plan limits. Please remove/archive data or choose a higher plan.",
          violations: usageValidation.violations,
        });
      }

      const amountInCentavos = Math.round(price * 100);

      const successUrl = `${FRONTEND_URL}/clinic-owner/payment-success`;
      const cancelUrl = `${FRONTEND_URL}/clinic-owner/payment-cancel`;

      const checkoutPayload = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `${plan.plan_name} subscription for ${clinic.clinic_name}`,
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [
              {
                currency: "PHP",
                amount: amountInCentavos,
                name: `${plan.plan_name} Plan`,
                quantity: 1,
                description: `${plan.plan_name} ${
                  plan.billing_cycle || ""
                } subscription`,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya"],
          },
        },
      };

      const paymongoResponse = await axios.post(
        "https://api.paymongo.com/v2/checkout_sessions",
        checkoutPayload,
        {
          headers: {
            Authorization: getPayMongoAuthHeader(),
            "Content-Type": "application/json",
          },
        },
      );

      const checkoutSession = paymongoResponse.data.data;
      const checkoutSessionId = checkoutSession.id;
      const checkoutUrl = checkoutSession.attributes.checkout_url;

      const paymentRecord = await client.query(
        `INSERT INTO public.payments
         (
           clinic_id,
           plan_id,
           owner_user_id,
           checkout_session_id,
           checkout_url,
           amount,
           currency,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PHP', 'Pending')
         RETURNING *`,
        [
          clinic.clinic_id,
          plan.plan_id,
          req.user.user_id,
          checkoutSessionId,
          checkoutUrl,
          price,
        ],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_PAYMONGO_CHECKOUT",
        module: "Payments",
        description: `Created PayMongo checkout for ${plan.plan_name} plan under ${clinic.clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Checkout session created successfully.",
        checkout_url: checkoutUrl,
        checkout_session_id: checkoutSessionId,
        payment: paymentRecord.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error(
        "Create PayMongo checkout error:",
        err.response?.data || err.message,
      );

      res.status(500).json({
        error:
          err.response?.data?.errors?.[0]?.detail ||
          err.message ||
          "Error creating PayMongo checkout session.",
      });
    } finally {
      client.release();
    }
  },
);

// ADMIN ONLY: Manual payment confirmation backup.
// This is only for testing or emergency admin correction.
// Normal subscription plan changes should be handled by the PayMongo webhook.
router.put(
  "/manual-confirm/:payment_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { payment_id } = req.params;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const paymentResult = await client.query(
        `SELECT 
            p.payment_id,
            p.clinic_id,
            p.plan_id,
            p.owner_user_id,
            p.status,
            sp.plan_name,
            sp.billing_cycle
         FROM public.payments p
         LEFT JOIN public.subscription_plans sp
           ON p.plan_id = sp.plan_id
         WHERE p.payment_id = $1
         LIMIT 1`,
        [payment_id],
      );

      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Payment record not found.",
        });
      }

      const payment = paymentResult.rows[0];

      await client.query(
        `UPDATE public.payments
         SET status = 'Paid',
             paid_at = CURRENT_TIMESTAMP
         WHERE payment_id = $1`,
        [payment_id],
      );

      await client.query(
        `UPDATE public.clinics
         SET ${buildSubscriptionDateUpdateSQL()}
         WHERE clinic_id = $2`,
        [payment.plan_id, payment.clinic_id, payment.billing_cycle],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "MANUAL_CONFIRM_PAYMENT",
        module: "Payments",
        description: `Payment ${payment_id} manually confirmed. Clinic subscription changed to ${payment.plan_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Payment confirmed. Clinic subscription changed to ${payment.plan_name}.`,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Manual confirm payment error:", err.message);

      res.status(500).json({
        error: err.message || "Error confirming payment.",
      });
    } finally {
      client.release();
    }
  },
);

// CLINIC OWNER: CANCEL OWN PENDING PAYMENT
router.put(
  "/cancel/:payment_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { payment_id } = req.params;

    try {
      const paymentResult = await pool.query(
        `SELECT 
            payment_id,
            owner_user_id,
            status
         FROM public.payments
         WHERE payment_id = $1
         LIMIT 1`,
        [payment_id],
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Payment record not found.",
        });
      }

      const payment = paymentResult.rows[0];

      if (Number(payment.owner_user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({
          error: "You cannot cancel another clinic owner's payment.",
        });
      }

      if (payment.status !== "Pending") {
        return res.status(400).json({
          error: "Only pending payments can be cancelled.",
        });
      }

      const updatedPayment = await pool.query(
        `UPDATE public.payments
         SET status = 'Cancelled'
         WHERE payment_id = $1
         RETURNING *`,
        [payment_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CANCEL_PENDING_PAYMENT",
        module: "Payments",
        description: `Clinic owner cancelled pending payment ${payment_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Pending payment cancelled successfully.",
        payment: updatedPayment.rows[0],
      });
    } catch (err) {
      console.error("Cancel pending payment error:", err.message);

      res.status(500).json({
        error: err.message || "Error cancelling pending payment.",
      });
    }
  },
);

// ADMIN: GET ALL PAYMENT RECORDS
router.get(
  "/admin/all-payments",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const payments = await pool.query(
        `SELECT 
            p.payment_id,
            p.clinic_id,
            p.plan_id,
            p.owner_user_id,
            p.checkout_session_id,
            p.checkout_url,
            p.amount,
            p.currency,
            p.status,
            p.paid_at,
            p.created_at,

            c.clinic_name,

            owner_user.name AS owner_name,
            owner_user.email AS owner_email,

            sp.plan_name,
            sp.plan_tier,
            sp.billing_cycle

         FROM public.payments p
         LEFT JOIN public.clinics c
           ON p.clinic_id = c.clinic_id
         LEFT JOIN public.users owner_user
           ON p.owner_user_id = owner_user.user_id
         LEFT JOIN public.subscription_plans sp
           ON p.plan_id = sp.plan_id
         ORDER BY p.created_at DESC`,
      );

      res.status(200).json({
        message: "All payment records retrieved successfully.",
        payments: payments.rows,
      });
    } catch (err) {
      console.error("Admin get all payments error:", err.message);

      res.status(500).json({
        error: err.message || "Error retrieving payment records.",
      });
    }
  },
);

// CLINIC OWNER: CHANGE TO FREE / NO-CHECKOUT PLAN
router.put(
  "/change-free-plan",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { plan_id } = req.body || {};

    if (!plan_id) {
      return res.status(400).json({
        error: "plan_id is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clinic = await getOwnedClinic(client, req.user.user_id);

      if (!clinic) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "No active clinic is linked to this clinic owner account.",
        });
      }

      const planResult = await client.query(
        `SELECT 
            plan_id,
            plan_name,
            plan_tier,
            price,
            billing_cycle,
            status,
            max_clinics,
            max_dentists,
            max_assistants,
            max_patients,
            max_records,
            max_xrays,
            storage_limit_mb
         FROM public.subscription_plans
         WHERE plan_id = $1
         AND status = 'Active'
         LIMIT 1`,
        [plan_id],
      );

      if (planResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Subscription plan not found or inactive.",
        });
      }

      const plan = planResult.rows[0];
      const price = Number(plan.price || 0);

      if (Number(clinic.subscription_plan_id) === Number(plan.plan_id)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "This clinic is already subscribed to the selected plan.",
        });
      }

      if (price > 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Paid plans require PayMongo checkout. Use the checkout endpoint instead.",
        });
      }

      const usageValidation = await validateClinicUsageAgainstPlan(
        client,
        clinic.clinic_id,
        plan,
      );

      if (!usageValidation.allowed) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "This clinic's current usage exceeds the selected plan limits. Please remove/archive data or choose a higher plan.",
          violations: usageValidation.violations,
        });
      }

      await client.query(
        `UPDATE public.clinics
         SET ${buildSubscriptionDateUpdateSQL()}
         WHERE clinic_id = $2`,
        [plan.plan_id, clinic.clinic_id, plan.billing_cycle],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CHANGE_FREE_SUBSCRIPTION_PLAN",
        module: "Subscriptions",
        description: `Clinic subscription changed to ${plan.plan_name} without checkout.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Clinic subscription changed to ${plan.plan_name}.`,
        plan,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Change free plan error:", err.message);

      res.status(500).json({
        error: err.message || "Error changing subscription plan.",
      });
    } finally {
      client.release();
    }
  },
);

// PAYMONGO WEBHOOK: AUTO-CONFIRM CHECKOUT PAYMENT
router.post("/webhook", async (req, res) => {
  // if (!verifyPayMongoSignature(req)) {
  //   return res.status(401).json({
  //     error: "Invalid PayMongo webhook signature.",
  //   });
  // }
  // IMPORTANT: ENABLE PAYMONGO SIGNATURE VERIFICATION BEFORE PRODUCTION DEPLOYMENT.

  try {
    const event = req.body;

    const eventType = event?.data?.attributes?.type;
    const resourceData = event?.data?.attributes?.data;
    const checkoutSessionId = resourceData?.id;

    console.log("PayMongo webhook received:", {
      eventType,
      checkoutSessionId,
    });

    if (!eventType) {
      return res.status(400).json({
        error: "Invalid webhook payload. Missing event type.",
      });
    }

    if (eventType !== "checkout_session.payment.paid") {
      return res.status(200).json({
        received: true,
        message: `Ignored event type: ${eventType}`,
      });
    }

    if (!checkoutSessionId) {
      return res.status(400).json({
        error: "Invalid webhook payload. Missing checkout session ID.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const paymentResult = await client.query(
        `SELECT 
            p.payment_id,
            p.clinic_id,
            p.plan_id,
            p.owner_user_id,
            p.status,
            sp.plan_name,
            sp.billing_cycle
         FROM public.payments p
         LEFT JOIN public.subscription_plans sp
           ON p.plan_id = sp.plan_id
         WHERE p.checkout_session_id = $1
         LIMIT 1`,
        [checkoutSessionId],
      );

      if (paymentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(200).json({
          received: true,
          message: "Payment record not found locally. Event acknowledged.",
        });
      }

      const payment = paymentResult.rows[0];

      if (payment.status === "Paid") {
        await client.query("ROLLBACK");

        return res.status(200).json({
          received: true,
          message: "Payment was already marked as paid.",
        });
      }

      await client.query(
        `UPDATE public.payments
         SET status = 'Paid',
             paid_at = CURRENT_TIMESTAMP
         WHERE payment_id = $1`,
        [payment.payment_id],
      );

      await client.query(
        `UPDATE public.clinics
         SET ${buildSubscriptionDateUpdateSQL()}
         WHERE clinic_id = $2`,
        [payment.plan_id, payment.clinic_id, payment.billing_cycle],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: payment.owner_user_id,
        action: "PAYMONGO_WEBHOOK_PAYMENT_PAID",
        module: "Payments",
        description: `PayMongo webhook confirmed payment ${payment.payment_id}. Clinic subscription changed to ${payment.plan_name}.`,
        ip_address: req.ip,
      });

      return res.status(200).json({
        received: true,
        message: `Payment confirmed. Clinic subscription changed to ${payment.plan_name}.`,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Webhook payment processing error:", err.message);

      return res.status(500).json({
        error: err.message || "Webhook payment processing failed.",
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("PayMongo webhook error:", err.message);

    return res.status(500).json({
      error: err.message || "Webhook failed.",
    });
  }
});

// CLINIC OWNER: GET OWN PAYMENT HISTORY
router.get(
  "/my-payments",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    try {
      const payments = await pool.query(
        `SELECT 
            p.payment_id,
            p.clinic_id,
            p.plan_id,
            p.owner_user_id,
            p.checkout_session_id,
            p.checkout_url,
            p.amount,
            p.currency,
            p.status,
            p.paid_at,
            p.created_at,

            sp.plan_name,
            sp.plan_tier,
            sp.billing_cycle,

            c.clinic_name

         FROM public.payments p
         LEFT JOIN public.subscription_plans sp
           ON p.plan_id = sp.plan_id
         LEFT JOIN public.clinics c
           ON p.clinic_id = c.clinic_id
         WHERE p.owner_user_id = $1
         ORDER BY p.created_at DESC`,
        [req.user.user_id],
      );

      res.status(200).json({
        message: "Payment history retrieved successfully.",
        payments: payments.rows,
      });
    } catch (err) {
      console.error("Get payment history error:", err.message);

      res.status(500).json({
        error: err.message || "Error retrieving payment history.",
      });
    }
  },
);

module.exports = router;
