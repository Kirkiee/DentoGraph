const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

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

const getRecordContext = async (record_id) => {
  const result = await pool.query(
    `SELECT 
        dr.record_id,
        dr.patient_id,
        dr.dentist_id,
        COALESCE(dr.status, 'Active') AS record_status,
        d.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        sp.plan_name,
        sp.max_xrays,
        sp.storage_limit_mb
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     LEFT JOIN public.subscription_plans sp ON c.subscription_plan_id = sp.plan_id
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
      error: "Dental record not found",
      statusCode: 404,
      record: null,
    };
  }

  if (record.record_status === "Archived") {
    return {
      allowed: false,
      error: "Cannot modify an archived dental record.",
      statusCode: 400,
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

    if (!dentist) {
      return {
        allowed: false,
        error: "Dentist profile not found",
        statusCode: 404,
        record,
      };
    }

    if (Number(record.dentist_id) !== Number(dentist.dentist_id)) {
      return {
        allowed: false,
        error: "This dental record is not assigned to this dentist.",
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

    if (!assistant) {
      return {
        allowed: false,
        error: "Assistant profile not found",
        statusCode: 404,
        record,
      };
    }

    if (!assistant.clinic_id) {
      return {
        allowed: false,
        error: "Assistant is not assigned to a clinic.",
        statusCode: 400,
        record,
      };
    }

    if (Number(record.clinic_id) !== Number(assistant.clinic_id)) {
      return {
        allowed: false,
        error: "This dental record is not under your assigned clinic.",
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

    if (!patient) {
      return {
        allowed: false,
        error: "Patient profile not found",
        statusCode: 404,
        record,
      };
    }

    if (Number(record.patient_id) !== Number(patient.patient_id)) {
      return {
        allowed: false,
        error: "This dental record does not belong to this patient.",
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
    error: "Access denied",
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
        c.clinic_name
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
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

const checkClinicXrayLimit = async (record_id, newFileSizeBytes) => {
  const record = await getRecordContext(record_id);

  if (!record) {
    return {
      allowed: false,
      error: "Dental record not found. Cannot validate subscription limits.",
    };
  }

  if (!record.clinic_id) {
    return {
      allowed: false,
      error:
        "This dental record is not connected to a clinic. Cannot validate subscription limits.",
    };
  }

  if (!record.subscription_plan_id) {
    return {
      allowed: false,
      error:
        "This clinic has no subscription plan assigned. Please assign a plan before uploading X-rays.",
    };
  }

  const xrayCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [record.clinic_id],
  );

  const storageResult = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [record.clinic_id],
  );

  const currentXrays = xrayCountResult.rows[0].count;
  const currentBytes = Number(storageResult.rows[0].total_bytes || 0);

  const maxXrays = Number(record.max_xrays || 0);
  const storageLimitMb = Number(record.storage_limit_mb || 0);
  const storageLimitBytes = storageLimitMb * 1024 * 1024;

  console.log("X-ray subscription check:", {
    clinic_id: record.clinic_id,
    clinic_name: record.clinic_name,
    plan_name: record.plan_name,
    currentXrays,
    maxXrays,
    currentBytes,
    currentMb: (currentBytes / 1024 / 1024).toFixed(2),
    newFileSizeBytes,
    newFileMb: (Number(newFileSizeBytes || 0) / 1024 / 1024).toFixed(2),
    storageLimitMb,
    storageLimitBytes,
  });

  if (maxXrays > 0 && currentXrays >= maxXrays) {
    return {
      allowed: false,
      error: `${record.clinic_name} has reached the X-ray upload limit for the ${record.plan_name} plan. Limit: ${maxXrays}.`,
    };
  }

  if (
    storageLimitBytes > 0 &&
    currentBytes + Number(newFileSizeBytes || 0) > storageLimitBytes
  ) {
    const usedMb = currentBytes / 1024 / 1024;
    const newMb = Number(newFileSizeBytes || 0) / 1024 / 1024;

    return {
      allowed: false,
      error: `${record.clinic_name} has reached the storage limit for the ${record.plan_name} plan. Used: ${usedMb.toFixed(
        2,
      )} MB, new file: ${newMb.toFixed(2)} MB, limit: ${storageLimitMb} MB.`,
    };
  }

  return {
    allowed: true,
    error: null,
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

const analyzeImageWithRoboflow = async (imagePath) => {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const modelUrl = process.env.ROBOFLOW_MODEL_URL;

  if (!apiKey || !modelUrl) {
    throw new Error("Roboflow API key or model URL is missing.");
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

    try {
      const access = await getAccessibleRecordForXray(req, record_id);

      if (!access.allowed) {
        deleteUploadedFile(filePath);

        return res.status(access.statusCode).json({
          error: access.error,
        });
      }

      const limitCheck = await checkClinicXrayLimit(record_id, fileSizeBytes);

      if (!limitCheck.allowed) {
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

      res.status(201).json({
        message: "X-ray uploaded successfully",
        xray: newXray.rows[0],
      });
    } catch (err) {
      deleteUploadedFile(filePath);

      console.error("Upload X-ray error:", err);
      res.status(500).json({
        error: err.message || "Error uploading X-ray",
      });
    }
  },
);

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
        xrays: xrays.rows,
      });
    } catch (err) {
      console.error("Get X-rays error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-rays",
      });
    }
  },
);

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
        xray: access.xray,
      });
    } catch (err) {
      console.error("Get X-ray error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-ray",
      });
    }
  },
);

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

      res.status(200).json({
        message: "X-ray deleted successfully",
        xray: deletedXray.rows[0],
      });
    } catch (err) {
      console.error("Delete X-ray error:", err.message);
      res.status(500).json({
        error: "Error deleting X-ray",
      });
    }
  },
);

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

      if (xray.file_path?.toLowerCase().endsWith(".pdf")) {
        return res.status(400).json({
          error: "AI analysis is only available for image files, not PDFs.",
        });
      }

      const roboflowResult = await analyzeImageWithRoboflow(xray.file_path);
      const predictions = roboflowResult.predictions || [];

      if (predictions.length === 0) {
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

        const note = `AI suggestion from Roboflow model. Confidence: ${(
          Number(prediction.confidence || 0) * 100
        ).toFixed(
          1,
        )}%. This is not a final diagnosis and requires dentist review.`;

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

      res.status(201).json({
        message:
          "AI analysis completed. Suggestions were saved and are pending dentist review.",
        annotations: insertedAnnotations,
      });
    } catch (err) {
      console.error("AI X-ray analysis error:", err.message);
      res.status(500).json({
        error: err.message || "Error analyzing X-ray",
      });
    }
  },
);

router.get(
  "/:xray_id/annotations",
  authenticateToken,
  authorizeRoles("Dentist", "Patient", "Admin"),
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
      console.error("Get X-ray annotations error:", err.message);
      res.status(500).json({
        error: "Error retrieving X-ray annotations",
      });
    }
  },
);

router.put(
  "/annotations/:annotation_id/review",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { annotation_id } = req.params;
    const { status, label, note } = req.body || {};

    const allowedStatuses = ["Confirmed", "Rejected", "Suggested"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required.",
      });
    }

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

      const dentist = await getDentistProfile(req.user.user_id);

      const updatedAnnotation = await pool.query(
        `UPDATE public.xray_annotations
         SET status = $1,
             label = COALESCE($2, label),
             note = COALESCE($3, note),
             dentist_id = $4,
             reviewed_at = CURRENT_TIMESTAMP
         WHERE annotation_id = $5
         RETURNING *`,
        [
          status,
          label || null,
          note || null,
          dentist?.dentist_id || null,
          annotation_id,
        ],
      );

      res.status(200).json({
        message: "Annotation reviewed successfully",
        annotation: updatedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Review annotation error:", err.message);
      res.status(500).json({
        error: "Error reviewing annotation",
      });
    }
  },
);

router.delete(
  "/annotations/:annotation_id",
  authenticateToken,
  authorizeRoles("Dentist"),
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

      const deletedAnnotation = await pool.query(
        `DELETE FROM public.xray_annotations
         WHERE annotation_id = $1
         RETURNING *`,
        [annotation_id],
      );

      res.status(200).json({
        message: "Annotation deleted successfully",
        annotation: deletedAnnotation.rows[0],
      });
    } catch (err) {
      console.error("Delete annotation error:", err.message);
      res.status(500).json({
        error: "Error deleting annotation",
      });
    }
  },
);

module.exports = router;
