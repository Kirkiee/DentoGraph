const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "../uploads/ar-simulations");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = `ar-simulation-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${path.extname(file.originalname)}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG, JPG, and JPEG files are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const getUserIdFromToken = (req) => {
  return req.user.user_id || req.user.id || req.user.userId;
};

const getPatientIdByUserId = async (userId) => {
  const result = await pool.query(
    "SELECT patient_id FROM patients WHERE user_id = $1",
    [userId],
  );

  return result.rows[0]?.patient_id;
};

const getDentistIdByUserId = async (userId) => {
  const result = await pool.query(
    "SELECT dentist_id FROM dentists WHERE user_id = $1",
    [userId],
  );

  return result.rows[0]?.dentist_id;
};

const verifyPatientOwnsRecord = async (patientId, recordId) => {
  const result = await pool.query(
    `
    SELECT record_id
    FROM dental_records
    WHERE record_id = $1 AND patient_id = $2
    `,
    [recordId, patientId],
  );

  return result.rows.length > 0;
};

const createARSimulationLog = async (
  simulationId,
  userId,
  action,
  details = null,
) => {
  await pool.query(
    `
    INSERT INTO ar_simulation_logs (simulation_id, user_id, action, details)
    VALUES ($1, $2, $3, $4)
    `,
    [simulationId, userId, action, details],
  );
};

const cleanBraceStyleValue = (braceStyle) => {
  const allowedStyles = ["metal", "ceramic", "blue", "pink", "green", "purple"];

  if (!braceStyle || !allowedStyles.includes(braceStyle)) {
    return "metal";
  }

  return braceStyle;
};

/* PATIENT: SAVE AR PREVIEW */

router.post(
  "/",
  authenticateToken,
  upload.single("simulation"),
  async (req, res) => {
    try {
      const userId = getUserIdFromToken(req);

      if (req.user.role !== "Patient" && req.user.role !== "patient") {
        return res.status(403).json({
          error: "Only patients can save AR simulation previews.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Simulation image is required.",
        });
      }

      const patientId = await getPatientIdByUserId(userId);

      if (!patientId) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      const recordId = req.body.record_id || null;

      if (!recordId) {
        return res.status(400).json({
          error: "Please select a dental record before saving an AR preview.",
        });
      }

      const ownsRecord = await verifyPatientOwnsRecord(patientId, recordId);

      if (!ownsRecord) {
        return res.status(403).json({
          error: "You can only save AR previews under your own dental records.",
        });
      }

      const imagePath = `uploads/ar-simulations/${req.file.filename}`;
      const notes = req.body.notes || "AR braces simulation preview";
      const braceStyle = cleanBraceStyleValue(req.body.brace_style);

      const result = await pool.query(
        `
        INSERT INTO ar_simulations (
          patient_id,
          record_id,
          image_path,
          notes,
          brace_style,
          review_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [patientId, recordId, imagePath, notes, braceStyle, "Pending Review"],
      );

      await createARSimulationLog(
        result.rows[0].simulation_id,
        userId,
        "Preview Captured",
        `Patient captured and saved an AR braces simulation preview using ${braceStyle} style.`,
      );

      return res.status(201).json({
        message: "AR simulation preview saved successfully.",
        simulation: result.rows[0],
      });
    } catch (err) {
      console.error("Save AR simulation error:", err);

      return res.status(500).json({
        error: "Unable to save AR simulation preview.",
      });
    }
  },
);

/* PATIENT: GET ALL OWN PREVIEWS */

router.get("/my-previews", authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);

    if (req.user.role !== "Patient" && req.user.role !== "patient") {
      return res.status(403).json({
        error: "Only patients can view their AR simulation previews.",
      });
    }

    const patientId = await getPatientIdByUserId(userId);

    if (!patientId) {
      return res.status(404).json({
        error: "Patient profile not found.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        ar.*,
        COALESCE(ar.brace_style, 'metal') AS brace_style,
        dr.dentist_id,
        u.name AS dentist_name,
        c.clinic_name
      FROM ar_simulations ar
      LEFT JOIN dental_records dr ON ar.record_id = dr.record_id
      LEFT JOIN dentists d ON dr.dentist_id = d.dentist_id
      LEFT JOIN users u ON d.user_id = u.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.clinic_id
      WHERE ar.patient_id = $1
      ORDER BY ar.created_at DESC
      `,
      [patientId],
    );

    return res.json({
      simulations: result.rows,
    });
  } catch (err) {
    console.error("Fetch AR simulations error:", err);

    return res.status(500).json({
      error: "Unable to load AR simulation previews.",
    });
  }
});

/* PATIENT: GET PREVIEWS BY RECORD */

router.get("/record/:recordId", authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);

    if (req.user.role !== "Patient" && req.user.role !== "patient") {
      return res.status(403).json({
        error: "Only patients can view their AR simulation previews.",
      });
    }

    const patientId = await getPatientIdByUserId(userId);

    if (!patientId) {
      return res.status(404).json({
        error: "Patient profile not found.",
      });
    }

    const { recordId } = req.params;

    const ownsRecord = await verifyPatientOwnsRecord(patientId, recordId);

    if (!ownsRecord) {
      return res.status(403).json({
        error: "You can only view AR previews from your own dental records.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        ar.*,
        COALESCE(ar.brace_style, 'metal') AS brace_style,
        dr.dentist_id,
        u.name AS dentist_name,
        c.clinic_name
      FROM ar_simulations ar
      LEFT JOIN dental_records dr ON ar.record_id = dr.record_id
      LEFT JOIN dentists d ON dr.dentist_id = d.dentist_id
      LEFT JOIN users u ON d.user_id = u.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.clinic_id
      WHERE ar.patient_id = $1 AND ar.record_id = $2
      ORDER BY ar.created_at DESC
      `,
      [patientId, recordId],
    );

    return res.json({
      simulations: result.rows,
    });
  } catch (err) {
    console.error("Fetch AR simulations by record error:", err);

    return res.status(500).json({
      error: "Unable to load AR simulation previews for this record.",
    });
  }
});

/* DENTIST: GET RECORD AR PREVIEWS */

router.get("/dentist/record/:recordId", authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);

    if (req.user.role !== "Dentist" && req.user.role !== "dentist") {
      return res.status(403).json({
        error:
          "Only dentists can view AR simulation previews for dental records.",
      });
    }

    const dentistId = await getDentistIdByUserId(userId);

    if (!dentistId) {
      return res.status(404).json({
        error: "Dentist profile not found.",
      });
    }

    const { recordId } = req.params;

    const recordResult = await pool.query(
      `
      SELECT
        dr.*,
        p.patient_id,
        pu.name AS patient_name,
        du.name AS dentist_name,
        c.clinic_name
      FROM dental_records dr
      JOIN patients p ON dr.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      JOIN dentists d ON dr.dentist_id = d.dentist_id
      JOIN users du ON d.user_id = du.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.clinic_id
      WHERE dr.record_id = $1 AND dr.dentist_id = $2
      `,
      [recordId, dentistId],
    );

    if (recordResult.rows.length === 0) {
      return res.status(404).json({
        error: "Dental record not found or not assigned to this dentist.",
      });
    }

    const previewsResult = await pool.query(
      `
      SELECT
        ar.*,
        COALESCE(ar.brace_style, 'metal') AS brace_style,
        pu.name AS patient_name,
        du.name AS dentist_name,
        c.clinic_name
      FROM ar_simulations ar
      JOIN patients p ON ar.patient_id = p.patient_id
      JOIN users pu ON p.user_id = pu.user_id
      LEFT JOIN dental_records dr ON ar.record_id = dr.record_id
      LEFT JOIN dentists d ON dr.dentist_id = d.dentist_id
      LEFT JOIN users du ON d.user_id = du.user_id
      LEFT JOIN clinics c ON d.clinic_id = c.clinic_id
      WHERE ar.record_id = $1 AND dr.dentist_id = $2
      ORDER BY ar.created_at DESC
      `,
      [recordId, dentistId],
    );

    return res.json({
      record: recordResult.rows[0],
      simulations: previewsResult.rows,
    });
  } catch (err) {
    console.error("Dentist fetch AR simulations error:", err);

    return res.status(500).json({
      error: "Unable to load AR simulation previews for this dental record.",
    });
  }
});

/* DENTIST: RECORD AR SUMMARY */

router.get(
  "/dentist/record/:recordId/summary",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = getUserIdFromToken(req);

      if (req.user.role !== "Dentist" && req.user.role !== "dentist") {
        return res.status(403).json({
          error: "Only dentists can view AR simulation summaries.",
        });
      }

      const dentistId = await getDentistIdByUserId(userId);

      if (!dentistId) {
        return res.status(404).json({
          error: "Dentist profile not found.",
        });
      }

      const { recordId } = req.params;

      const recordResult = await pool.query(
        `
        SELECT record_id
        FROM dental_records
        WHERE record_id = $1 AND dentist_id = $2
        `,
        [recordId, dentistId],
      );

      if (recordResult.rows.length === 0) {
        return res.status(404).json({
          error: "Dental record not found or not assigned to this dentist.",
        });
      }

      const summaryResult = await pool.query(
        `
        SELECT
          COUNT(*)::INTEGER AS total_previews,
          (
            SELECT review_status
            FROM ar_simulations
            WHERE record_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ) AS latest_status,
          (
            SELECT COALESCE(brace_style, 'metal')
            FROM ar_simulations
            WHERE record_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ) AS latest_brace_style,
          (
            SELECT created_at
            FROM ar_simulations
            WHERE record_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          ) AS latest_created_at,
          (
            SELECT reviewed_at
            FROM ar_simulations
            WHERE record_id = $1
            ORDER BY reviewed_at DESC NULLS LAST
            LIMIT 1
          ) AS latest_reviewed_at
        FROM ar_simulations
        WHERE record_id = $1
        `,
        [recordId],
      );

      return res.json({
        summary: summaryResult.rows[0],
      });
    } catch (err) {
      console.error("Dentist AR summary error:", err);

      return res.status(500).json({
        error: "Unable to load AR simulation summary.",
      });
    }
  },
);

/* DENTIST: REVIEW AR PREVIEW */

router.put(
  "/dentist/:simulationId/review",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = getUserIdFromToken(req);

      if (req.user.role !== "Dentist" && req.user.role !== "dentist") {
        return res.status(403).json({
          error: "Only dentists can review AR simulation previews.",
        });
      }

      const dentistId = await getDentistIdByUserId(userId);

      if (!dentistId) {
        return res.status(404).json({
          error: "Dentist profile not found.",
        });
      }

      const { simulationId } = req.params;
      const { review_status, dentist_notes } = req.body;

      const allowedStatuses = [
        "Pending Review",
        "Reviewed",
        "For Consultation",
      ];

      if (!allowedStatuses.includes(review_status)) {
        return res.status(400).json({
          error: "Invalid review status.",
        });
      }

      const simulationResult = await pool.query(
        `
        SELECT
          ar.simulation_id,
          ar.record_id,
          ar.brace_style,
          dr.dentist_id
        FROM ar_simulations ar
        JOIN dental_records dr ON ar.record_id = dr.record_id
        WHERE ar.simulation_id = $1 AND dr.dentist_id = $2
        `,
        [simulationId, dentistId],
      );

      if (simulationResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "AR simulation preview not found or not assigned to this dentist.",
        });
      }

      const updateResult = await pool.query(
        `
        UPDATE ar_simulations
        SET
          review_status = $1,
          dentist_notes = $2,
          reviewed_at = CURRENT_TIMESTAMP
        WHERE simulation_id = $3
        RETURNING *
        `,
        [review_status, dentist_notes || null, simulationId],
      );

      await createARSimulationLog(
        simulationId,
        userId,
        "Review Updated",
        `Dentist updated review status to "${review_status}".`,
      );

      return res.json({
        message: "AR simulation review updated successfully.",
        simulation: updateResult.rows[0],
      });
    } catch (err) {
      console.error("Dentist review AR simulation error:", err);

      return res.status(500).json({
        error: "Unable to update AR simulation review.",
      });
    }
  },
);

/* PATIENT + DENTIST: VIEW LOGS */

router.get("/:simulationId/logs", authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const role = req.user.role;
    const { simulationId } = req.params;

    let accessResult;

    if (role === "Patient" || role === "patient") {
      const patientId = await getPatientIdByUserId(userId);

      if (!patientId) {
        return res.status(404).json({
          error: "Patient profile not found.",
        });
      }

      accessResult = await pool.query(
        `
        SELECT simulation_id
        FROM ar_simulations
        WHERE simulation_id = $1 AND patient_id = $2
        `,
        [simulationId, patientId],
      );
    } else if (role === "Dentist" || role === "dentist") {
      const dentistId = await getDentistIdByUserId(userId);

      if (!dentistId) {
        return res.status(404).json({
          error: "Dentist profile not found.",
        });
      }

      accessResult = await pool.query(
        `
        SELECT ar.simulation_id
        FROM ar_simulations ar
        JOIN dental_records dr ON ar.record_id = dr.record_id
        WHERE ar.simulation_id = $1 AND dr.dentist_id = $2
        `,
        [simulationId, dentistId],
      );
    } else {
      return res.status(403).json({
        error: "You are not allowed to view AR simulation logs.",
      });
    }

    if (accessResult.rows.length === 0) {
      return res.status(404).json({
        error: "AR simulation preview not found or access denied.",
      });
    }

    const logsResult = await pool.query(
      `
      SELECT
        logs.*,
        u.name AS user_name,
        CASE
          WHEN p.patient_id IS NOT NULL THEN 'Patient'
          WHEN d.dentist_id IS NOT NULL THEN 'Dentist'
          ELSE 'User'
        END AS user_role
      FROM ar_simulation_logs logs
      LEFT JOIN users u ON logs.user_id = u.user_id
      LEFT JOIN patients p ON u.user_id = p.user_id
      LEFT JOIN dentists d ON u.user_id = d.user_id
      WHERE logs.simulation_id = $1
      ORDER BY logs.created_at ASC
      `,
      [simulationId],
    );

    return res.json({
      logs: logsResult.rows,
    });
  } catch (err) {
    console.error("Fetch AR simulation logs error:", err);

    return res.status(500).json({
      error: "Unable to load AR simulation logs.",
    });
  }
});

/* PATIENT: DELETE PREVIEW */

router.delete("/:simulationId", authenticateToken, async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);

    if (req.user.role !== "Patient" && req.user.role !== "patient") {
      return res.status(403).json({
        error: "Only patients can delete their AR simulation previews.",
      });
    }

    const patientId = await getPatientIdByUserId(userId);

    if (!patientId) {
      return res.status(404).json({
        error: "Patient profile not found.",
      });
    }

    const { simulationId } = req.params;

    const findResult = await pool.query(
      `
      SELECT *
      FROM ar_simulations
      WHERE simulation_id = $1 AND patient_id = $2
      `,
      [simulationId, patientId],
    );

    if (findResult.rows.length === 0) {
      return res.status(404).json({
        error: "AR simulation preview not found.",
      });
    }

    const simulation = findResult.rows[0];

    await createARSimulationLog(
      simulationId,
      userId,
      "Preview Deleted",
      "Patient deleted this AR braces simulation preview.",
    );

    await pool.query(
      `
      DELETE FROM ar_simulations
      WHERE simulation_id = $1 AND patient_id = $2
      `,
      [simulationId, patientId],
    );

    if (simulation.image_path) {
      const filePath = path.join(__dirname, "..", simulation.image_path);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    return res.json({
      message: "AR simulation preview deleted successfully.",
    });
  } catch (err) {
    console.error("Delete AR simulation error:", err);

    return res.status(500).json({
      error: "Unable to delete AR simulation preview.",
    });
  }
});

module.exports = router;
