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

const getOwnerSubscriptionSource = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        c.owner_user_id
     FROM public.clinics c
     WHERE c.owner_user_id = $1
     AND c.status = 'Active'
     ORDER BY 
       CASE WHEN c.subscription_plan_id IS NULL THEN 1 ELSE 0 END,
       c.created_at ASC NULLS LAST,
       c.clinic_id ASC
     LIMIT 1`,
    [ownerUserId],
  );

  return result.rows[0] || null;
};

const getOwnerLocationCount = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.clinics
     WHERE owner_user_id = $1
     AND status = 'Active'`,
    [ownerUserId],
  );

  return Number(result.rows[0]?.count || 0);
};

const syncOwnerSubscriptionToAllLocations = async (
  client,
  ownerUserId,
  planId,
  billingCycle,
) => {
  const result = await client.query(
    `UPDATE public.clinics
     SET ${buildSubscriptionDateUpdateSQL()}
     WHERE owner_user_id = $2
     AND status = 'Active'
     RETURNING clinic_id, clinic_name, subscription_plan_id, subscription_status`,
    [planId, ownerUserId, billingCycle],
  );

  return result.rows;
};

const validateOwnerUsageAgainstPlan = async (client, ownerUserId, plan) => {
  const usageResult = await client.query(
    `WITH owner_clinics AS (
       SELECT clinic_id
       FROM public.clinics
       WHERE owner_user_id = $1
       AND status = 'Active'
     ),
     direct_patients AS (
       SELECT p.patient_id
       FROM public.patients p
       JOIN owner_clinics oc ON p.clinic_id = oc.clinic_id
       WHERE p.patient_id IS NOT NULL
     ),
     record_patients AS (
       SELECT DISTINCT dr.patient_id
       FROM public.dental_records dr
       JOIN public.dentists d ON dr.dentist_id = d.dentist_id
       JOIN owner_clinics oc ON d.clinic_id = oc.clinic_id
       WHERE dr.patient_id IS NOT NULL
       AND COALESCE(dr.status, 'Active') = 'Active'
     ),
     all_patients AS (
       SELECT patient_id FROM direct_patients
       UNION
       SELECT patient_id FROM record_patients
     )
     SELECT
       (SELECT COUNT(*)::int FROM owner_clinics) AS current_clinics,

       (SELECT COUNT(*)::int 
        FROM public.dentists d
        JOIN owner_clinics oc ON d.clinic_id = oc.clinic_id) AS current_dentists,

       (SELECT COUNT(*)::int 
        FROM public.assistants a
        JOIN owner_clinics oc ON a.clinic_id = oc.clinic_id) AS current_assistants,

       (SELECT COUNT(*)::int
        FROM all_patients) AS current_patients,

       (SELECT COUNT(*)::int
        FROM public.dental_records dr
        JOIN public.dentists d ON dr.dentist_id = d.dentist_id
        JOIN owner_clinics oc ON d.clinic_id = oc.clinic_id
        WHERE COALESCE(dr.status, 'Active') = 'Active') AS current_records,

       (SELECT COUNT(*)::int
        FROM public.xray_images x
        JOIN public.dental_records dr ON x.record_id = dr.record_id
        JOIN public.dentists d ON dr.dentist_id = d.dentist_id
        JOIN owner_clinics oc ON d.clinic_id = oc.clinic_id) AS current_xrays,

       (SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint
        FROM public.xray_images x
        JOIN public.dental_records dr ON x.record_id = dr.record_id
        JOIN public.dentists d ON dr.dentist_id = d.dentist_id
        JOIN owner_clinics oc ON d.clinic_id = oc.clinic_id) AS current_storage_bytes`,
    [ownerUserId],
  );

  const usage = usageResult.rows[0] || {};
  const violations = [];

  const currentClinics = Number(usage.current_clinics || 0);
  const currentDentists = Number(usage.current_dentists || 0);
  const currentAssistants = Number(usage.current_assistants || 0);
  const currentPatients = Number(usage.current_patients || 0);
  const currentRecords = Number(usage.current_records || 0);
  const currentXrays = Number(usage.current_xrays || 0);
  const currentStorageBytes = Number(usage.current_storage_bytes || 0);

  const maxClinics =
    plan.max_clinics === null || plan.max_clinics === undefined
      ? null
      : Number(plan.max_clinics);

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

  if (maxClinics !== null && currentClinics > maxClinics) {
    violations.push(`Clinic locations: ${currentClinics}/${maxClinics}`);
  }

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
    usage: {
      clinics: currentClinics,
      dentists: currentDentists,
      assistants: currentAssistants,
      patients: currentPatients,
      records: currentRecords,
      xrays: currentXrays,
      storage_bytes: currentStorageBytes,
      storage_used_mb: Number((currentStorageBytes / 1024 / 1024).toFixed(2)),
    },
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

      const clinic = await getOwnerSubscriptionSource(client, req.user.user_id);

      if (!clinic) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "No active clinic location is linked to this clinic owner account.",
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
          error:
            "This Clinic Owner account is already subscribed to the selected plan.",
        });
      }

      if (price <= 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Free plan does not require PayMongo checkout.",
        });
      }

      const usageValidation = await validateOwnerUsageAgainstPlan(
        client,
        req.user.user_id,
        plan,
      );

      if (!usageValidation.allowed) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "The combined usage across all clinic locations exceeds the selected plan limits. Please remove/archive data or choose a higher plan.",
          violations: usageValidation.violations,
        });
      }

      const amountInCentavos = Math.round(price * 100);

      const successUrl = `${FRONTEND_URL}/clinic-owner/subscription?payment=success`;
      const cancelUrl = `${FRONTEND_URL}/clinic-owner/subscription?payment=cancelled`;

      const checkoutPayload = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `${plan.plan_name} shared subscription for Clinic Owner account`,
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
                } shared subscription`,
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
        description: `Created PayMongo checkout for ${plan.plan_name} shared plan under Clinic Owner account.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Shared subscription checkout session created successfully.",
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

      const updatedLocations = await syncOwnerSubscriptionToAllLocations(
        client,
        payment.owner_user_id,
        payment.plan_id,
        payment.billing_cycle,
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "MANUAL_CONFIRM_PAYMENT",
        module: "Payments",
        description: `Payment ${payment_id} manually confirmed. Shared subscription changed to ${payment.plan_name} for all owned clinic locations.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Payment confirmed. Shared subscription changed to ${payment.plan_name} for all clinic locations.`,
        updated_locations: updatedLocations,
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

      const clinic = await getOwnerSubscriptionSource(client, req.user.user_id);

      if (!clinic) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "No active clinic location is linked to this clinic owner account.",
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
          error:
            "This Clinic Owner account is already subscribed to the selected plan.",
        });
      }

      if (price > 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Paid plans require PayMongo checkout. Use the checkout endpoint instead.",
        });
      }

      const usageValidation = await validateOwnerUsageAgainstPlan(
        client,
        req.user.user_id,
        plan,
      );

      if (!usageValidation.allowed) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "The combined usage across all clinic locations exceeds the selected plan limits. Please remove/archive data or choose a higher plan.",
          violations: usageValidation.violations,
        });
      }

      const updatedLocations = await syncOwnerSubscriptionToAllLocations(
        client,
        req.user.user_id,
        plan.plan_id,
        plan.billing_cycle,
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CHANGE_FREE_SUBSCRIPTION_PLAN",
        module: "Subscriptions",
        description: `Shared subscription changed to ${plan.plan_name} without checkout for all owned clinic locations.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `Shared subscription changed to ${plan.plan_name} for all clinic locations.`,
        plan,
        updated_locations: updatedLocations,
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

      const updatedLocations = await syncOwnerSubscriptionToAllLocations(
        client,
        payment.owner_user_id,
        payment.plan_id,
        payment.billing_cycle,
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: payment.owner_user_id,
        action: "PAYMONGO_WEBHOOK_PAYMENT_PAID",
        module: "Payments",
        description: `PayMongo webhook confirmed payment ${payment.payment_id}. Shared subscription changed to ${payment.plan_name} for all owned clinic locations.`,
        ip_address: req.ip,
      });

      return res.status(200).json({
        received: true,
        message: `Payment confirmed. Shared subscription changed to ${payment.plan_name} for all clinic locations.`,
        updated_locations: updatedLocations,
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
        error: err.message || "Error retrieving payment records.",
      });
    }
  },
);

module.exports = router;
