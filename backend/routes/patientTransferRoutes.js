const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const cleanText = (value) => String(value ?? "").trim();

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getPatientContext = async (userId, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
       p.patient_id,
       p.user_id,
       p.clinic_id,
       c.clinic_name,
       c.status AS clinic_status
     FROM public.patients p
     JOIN public.clinics c ON c.clinic_id = p.clinic_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId],
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      status: 404,
      error: "Patient profile not found.",
    };
  }

  const patient = result.rows[0];

  if (patient.clinic_status !== "Active") {
    return {
      allowed: false,
      status: 403,
      error: "Your assigned clinic location is currently inactive.",
    };
  }

  return {
    allowed: true,
    ...patient,
  };
};

const getAuthorizedClinicIds = async (userId, role, queryClient = pool) => {
  if (role === "Clinic Owner") {
    const result = await queryClient.query(
      `SELECT clinic_id
       FROM public.clinics
       WHERE owner_user_id = $1
         AND status = 'Active'
       ORDER BY clinic_id`,
      [userId],
    );

    return result.rows.map((row) => Number(row.clinic_id));
  }

  if (role === "Dentist") {
    const result = await queryClient.query(
      `SELECT clinic_id
       FROM public.dentists
       WHERE user_id = $1
         AND status = 'Active'
       LIMIT 1`,
      [userId],
    );

    return result.rows.map((row) => Number(row.clinic_id));
  }

  if (role === "Assistant" || role === "Dental Assistant") {
    const result = await queryClient.query(
      `SELECT clinic_id
       FROM public.assistants
       WHERE user_id = $1
         AND status = 'Active'
       LIMIT 1`,
      [userId],
    );

    return result.rows.map((row) => Number(row.clinic_id));
  }

  if (role === "Admin") {
    const result = await queryClient.query(
      `SELECT clinic_id
       FROM public.clinics
       ORDER BY clinic_id`,
    );

    return result.rows.map((row) => Number(row.clinic_id));
  }

  return [];
};

const expirePendingRequests = async (queryClient = pool) => {
  await queryClient.query(
    `UPDATE public.patient_transfer_requests
     SET transfer_status = 'Expired',
         updated_at = CURRENT_TIMESTAMP
     WHERE transfer_status IN (
       'Pending Source Approval',
       'Pending Destination Approval'
     )
       AND expires_at <= CURRENT_TIMESTAMP`,
  );
};

const requestSelect = `
  SELECT
    t.transfer_id,
    t.patient_id,
    t.source_clinic_id,
    source_clinic.clinic_name AS source_clinic_name,
    t.destination_clinic_id,
    destination_clinic.clinic_name AS destination_clinic_name,
    t.requested_by_user_id,
    patient_user.name AS patient_name,
    patient_user.email AS patient_email,
    t.consent_statement,
    t.patient_consent_at,
    t.include_profile,
    t.include_dental_records,
    t.include_xrays,
    t.include_appointments,
    t.transfer_status,
    t.source_reviewed_by_user_id,
    source_reviewer.name AS source_reviewed_by_name,
    t.source_reviewed_at,
    t.destination_reviewed_by_user_id,
    destination_reviewer.name AS destination_reviewed_by_name,
    t.destination_reviewed_at,
    t.rejection_reason,
    t.expires_at,
    t.created_at,
    t.updated_at
  FROM public.patient_transfer_requests t
  JOIN public.patients p ON p.patient_id = t.patient_id
  JOIN public.users patient_user ON patient_user.user_id = p.user_id
  JOIN public.clinics source_clinic
    ON source_clinic.clinic_id = t.source_clinic_id
  JOIN public.clinics destination_clinic
    ON destination_clinic.clinic_id = t.destination_clinic_id
  LEFT JOIN public.users source_reviewer
    ON source_reviewer.user_id = t.source_reviewed_by_user_id
  LEFT JOIN public.users destination_reviewer
    ON destination_reviewer.user_id = t.destination_reviewed_by_user_id
`;

router.get(
  "/destination-clinics",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const context = await getPatientContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const result = await pool.query(
        `SELECT
           clinic_id,
           clinic_name,
           address,
           contact_number
         FROM public.clinics
         WHERE status = 'Active'
           AND clinic_id <> $1
         ORDER BY clinic_name`,
        [context.clinic_id],
      );

      return res.status(200).json({
        source_clinic: {
          clinic_id: context.clinic_id,
          clinic_name: context.clinic_name,
        },
        clinics: result.rows,
      });
    } catch (err) {
      console.error("Get transfer destination clinics error:", err.message);
      return res.status(500).json({
        error: "Unable to load destination clinics.",
      });
    }
  },
);

router.post(
  "/requests",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const destinationClinicId = parsePositiveInteger(
      req.body.destination_clinic_id,
    );
    const consentConfirmed = req.body.consent_confirmed === true;
    const consentStatement = cleanText(req.body.consent_statement);

    const includeProfile = req.body.include_profile !== false;
    const includeDentalRecords = req.body.include_dental_records !== false;
    const includeXrays = req.body.include_xrays !== false;
    const includeAppointments = req.body.include_appointments === true;

    if (!destinationClinicId) {
      return res.status(400).json({
        error: "Select a valid destination clinic.",
      });
    }

    if (!consentConfirmed || !consentStatement) {
      return res.status(400).json({
        error:
          "Patient consent and the consent statement are required before information can be transferred.",
      });
    }

    if (
      !includeProfile &&
      !includeDentalRecords &&
      !includeXrays &&
      !includeAppointments
    ) {
      return res.status(400).json({
        error: "Select at least one information category to transfer.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await expirePendingRequests(client);

      const context = await getPatientContext(req.user.user_id, client);

      if (!context.allowed) {
        await client.query("ROLLBACK");
        return res.status(context.status).json({ error: context.error });
      }

      if (Number(context.clinic_id) === destinationClinicId) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "The destination clinic must be different from your current clinic.",
        });
      }

      const destination = await client.query(
        `SELECT clinic_id, clinic_name
         FROM public.clinics
         WHERE clinic_id = $1
           AND status = 'Active'
         LIMIT 1`,
        [destinationClinicId],
      );

      if (destination.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "The selected destination clinic is unavailable.",
        });
      }

      const created = await client.query(
        `INSERT INTO public.patient_transfer_requests
         (
           patient_id,
           source_clinic_id,
           destination_clinic_id,
           requested_by_user_id,
           consent_statement,
           patient_consent_at,
           include_profile,
           include_dental_records,
           include_xrays,
           include_appointments
         )
         VALUES (
           $1, $2, $3, $4, $5, CURRENT_TIMESTAMP,
           $6, $7, $8, $9
         )
         RETURNING *`,
        [
          context.patient_id,
          context.clinic_id,
          destinationClinicId,
          req.user.user_id,
          consentStatement,
          includeProfile,
          includeDentalRecords,
          includeXrays,
          includeAppointments,
        ],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "REQUEST_PATIENT_INFORMATION_TRANSFER",
        module: "Patient Information Transfer",
        description:
          `Patient requested transfer from ${context.clinic_name} to ` +
          `${destination.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      return res.status(201).json({
        message:
          "Transfer request submitted. Your current clinic must approve it before the destination clinic can review it.",
        request: created.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Create patient transfer request error:", err.message);

      if (err.code === "23505") {
        return res.status(409).json({
          error:
            "You already have a pending transfer request for this destination clinic.",
        });
      }

      return res.status(500).json({
        error: "Unable to submit the transfer request.",
      });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/patient/requests",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      await expirePendingRequests();

      const context = await getPatientContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const result = await pool.query(
        `${requestSelect}
         WHERE t.patient_id = $1
         ORDER BY t.created_at DESC`,
        [context.patient_id],
      );

      return res.status(200).json({
        requests: result.rows,
      });
    } catch (err) {
      console.error("Get patient transfer requests error:", err.message);
      return res.status(500).json({
        error: "Unable to load transfer requests.",
      });
    }
  },
);

router.put(
  "/patient/requests/:transfer_id/cancel",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const transferId = parsePositiveInteger(req.params.transfer_id);

    if (!transferId) {
      return res.status(400).json({ error: "Invalid transfer request." });
    }

    try {
      const context = await getPatientContext(req.user.user_id);

      if (!context.allowed) {
        return res.status(context.status).json({ error: context.error });
      }

      const result = await pool.query(
        `UPDATE public.patient_transfer_requests
         SET transfer_status = 'Cancelled',
             updated_at = CURRENT_TIMESTAMP
         WHERE transfer_id = $1
           AND patient_id = $2
           AND transfer_status IN (
             'Pending Source Approval',
             'Pending Destination Approval'
           )
         RETURNING *`,
        [transferId, context.patient_id],
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          error: "Only a pending transfer request can be cancelled.",
        });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CANCEL_PATIENT_INFORMATION_TRANSFER",
        module: "Patient Information Transfer",
        description: `Patient cancelled transfer request ${transferId}.`,
        ip_address: req.ip,
      });

      return res.status(200).json({
        message: "Transfer request cancelled.",
        request: result.rows[0],
      });
    } catch (err) {
      console.error("Cancel patient transfer request error:", err.message);
      return res.status(500).json({
        error: "Unable to cancel the transfer request.",
      });
    }
  },
);

router.get(
  "/clinic/requests",
  authenticateToken,
  authorizeRoles(
    "Admin",
    "Clinic Owner",
    "Dentist",
    "Assistant",
    "Dental Assistant",
  ),
  async (req, res) => {
    try {
      await expirePendingRequests();

      const clinicIds = await getAuthorizedClinicIds(
        req.user.user_id,
        req.user.role,
      );

      if (clinicIds.length === 0) {
        return res.status(403).json({
          error: "No authorized clinic location is available.",
        });
      }

      const direction = cleanText(req.query.direction || "all").toLowerCase();

      let condition = `
        (
          t.source_clinic_id = ANY($1::int[])
          OR t.destination_clinic_id = ANY($1::int[])
        )
      `;

      if (direction === "outgoing") {
        condition = "t.source_clinic_id = ANY($1::int[])";
      } else if (direction === "incoming") {
        condition = "t.destination_clinic_id = ANY($1::int[])";
      }

      const result = await pool.query(
        `${requestSelect}
         WHERE ${condition}
         ORDER BY
           CASE
             WHEN t.transfer_status = 'Pending Source Approval' THEN 0
             WHEN t.transfer_status = 'Pending Destination Approval' THEN 1
             ELSE 2
           END,
           t.created_at DESC`,
        [clinicIds],
      );

      return res.status(200).json({
        authorized_clinic_ids: clinicIds,
        direction,
        requests: result.rows,
      });
    } catch (err) {
      console.error("Get clinic transfer requests error:", err.message);
      return res.status(500).json({
        error: "Unable to load clinic transfer requests.",
      });
    }
  },
);

router.put(
  "/clinic/requests/:transfer_id/review",
  authenticateToken,
  authorizeRoles(
    "Admin",
    "Clinic Owner",
    "Dentist",
    "Assistant",
    "Dental Assistant",
  ),
  async (req, res) => {
    const transferId = parsePositiveInteger(req.params.transfer_id);
    const decision = cleanText(req.body.decision);
    const rejectionReason = cleanText(req.body.rejection_reason);

    if (!transferId) {
      return res.status(400).json({ error: "Invalid transfer request." });
    }

    if (!["Approve", "Reject"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be Approve or Reject.",
      });
    }

    if (decision === "Reject" && !rejectionReason) {
      return res.status(400).json({
        error: "A rejection reason is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await expirePendingRequests(client);

      const clinicIds = await getAuthorizedClinicIds(
        req.user.user_id,
        req.user.role,
        client,
      );

      const transferResult = await client.query(
        `SELECT *
         FROM public.patient_transfer_requests
         WHERE transfer_id = $1
         FOR UPDATE`,
        [transferId],
      );

      if (transferResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Transfer request not found." });
      }

      const transfer = transferResult.rows[0];
      const isSourceReviewer = clinicIds.includes(
        Number(transfer.source_clinic_id),
      );
      const isDestinationReviewer = clinicIds.includes(
        Number(transfer.destination_clinic_id),
      );

      if (transfer.transfer_status === "Pending Source Approval") {
        if (!isSourceReviewer && req.user.role !== "Admin") {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: "Only the source clinic can complete this review stage.",
          });
        }

        if (decision === "Reject") {
          await client.query(
            `UPDATE public.patient_transfer_requests
             SET transfer_status = 'Rejected',
                 source_reviewed_by_user_id = $1,
                 source_reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE transfer_id = $3`,
            [req.user.user_id, rejectionReason, transferId],
          );
        } else {
          await client.query(
            `UPDATE public.patient_transfer_requests
             SET transfer_status = 'Pending Destination Approval',
                 source_reviewed_by_user_id = $1,
                 source_reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE transfer_id = $2`,
            [req.user.user_id, transferId],
          );
        }
      } else if (transfer.transfer_status === "Pending Destination Approval") {
        if (!isDestinationReviewer && req.user.role !== "Admin") {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error:
              "Only the destination clinic can complete this review stage.",
          });
        }

        if (decision === "Reject") {
          await client.query(
            `UPDATE public.patient_transfer_requests
             SET transfer_status = 'Rejected',
                 destination_reviewed_by_user_id = $1,
                 destination_reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE transfer_id = $3`,
            [req.user.user_id, rejectionReason, transferId],
          );
        } else {
          await client.query(
            `DELETE FROM public.patient_transfer_record_access
             WHERE transfer_id = $1`,
            [transferId],
          );

          if (transfer.include_dental_records) {
            await client.query(
              `INSERT INTO public.patient_transfer_record_access
               (
                 transfer_id,
                 record_type,
                 source_record_id,
                 granted_by_user_id
               )
               SELECT
                 $1,
                 'DENTAL_RECORD',
                 dr.record_id,
                 $2
               FROM public.dental_records dr
               JOIN public.dentists d
                 ON d.dentist_id = dr.dentist_id
               WHERE dr.patient_id = $3
                 AND d.clinic_id = $4
               ON CONFLICT DO NOTHING`,
              [
                transferId,
                req.user.user_id,
                transfer.patient_id,
                transfer.source_clinic_id,
              ],
            );
          }

          if (transfer.include_xrays) {
            await client.query(
              `INSERT INTO public.patient_transfer_record_access
               (
                 transfer_id,
                 record_type,
                 source_record_id,
                 granted_by_user_id
               )
               SELECT
                 $1,
                 'XRAY',
                 x.xray_id,
                 $2
               FROM public.xray_images x
               JOIN public.dental_records dr
                 ON dr.record_id = x.record_id
               JOIN public.dentists d
                 ON d.dentist_id = dr.dentist_id
               WHERE dr.patient_id = $3
                 AND d.clinic_id = $4
               ON CONFLICT DO NOTHING`,
              [
                transferId,
                req.user.user_id,
                transfer.patient_id,
                transfer.source_clinic_id,
              ],
            );
          }

          if (transfer.include_appointments) {
            await client.query(
              `INSERT INTO public.patient_transfer_record_access
               (
                 transfer_id,
                 record_type,
                 source_record_id,
                 granted_by_user_id
               )
               SELECT
                 $1,
                 'APPOINTMENT',
                 a.appointment_id,
                 $2
               FROM public.appointments a
               JOIN public.dentists d
                 ON d.dentist_id = a.dentist_id
               WHERE a.patient_id = $3
                 AND d.clinic_id = $4
               ON CONFLICT DO NOTHING`,
              [
                transferId,
                req.user.user_id,
                transfer.patient_id,
                transfer.source_clinic_id,
              ],
            );
          }

          await client.query(
            `UPDATE public.patient_transfer_requests
             SET transfer_status = 'Approved',
                 destination_reviewed_by_user_id = $1,
                 destination_reviewed_at = CURRENT_TIMESTAMP,
                 rejection_reason = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE transfer_id = $2`,
            [req.user.user_id, transferId],
          );
        }
      } else {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `This transfer request is already ${String(
            transfer.transfer_status,
          ).toLowerCase()}.`,
        });
      }

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action:
          decision === "Approve"
            ? "APPROVE_PATIENT_INFORMATION_TRANSFER"
            : "REJECT_PATIENT_INFORMATION_TRANSFER",
        module: "Patient Information Transfer",
        description:
          `${req.user.role} ${decision.toLowerCase()}d transfer request ` +
          `${transferId} during ${transfer.transfer_status}.`,
        ip_address: req.ip,
      });

      return res.status(200).json({
        message:
          decision === "Approve"
            ? transfer.transfer_status === "Pending Source Approval"
              ? "Source clinic approved the request. It is now waiting for destination clinic approval."
              : "Destination clinic approved the request. The authorized transfer package is now available."
            : "Transfer request rejected.",
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Review patient transfer request error:", {
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
      });

      return res.status(500).json({
        error: "Unable to review the transfer request.",
        reference_code: err.code || "PATIENT_TRANSFER_REVIEW_FAILED",
      });
    } finally {
      client.release();
    }
  },
);

router.get(
  "/requests/:transfer_id/package",
  authenticateToken,
  authorizeRoles(
    "Admin",
    "Patient",
    "Clinic Owner",
    "Dentist",
    "Assistant",
    "Dental Assistant",
  ),
  async (req, res) => {
    const transferId = parsePositiveInteger(req.params.transfer_id);

    if (!transferId) {
      return res.status(400).json({ error: "Invalid transfer request." });
    }

    try {
      const transferResult = await pool.query(
        `${requestSelect}
         WHERE t.transfer_id = $1
         LIMIT 1`,
        [transferId],
      );

      if (transferResult.rows.length === 0) {
        return res.status(404).json({ error: "Transfer request not found." });
      }

      const transfer = transferResult.rows[0];

      if (transfer.transfer_status !== "Approved") {
        return res.status(403).json({
          error: "The transfer package is available only after final approval.",
        });
      }

      let allowed = req.user.role === "Admin";

      if (req.user.role === "Patient") {
        const context = await getPatientContext(req.user.user_id);
        allowed =
          context.allowed &&
          Number(context.patient_id) === Number(transfer.patient_id);
      } else if (!allowed) {
        const clinicIds = await getAuthorizedClinicIds(
          req.user.user_id,
          req.user.role,
        );

        allowed = clinicIds.includes(Number(transfer.destination_clinic_id));
      }

      if (!allowed) {
        return res.status(403).json({
          error:
            "You are not authorized to view this transferred information package.",
        });
      }

      const profileResult = transfer.include_profile
        ? await pool.query(
            `SELECT
               p.patient_id,
               p.contact_number,
               TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
               p.address,
               p.gender,
               p.medical_history,
               p.dentition_type,
               p.emergency_contact_name,
               p.emergency_contact_number,
               u.name,
               u.email
             FROM public.patients p
             JOIN public.users u ON u.user_id = p.user_id
             WHERE p.patient_id = $1
             LIMIT 1`,
            [transfer.patient_id],
          )
        : { rows: [] };

      const dentalRecordsResult = await pool.query(
        `SELECT
           dr.record_id,
           dr.patient_id,
           dr.dentist_id,
           dentist_user.name AS dentist_name,
           source_clinic.clinic_name AS source_clinic_name,
           dr.date_created,
           dr.last_updated,
           dr.status,
           dr.record_source,
           dr.source_notes
         FROM public.patient_transfer_record_access access
         JOIN public.dental_records dr
           ON dr.record_id = access.source_record_id
         JOIN public.dentists d
           ON d.dentist_id = dr.dentist_id
         JOIN public.users dentist_user
           ON dentist_user.user_id = d.user_id
         JOIN public.clinics source_clinic
           ON source_clinic.clinic_id = d.clinic_id
         WHERE access.transfer_id = $1
           AND access.record_type = 'DENTAL_RECORD'
         ORDER BY dr.date_created DESC`,
        [transferId],
      );

      const recordIds = dentalRecordsResult.rows.map((row) =>
        Number(row.record_id),
      );

      const teethResult =
        recordIds.length > 0
          ? await pool.query(
              `SELECT
                 t.tooth_id,
                 t.record_id,
                 t.tooth_number,
                 t.tooth_status
               FROM public.teeth t
               WHERE t.record_id = ANY($1::int[])
               ORDER BY t.record_id, t.tooth_number`,
              [recordIds],
            )
          : { rows: [] };

      const toothIds = teethResult.rows.map((row) => Number(row.tooth_id));

      const treatmentsResult =
        toothIds.length > 0
          ? await pool.query(
              `SELECT
                 treatment_id,
                 tooth_id,
                 procedure_type,
                 description,
                 treatment_date
               FROM public.treatments
               WHERE tooth_id = ANY($1::int[])
               ORDER BY treatment_date DESC`,
              [toothIds],
            )
          : { rows: [] };

      const xraysResult = await pool.query(
        `SELECT
           x.xray_id,
           x.record_id,
           x.tooth_number,
           x.file_path,
           x.file_size_bytes,
           x.upload_date,
           dr.record_source,
           dentist_user.name AS dentist_name,
           source_clinic.clinic_name AS source_clinic_name
         FROM public.patient_transfer_record_access access
         JOIN public.xray_images x
           ON x.xray_id = access.source_record_id
         JOIN public.dental_records dr
           ON dr.record_id = x.record_id
         JOIN public.dentists d
           ON d.dentist_id = dr.dentist_id
         JOIN public.users dentist_user
           ON dentist_user.user_id = d.user_id
         JOIN public.clinics source_clinic
           ON source_clinic.clinic_id = d.clinic_id
         WHERE access.transfer_id = $1
           AND access.record_type = 'XRAY'
         ORDER BY x.upload_date DESC`,
        [transferId],
      );

      const appointmentsResult = await pool.query(
        `SELECT
           a.appointment_id,
           a.appointment_date,
           a.status,
           a.notes,
           a.appointment_type,
           a.cancellation_reason,
           dentist_user.name AS dentist_name,
           source_clinic.clinic_name AS source_clinic_name
         FROM public.patient_transfer_record_access access
         JOIN public.appointments a
           ON a.appointment_id = access.source_record_id
         JOIN public.dentists d
           ON d.dentist_id = a.dentist_id
         JOIN public.users dentist_user
           ON dentist_user.user_id = d.user_id
         JOIN public.clinics source_clinic
           ON source_clinic.clinic_id = d.clinic_id
         WHERE access.transfer_id = $1
           AND access.record_type = 'APPOINTMENT'
         ORDER BY a.appointment_date DESC`,
        [transferId],
      );

      const dentalRecords = dentalRecordsResult.rows.map((record) => ({
        ...record,
        teeth: teethResult.rows
          .filter(
            (tooth) => Number(tooth.record_id) === Number(record.record_id),
          )
          .map((tooth) => ({
            ...tooth,
            treatments: treatmentsResult.rows.filter(
              (treatment) =>
                Number(treatment.tooth_id) === Number(tooth.tooth_id),
            ),
          })),
      }));

      await createAuditLog({
        user_id: req.user.user_id,
        action: "VIEW_PATIENT_INFORMATION_TRANSFER_PACKAGE",
        module: "Patient Information Transfer",
        description: `${req.user.role} viewed transfer package ${transferId}.`,
        ip_address: req.ip,
      });

      return res.status(200).json({
        transfer,
        records: {
          patient_profile: profileResult.rows[0] || null,
          dental_records: dentalRecords,
          xrays: xraysResult.rows,
          appointments: appointmentsResult.rows,
        },
        notice:
          "These are the actual authorized patient records. Access is read-only and limited to continuity of care.",
      });
    } catch (err) {
      console.error("Get patient transfer package error:", err.message);
      return res.status(500).json({
        error: "Unable to load the transfer package.",
      });
    }
  },
);

module.exports = router;
