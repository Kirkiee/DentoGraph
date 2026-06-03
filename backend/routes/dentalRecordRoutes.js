const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const ADULT_TOOTH_NUMBERS = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
];

const CHILD_TOOTH_NUMBERS = [
  51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84,
  85,
];

const getValidToothNumbersByDentition = (dentitionType) => {
  return dentitionType === "Child" ? CHILD_TOOTH_NUMBERS : ADULT_TOOTH_NUMBERS;
};

const isValidToothNumberForDentition = (toothNumber, dentitionType) => {
  const validNumbers = getValidToothNumbersByDentition(dentitionType);
  return validNumbers.includes(Number(toothNumber));
};

const getToothNumberErrorMessage = (dentitionType) => {
  if (dentitionType === "Child") {
    return "Invalid tooth number for a child patient. Please use primary FDI tooth numbers: 51-55, 61-65, 71-75, or 81-85.";
  }

  return "Invalid tooth number for an adult patient. Please use permanent FDI tooth numbers: 11-18, 21-28, 31-38, or 41-48.";
};

const getDentitionLabel = (dentitionType) => {
  if (dentitionType === "Child") {
    return "Child / Primary Teeth";
  }

  return "Adult / Permanent Teeth";
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
    `SELECT 
        patient_id,
        COALESCE(dentition_type, 'Adult') AS dentition_type
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
      patient_user.name AS patient_name,
      patient_user.email AS patient_email,
      COALESCE(p.dentition_type, 'Adult') AS dentition_type,
      dr.dentist_id,
      dentist_user.name AS dentist_name,
      d.clinic_id,
      c.clinic_name,
      dr.date_created,
      dr.last_updated,
      COALESCE(dr.status, 'Active') AS status
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

const checkClinicRecordLimit = async (clinic_id) => {
  if (!clinic_id) {
    return {
      allowed: false,
      error:
        "Dentist is not assigned to a clinic. Cannot validate subscription limits.",
    };
  }

  const clinicPlanResult = await pool.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        sp.plan_name,
        sp.max_records
     FROM public.clinics c
     LEFT JOIN public.subscription_plans sp
       ON c.subscription_plan_id = sp.plan_id
     WHERE c.clinic_id = $1`,
    [clinic_id],
  );

  if (clinicPlanResult.rows.length === 0) {
    return {
      allowed: false,
      error: "Clinic not found. Cannot validate subscription limits.",
    };
  }

  const clinic = clinicPlanResult.rows[0];

  if (!clinic.subscription_plan_id) {
    return {
      allowed: false,
      error:
        "This clinic has no subscription plan assigned. Please assign a plan before creating dental records.",
    };
  }

  const recordCountResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND COALESCE(dr.status, 'Active') = 'Active'`,
    [clinic_id],
  );

  const currentRecords = recordCountResult.rows[0].count;
  const maxRecords = clinic.max_records;

  if (maxRecords !== null && currentRecords >= maxRecords) {
    return {
      allowed: false,
      error: `${clinic.clinic_name} has reached the dental record limit for the ${clinic.plan_name} plan. Limit: ${maxRecords}.`,
    };
  }

  return {
    allowed: true,
    error: null,
  };
};

// DENTIST: CREATE DENTAL RECORD FOR A PATIENT
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { patient_id } = req.body || {};

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    try {
      const dentist = await getDentistProfile(user_id);

      if (!dentist) {
        return res.status(404).json({
          error:
            "Dentist profile not found. Please create your dentist profile first.",
        });
      }

      const patientResult = await pool.query(
        `SELECT 
            p.patient_id,
            u.name AS patient_name,
            COALESCE(p.dentition_type, 'Adult') AS dentition_type
         FROM public.patients p
         JOIN public.users u ON p.user_id = u.user_id
         WHERE p.patient_id = $1`,
        [patient_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const appointmentCheck = await pool.query(
        `SELECT appointment_id
         FROM public.appointments
         WHERE patient_id = $1
         AND dentist_id = $2
         AND status IN ('Pending', 'Scheduled', 'Completed')
         LIMIT 1`,
        [patient_id, dentist.dentist_id],
      );

      if (appointmentCheck.rows.length === 0) {
        return res.status(403).json({
          error:
            "You can only create dental records for patients assigned to your appointments.",
        });
      }

      const existingRecord = await pool.query(
        `SELECT 
            record_id,
            patient_id,
            dentist_id,
            date_created,
            last_updated,
            COALESCE(status, 'Active') AS status
         FROM public.dental_records
         WHERE patient_id = $1
         AND dentist_id = $2
         AND COALESCE(status, 'Active') = 'Active'`,
        [patient_id, dentist.dentist_id],
      );

      if (existingRecord.rows.length > 0) {
        return res.status(200).json({
          message: "Dental record already exists for this patient and dentist.",
          dental_record: existingRecord.rows[0],
          existing: true,
        });
      }

      const limitCheck = await checkClinicRecordLimit(dentist.clinic_id);

      if (!limitCheck.allowed) {
        return res.status(400).json({
          error: limitCheck.error,
        });
      }

      const newRecord = await pool.query(
        `INSERT INTO public.dental_records
         (patient_id, dentist_id, date_created, last_updated, status)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Active')
         RETURNING *`,
        [patient_id, dentist.dentist_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_DENTAL_RECORD",
        module: "Dental Records",
        description: `Created dental record #${newRecord.rows[0].record_id} for patient ${patientResult.rows[0].patient_name}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: `Dental record created successfully for ${patientResult.rows[0].patient_name} (${getDentitionLabel(
          patientResult.rows[0].dentition_type,
        )}).`,
        dental_record: newRecord.rows[0],
      });
    } catch (err) {
      console.error("Create dental record error:", err.message);
      res.status(500).json({ error: "Error creating dental record" });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET DENTAL RECORDS BY ROLE SCOPE
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const role = req.user.role;
    const user_id = req.user.user_id;
    const { status } = req.query;
    const selectedStatus = status || "Active";

    try {
      let records;

      if (role === "Admin") {
        if (selectedStatus === "All") {
          records = await pool.query(
            `${getDentalRecordBaseQuery()}
             ORDER BY dr.record_id DESC`,
          );
        } else {
          records = await pool.query(
            `${getDentalRecordBaseQuery()}
             WHERE COALESCE(dr.status, 'Active') = $1
             ORDER BY dr.record_id DESC`,
            [selectedStatus],
          );
        }
      } else if (role === "Dentist") {
        const dentist = await getDentistProfile(user_id);

        if (!dentist) {
          return res.status(404).json({ error: "Dentist profile not found" });
        }

        records = await pool.query(
          `${getDentalRecordBaseQuery()}
           WHERE dr.dentist_id = $1
           AND COALESCE(dr.status, 'Active') = 'Active'
           ORDER BY dr.record_id DESC`,
          [dentist.dentist_id],
        );
      } else if (isAssistantRole(role)) {
        const assistant = await getAssistantProfile(user_id);

        if (!assistant) {
          return res.status(404).json({ error: "Assistant profile not found" });
        }

        if (!assistant.clinic_id) {
          return res.status(400).json({
            error: "Assistant is not assigned to a clinic",
          });
        }

        records = await pool.query(
          `${getDentalRecordBaseQuery()}
           WHERE d.clinic_id = $1
           AND COALESCE(dr.status, 'Active') = 'Active'
           ORDER BY dr.record_id DESC`,
          [assistant.clinic_id],
        );
      }

      res.status(200).json({
        message: "Dental records retrieved successfully",
        dental_records: records.rows,
      });
    } catch (err) {
      console.error("Get dental records error:", err.message);
      res.status(500).json({ error: "Error retrieving dental records" });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET PATIENTS FOR DENTAL RECORD CREATION
router.get(
  "/patients/list",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const role = req.user.role;
    const user_id = req.user.user_id;

    try {
      let patients;

      if (role === "Admin") {
        patients = await pool.query(
          `SELECT 
              p.patient_id,
              p.user_id,
              u.name AS patient_name,
              u.email,
              COALESCE(p.dentition_type, 'Adult') AS dentition_type
           FROM public.patients p
           JOIN public.users u ON p.user_id = u.user_id
           ORDER BY u.name ASC`,
        );
      } else if (role === "Dentist") {
        const dentist = await getDentistProfile(user_id);

        if (!dentist) {
          return res.status(404).json({ error: "Dentist profile not found" });
        }

        patients = await pool.query(
          `SELECT DISTINCT
              p.patient_id,
              p.user_id,
              u.name AS patient_name,
              u.email,
              COALESCE(p.dentition_type, 'Adult') AS dentition_type
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users u ON p.user_id = u.user_id
           WHERE a.dentist_id = $1
           AND a.status IN ('Pending', 'Scheduled', 'Completed')
           ORDER BY u.name ASC`,
          [dentist.dentist_id],
        );
      } else if (isAssistantRole(role)) {
        const assistant = await getAssistantProfile(user_id);

        if (!assistant) {
          return res.status(404).json({ error: "Assistant profile not found" });
        }

        if (!assistant.clinic_id) {
          return res.status(400).json({
            error: "Assistant is not assigned to a clinic",
          });
        }

        patients = await pool.query(
          `SELECT DISTINCT
              p.patient_id,
              p.user_id,
              u.name AS patient_name,
              u.email,
              COALESCE(p.dentition_type, 'Adult') AS dentition_type
           FROM public.appointments a
           JOIN public.patients p ON a.patient_id = p.patient_id
           JOIN public.users u ON p.user_id = u.user_id
           JOIN public.dentists d ON a.dentist_id = d.dentist_id
           WHERE d.clinic_id = $1
           AND a.status IN ('Pending', 'Scheduled', 'Completed')
           ORDER BY u.name ASC`,
          [assistant.clinic_id],
        );
      }

      res.status(200).json({
        message: "Patients retrieved successfully",
        patients: patients.rows,
      });
    } catch (err) {
      console.error("Get patients list error:", err.message);
      res.status(500).json({ error: "Error retrieving patients" });
    }
  },
);

// PATIENT: GET OWN DENTAL RECORDS
router.get(
  "/patient/my-records/list",
  authenticateToken,
  authorizeRoles("Patient"),
  async (req, res) => {
    const user_id = req.user.user_id;

    try {
      const patient = await getPatientProfile(user_id);

      if (!patient) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const records = await pool.query(
        `${getDentalRecordBaseQuery()}
         WHERE dr.patient_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'
         ORDER BY dr.date_created DESC`,
        [patient.patient_id],
      );

      res.status(200).json({
        message: "Patient dental records retrieved successfully",
        dental_records: records.rows,
      });
    } catch (err) {
      console.error("Get patient dental records error:", err.message);
      res
        .status(500)
        .json({ error: "Error retrieving patient dental records" });
    }
  },
);

// DENTIST / ASSISTANT / PATIENT / ADMIN: GET SINGLE DENTAL RECORD WITH TEETH AND TREATMENTS
router.get(
  "/:record_id",
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

      if (access.record.status === "Archived" && req.user.role !== "Admin") {
        return res.status(403).json({
          error: "This dental record has been archived.",
        });
      }

      const teethResult = await pool.query(
        `SELECT *
         FROM public.teeth
         WHERE record_id = $1
         ORDER BY tooth_number`,
        [record_id],
      );

      const treatmentsResult = await pool.query(
        `SELECT 
            t.treatment_id,
            t.tooth_id,
            teeth.tooth_number,
            t.procedure_type,
            t.description,
            t.treatment_date
         FROM public.treatments t
         JOIN public.teeth teeth ON t.tooth_id = teeth.tooth_id
         WHERE teeth.record_id = $1
         ORDER BY t.treatment_date DESC`,
        [record_id],
      );

      res.status(200).json({
        message: "Dental record details retrieved successfully",
        dental_record: {
          ...access.record,
          valid_tooth_numbers: getValidToothNumbersByDentition(
            access.record.dentition_type,
          ),
          dentition_label: getDentitionLabel(access.record.dentition_type),
        },
        teeth: teethResult.rows,
        treatments: treatmentsResult.rows,
      });
    } catch (err) {
      console.error("Get dental record details error:", err.message);
      res.status(500).json({ error: "Error retrieving dental record details" });
    }
  },
);

// DENTIST / ASSISTANT: ADD TOOTH TO DENTAL RECORD
router.post(
  "/:record_id/teeth",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    const { record_id } = req.params;
    const { tooth_number, tooth_status } = req.body || {};

    if (!tooth_number) {
      return res.status(400).json({ error: "Tooth number is required" });
    }

    try {
      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      const dentitionType = access.record.dentition_type || "Adult";

      if (!isValidToothNumberForDentition(tooth_number, dentitionType)) {
        return res.status(400).json({
          error: getToothNumberErrorMessage(dentitionType),
        });
      }

      const duplicateCheck = await pool.query(
        `SELECT tooth_id
         FROM public.teeth
         WHERE record_id = $1 AND tooth_number = $2`,
        [record_id, Number(tooth_number)],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error: "This tooth already exists in the dental record",
        });
      }

      const newTooth = await pool.query(
        `INSERT INTO public.teeth
         (record_id, tooth_number, tooth_status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [record_id, Number(tooth_number), tooth_status || "Normal"],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "ADD_TOOTH",
        module: "Dental Records",
        description: `Added tooth #${newTooth.rows[0].tooth_number} to ${getDentitionLabel(
          dentitionType,
        )} dental record #${record_id}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Tooth added successfully",
        tooth: newTooth.rows[0],
      });
    } catch (err) {
      console.error("Add tooth error:", err.message);
      res.status(500).json({ error: "Error adding tooth" });
    }
  },
);

// DENTIST / ASSISTANT: UPDATE TOOTH STATUS
router.put(
  "/teeth/:tooth_id",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    const { tooth_id } = req.params;
    const { tooth_status } = req.body || {};

    if (!tooth_status) {
      return res.status(400).json({ error: "Tooth status is required" });
    }

    try {
      const toothResult = await pool.query(
        `SELECT tooth_id, record_id, tooth_number
         FROM public.teeth
         WHERE tooth_id = $1`,
        [tooth_id],
      );

      if (toothResult.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
      }

      const record_id = toothResult.rows[0].record_id;
      const tooth_number = toothResult.rows[0].tooth_number;

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      const updatedTooth = await pool.query(
        `UPDATE public.teeth
         SET tooth_status = $1
         WHERE tooth_id = $2
         RETURNING *`,
        [tooth_status, tooth_id],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_TOOTH",
        module: "Dental Records",
        description: `Updated tooth #${tooth_number} status to ${tooth_status} in dental record #${record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Tooth status updated successfully",
        tooth: updatedTooth.rows[0],
      });
    } catch (err) {
      console.error("Update tooth error:", err.message);
      res.status(500).json({ error: "Error updating tooth status" });
    }
  },
);

// DENTIST: ADD TREATMENT TO TOOTH
router.post(
  "/teeth/:tooth_id/treatments",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { tooth_id } = req.params;
    const { procedure_type, description, treatment_date } = req.body || {};

    if (!procedure_type) {
      return res.status(400).json({ error: "Procedure type is required" });
    }

    try {
      const toothCheck = await pool.query(
        `SELECT tooth_id, record_id, tooth_number
         FROM public.teeth
         WHERE tooth_id = $1`,
        [tooth_id],
      );

      if (toothCheck.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
      }

      const record_id = toothCheck.rows[0].record_id;
      const tooth_number = toothCheck.rows[0].tooth_number;

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      const newTreatment = await pool.query(
        `INSERT INTO public.treatments
         (tooth_id, procedure_type, description, treatment_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          tooth_id,
          procedure_type,
          description || null,
          treatment_date || new Date(),
        ],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "ADD_TREATMENT",
        module: "Dental Records",
        description: `Added treatment "${procedure_type}" to tooth #${tooth_number} in dental record #${record_id}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: "Treatment added successfully",
        treatment: newTreatment.rows[0],
      });
    } catch (err) {
      console.error("Add treatment error:", err.message);
      res.status(500).json({ error: "Error adding treatment" });
    }
  },
);

// DENTIST: UPDATE TREATMENT
router.put(
  "/treatments/:treatment_id",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const { treatment_id } = req.params;
    const { procedure_type, description, treatment_date } = req.body || {};

    if (!procedure_type || !treatment_date) {
      return res.status(400).json({
        error: "Procedure type and treatment date are required",
      });
    }

    try {
      const treatmentResult = await pool.query(
        `SELECT 
            t.treatment_id,
            t.tooth_id,
            teeth.record_id,
            teeth.tooth_number
         FROM public.treatments t
         JOIN public.teeth teeth ON t.tooth_id = teeth.tooth_id
         WHERE t.treatment_id = $1`,
        [treatment_id],
      );

      if (treatmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Treatment not found" });
      }

      const record_id = treatmentResult.rows[0].record_id;
      const tooth_number = treatmentResult.rows[0].tooth_number;

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      const updatedTreatment = await pool.query(
        `UPDATE public.treatments
         SET procedure_type = $1,
             description = $2,
             treatment_date = $3
         WHERE treatment_id = $4
         RETURNING *`,
        [procedure_type, description || null, treatment_date, treatment_id],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_TREATMENT",
        module: "Dental Records",
        description: `Updated treatment #${treatment_id} for tooth #${tooth_number} in dental record #${record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Treatment updated successfully",
        treatment: updatedTreatment.rows[0],
      });
    } catch (err) {
      console.error("Update treatment error:", err.message);
      res.status(500).json({ error: "Error updating treatment" });
    }
  },
);

// ADMIN / DENTIST: ARCHIVE DENTAL RECORD
router.put(
  "/:record_id/archive",
  authenticateToken,
  authorizeRoles("Admin", "Dentist"),
  async (req, res) => {
    const { record_id } = req.params;

    try {
      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      const archivedRecord = await pool.query(
        `UPDATE public.dental_records
         SET status = 'Archived',
             last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1
         RETURNING *`,
        [record_id],
      );

      if (archivedRecord.rows.length === 0) {
        return res.status(404).json({ error: "Dental record not found" });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "ARCHIVE_DENTAL_RECORD",
        module: "Dental Records",
        description: `Archived dental record #${archivedRecord.rows[0].record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Dental record archived successfully",
        dental_record: archivedRecord.rows[0],
      });
    } catch (err) {
      console.error("Archive dental record error:", err.message);
      res.status(500).json({ error: "Error archiving dental record" });
    }
  },
);

// ADMIN: RESTORE ARCHIVED DENTAL RECORD
router.put(
  "/:record_id/restore",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { record_id } = req.params;

    try {
      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      const restoredRecord = await pool.query(
        `UPDATE public.dental_records
         SET status = 'Active',
             last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1
         RETURNING *`,
        [record_id],
      );

      if (restoredRecord.rows.length === 0) {
        return res.status(404).json({ error: "Dental record not found" });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "RESTORE_DENTAL_RECORD",
        module: "Dental Records",
        description: `Restored dental record #${restoredRecord.rows[0].record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Dental record restored successfully",
        dental_record: restoredRecord.rows[0],
      });
    } catch (err) {
      console.error("Restore dental record error:", err.message);
      res.status(500).json({ error: "Error restoring dental record" });
    }
  },
);

module.exports = router;
