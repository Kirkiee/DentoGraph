const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const documentUploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "patient-documents",
);

if (!fs.existsSync(documentUploadDir)) {
  fs.mkdirSync(documentUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginalName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const getPatientByUserId = async (user_id) => {
  const result = await pool.query(
    `SELECT patient_id
     FROM public.patients
     WHERE user_id = $1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getFileUrlPath = (filename) => {
  return `uploads/patient-documents/${filename}`;
};

// PATIENT: UPLOAD OWN PDA DENTAL CHART / FORM
router.post(
  "/pda-form",
  authenticateToken,
  authorizeRoles("Patient"),
  upload.single("pda_form"),
  async (req, res) => {
    try {
      const patient = await getPatientByUserId(req.user.user_id);

      if (!patient) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          error: "Patient profile not found. Please create your profile first.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please upload a PDA dental chart/form file.",
        });
      }

      const filePath = getFileUrlPath(req.file.filename);

      const existingDocument = await pool.query(
        `SELECT document_id, file_path
         FROM public.patient_documents
         WHERE patient_id = $1
         AND document_type = 'PDA_DENTAL_CHART'
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [patient.patient_id],
      );

      if (existingDocument.rows.length > 0) {
        const oldFilePath = existingDocument.rows[0].file_path;
        const oldAbsolutePath = path.join(__dirname, "..", oldFilePath);

        if (fs.existsSync(oldAbsolutePath)) {
          fs.unlinkSync(oldAbsolutePath);
        }

        const updatedDocument = await pool.query(
          `UPDATE public.patient_documents
           SET file_path = $1,
               original_filename = $2,
               mime_type = $3,
               file_size_bytes = $4,
               uploaded_at = CURRENT_TIMESTAMP
           WHERE document_id = $5
           RETURNING *`,
          [
            filePath,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            existingDocument.rows[0].document_id,
          ],
        );

        return res.status(200).json({
          message: "PDA dental chart/form updated successfully.",
          document: updatedDocument.rows[0],
        });
      }

      const newDocument = await pool.query(
        `INSERT INTO public.patient_documents
         (
           patient_id,
           document_type,
           file_path,
           original_filename,
           mime_type,
           file_size_bytes,
           uploaded_at
         )
         VALUES ($1, 'PDA_DENTAL_CHART', $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          patient.patient_id,
          filePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
        ],
      );

      res.status(201).json({
        message: "PDA dental chart/form uploaded successfully.",
        document: newDocument.rows[0],
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error("Upload PDA form error:", err.message);

      if (err.message === "Only PDF, JPG, JPEG, and PNG files are allowed.") {
        return res.status(400).json({ error: err.message });
      }

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File is too large. Maximum upload size is 10MB.",
        });
      }

      res.status(500).json({ error: "Error uploading PDA dental chart/form." });
    }
  },
);

// PATIENT: GET OWN PDA FORM
router.get(
  "/pda-form/me",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    try {
      const patient = await getPatientByUserId(req.user.user_id);

      if (!patient) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const documentResult = await pool.query(
        `SELECT *
         FROM public.patient_documents
         WHERE patient_id = $1
         AND document_type = 'PDA_DENTAL_CHART'
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [patient.patient_id],
      );

      res.status(200).json({
        message: "PDA dental chart/form retrieved successfully.",
        document: documentResult.rows[0] || null,
      });
    } catch (err) {
      console.error("Get own PDA form error:", err.message);
      res
        .status(500)
        .json({ error: "Error retrieving PDA dental chart/form." });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET PDA FORM BY PATIENT ID
router.get(
  "/patient/:patient_id/pda-form",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const { patient_id } = req.params;

    try {
      if (req.user.role === "Dentist") {
        const dentistResult = await pool.query(
          `SELECT dentist_id
           FROM public.dentists
           WHERE user_id = $1`,
          [req.user.user_id],
        );

        if (dentistResult.rows.length === 0) {
          return res.status(404).json({
            error: "Dentist profile not found.",
          });
        }

        const accessCheck = await pool.query(
          `SELECT appointment_id
           FROM public.appointments
           WHERE patient_id = $1
           AND dentist_id = $2
           AND status IN ('Pending', 'Scheduled', 'Completed')
           LIMIT 1`,
          [patient_id, dentistResult.rows[0].dentist_id],
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({
            error:
              "You can only view PDA forms for patients assigned to your appointments.",
          });
        }
      }

      if (
        req.user.role === "Assistant" ||
        req.user.role === "Dental Assistant"
      ) {
        const assistantResult = await pool.query(
          `SELECT clinic_id
           FROM public.assistants
           WHERE user_id = $1`,
          [req.user.user_id],
        );

        if (assistantResult.rows.length === 0) {
          return res.status(404).json({
            error: "Assistant profile not found.",
          });
        }

        if (!assistantResult.rows[0].clinic_id) {
          return res.status(400).json({
            error: "Assistant is not assigned to a clinic.",
          });
        }

        const accessCheck = await pool.query(
          `SELECT a.appointment_id
           FROM public.appointments a
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           WHERE a.patient_id = $1
           AND d.clinic_id = $2
           LIMIT 1`,
          [patient_id, assistantResult.rows[0].clinic_id],
        );

        if (accessCheck.rows.length === 0) {
          return res.status(403).json({
            error:
              "You can only view PDA forms for patients under your assigned clinic.",
          });
        }
      }

      const documentResult = await pool.query(
        `SELECT *
         FROM public.patient_documents
         WHERE patient_id = $1
         AND document_type = 'PDA_DENTAL_CHART'
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [patient_id],
      );

      res.status(200).json({
        message: "Patient PDA dental chart/form retrieved successfully.",
        document: documentResult.rows[0] || null,
      });
    } catch (err) {
      console.error("Get patient PDA form error:", err.message);
      res
        .status(500)
        .json({ error: "Error retrieving patient PDA dental chart/form." });
    }
  },
);

module.exports = router;
