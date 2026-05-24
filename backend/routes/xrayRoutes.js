const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif|pdf/;
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];

  const extName = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase(),
  );

  const mimeType = allowedMimeTypes.includes(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG, WEBP, GIF, and PDF files are allowed"));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
});

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const getDentistProfile = async (user_id) => {
  const result = await pool.query(
    `SELECT dentist_id, clinic_id
     FROM public.dentists
     WHERE user_id = $1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getAssistantProfile = async (user_id) => {
  const result = await pool.query(
    `SELECT assistant_id, clinic_id
     FROM public.assistants
     WHERE user_id = $1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getPatientProfile = async (user_id) => {
  const result = await pool.query(
    `SELECT patient_id
     FROM public.patients
     WHERE user_id = $1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getDentalRecordBaseQuery = () => {
  return `
    SELECT 
      dr.record_id,
      dr.patient_id,
      dr.dentist_id,
      COALESCE(dr.status, 'Active') AS record_status,
      d.clinic_id,
      patient_user.name AS patient_name,
      dentist_user.name AS dentist_name,
      c.clinic_name
    FROM public.dental_records dr
    JOIN public.patients p ON dr.patient_id = p.patient_id
    JOIN public.users patient_user ON p.user_id = patient_user.user_id
    JOIN public.dentists d ON dr.dentist_id = d.dentist_id
    JOIN public.users dentist_user ON d.user_id = dentist_user.user_id
    LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
  `;
};

const getAccessibleRecord = async (req, record_id) => {
  const role = req.user.role;
  const user_id = req.user.user_id;

  if (role === "Admin") {
    const result = await pool.query(
      `${getDentalRecordBaseQuery()}
       WHERE dr.record_id = $1`,
      [record_id],
    );

    return {
      allowed: result.rows.length > 0,
      record: result.rows[0] || null,
      error: result.rows.length === 0 ? "Dental record not found" : null,
      statusCode: result.rows.length === 0 ? 404 : 200,
    };
  }

  if (role === "Dentist") {
    const dentist = await getDentistProfile(user_id);

    if (!dentist) {
      return {
        allowed: false,
        record: null,
        error: "Dentist profile not found",
        statusCode: 404,
      };
    }

    const result = await pool.query(
      `${getDentalRecordBaseQuery()}
       WHERE dr.record_id = $1
       AND dr.dentist_id = $2`,
      [record_id, dentist.dentist_id],
    );

    return {
      allowed: result.rows.length > 0,
      record: result.rows[0] || null,
      error:
        result.rows.length === 0
          ? "Dental record not found or not assigned to this dentist"
          : null,
      statusCode: result.rows.length === 0 ? 403 : 200,
    };
  }

  if (isAssistantRole(role)) {
    const assistant = await getAssistantProfile(user_id);

    if (!assistant) {
      return {
        allowed: false,
        record: null,
        error: "Assistant profile not found",
        statusCode: 404,
      };
    }

    if (!assistant.clinic_id) {
      return {
        allowed: false,
        record: null,
        error: "Assistant is not assigned to a clinic",
        statusCode: 400,
      };
    }

    const result = await pool.query(
      `${getDentalRecordBaseQuery()}
       WHERE dr.record_id = $1
       AND d.clinic_id = $2`,
      [record_id, assistant.clinic_id],
    );

    return {
      allowed: result.rows.length > 0,
      record: result.rows[0] || null,
      error:
        result.rows.length === 0
          ? "Dental record not found or not under assistant assigned clinic"
          : null,
      statusCode: result.rows.length === 0 ? 403 : 200,
    };
  }

  if (role === "Patient") {
    const patient = await getPatientProfile(user_id);

    if (!patient) {
      return {
        allowed: false,
        record: null,
        error: "Patient profile not found",
        statusCode: 404,
      };
    }

    const result = await pool.query(
      `${getDentalRecordBaseQuery()}
       WHERE dr.record_id = $1
       AND dr.patient_id = $2`,
      [record_id, patient.patient_id],
    );

    return {
      allowed: result.rows.length > 0,
      record: result.rows[0] || null,
      error:
        result.rows.length === 0
          ? "Dental record not found or does not belong to this patient"
          : null,
      statusCode: result.rows.length === 0 ? 403 : 200,
    };
  }

  return {
    allowed: false,
    record: null,
    error: "Access denied",
    statusCode: 403,
  };
};

const getXrayWithRecord = async (xray_id) => {
  const result = await pool.query(
    `SELECT 
        x.xray_id,
        x.record_id,
        x.tooth_id,
        t.tooth_number,
        x.file_path,
        x.upload_date,
        dr.patient_id,
        dr.dentist_id,
        COALESCE(dr.status, 'Active') AS record_status,
        d.clinic_id
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     LEFT JOIN public.teeth t ON x.tooth_id = t.tooth_id
     WHERE x.xray_id = $1`,
    [xray_id],
  );

  return result.rows[0] || null;
};

const ensureDentistCanAnnotateXray = async (req, xray_id) => {
  const xray = await getXrayWithRecord(xray_id);

  if (!xray) {
    return {
      allowed: false,
      xray: null,
      dentist: null,
      error: "X-ray image not found",
      statusCode: 404,
    };
  }

  const access = await getAccessibleRecord(req, xray.record_id);

  if (!access.allowed) {
    return {
      allowed: false,
      xray,
      dentist: null,
      error: access.error,
      statusCode: access.statusCode,
    };
  }

  if (xray.record_status === "Archived") {
    return {
      allowed: false,
      xray,
      dentist: null,
      error: "Cannot annotate an X-ray from an archived dental record.",
      statusCode: 400,
    };
  }

  const dentist = await getDentistProfile(req.user.user_id);

  if (!dentist) {
    return {
      allowed: false,
      xray,
      dentist: null,
      error: "Dentist profile not found",
      statusCode: 404,
    };
  }

  return {
    allowed: true,
    xray,
    dentist,
    error: null,
    statusCode: 200,
  };
};

const ensureUserCanAnalyzeXray = async (req, xray_id) => {
  const xray = await getXrayWithRecord(xray_id);

  if (!xray) {
    return {
      allowed: false,
      xray: null,
      dentist: null,
      error: "X-ray image not found",
      statusCode: 404,
    };
  }

  const access = await getAccessibleRecord(req, xray.record_id);

  if (!access.allowed) {
    return {
      allowed: false,
      xray,
      dentist: null,
      error: access.error,
      statusCode: access.statusCode,
    };
  }

  if (xray.record_status === "Archived" && req.user.role !== "Admin") {
    return {
      allowed: false,
      xray,
      dentist: null,
      error: "Cannot analyze an X-ray from an archived dental record.",
      statusCode: 400,
    };
  }

  if (req.user.role === "Dentist") {
    const dentist = await getDentistProfile(req.user.user_id);

    if (!dentist) {
      return {
        allowed: false,
        xray,
        dentist: null,
        error: "Dentist profile not found",
        statusCode: 404,
      };
    }

    return {
      allowed: true,
      xray,
      dentist,
      error: null,
      statusCode: 200,
    };
  }

  if (req.user.role === "Patient") {
    return {
      allowed: true,
      xray,
      dentist: null,
      error: null,
      statusCode: 200,
    };
  }

  return {
    allowed: false,
    xray,
    dentist: null,
    error: "Access denied",
    statusCode: 403,
  };
};

const mapLabel = (className = "") => {
  const normalized = className.toLowerCase().trim();

  if (normalized.includes("cavity") || normalized.includes("caries")) {
    return "Possible cavity";
  }

  if (normalized.includes("filling") || normalized.includes("fillings")) {
    return "Existing filling";
  }

  if (normalized.includes("impacted")) {
    return "Possible impacted tooth";
  }

  if (normalized.includes("implant")) {
    return "Dental implant detected";
  }

  return className || "AI-suggested finding";
};

// DENTIST / ASSISTANT: UPLOAD X-RAY IMAGE
router.post(
  "/upload",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  upload.single("xray"),
  async (req, res) => {
    const { record_id, tooth_id } = req.body || {};

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No X-ray file uploaded",
        });
      }

      if (!record_id) {
        return res.status(400).json({
          error: "record_id is required",
        });
      }

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.record_status === "Archived") {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          error: "Cannot upload X-rays to an archived dental record.",
        });
      }

      if (tooth_id) {
        const toothCheck = await pool.query(
          `SELECT tooth_id 
           FROM public.teeth 
           WHERE tooth_id = $1 
           AND record_id = $2`,
          [tooth_id, record_id],
        );

        if (toothCheck.rows.length === 0) {
          if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          return res.status(404).json({
            error: "Tooth not found or does not belong to this dental record",
          });
        }
      }

      const filePath = req.file.path.replace(/\\/g, "/");

      const newXray = await pool.query(
        `INSERT INTO public.xray_images
         (record_id, tooth_id, file_path, upload_date)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [record_id, tooth_id || null, filePath],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      res.status(201).json({
        message: "X-ray image uploaded successfully",
        xray: newXray.rows[0],
        file: {
          original_name: req.file.originalname,
          stored_name: req.file.filename,
          file_path: filePath,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
        },
      });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error("Upload X-ray error:", err.message);
      res.status(500).json({
        error: "Error uploading X-ray image",
      });
    }
  },
);

// DENTIST / ASSISTANT / PATIENT / ADMIN: GET X-RAYS BY DENTAL RECORD
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
      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (
        access.record.record_status === "Archived" &&
        req.user.role !== "Admin"
      ) {
        return res.status(403).json({
          error: "This dental record has been archived.",
        });
      }

      const xrays = await pool.query(
        `SELECT 
            x.xray_id,
            x.record_id,
            x.tooth_id,
            t.tooth_number,
            x.file_path,
            x.upload_date
         FROM public.xray_images x
         LEFT JOIN public.teeth t ON x.tooth_id = t.tooth_id
         WHERE x.record_id = $1
         ORDER BY x.upload_date DESC`,
        [record_id],
      );

      res.status(200).json({
        message: "X-ray images retrieved successfully",
        xrays: xrays.rows,
      });
    } catch (err) {
      console.error("Get X-rays error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-ray images",
      });
    }
  },
);

// DENTIST / PATIENT: GENERATE AI-SUGGESTED X-RAY ANNOTATIONS USING ROBOFLOW
router.post(
  "/:xray_id/analyze",
  authenticateToken,
  authorizeRoles("Dentist", "Patient"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const permission = await ensureUserCanAnalyzeXray(req, xray_id);

      if (!permission.allowed) {
        return res
          .status(permission.statusCode)
          .json({ error: permission.error });
      }

      const existingSuggestions = await pool.query(
        `SELECT annotation_id
         FROM public.xray_annotations
         WHERE xray_id = $1
         AND source = 'AI'
         AND status = 'Suggested'`,
        [xray_id],
      );

      if (existingSuggestions.rows.length > 0) {
        return res.status(200).json({
          message:
            "AI suggestions already exist for this X-ray and are pending dentist review.",
          annotations: [],
          pending_review: true,
        });
      }

      const xray = permission.xray;

      if (!xray.file_path) {
        return res.status(400).json({
          error: "X-ray file path is missing.",
        });
      }

      if (xray.file_path.toLowerCase().endsWith(".pdf")) {
        return res.status(400).json({
          error:
            "AI analysis is currently available only for image files, not PDF files.",
        });
      }

      const imagePath = path.resolve(xray.file_path);

      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          error: "X-ray image file was not found on the server.",
        });
      }

      const roboflowApiKey = process.env.ROBOFLOW_API_KEY;
      const roboflowModel = process.env.ROBOFLOW_MODEL || "dental-x-ray-1imfs";
      const roboflowVersion = process.env.ROBOFLOW_VERSION || "1";

      if (!roboflowApiKey) {
        return res.status(500).json({
          error: "Roboflow API key is not configured in backend .env.",
        });
      }

      const imageBase64 = fs.readFileSync(imagePath, {
        encoding: "base64",
      });

      const roboflowUrl = `https://detect.roboflow.com/${roboflowModel}/${roboflowVersion}`;

      const aiResponse = await axios({
        method: "POST",
        url: roboflowUrl,
        params: {
          api_key: roboflowApiKey,
        },
        data: imageBase64,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 30000,
      });

      const predictions = aiResponse.data?.predictions || [];

      console.log("Roboflow predictions:", predictions);

      if (predictions.length === 0) {
        return res.status(200).json({
          message:
            "AI analysis completed, but no findings were detected. Dentist review is still recommended.",
          annotations: [],
          raw_predictions: [],
          pending_review: false,
        });
      }

      const imageWidth = aiResponse.data?.image?.width || 1;
      const imageHeight = aiResponse.data?.image?.height || 1;

      const insertedAnnotations = [];

      for (const prediction of predictions) {
        const originalClass = prediction.class || "Finding";

        const confidence =
          prediction.confidence !== undefined && prediction.confidence !== null
            ? Math.round(Number(prediction.confidence) * 100)
            : null;

        const mappedLabel = mapLabel(originalClass);

        const label =
          confidence !== null
            ? `${mappedLabel} (${confidence}% confidence)`
            : mappedLabel;

        const xPosition = imageWidth
          ? Number(((prediction.x / imageWidth) * 100).toFixed(2))
          : 50;

        const yPosition = imageHeight
          ? Number(((prediction.y / imageHeight) * 100).toFixed(2))
          : 50;

        const requestedBy =
          req.user.role === "Patient"
            ? "Requested by patient"
            : "Generated by dentist";

        const note = `${requestedBy}. AI detected class: "${originalClass}". Confidence: ${
          confidence !== null ? `${confidence}%` : "N/A"
        }. This is a preliminary AI-assisted suggestion only and must be reviewed by a licensed dentist before being treated as a clinical finding.`;

        const inserted = await pool.query(
          `INSERT INTO public.xray_annotations
           (xray_id, dentist_id, label, note, x_position, y_position, source, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'AI', 'Suggested')
           RETURNING *`,
          [
            xray_id,
            permission.dentist?.dentist_id || null,
            label,
            note,
            xPosition,
            yPosition,
          ],
        );

        insertedAnnotations.push(inserted.rows[0]);
      }

      res.status(201).json({
        message:
          req.user.role === "Patient"
            ? "AI analysis request completed. Suggestions are now pending dentist review."
            : "AI suggestions generated from the X-ray image successfully. These are not final diagnoses and require dentist review.",
        annotations: insertedAnnotations,
        raw_predictions: predictions,
        pending_review: true,
      });
    } catch (err) {
      console.error(
        "Roboflow AI X-ray analysis error:",
        err.response?.data || err.message,
      );

      res.status(500).json({
        error:
          "Error generating AI X-ray suggestions. Please check Roboflow configuration and try again.",
      });
    }
  },
);

// DENTIST / PATIENT / ADMIN: GET X-RAY ANNOTATIONS
router.get(
  "/:xray_id/annotations",
  authenticateToken,
  authorizeRoles("Dentist", "Patient", "Admin"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const xray = await getXrayWithRecord(xray_id);

      if (!xray) {
        return res.status(404).json({ error: "X-ray image not found" });
      }

      const access = await getAccessibleRecord(req, xray.record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      let annotationsQuery = `
        SELECT 
          xa.annotation_id,
          xa.xray_id,
          xa.dentist_id,
          du.name AS dentist_name,
          xa.label,
          xa.note,
          xa.x_position,
          xa.y_position,
          xa.source,
          xa.status,
          xa.created_at,
          xa.reviewed_at
        FROM public.xray_annotations xa
        LEFT JOIN public.dentists d ON xa.dentist_id = d.dentist_id
        LEFT JOIN public.users du ON d.user_id = du.user_id
        WHERE xa.xray_id = $1
      `;

      const queryParams = [xray_id];

      if (req.user.role === "Patient") {
        annotationsQuery += ` AND xa.status IN ('Suggested', 'Confirmed')`;
      }

      annotationsQuery += ` ORDER BY xa.created_at DESC`;

      const annotations = await pool.query(annotationsQuery, queryParams);

      const pendingReviewResult = await pool.query(
        `SELECT COUNT(*)::int AS pending_count
         FROM public.xray_annotations
         WHERE xray_id = $1
         AND source = 'AI'
         AND status = 'Suggested'`,
        [xray_id],
      );

      res.status(200).json({
        message: "X-ray annotations retrieved successfully",
        annotations: annotations.rows,
        pending_review_count: pendingReviewResult.rows[0]?.pending_count || 0,
        disclaimer:
          "AI-assisted annotations are preliminary suggestions only and must be reviewed by a licensed dentist.",
      });
    } catch (err) {
      console.error("Get X-ray annotations error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-ray annotations",
      });
    }
  },
);

// DENTIST: MANUALLY ADD X-RAY ANNOTATION
router.post(
  "/:xray_id/annotations",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { xray_id } = req.params;
    const { label, note, x_position, y_position } = req.body || {};

    if (!label || x_position === undefined || y_position === undefined) {
      return res.status(400).json({
        error: "Label, x_position, and y_position are required",
      });
    }

    try {
      const permission = await ensureDentistCanAnnotateXray(req, xray_id);

      if (!permission.allowed) {
        return res
          .status(permission.statusCode)
          .json({ error: permission.error });
      }

      const annotation = await pool.query(
        `INSERT INTO public.xray_annotations
         (xray_id, dentist_id, label, note, x_position, y_position, source, status, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Dentist', 'Confirmed', CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          xray_id,
          permission.dentist.dentist_id,
          label,
          note || null,
          x_position,
          y_position,
        ],
      );

      res.status(201).json({
        message: "Dentist annotation added successfully",
        annotation: annotation.rows[0],
      });
    } catch (err) {
      console.error("Add X-ray annotation error:", err.message);
      res.status(500).json({
        error: "Error adding X-ray annotation",
      });
    }
  },
);

// DENTIST: UPDATE / CONFIRM / REJECT X-RAY ANNOTATION
router.put(
  "/annotations/:annotation_id",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { annotation_id } = req.params;
    const { label, note, x_position, y_position, status } = req.body || {};

    const allowedStatuses = ["Suggested", "Confirmed", "Rejected"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use Suggested, Confirmed, or Rejected.",
      });
    }

    try {
      const annotationCheck = await pool.query(
        `SELECT 
            xa.annotation_id,
            xa.xray_id,
            xa.label,
            xa.note,
            xa.x_position,
            xa.y_position,
            xa.source,
            xa.status,
            x.record_id
         FROM public.xray_annotations xa
         JOIN public.xray_images x ON xa.xray_id = x.xray_id
         WHERE xa.annotation_id = $1`,
        [annotation_id],
      );

      if (annotationCheck.rows.length === 0) {
        return res.status(404).json({ error: "Annotation not found" });
      }

      const annotation = annotationCheck.rows[0];

      const permission = await ensureDentistCanAnnotateXray(
        req,
        annotation.xray_id,
      );

      if (!permission.allowed) {
        return res
          .status(permission.statusCode)
          .json({ error: permission.error });
      }

      const updatedAnnotation = await pool.query(
        `UPDATE public.xray_annotations
         SET label = COALESCE($1, label),
             note = COALESCE($2, note),
             x_position = COALESCE($3, x_position),
             y_position = COALESCE($4, y_position),
             status = COALESCE($5, status),
             dentist_id = $6,
             reviewed_at = CASE
               WHEN $5 IN ('Confirmed', 'Rejected') THEN CURRENT_TIMESTAMP
               ELSE reviewed_at
             END
         WHERE annotation_id = $7
         RETURNING *`,
        [
          label || null,
          note || null,
          x_position ?? null,
          y_position ?? null,
          status || null,
          permission.dentist.dentist_id,
          annotation_id,
        ],
      );

      res.status(200).json({
        message: "X-ray annotation updated successfully",
        annotation: updatedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Update X-ray annotation error:", err.message);
      res.status(500).json({
        error: "Error updating X-ray annotation",
      });
    }
  },
);

// DENTIST: DELETE X-RAY ANNOTATION
router.delete(
  "/annotations/:annotation_id",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { annotation_id } = req.params;

    try {
      const annotationCheck = await pool.query(
        `SELECT xa.annotation_id, xa.xray_id
         FROM public.xray_annotations xa
         WHERE xa.annotation_id = $1`,
        [annotation_id],
      );

      if (annotationCheck.rows.length === 0) {
        return res.status(404).json({ error: "Annotation not found" });
      }

      const permission = await ensureDentistCanAnnotateXray(
        req,
        annotationCheck.rows[0].xray_id,
      );

      if (!permission.allowed) {
        return res
          .status(permission.statusCode)
          .json({ error: permission.error });
      }

      const deletedAnnotation = await pool.query(
        `DELETE FROM public.xray_annotations
         WHERE annotation_id = $1
         RETURNING *`,
        [annotation_id],
      );

      res.status(200).json({
        message: "X-ray annotation deleted successfully",
        deleted_annotation: deletedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Delete X-ray annotation error:", err.message);
      res.status(500).json({
        error: "Error deleting X-ray annotation",
      });
    }
  },
);

// DENTIST / ASSISTANT / PATIENT / ADMIN: GET SINGLE X-RAY
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
      const xray = await getXrayWithRecord(xray_id);

      if (!xray) {
        return res.status(404).json({
          error: "X-ray image not found",
        });
      }

      const access = await getAccessibleRecord(req, xray.record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (xray.record_status === "Archived" && req.user.role !== "Admin") {
        return res.status(403).json({
          error: "This X-ray belongs to an archived dental record.",
        });
      }

      res.status(200).json({
        message: "X-ray image retrieved successfully",
        xray,
      });
    } catch (err) {
      console.error("Get single X-ray error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-ray image",
      });
    }
  },
);

// DENTIST / ASSISTANT: DELETE X-RAY IMAGE RECORD
router.delete(
  "/:xray_id",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const xray = await getXrayWithRecord(xray_id);

      if (!xray) {
        return res.status(404).json({
          error: "X-ray image not found",
        });
      }

      const access = await getAccessibleRecord(req, xray.record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (xray.record_status === "Archived") {
        return res.status(400).json({
          error: "Cannot delete X-rays from an archived dental record.",
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
          error: "X-ray image not found",
        });
      }

      if (deletedXray.rows[0].file_path) {
        const filePath = deletedXray.rows[0].file_path;

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [deletedXray.rows[0].record_id],
      );

      res.status(200).json({
        message: "X-ray image record deleted successfully",
        deleted_xray: deletedXray.rows[0],
      });
    } catch (err) {
      console.error("Delete X-ray error:", err.message);
      res.status(500).json({
        error: "Error deleting X-ray image",
      });
    }
  },
);

module.exports = router;
