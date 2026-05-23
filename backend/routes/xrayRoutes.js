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
  const allowedTypes = /jpeg|jpg|png|webp|gif|pdf/;
  const extName = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed"));
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

// DENTIST / ASSISTANT: UPLOAD X-RAY IMAGE
router.post(
  "/upload",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant"),
  upload.single("xray"),
  async (req, res) => {
    const { record_id, tooth_id } = req.body;

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

      const recordCheck = await pool.query(
        "SELECT record_id FROM public.dental_records WHERE record_id = $1",
        [record_id],
      );

      if (recordCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Dental record not found",
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
  authorizeRoles("Dentist", "Assistant", "Patient", "Admin"),
  async (req, res) => {
    const { record_id } = req.params;

    try {
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
  authorizeRoles("Dentist", "Assistant", "Patient", "Admin"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
      const xray = await pool.query(
        `SELECT 
            x.xray_id,
            x.record_id,
            x.tooth_id,
            t.tooth_number,
            x.file_path,
            x.upload_date
         FROM public.xray_images x
         LEFT JOIN public.teeth t ON x.tooth_id = t.tooth_id
         WHERE x.xray_id = $1`,
        [xray_id],
      );

      if (xray.rows.length === 0) {
        return res.status(404).json({
          error: "X-ray image not found",
        });
      }

      res.status(200).json({
        message: "X-ray image retrieved successfully",
        xray: xray.rows[0],
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
  authorizeRoles("Dentist", "Assistant"),
  async (req, res) => {
    const { xray_id } = req.params;

    try {
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
