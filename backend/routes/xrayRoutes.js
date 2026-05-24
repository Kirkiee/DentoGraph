const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// Ensure uploads folder exists
const uploadDir = "uploads/";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// STORAGE CONFIGURATION
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

// FILE FILTER
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

// UPLOAD MIDDLEWARE
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
      status: result.rows.length === 0 ? 404 : 200,
    };
  }

  if (role === "Dentist") {
    const dentist = await getDentistProfile(user_id);

    if (!dentist) {
      return {
        allowed: false,
        record: null,
        error: "Dentist profile not found",
        status: 404,
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
      status: result.rows.length === 0 ? 403 : 200,
    };
  }

  if (isAssistantRole(role)) {
    const assistant = await getAssistantProfile(user_id);

    if (!assistant) {
      return {
        allowed: false,
        record: null,
        error: "Assistant profile not found",
        status: 404,
      };
    }

    if (!assistant.clinic_id) {
      return {
        allowed: false,
        record: null,
        error: "Assistant is not assigned to a clinic",
        status: 400,
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
      status: result.rows.length === 0 ? 403 : 200,
    };
  }

  if (role === "Patient") {
    const patient = await getPatientProfile(user_id);

    if (!patient) {
      return {
        allowed: false,
        record: null,
        error: "Patient profile not found",
        status: 404,
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
      status: result.rows.length === 0 ? 403 : 200,
    };
  }

  return {
    allowed: false,
    record: null,
    error: "Access denied",
    status: 403,
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

        return res.status(access.status).json({ error: access.error });
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
        return res.status(access.status).json({ error: access.error });
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
        return res.status(access.status).json({ error: access.error });
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
        return res.status(access.status).json({ error: access.error });
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
