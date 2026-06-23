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

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const getFileUrlPath = (filename) => {
  return `uploads/patient-documents/${filename}`;
};

const deleteUploadedFile = (file) => {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
};

const deleteExistingDocumentFile = (filePath) => {
  if (!filePath) return;

  const normalizedPath = String(filePath).replace(/\\/g, "/");
  const absolutePath = path.join(__dirname, "..", normalizedPath);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;

  return value;
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

const getPatientById = async (patient_id) => {
  const result = await pool.query(
    `SELECT 
        p.patient_id,
        p.user_id,
        u.name AS patient_name,
        u.email AS patient_email
     FROM public.patients p
     JOIN public.users u ON p.user_id = u.user_id
     WHERE p.patient_id = $1`,
    [patient_id],
  );

  return result.rows[0] || null;
};

const getRecordById = async (record_id) => {
  const result = await pool.query(
    `SELECT 
        dr.record_id,
        dr.patient_id,
        dr.dentist_id,
        dr.status,
        d.clinic_id
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE dr.record_id = $1`,
    [record_id],
  );

  return result.rows[0] || null;
};

const checkPatientAccess = async (req, patient_id) => {
  if (req.user.role === "Admin") {
    return {
      allowed: true,
      error: null,
    };
  }

  if (req.user.role === "Dentist") {
    const dentist = await getDentistProfile(req.user.user_id);

    if (!dentist) {
      return {
        allowed: false,
        status: 404,
        error: "Dentist profile not found.",
      };
    }

    const accessCheck = await pool.query(
      `SELECT appointment_id
       FROM public.appointments
       WHERE patient_id = $1
       AND dentist_id = $2
       AND status IN ('Pending', 'Scheduled', 'Completed')
       LIMIT 1`,
      [patient_id, dentist.dentist_id],
    );

    if (accessCheck.rows.length === 0) {
      return {
        allowed: false,
        status: 403,
        error:
          "You can only access documents for patients assigned to your appointments.",
      };
    }

    return {
      allowed: true,
      error: null,
    };
  }

  if (isAssistantRole(req.user.role)) {
    const assistant = await getAssistantProfile(req.user.user_id);

    if (!assistant) {
      return {
        allowed: false,
        status: 404,
        error: "Assistant profile not found.",
      };
    }

    if (!assistant.clinic_id) {
      return {
        allowed: false,
        status: 400,
        error: "Assistant is not assigned to a clinic.",
      };
    }

    const accessCheck = await pool.query(
      `SELECT a.appointment_id
       FROM public.appointments a
       JOIN public.dentists d ON a.dentist_id = d.dentist_id
       WHERE a.patient_id = $1
       AND d.clinic_id = $2
       LIMIT 1`,
      [patient_id, assistant.clinic_id],
    );

    if (accessCheck.rows.length === 0) {
      return {
        allowed: false,
        status: 403,
        error:
          "You can only access documents for patients under your assigned clinic.",
      };
    }

    return {
      allowed: true,
      error: null,
    };
  }

  return {
    allowed: false,
    status: 403,
    error: "You are not allowed to access patient documents.",
  };
};

const checkRecordAccess = async (req, record_id) => {
  const record = await getRecordById(record_id);

  if (!record) {
    return {
      allowed: false,
      status: 404,
      error: "Dental record not found.",
      record: null,
    };
  }

  if (req.user.role === "Admin") {
    return {
      allowed: true,
      error: null,
      record,
    };
  }

  if (req.user.role === "Dentist") {
    const dentist = await getDentistProfile(req.user.user_id);

    if (!dentist) {
      return {
        allowed: false,
        status: 404,
        error: "Dentist profile not found.",
        record,
      };
    }

    if (Number(record.dentist_id) !== Number(dentist.dentist_id)) {
      return {
        allowed: false,
        status: 403,
        error: "You can only access documents for your own dental records.",
        record,
      };
    }

    return {
      allowed: true,
      error: null,
      record,
    };
  }

  if (isAssistantRole(req.user.role)) {
    const assistant = await getAssistantProfile(req.user.user_id);

    if (!assistant) {
      return {
        allowed: false,
        status: 404,
        error: "Assistant profile not found.",
        record,
      };
    }

    if (!assistant.clinic_id) {
      return {
        allowed: false,
        status: 400,
        error: "Assistant is not assigned to a clinic.",
        record,
      };
    }

    if (Number(record.clinic_id) !== Number(assistant.clinic_id)) {
      return {
        allowed: false,
        status: 403,
        error:
          "You can only access documents for records under your assigned clinic.",
        record,
      };
    }

    return {
      allowed: true,
      error: null,
      record,
    };
  }

  return {
    allowed: false,
    status: 403,
    error: "You are not allowed to access this dental record.",
    record,
  };
};

const handleUploadError = (err, req, res, fallbackMessage) => {
  deleteUploadedFile(req.file);

  console.error(fallbackMessage, err.message);

  if (err.message === "Only PDF, JPG, JPEG, and PNG files are allowed.") {
    return res.status(400).json({
      error: err.message,
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File is too large. Maximum upload size is 10MB.",
    });
  }

  return res.status(500).json({
    error: fallbackMessage,
  });
};

// DENTIST / ASSISTANT / ADMIN: UPLOAD PDA FORM FOR PATIENT
router.post(
  "/patient/:patient_id/pda-form",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  upload.single("pda_form"),
  async (req, res) => {
    const { patient_id } = req.params;
    const { record_id, notes } = req.body || {};

    try {
      const patient = await getPatientById(patient_id);

      if (!patient) {
        deleteUploadedFile(req.file);

        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const access = await checkPatientAccess(req, patient_id);

      if (!access.allowed) {
        deleteUploadedFile(req.file);

        return res.status(access.status || 403).json({
          error: access.error,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please upload a PDA dental chart/form file.",
        });
      }

      const normalizedRecordId = normalizeNullable(record_id);

      if (normalizedRecordId) {
        const recordAccess = await checkRecordAccess(req, normalizedRecordId);

        if (!recordAccess.allowed) {
          deleteUploadedFile(req.file);

          return res.status(recordAccess.status || 403).json({
            error: recordAccess.error,
          });
        }

        if (Number(recordAccess.record.patient_id) !== Number(patient_id)) {
          deleteUploadedFile(req.file);

          return res.status(400).json({
            error: "Selected dental record does not belong to this patient.",
          });
        }
      }

      const filePath = getFileUrlPath(req.file.filename);

      const existingDocument = await pool.query(
        `SELECT document_id, file_path
         FROM public.patient_documents
         WHERE patient_id = $1
         AND document_type = 'PDA_DENTAL_CHART'
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [patient_id],
      );

      if (existingDocument.rows.length > 0) {
        deleteExistingDocumentFile(existingDocument.rows[0].file_path);

        const updatedDocument = await pool.query(
          `UPDATE public.patient_documents
           SET file_path = $1,
               original_filename = $2,
               mime_type = $3,
               file_size_bytes = $4,
               record_id = $5,
               uploaded_by = $6,
               notes = $7,
               uploaded_at = CURRENT_TIMESTAMP
           WHERE document_id = $8
           RETURNING *`,
          [
            filePath,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            normalizedRecordId,
            req.user.user_id,
            notes || "PDA form uploaded by clinic staff.",
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
           record_id,
           document_type,
           file_path,
           original_filename,
           mime_type,
           file_size_bytes,
           uploaded_by,
           notes,
           uploaded_at
         )
         VALUES ($1, $2, 'PDA_DENTAL_CHART', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          patient_id,
          normalizedRecordId,
          filePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.user.user_id,
          notes || "PDA form uploaded by clinic staff.",
        ],
      );

      res.status(201).json({
        message: "PDA dental chart/form uploaded successfully.",
        document: newDocument.rows[0],
      });
    } catch (err) {
      return handleUploadError(
        err,
        req,
        res,
        "Error uploading PDA dental chart/form.",
      );
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: UPLOAD OLD / SCANNED RECORD
router.post(
  "/patient/:patient_id/old-record",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  upload.single("old_record"),
  async (req, res) => {
    const { patient_id } = req.params;
    const { record_id, notes, document_type } = req.body || {};

    try {
      const patient = await getPatientById(patient_id);

      if (!patient) {
        deleteUploadedFile(req.file);

        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const access = await checkPatientAccess(req, patient_id);

      if (!access.allowed) {
        deleteUploadedFile(req.file);

        return res.status(access.status || 403).json({
          error: access.error,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please upload an old/scanned dental record file.",
        });
      }

      const normalizedRecordId = normalizeNullable(record_id);

      if (normalizedRecordId) {
        const recordAccess = await checkRecordAccess(req, normalizedRecordId);

        if (!recordAccess.allowed) {
          deleteUploadedFile(req.file);

          return res.status(recordAccess.status || 403).json({
            error: recordAccess.error,
          });
        }

        if (Number(recordAccess.record.patient_id) !== Number(patient_id)) {
          deleteUploadedFile(req.file);

          return res.status(400).json({
            error: "Selected dental record does not belong to this patient.",
          });
        }
      }

      const allowedDocumentTypes = [
        "OLD_DENTAL_RECORD",
        "SCANNED_OLD_RECORD",
        "MANUALLY_ENCODED_OLD_RECORD",
      ];

      const cleanDocumentType = allowedDocumentTypes.includes(document_type)
        ? document_type
        : "SCANNED_OLD_RECORD";

      const filePath = getFileUrlPath(req.file.filename);

      const newDocument = await pool.query(
        `INSERT INTO public.patient_documents
         (
           patient_id,
           record_id,
           document_type,
           file_path,
           original_filename,
           mime_type,
           file_size_bytes,
           uploaded_by,
           notes,
           uploaded_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          patient_id,
          normalizedRecordId,
          cleanDocumentType,
          filePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.user.user_id,
          notes || "Old/scanned dental record uploaded by clinic staff.",
        ],
      );

      res.status(201).json({
        message: "Old/scanned dental record uploaded successfully.",
        document: newDocument.rows[0],
      });
    } catch (err) {
      return handleUploadError(
        err,
        req,
        res,
        "Error uploading old/scanned dental record.",
      );
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
      const patient = await getPatientById(patient_id);

      if (!patient) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const access = await checkPatientAccess(req, patient_id);

      if (!access.allowed) {
        return res.status(access.status || 403).json({
          error: access.error,
        });
      }

      const documentResult = await pool.query(
        `SELECT 
            pd.*,
            u.name AS uploaded_by_name,
            u.email AS uploaded_by_email
         FROM public.patient_documents pd
         LEFT JOIN public.users u ON pd.uploaded_by = u.user_id
         WHERE pd.patient_id = $1
         AND pd.document_type = 'PDA_DENTAL_CHART'
         ORDER BY pd.uploaded_at DESC
         LIMIT 1`,
        [patient_id],
      );

      res.status(200).json({
        message: "Patient PDA dental chart/form retrieved successfully.",
        document: documentResult.rows[0] || null,
      });
    } catch (err) {
      console.error("Get patient PDA form error:", err.message);

      res.status(500).json({
        error: "Error retrieving patient PDA dental chart/form.",
      });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET ALL DOCUMENTS BY PATIENT ID
router.get(
  "/patient/:patient_id/documents",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const { patient_id } = req.params;

    try {
      const patient = await getPatientById(patient_id);

      if (!patient) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const access = await checkPatientAccess(req, patient_id);

      if (!access.allowed) {
        return res.status(access.status || 403).json({
          error: access.error,
        });
      }

      const documentsResult = await pool.query(
        `SELECT 
            pd.*,
            u.name AS uploaded_by_name,
            u.email AS uploaded_by_email
         FROM public.patient_documents pd
         LEFT JOIN public.users u ON pd.uploaded_by = u.user_id
         WHERE pd.patient_id = $1
         ORDER BY pd.uploaded_at DESC`,
        [patient_id],
      );

      res.status(200).json({
        message: "Patient documents retrieved successfully.",
        documents: documentsResult.rows,
      });
    } catch (err) {
      console.error("Get patient documents error:", err.message);

      res.status(500).json({
        error: "Error retrieving patient documents.",
      });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET DOCUMENTS BY RECORD ID
router.get(
  "/record/:record_id/documents",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const { record_id } = req.params;

    try {
      const recordAccess = await checkRecordAccess(req, record_id);

      if (!recordAccess.allowed) {
        return res.status(recordAccess.status || 403).json({
          error: recordAccess.error,
        });
      }

      const documentsResult = await pool.query(
        `SELECT 
            pd.*,
            u.name AS uploaded_by_name,
            u.email AS uploaded_by_email
         FROM public.patient_documents pd
         LEFT JOIN public.users u ON pd.uploaded_by = u.user_id
         WHERE pd.record_id = $1
         OR (
           pd.patient_id = $2
           AND pd.document_type = 'PDA_DENTAL_CHART'
         )
         ORDER BY pd.uploaded_at DESC`,
        [record_id, recordAccess.record.patient_id],
      );

      res.status(200).json({
        message: "Dental record documents retrieved successfully.",
        documents: documentsResult.rows,
      });
    } catch (err) {
      console.error("Get record documents error:", err.message);

      res.status(500).json({
        error: "Error retrieving dental record documents.",
      });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: REMOVE PATIENT DOCUMENT
router.delete(
  "/documents/:document_id",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const { document_id } = req.params;

    try {
      const documentResult = await pool.query(
        `SELECT *
         FROM public.patient_documents
         WHERE document_id = $1`,
        [document_id],
      );

      if (documentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Document not found.",
        });
      }

      const document = documentResult.rows[0];

      if (document.record_id) {
        const recordAccess = await checkRecordAccess(req, document.record_id);

        if (!recordAccess.allowed) {
          return res.status(recordAccess.status || 403).json({
            error: recordAccess.error,
          });
        }
      } else {
        const patientAccess = await checkPatientAccess(
          req,
          document.patient_id,
        );

        if (!patientAccess.allowed) {
          return res.status(patientAccess.status || 403).json({
            error: patientAccess.error,
          });
        }
      }

      deleteExistingDocumentFile(document.file_path);

      await pool.query(
        `DELETE FROM public.patient_documents
         WHERE document_id = $1`,
        [document_id],
      );

      res.status(200).json({
        message: "Patient document removed successfully.",
        deleted_document_id: Number(document_id),
      });
    } catch (err) {
      console.error("Delete patient document error:", err.message);

      res.status(500).json({
        error: "Error removing patient document.",
      });
    }
  },
);

module.exports = router;
