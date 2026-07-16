const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const createAuditLog = require("../utils/auditLogger");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const uploadDir = path.join(__dirname, "../uploads/xrays");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `xray-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const deleteUploadedFile = (filePath) => {
  if (!filePath) return;

  const fullPath = path.join(__dirname, "..", filePath);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

const normalizeAnnotationStatus = (status) => {
  if (!status) return null;

  const normalized = String(status).trim().toLowerCase();

  if (
    normalized === "confirmed" ||
    normalized === "confirm" ||
    normalized === "approved" ||
    normalized === "approve" ||
    normalized === "accepted" ||
    normalized === "accept"
  ) {
    return "Confirmed";
  }

  if (
    normalized === "rejected" ||
    normalized === "reject" ||
    normalized === "declined" ||
    normalized === "decline"
  ) {
    return "Rejected";
  }

  if (
    normalized === "suggested" ||
    normalized === "pending" ||
    normalized === "pending review"
  ) {
    return "Suggested";
  }

  return null;
};

const getRoboflowModelUrl = () => {
  if (process.env.ROBOFLOW_MODEL_URL) {
    return process.env.ROBOFLOW_MODEL_URL;
  }

  const model = process.env.ROBOFLOW_MODEL;
  const version = process.env.ROBOFLOW_VERSION;

  if (model && version) {
    return `https://detect.roboflow.com/${model}/${version}`;
  }

  return null;
};

const getDentistProfile = async (user_id, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        d.dentist_id,
        d.clinic_id,
        d.status AS dentist_status,
        c.clinic_name,
        c.status AS clinic_status,
        c.owner_user_id
     FROM public.dentists d
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE d.user_id = $1
     LIMIT 1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getAssistantProfile = async (user_id, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        a.assistant_id,
        a.clinic_id,
        a.status AS assistant_status,
        c.clinic_name,
        c.status AS clinic_status,
        c.owner_user_id
     FROM public.assistants a
     LEFT JOIN public.clinics c ON a.clinic_id = c.clinic_id
     WHERE a.user_id = $1
     LIMIT 1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getPatientProfile = async (user_id, queryClient = pool) => {
  const result = await queryClient.query(
    `SELECT
        p.patient_id,
        p.clinic_id,
        c.clinic_name,
        c.status AS clinic_status,
        c.owner_user_id
     FROM public.patients p
     LEFT JOIN public.clinics c ON p.clinic_id = c.clinic_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const validateStaffClinicContext = (profile, roleLabel) => {
  if (!profile) {
    return {
      allowed: false,
      statusCode: 404,
      error: `${roleLabel} profile not found.`,
    };
  }

  if (!profile.clinic_id) {
    return {
      allowed: false,
      statusCode: 400,
      error: `${roleLabel} is not assigned to a clinic location.`,
    };
  }

  const accountStatus =
    roleLabel === "Dentist" ? profile.dentist_status : profile.assistant_status;

  if (accountStatus !== "Active") {
    return {
      allowed: false,
      statusCode: 403,
      error: `${roleLabel} account is currently inactive.`,
    };
  }

  if (!profile.clinic_name) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Assigned clinic location no longer exists.",
    };
  }

  if (profile.clinic_status !== "Active") {
    return {
      allowed: false,
      statusCode: 403,
      error: "Assigned clinic location is currently inactive.",
    };
  }

  return { allowed: true };
};

const validatePatientClinicContext = (patient) => {
  if (!patient) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Patient profile not found.",
    };
  }

  if (!patient.clinic_id) {
    return {
      allowed: false,
      statusCode: 400,
      error: "Patient account is not assigned to a clinic location.",
    };
  }

  if (!patient.clinic_name) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Assigned clinic location no longer exists.",
    };
  }

  if (patient.clinic_status !== "Active") {
    return {
      allowed: false,
      statusCode: 403,
      error: "Assigned clinic location is currently inactive.",
    };
  }

  return { allowed: true };
};

const getRecordContext = async (record_id) => {
  const result = await pool.query(
    `SELECT
        dr.record_id,
        dr.patient_id,
        dr.dentist_id,
        COALESCE(dr.status, 'Active') AS record_status,
        d.clinic_id AS dentist_clinic_id,
        d.status AS dentist_status,
        p.clinic_id AS patient_clinic_id,
        c.clinic_id,
        c.clinic_name,
        c.status AS clinic_status,
        c.owner_user_id,
        os.plan_id AS subscription_plan_id,
        os.end_date AS subscription_end_date,
        os.subscription_status,
        sp.plan_name,
        sp.max_xrays,
        sp.storage_limit_mb
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     JOIN public.patients p ON dr.patient_id = p.patient_id
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     LEFT JOIN public.owner_subscriptions os
       ON os.owner_user_id = c.owner_user_id
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE dr.record_id = $1`,
    [record_id],
  );

  return result.rows[0] || null;
};

const getAccessibleRecordForXray = async (req, record_id) => {
  const role = req.user.role;
  const user_id = req.user.user_id;
  const record = await getRecordContext(record_id);

  if (!record) {
    return {
      allowed: false,
      error: "Dental record not found.",
      statusCode: 404,
      record: null,
    };
  }

  if (record.record_status === "Archived") {
    return {
      allowed: false,
      error: "X-ray actions are unavailable for an archived dental record.",
      statusCode: 400,
      record,
    };
  }

  if (
    !record.clinic_id ||
    !record.patient_clinic_id ||
    Number(record.clinic_id) !== Number(record.patient_clinic_id)
  ) {
    return {
      allowed: false,
      error:
        "This dental record has an invalid cross-clinic assignment and cannot be used for X-ray operations.",
      statusCode: 409,
      record,
    };
  }

  if (role === "Admin") {
    return {
      allowed: true,
      error: null,
      statusCode: 200,
      record,
    };
  }

  if (role === "Dentist") {
    const dentist = await getDentistProfile(user_id);
    const context = validateStaffClinicContext(dentist, "Dentist");

    if (!context.allowed) {
      return { ...context, record };
    }

    if (
      Number(record.dentist_id) !== Number(dentist.dentist_id) ||
      Number(record.clinic_id) !== Number(dentist.clinic_id)
    ) {
      return {
        allowed: false,
        error:
          "This dental record is not assigned to this dentist or clinic location.",
        statusCode: 403,
        record,
      };
    }

    return {
      allowed: true,
      error: null,
      statusCode: 200,
      record,
    };
  }

  if (isAssistantRole(role)) {
    const assistant = await getAssistantProfile(user_id);
    const context = validateStaffClinicContext(assistant, "Assistant");

    if (!context.allowed) {
      return { ...context, record };
    }

    if (Number(record.clinic_id) !== Number(assistant.clinic_id)) {
      return {
        allowed: false,
        error:
          "This dental record is not under the assistant's assigned clinic location.",
        statusCode: 403,
        record,
      };
    }

    return {
      allowed: true,
      error: null,
      statusCode: 200,
      record,
    };
  }

  if (role === "Patient") {
    const patient = await getPatientProfile(user_id);
    const context = validatePatientClinicContext(patient);

    if (!context.allowed) {
      return { ...context, record };
    }

    if (
      Number(record.patient_id) !== Number(patient.patient_id) ||
      Number(record.clinic_id) !== Number(patient.clinic_id)
    ) {
      return {
        allowed: false,
        error:
          "This dental record does not belong to this patient or assigned clinic location.",
        statusCode: 403,
        record,
      };
    }

    return {
      allowed: true,
      error: null,
      statusCode: 200,
      record,
    };
  }

  return {
    allowed: false,
    error: "Access denied.",
    statusCode: 403,
    record,
  };
};

const getAccessibleXray = async (req, xray_id) => {
  const xrayResult = await pool.query(
    `SELECT 
        x.xray_id,
        x.record_id,
        x.tooth_number,
        x.file_path,
        COALESCE(x.file_size_bytes, 0) AS file_size_bytes,
        x.upload_date,
        dr.patient_id,
        dr.dentist_id,
        d.clinic_id,
        d.status AS dentist_status,
        p.clinic_id AS patient_clinic_id,
        c.clinic_name,
        c.status AS clinic_status
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     JOIN public.patients p ON dr.patient_id = p.patient_id
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE x.xray_id = $1`,
    [xray_id],
  );

  if (xrayResult.rows.length === 0) {
    return {
      allowed: false,
      error: "X-ray not found",
      statusCode: 404,
      xray: null,
    };
  }

  const xray = xrayResult.rows[0];
  const access = await getAccessibleRecordForXray(req, xray.record_id);

  if (!access.allowed) {
    return {
      allowed: false,
      error: access.error,
      statusCode: access.statusCode,
      xray,
    };
  }

  return {
    allowed: true,
    error: null,
    statusCode: 200,
    xray,
  };
};

const checkClinicSubscriptionActiveForXray = async (record_id) => {
  const record = await getRecordContext(record_id);

  if (!record) {
    return {
      allowed: false,
      statusCode: 404,
      error: "Dental record not found. Cannot validate subscription status.",
    };
  }

  if (!record.owner_user_id) {
    return {
      allowed: false,
      statusCode: 400,
      error:
        "Clinic location is not linked to a Clinic Owner account. Shared subscription status cannot be validated.",
    };
  }

  const isExpiredByDate =
    record.subscription_end_date &&
    new Date(record.subscription_end_date) < new Date();

  if (record.subscription_status !== "Active" || isExpiredByDate) {
    return {
      allowed: false,
      statusCode: 403,
      error:
        "The shared Clinic Owner subscription is inactive or expired. Please ask the Clinic Owner to renew or change the subscription before using X-ray features.",
    };
  }

  if (!record.subscription_plan_id) {
    return {
      allowed: false,
      statusCode: 403,
      error:
        "The Clinic Owner account has no shared subscription plan assigned.",
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    error: null,
    owner_user_id: record.owner_user_id,
  };
};

const checkClinicXrayLimit = async (record_id, newFileSizeBytes) => {
  const record = await getRecordContext(record_id);

  if (!record) {
    return {
      allowed: false,
      error: "Dental record not found. Cannot validate subscription limits.",
    };
  }

  const subscriptionCheck =
    await checkClinicSubscriptionActiveForXray(record_id);

  if (!subscriptionCheck.allowed) {
    return {
      allowed: false,
      error: subscriptionCheck.error,
    };
  }

  const xrayCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     JOIN public.patients p ON dr.patient_id = p.patient_id
     JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE c.owner_user_id = $1
     AND p.clinic_id = d.clinic_id`,
    [record.owner_user_id],
  );

  const storageResult = await pool.query(
    `SELECT
        COALESCE(
          SUM(COALESCE(x.file_size_bytes, 0)),
          0
        )::bigint AS total_bytes
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     JOIN public.patients p ON dr.patient_id = p.patient_id
     JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE c.owner_user_id = $1
     AND p.clinic_id = d.clinic_id`,
    [record.owner_user_id],
  );

  const currentXrays = xrayCountResult.rows[0].count;
  const currentBytes = Number(storageResult.rows[0].total_bytes || 0);

  const maxXrays =
    record.max_xrays === null || record.max_xrays === undefined
      ? null
      : Number(record.max_xrays);

  const storageLimitMb =
    record.storage_limit_mb === null || record.storage_limit_mb === undefined
      ? null
      : Number(record.storage_limit_mb);

  const storageLimitBytes =
    storageLimitMb === null ? null : storageLimitMb * 1024 * 1024;

  if (maxXrays !== null && currentXrays >= maxXrays) {
    return {
      allowed: false,
      error: `The Clinic Owner account has reached the shared X-ray upload limit for the ${record.plan_name} plan. Limit: ${maxXrays}.`,
    };
  }

  if (
    storageLimitBytes !== null &&
    currentBytes + Number(newFileSizeBytes || 0) > storageLimitBytes
  ) {
    const usedMb = currentBytes / 1024 / 1024;
    const newMb = Number(newFileSizeBytes || 0) / 1024 / 1024;

    return {
      allowed: false,
      error: `The Clinic Owner account has reached the shared storage limit for the ${record.plan_name} plan. Used: ${usedMb.toFixed(
        2,
      )} MB, new file: ${newMb.toFixed(2)} MB, limit: ${storageLimitMb} MB.`,
    };
  }

  return {
    allowed: true,
    error: null,
    owner_user_id: record.owner_user_id,
  };
};

const mapRoboflowLabel = (rawLabel) => {
  if (!rawLabel) return "Possible dental finding";

  const normalized = rawLabel.toLowerCase();

  if (normalized.includes("cavity") || normalized.includes("caries")) {
    return "Possible cavity";
  }

  if (normalized.includes("impacted")) {
    return "Possible impacted tooth";
  }

  if (normalized.includes("infection") || normalized.includes("abscess")) {
    return "Possible infection";
  }

  if (normalized.includes("bone")) {
    return "Possible bone loss";
  }

  if (normalized.includes("filling")) {
    return "Existing filling";
  }

  if (normalized.includes("crown")) {
    return "Existing crown";
  }

  if (normalized.includes("root")) {
    return "Possible root concern";
  }

  return rawLabel
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getConfidenceLevel = (confidence) => {
  const percent = Number(confidence || 0) * 100;

  if (percent >= 80) return "High";
  if (percent >= 50) return "Moderate";
  return "Low";
};

const getFindingReason = (rawLabel, mappedLabel) => {
  const label = String(rawLabel || mappedLabel || "").toLowerCase();

  if (label.includes("cavity") || label.includes("caries")) {
    return "The AI detected a darkened or radiolucent area that may be associated with enamel or dentin breakdown, which can suggest possible dental caries.";
  }

  if (label.includes("impacted")) {
    return "The AI detected a tooth-like structure that may appear unerupted, partially erupted, or positioned abnormally compared with the surrounding teeth.";
  }

  if (label.includes("infection") || label.includes("abscess")) {
    return "The AI detected an abnormal radiographic area near the tooth root or surrounding bone that may be associated with infection or periapical changes.";
  }

  if (label.includes("bone")) {
    return "The AI detected changes in the surrounding bone level or density that may suggest possible bone loss or periodontal involvement.";
  }

  if (label.includes("filling")) {
    return "The AI detected a radiopaque area that may correspond to an existing dental filling or restorative material.";
  }

  if (label.includes("crown")) {
    return "The AI detected a radiopaque coverage-like structure that may correspond to an existing crown restoration.";
  }

  if (label.includes("root")) {
    return "The AI detected a finding near the root area, which may require dentist review to determine whether it relates to root condition, canal treatment, or pathology.";
  }

  return "The AI detected a visual pattern in the X-ray image that matched one of its trained dental finding categories. This should be reviewed clinically by the dentist.";
};

const generateXrayInterpretation = ({
  rawLabel,
  mappedLabel,
  confidence,
  xPosition,
  yPosition,
  width,
  height,
}) => {
  const percent = Number(confidence || 0) * 100;
  const confidenceLevel = getConfidenceLevel(confidence);
  const reason = getFindingReason(rawLabel, mappedLabel);

  let confidenceExplanation = "";

  if (confidenceLevel === "High") {
    confidenceExplanation =
      "The confidence is high, meaning the detected region strongly matched patterns learned by the AI model.";
  } else if (confidenceLevel === "Moderate") {
    confidenceExplanation =
      "The confidence is moderate, meaning the detected region has some matching features but still needs careful dentist verification.";
  } else {
    confidenceExplanation =
      "The confidence is low, meaning the detected region only weakly matched the AI model pattern and should be treated as a cautious suggestion.";
  }

  return [
    `AI Interpretation: ${mappedLabel}.`,
    `Reason: ${reason}`,
    `Confidence: ${percent.toFixed(1)}% (${confidenceLevel}). ${confidenceExplanation}`,
    `Location: The suggested finding is located around X ${xPosition.toFixed(
      1,
    )}% and Y ${yPosition.toFixed(
      1,
    )}% of the image, with an estimated box size of ${width.toFixed(
      1,
    )}% by ${height.toFixed(1)}%.`,
    "Clinical Reminder: This is not a final diagnosis. The dentist must review the X-ray, patient history, symptoms, and clinical examination before confirming or rejecting the finding.",
  ].join("\n");
};

const analyzeImageWithRoboflow = async (imagePath) => {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const modelUrl = getRoboflowModelUrl();

  if (!apiKey || !modelUrl) {
    throw new Error(
      "Roboflow API key or model URL is missing. Check ROBOFLOW_API_KEY and either ROBOFLOW_MODEL_URL or ROBOFLOW_MODEL plus ROBOFLOW_VERSION in your backend .env.",
    );
  }

  const fullImagePath = path.join(__dirname, "..", imagePath);

  if (!fs.existsSync(fullImagePath)) {
    throw new Error("X-ray image file was not found.");
  }

  const formData = new FormData();
  formData.append("file", fs.createReadStream(fullImagePath));

  const response = await axios.post(`${modelUrl}?api_key=${apiKey}`, formData, {
    headers: formData.getHeaders(),
  });

  return response.data;
};

// UPLOAD X-RAY
router.post(
  "/upload",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  upload.single("xray"),
  async (req, res) => {
    const { record_id, tooth_number } = req.body || {};

    if (!record_id) {
      if (req.file) {
        deleteUploadedFile(`uploads/xrays/${req.file.filename}`);
      }

      return res.status(400).json({
        error: "Record ID is required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "X-ray file is required.",
      });
    }

    const filePath = `uploads/xrays/${req.file.filename}`;
    const fileSizeBytes = req.file.size || 0;

    let dbInsertSucceeded = false;
    let insertedXray = null;

    console.log("XRAY UPLOAD START:", {
      originalname: req.file.originalname,
      filename: req.file.filename,
      multerPath: req.file.path,
      savedDbPath: filePath,
      fileExistsAtStart: fs.existsSync(req.file.path),
    });

    try {
      const access = await getAccessibleRecordForXray(req, record_id);

      if (!access.allowed) {
        console.log("XRAY UPLOAD BLOCKED BY ACCESS CHECK:", access.error);
        deleteUploadedFile(filePath);

        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const limitCheck = await checkClinicXrayLimit(record_id, fileSizeBytes);

      if (!limitCheck.allowed) {
        console.log("XRAY UPLOAD BLOCKED BY LIMIT CHECK:", limitCheck.error);
        deleteUploadedFile(filePath);

        return res.status(400).json({
          error: limitCheck.error,
        });
      }

      const newXray = await pool.query(
        `INSERT INTO public.xray_images
         (record_id, tooth_number, file_path, file_size_bytes, upload_date)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [record_id, tooth_number || null, filePath, fileSizeBytes],
      );

      dbInsertSucceeded = true;
      insertedXray = newXray.rows[0];

      console.log("XRAY DB INSERT SUCCESS:", {
        xray_id: insertedXray.xray_id,
        file_path: insertedXray.file_path,
        physicalFileStillExists: fs.existsSync(req.file.path),
      });

      try {
        await createAuditLog({
          user_id: req.user.user_id,
          action: "UPLOAD_XRAY",
          module: "X-rays",
          description: `Uploaded X-ray #${insertedXray.xray_id} for dental record #${record_id}.`,
          ip_address: req.ip,
        });
      } catch (auditErr) {
        console.error(
          "UPLOAD_XRAY audit log failed, but upload will continue:",
          auditErr,
        );
      }

      console.log("XRAY UPLOAD FINISHED:", {
        xray_id: insertedXray.xray_id,
        url: `/uploads/xrays/${req.file.filename}`,
        physicalFileStillExists: fs.existsSync(req.file.path),
      });

      return res.status(201).json({
        message: "X-ray uploaded successfully",
        assigned_clinic_id: access.record.clinic_id,
        assigned_clinic_name: access.record.clinic_name,
        xray: insertedXray,
      });
    } catch (err) {
      console.error("Upload X-ray error:", err);

      if (!dbInsertSucceeded) {
        console.log(
          "Deleting uploaded file because DB insert did not succeed:",
          filePath,
        );
        deleteUploadedFile(filePath);
      } else {
        console.log(
          "DB insert already succeeded. File will NOT be deleted:",
          filePath,
        );
      }

      return res.status(500).json({
        error: err.message || "Error uploading X-ray",
      });
    }
  },
);

// GET XRAYS BY RECORD
router.get(
  "/record/:record_id",
  authenticateToken,
  authorizeRoles(
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
    "Admin",
  ),
  async (req, res) => {
    const { record_id } = req.params;

    try {
      const access = await getAccessibleRecordForXray(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const xrays = await pool.query(
        `SELECT *
         FROM public.xray_images
         WHERE record_id = $1
         ORDER BY upload_date DESC`,
        [record_id],
      );

      res.status(200).json({
        message: "X-rays retrieved successfully",
        assigned_clinic_id: access.record.clinic_id,
        assigned_clinic_name: access.record.clinic_name,
        xrays: xrays.rows,
      });
    } catch (err) {
      console.error("Get X-rays error:", err);
      res.status(500).json({
        error: err.message || "Error retrieving X-rays",
      });
    }
  },
);

// GET SINGLE XRAY
router.get(
  "/:xray_id",
  authenticateToken,
  authorizeRoles(
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
    "Admin",
  ),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const access = await getAccessibleXray(req, xray_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      res.status(200).json({
        message: "X-ray retrieved successfully",
        assigned_clinic_id: access.xray.clinic_id,
        assigned_clinic_name: access.xray.clinic_name,
        xray: access.xray,
      });
    } catch (err) {
      console.error("Get X-ray error:", err);
      res.status(500).json({
        error: err.message || "Error retrieving X-ray",
      });
    }
  },
);

// DELETE XRAY
router.delete(
  "/:xray_id",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const access = await getAccessibleXray(req, xray_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const deletedXray = await pool.query(
        `DELETE FROM public.xray_images
         WHERE xray_id = $1
         RETURNING *`,
        [xray_id],
      );

      if (deletedXray.rows.length === 0) {
        return res.status(404).json({
          error: "X-ray not found",
        });
      }

      deleteUploadedFile(deletedXray.rows[0].file_path);

      await createAuditLog({
        user_id: req.user.user_id,
        action: "DELETE_XRAY",
        module: "X-rays",
        description: `Deleted X-ray #${deletedXray.rows[0].xray_id} from dental record #${deletedXray.rows[0].record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "X-ray deleted successfully",
        xray: deletedXray.rows[0],
      });
    } catch (err) {
      console.error("Delete X-ray error:", err);
      res.status(500).json({
        error: err.message || "Error deleting X-ray",
      });
    }
  },
);

// RUN AI ANALYSIS
router.post(
  "/:xray_id/analyze",
  authenticateToken,
  authorizeRoles("Dentist", "Patient"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const access = await getAccessibleXray(req, xray_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const xray = access.xray;

      const subscriptionCheck = await checkClinicSubscriptionActiveForXray(
        xray.record_id,
      );

      if (!subscriptionCheck.allowed) {
        return res.status(subscriptionCheck.statusCode).json({
          error: subscriptionCheck.error,
        });
      }

      if (xray.file_path?.toLowerCase().endsWith(".pdf")) {
        return res.status(400).json({
          error: "AI analysis is only available for image files, not PDFs.",
        });
      }

      const roboflowResult = await analyzeImageWithRoboflow(xray.file_path);
      const predictions = roboflowResult.predictions || [];

      if (predictions.length === 0) {
        await createAuditLog({
          user_id: req.user.user_id,
          action: "RUN_AI_ANALYSIS",
          module: "AI X-ray Analysis",
          description: `Ran AI analysis for X-ray #${xray_id}. No findings were detected.`,
          ip_address: req.ip,
        });

        return res.status(200).json({
          message: "AI analysis completed. No findings were detected.",
          annotations: [],
        });
      }

      const insertedAnnotations = [];

      for (const prediction of predictions) {
        const imageWidth = roboflowResult.image?.width || 1;
        const imageHeight = roboflowResult.image?.height || 1;

        const xPosition = ((prediction.x || 0) / imageWidth) * 100;
        const yPosition = ((prediction.y || 0) / imageHeight) * 100;
        const width = ((prediction.width || 0) / imageWidth) * 100;
        const height = ((prediction.height || 0) / imageHeight) * 100;

        const label = mapRoboflowLabel(prediction.class);

        const note = generateXrayInterpretation({
          rawLabel: prediction.class,
          mappedLabel: label,
          confidence: prediction.confidence,
          xPosition,
          yPosition,
          width,
          height,
        });

        const inserted = await pool.query(
          `INSERT INTO public.xray_annotations
           (
             xray_id,
             label,
             note,
             x_position,
             y_position,
             width,
             height,
             confidence,
             source,
             status,
             created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AI', 'Suggested', CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            xray_id,
            label,
            note,
            xPosition,
            yPosition,
            width,
            height,
            prediction.confidence || null,
          ],
        );

        insertedAnnotations.push(inserted.rows[0]);
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "RUN_AI_ANALYSIS",
        module: "AI X-ray Analysis",
        description: `Ran AI analysis for X-ray #${xray_id}. ${insertedAnnotations.length} annotation(s) were suggested.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message:
          "AI analysis completed. Suggestions with interpretations were saved and are pending dentist review.",
        annotations: insertedAnnotations,
      });
    } catch (err) {
      console.error("AI X-ray analysis error:", err);
      res.status(500).json({
        error: err.message || "Error analyzing X-ray",
      });
    }
  },
);

// GET XRAY ANNOTATIONS
router.get(
  "/:xray_id/annotations",
  authenticateToken,
  authorizeRoles(
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
    "Admin",
  ),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const access = await getAccessibleXray(req, xray_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      let annotationsQuery = `
        SELECT 
          xa.*,
          u.name AS dentist_name
        FROM public.xray_annotations xa
        LEFT JOIN public.dentists d ON xa.dentist_id = d.dentist_id
        LEFT JOIN public.users u ON d.user_id = u.user_id
        WHERE xa.xray_id = $1
      `;

      if (req.user.role === "Patient") {
        annotationsQuery += ` AND xa.status IN ('Suggested', 'Confirmed')`;
      }

      annotationsQuery += ` ORDER BY xa.created_at DESC`;

      const annotations = await pool.query(annotationsQuery, [xray_id]);

      const pendingCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.xray_annotations
         WHERE xray_id = $1
         AND status = 'Suggested'`,
        [xray_id],
      );

      res.status(200).json({
        message: "Annotations retrieved successfully",
        annotations: annotations.rows,
        pending_review_count: pendingCount.rows[0].count,
      });
    } catch (err) {
      console.error("Get X-ray annotations error:", err);
      res.status(500).json({
        error: err.message || "Error retrieving X-ray annotations",
      });
    }
  },
);

// CREATE MANUAL ANNOTATION
router.post(
  "/:xray_id/annotations",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  async (req, res) => {
    const { xray_id } = req.params;
    const { label, note, x_position, y_position, width, height } =
      req.body || {};

    if (!label || x_position === undefined || y_position === undefined) {
      return res.status(400).json({
        error: "Label, X position, and Y position are required.",
      });
    }

    try {
      const access = await getAccessibleXray(req, xray_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const subscriptionCheck = await checkClinicSubscriptionActiveForXray(
        access.xray.record_id,
      );

      if (!subscriptionCheck.allowed) {
        return res.status(subscriptionCheck.statusCode).json({
          error: subscriptionCheck.error,
        });
      }

      const dentist = await getDentistProfile(req.user.user_id);

      if (req.user.role === "Dentist") {
        const dentistContext = validateStaffClinicContext(dentist, "Dentist");

        if (!dentistContext.allowed) {
          return res
            .status(dentistContext.statusCode)
            .json({ error: dentistContext.error });
        }
      }

      const finalNote =
        note ||
        "Manual dentist annotation. This finding was added through clinical review and should be interpreted together with the patient record, symptoms, and dental examination.";

      const newAnnotation = await pool.query(
        `INSERT INTO public.xray_annotations
         (
           xray_id,
           dentist_id,
           label,
           note,
           x_position,
           y_position,
           width,
           height,
           confidence,
           source,
           status,
           created_at,
           reviewed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, 'Dentist', 'Confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          xray_id,
          dentist?.dentist_id || null,
          label,
          finalNote,
          Number(x_position),
          Number(y_position),
          width !== undefined && width !== "" ? Number(width) : 0,
          height !== undefined && height !== "" ? Number(height) : 0,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_XRAY_ANNOTATION",
        module: "AI X-ray Analysis",
        description: `Created manual annotation #${newAnnotation.rows[0].annotation_id} for X-ray #${xray_id}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Manual annotation created successfully",
        annotation: newAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Create annotation error:", err);

      res.status(500).json({
        error: err.message || "Error creating annotation",
      });
    }
  },
);

// UPDATE ANNOTATION DETAILS
router.put(
  "/annotations/:annotation_id",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  async (req, res) => {
    const { annotation_id } = req.params;

    const { label, note, x_position, y_position, width, height, status } =
      req.body || {};

    try {
      const annotationResult = await pool.query(
        `SELECT 
            xa.*,
            x.record_id,
            x.xray_id
         FROM public.xray_annotations xa
         JOIN public.xray_images x ON xa.xray_id = x.xray_id
         WHERE xa.annotation_id = $1`,
        [annotation_id],
      );

      if (annotationResult.rows.length === 0) {
        return res.status(404).json({
          error: "Annotation not found.",
        });
      }

      const annotation = annotationResult.rows[0];

      const access = await getAccessibleRecordForXray(
        req,
        annotation.record_id,
      );

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const subscriptionCheck = await checkClinicSubscriptionActiveForXray(
        annotation.record_id,
      );

      if (!subscriptionCheck.allowed) {
        return res.status(subscriptionCheck.statusCode).json({
          error: subscriptionCheck.error,
        });
      }

      const dentist = await getDentistProfile(req.user.user_id);

      if (req.user.role === "Dentist") {
        const dentistContext = validateStaffClinicContext(dentist, "Dentist");

        if (!dentistContext.allowed) {
          return res
            .status(dentistContext.statusCode)
            .json({ error: dentistContext.error });
        }
      }

      const normalizedStatus = status
        ? normalizeAnnotationStatus(status)
        : annotation.status;

      const updatedAnnotation = await pool.query(
        `UPDATE public.xray_annotations
         SET label = COALESCE($1, label),
             note = COALESCE($2, note),
             x_position = COALESCE($3, x_position),
             y_position = COALESCE($4, y_position),
             width = COALESCE($5, width),
             height = COALESCE($6, height),
             status = COALESCE($7, status),
             dentist_id = COALESCE($8, dentist_id),
             reviewed_at = CURRENT_TIMESTAMP
         WHERE annotation_id = $9
         RETURNING *`,
        [
          label || null,
          note || null,
          x_position !== undefined && x_position !== ""
            ? Number(x_position)
            : null,
          y_position !== undefined && y_position !== ""
            ? Number(y_position)
            : null,
          width !== undefined && width !== "" ? Number(width) : null,
          height !== undefined && height !== "" ? Number(height) : null,
          normalizedStatus,
          dentist?.dentist_id || null,
          annotation_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_XRAY_ANNOTATION",
        module: "AI X-ray Analysis",
        description: `Updated annotation #${annotation_id} for X-ray #${annotation.xray_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Annotation updated successfully",
        annotation: updatedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Update annotation error:", err);

      res.status(500).json({
        error: err.message || "Error updating annotation",
      });
    }
  },
);

// REVIEW ANNOTATION STATUS
const reviewAnnotationHandler = async (req, res) => {
  const { annotation_id } = req.params;
  const { status, review_status, new_status, label, note } = req.body || {};

  const requestedStatus = status || review_status || new_status;
  const reviewedStatus = normalizeAnnotationStatus(requestedStatus);

  if (!reviewedStatus) {
    return res.status(400).json({
      error:
        "Valid status is required. Use Confirmed, Rejected, Suggested, Approved, or Declined.",
    });
  }

  try {
    const annotationResult = await pool.query(
      `SELECT 
          xa.*,
          x.record_id,
          x.xray_id,
          dr.dentist_id,
          dr.patient_id,
          d.user_id AS record_dentist_user_id
       FROM public.xray_annotations xa
       JOIN public.xray_images x ON xa.xray_id = x.xray_id
       JOIN public.dental_records dr ON x.record_id = dr.record_id
       JOIN public.dentists d ON dr.dentist_id = d.dentist_id
       WHERE xa.annotation_id = $1`,
      [annotation_id],
    );

    if (annotationResult.rows.length === 0) {
      return res.status(404).json({
        error: "Annotation not found.",
      });
    }

    const annotation = annotationResult.rows[0];

    const access = await getAccessibleRecordForXray(req, annotation.record_id);

    if (!access.allowed) {
      return res.status(access.statusCode).json({
        error: access.error,
      });
    }

    const subscriptionCheck = await checkClinicSubscriptionActiveForXray(
      annotation.record_id,
    );

    if (!subscriptionCheck.allowed) {
      return res.status(subscriptionCheck.statusCode).json({
        error: subscriptionCheck.error,
      });
    }

    const dentist = await getDentistProfile(req.user.user_id);

    if (req.user.role === "Dentist") {
      const dentistContext = validateStaffClinicContext(dentist, "Dentist");

      if (!dentistContext.allowed) {
        return res
          .status(dentistContext.statusCode)
          .json({ error: dentistContext.error });
      }
    }

    const updatedAnnotation = await pool.query(
      `UPDATE public.xray_annotations
       SET status = $1,
           label = COALESCE($2, label),
           note = COALESCE($3, note),
           dentist_id = COALESCE($4, dentist_id),
           reviewed_at = CURRENT_TIMESTAMP
       WHERE annotation_id = $5
       RETURNING *`,
      [
        reviewedStatus,
        label || null,
        note || null,
        dentist?.dentist_id || null,
        annotation_id,
      ],
    );

    if (updatedAnnotation.rows.length === 0) {
      return res.status(404).json({
        error: "Annotation could not be updated because it was not found.",
      });
    }

    await createAuditLog({
      user_id: req.user.user_id,
      action: "REVIEW_AI_ANNOTATION",
      module: "AI X-ray Analysis",
      description: `Reviewed annotation #${annotation_id}. Status set to ${reviewedStatus}.`,
      ip_address: req.ip,
    });

    return res.status(200).json({
      message: "Annotation reviewed successfully",
      annotation: updatedAnnotation.rows[0],
    });
  } catch (err) {
    console.error("Review annotation error:", err);

    return res.status(500).json({
      error: err.message || "Error reviewing annotation.",
    });
  }
};

router.put(
  "/annotations/:annotation_id/review",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  reviewAnnotationHandler,
);

router.put(
  "/annotations/:annotation_id/status",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  reviewAnnotationHandler,
);

router.patch(
  "/annotations/:annotation_id/review",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  reviewAnnotationHandler,
);

router.patch(
  "/annotations/:annotation_id/status",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  reviewAnnotationHandler,
);

// DELETE ANNOTATION
router.delete(
  "/annotations/:annotation_id",
  authenticateToken,
  authorizeRoles("Dentist", "Admin"),
  async (req, res) => {
    const { annotation_id } = req.params;

    try {
      const annotationResult = await pool.query(
        `SELECT xa.*, x.record_id
         FROM public.xray_annotations xa
         JOIN public.xray_images x ON xa.xray_id = x.xray_id
         WHERE xa.annotation_id = $1`,
        [annotation_id],
      );

      if (annotationResult.rows.length === 0) {
        return res.status(404).json({
          error: "Annotation not found",
        });
      }

      const annotation = annotationResult.rows[0];

      const access = await getAccessibleRecordForXray(
        req,
        annotation.record_id,
      );

      if (!access.allowed) {
        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const subscriptionCheck = await checkClinicSubscriptionActiveForXray(
        annotation.record_id,
      );

      if (!subscriptionCheck.allowed) {
        return res.status(subscriptionCheck.statusCode).json({
          error: subscriptionCheck.error,
        });
      }

      const deletedAnnotation = await pool.query(
        `DELETE FROM public.xray_annotations
         WHERE annotation_id = $1
         RETURNING *`,
        [annotation_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "DELETE_AI_ANNOTATION",
        module: "AI X-ray Analysis",
        description: `Deleted annotation #${deletedAnnotation.rows[0].annotation_id} from X-ray #${deletedAnnotation.rows[0].xray_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Annotation deleted successfully",
        annotation: deletedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Delete annotation error:", err);
      res.status(500).json({
        error: err.message || "Error deleting annotation",
      });
    }
  },
);

module.exports = router;
