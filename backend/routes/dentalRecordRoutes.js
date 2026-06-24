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

const ALLOWED_TOOTH_STATUSES = [
  "Sound",
  "Caries",
  "Filled",
  "Missing",
  "Crown",
  "Impacted",
  "Root Canal Treated",
  "For Extraction",
  "Normal",
  "Decayed",
  "Crowned",
];

const ALLOWED_RECORD_SOURCES = [
  "NEW_SYSTEM_RECORD",
  "OLD_ENCODED_RECORD",
  "SCANNED_OLD_RECORD",
  "PDA_BASED_RECORD",
];

const normalizeRecordSource = (recordSource) => {
  if (ALLOWED_RECORD_SOURCES.includes(recordSource)) {
    return recordSource;
  }

  return "NEW_SYSTEM_RECORD";
};

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

const normalizeDentitionType = (dentitionType) => {
  if (dentitionType === "Adult" || dentitionType === "Child") {
    return dentitionType;
  }

  return null;
};

const normalizeToothStatus = (status) => {
  switch (status) {
    case "Normal":
      return "Sound";
    case "Decayed":
      return "Caries";
    case "Crowned":
      return "Crown";
    default:
      return status || "Sound";
  }
};

const isValidToothStatus = (status) => {
  return ALLOWED_TOOTH_STATUSES.includes(status);
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

const getDentistProfileByDentistId = async (dentist_id) => {
  const result = await pool.query(
    `SELECT dentist_id, clinic_id
     FROM public.dentists
     WHERE dentist_id = $1`,
    [dentist_id],
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
        dentition_type
     FROM public.patients
     WHERE user_id = $1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const getActorInfo = async (user_id) => {
  const result = await pool.query(
    `SELECT 
        u.user_id,
        u.name,
        u.email,
        r.role_name
     FROM public.users u
     LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
     LEFT JOIN public.roles r ON ur.role_id = r.role_id
     WHERE u.user_id = $1
     LIMIT 1`,
    [user_id],
  );

  return result.rows[0] || null;
};

const addToothStatusHistory = async ({
  record_id,
  tooth_number,
  old_status = null,
  new_status,
  notes = null,
  changed_by,
  change_type = "Status Update",
}) => {
  const actor = await getActorInfo(changed_by);

  const result = await pool.query(
    `INSERT INTO public.tooth_status_history
     (
       record_id,
       tooth_number,
       old_status,
       new_status,
       notes,
       changed_by,
       changed_by_name,
       changed_by_role,
       change_type,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      record_id,
      String(tooth_number),
      old_status,
      new_status,
      notes,
      changed_by,
      actor?.name || null,
      actor?.role_name || null,
      change_type,
    ],
  );

  return result.rows[0];
};

const getDentalRecordBaseQuery = () => {
  return `
    SELECT 
      dr.record_id,
      dr.patient_id,
      patient_user.name AS patient_name,
      patient_user.email AS patient_email,
      p.dentition_type AS dentition_type,
      dr.dentist_id,
      dentist_user.name AS dentist_name,
      d.clinic_id,
      c.clinic_name,
      dr.date_created,
      dr.last_updated,
      COALESCE(dr.status, 'Active') AS status,
      COALESCE(dr.record_source, 'NEW_SYSTEM_RECORD') AS record_source,
      dr.source_notes
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

const checkClinicRecordLimit = async (clinic_id, patient_id) => {
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
        c.subscription_end_date,
        c.subscription_status,
        sp.plan_name,
        sp.max_patients,
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

  const isExpiredByDate =
    clinic.subscription_end_date &&
    new Date(clinic.subscription_end_date) < new Date();

  if (clinic.subscription_status === "Expired" || isExpiredByDate) {
    return {
      allowed: false,
      error:
        "Your clinic subscription has expired. Please ask the Clinic Owner to renew or change the subscription plan.",
    };
  }

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

  const patientAlreadyCountedResult = await pool.query(
    `SELECT dr.record_id
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND dr.patient_id = $2
     AND COALESCE(dr.status, 'Active') = 'Active'
     LIMIT 1`,
    [clinic_id, patient_id],
  );

  const patientAlreadyCounted = patientAlreadyCountedResult.rows.length > 0;

  if (!patientAlreadyCounted) {
    const patientCountResult = await pool.query(
      `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
       FROM public.dental_records dr
       JOIN public.dentists d ON dr.dentist_id = d.dentist_id
       WHERE d.clinic_id = $1
       AND COALESCE(dr.status, 'Active') = 'Active'`,
      [clinic_id],
    );

    const currentPatients = patientCountResult.rows[0].count;
    const maxPatients = clinic.max_patients;

    if (maxPatients !== null && currentPatients >= maxPatients) {
      return {
        allowed: false,
        error: `${clinic.clinic_name} has reached the patient limit for the ${clinic.plan_name} plan. Limit: ${maxPatients}.`,
      };
    }
  }

  return {
    allowed: true,
    error: null,
  };
};

const validateDentalRecordCreationPolicy = async ({ patient_id, dentist }) => {
  if (!dentist) {
    return {
      allowed: false,
      statusCode: 404,
      error:
        "Dental Record Creation Policy: Dentist profile must exist before creating dental records.",
    };
  }

  if (!dentist.clinic_id) {
    return {
      allowed: false,
      statusCode: 400,
      error:
        "Dental Record Creation Policy: Dentist must be assigned to a clinic before creating dental records.",
    };
  }

  const patientResult = await pool.query(
    `SELECT 
        p.patient_id,
        p.user_id,
        u.name AS patient_name,
        u.email AS patient_email,
        p.contact_number,
        p.date_of_birth,
        p.address,
        p.gender,
        p.medical_history,
        p.dentition_type
     FROM public.patients p
     JOIN public.users u ON p.user_id = u.user_id
     WHERE p.patient_id = $1`,
    [patient_id],
  );

  if (patientResult.rows.length === 0) {
    return {
      allowed: false,
      statusCode: 404,
      error:
        "Dental Record Creation Policy: A dental record can only be created for an existing patient profile.",
    };
  }

  const patient = patientResult.rows[0];
  const normalizedDentitionType = normalizeDentitionType(
    patient.dentition_type,
  );

  if (!normalizedDentitionType) {
    return {
      allowed: false,
      statusCode: 400,
      error:
        "Dental Record Creation Policy: Patient dentition type must be set to Adult or Child before creating a dental record.",
    };
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
    return {
      allowed: false,
      statusCode: 403,
      error:
        "Dental Record Creation Policy: You can only create dental records for patients assigned to your appointments.",
    };
  }

  const existingClinicRecord = await pool.query(
    `SELECT 
        dr.record_id,
        dr.patient_id,
        dr.dentist_id,
        d.clinic_id,
        c.clinic_name,
        dentist_user.name AS dentist_name,
        dr.date_created,
        dr.last_updated,
        COALESCE(dr.status, 'Active') AS status,
        COALESCE(dr.record_source, 'NEW_SYSTEM_RECORD') AS record_source,
        dr.source_notes
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     JOIN public.users dentist_user ON d.user_id = dentist_user.user_id
     LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
     WHERE dr.patient_id = $1
     AND d.clinic_id = $2
     AND COALESCE(dr.status, 'Active') = 'Active'
     LIMIT 1`,
    [patient_id, dentist.clinic_id],
  );

  if (existingClinicRecord.rows.length > 0) {
    return {
      allowed: false,
      statusCode: 409,
      error:
        "Dental Record Creation Policy: This patient already has an active dental record under this clinic. Archive the existing record before creating a new one.",
      existingRecord: existingClinicRecord.rows[0],
      patient,
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    error: null,
    patient,
    dentitionType: normalizedDentitionType,
  };
};

// DENTIST / ASSISTANT: CREATE DENTAL RECORD FOR A PATIENT
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const role = req.user.role;
    const { patient_id, dentist_id, record_source, source_notes } =
      req.body || {};

    const cleanRecordSource = normalizeRecordSource(record_source);

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    try {
      let dentist = null;

      if (role === "Dentist") {
        dentist = await getDentistProfile(user_id);

        if (!dentist) {
          return res.status(404).json({ error: "Dentist profile not found" });
        }
      }

      if (isAssistantRole(role)) {
        const assistant = await getAssistantProfile(user_id);

        if (!assistant) {
          return res.status(404).json({ error: "Assistant profile not found" });
        }

        if (!assistant.clinic_id) {
          return res.status(400).json({
            error: "Assistant is not assigned to a clinic",
          });
        }

        if (!dentist_id) {
          return res.status(400).json({
            error:
              "Dentist ID is required when an assistant creates a dental record.",
          });
        }

        dentist = await getDentistProfileByDentistId(dentist_id);

        if (!dentist) {
          return res.status(404).json({ error: "Selected dentist not found" });
        }

        if (Number(dentist.clinic_id) !== Number(assistant.clinic_id)) {
          return res.status(403).json({
            error:
              "Assistant can only create dental records under dentists from the same assigned clinic.",
          });
        }
      }

      const policyCheck = await validateDentalRecordCreationPolicy({
        patient_id,
        dentist,
      });

      if (!policyCheck.allowed) {
        const responseBody = {
          error: policyCheck.error,
          policy: {
            name: "Dental Record Creation Policy",
            rules: [
              "A dental record can only be created for an existing patient profile.",
              "The patient must have dentition type set to Adult or Child.",
              "The selected dentist must have an assigned clinic.",
              "The selected dentist must have an appointment connection with the patient.",
              "Only one active dental record is allowed per patient per clinic.",
              "Archived records must be restored or a new record can be created only after the previous record is archived.",
              "Dental assistants may create records only under dentists from their assigned clinic.",
            ],
          },
        };

        if (policyCheck.existingRecord) {
          responseBody.existing_record = policyCheck.existingRecord;
        }

        return res.status(policyCheck.statusCode).json(responseBody);
      }

      const limitCheck = await checkClinicRecordLimit(
        dentist.clinic_id,
        patient_id,
      );

      if (!limitCheck.allowed) {
        return res.status(400).json({
          error: limitCheck.error,
        });
      }

      const newRecord = await pool.query(
        `INSERT INTO public.dental_records
         (
           patient_id,
           dentist_id,
           date_created,
           last_updated,
           status,
           record_source,
           source_notes
         )
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Active', $3, $4)
         RETURNING *`,
        [
          patient_id,
          dentist.dentist_id,
          cleanRecordSource,
          source_notes || null,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_DENTAL_RECORD",
        module: "Dental Records",
        description: `${role} created dental record #${newRecord.rows[0].record_id} for patient ${policyCheck.patient.patient_name}. Source: ${cleanRecordSource}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: `Dental record created successfully for ${
          policyCheck.patient.patient_name
        } (${getDentitionLabel(policyCheck.dentitionType)}).`,
        dental_record: newRecord.rows[0],
        policy_applied: {
          name: "Dental Record Creation Policy",
          summary:
            "Patient profile, dentition type, appointment assignment, clinic assignment, active record uniqueness, subscription patient limit and subscription record limits were validated.",
          record_source: cleanRecordSource,
        },
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
              p.dentition_type
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
              p.dentition_type
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
              p.dentition_type
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

// DENTIST / ASSISTANT / ADMIN: GET DENTISTS FOR RECORD CREATION
router.get(
  "/dentists/list",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant", "Admin"),
  async (req, res) => {
    const role = req.user.role;
    const user_id = req.user.user_id;

    try {
      let dentists;

      if (role === "Admin") {
        dentists = await pool.query(
          `SELECT 
              d.dentist_id,
              d.user_id,
              u.name AS dentist_name,
              u.email,
              d.clinic_id,
              c.clinic_name
           FROM public.dentists d
           JOIN public.users u ON d.user_id = u.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
           ORDER BY u.name ASC`,
        );
      } else if (role === "Dentist") {
        const dentist = await getDentistProfile(user_id);

        if (!dentist) {
          return res.status(404).json({ error: "Dentist profile not found" });
        }

        dentists = await pool.query(
          `SELECT 
              d.dentist_id,
              d.user_id,
              u.name AS dentist_name,
              u.email,
              d.clinic_id,
              c.clinic_name
           FROM public.dentists d
           JOIN public.users u ON d.user_id = u.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
           WHERE d.dentist_id = $1
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

        dentists = await pool.query(
          `SELECT 
              d.dentist_id,
              d.user_id,
              u.name AS dentist_name,
              u.email,
              d.clinic_id,
              c.clinic_name
           FROM public.dentists d
           JOIN public.users u ON d.user_id = u.user_id
           LEFT JOIN public.clinics c ON d.clinic_id = c.clinic_id
           WHERE d.clinic_id = $1
           ORDER BY u.name ASC`,
          [assistant.clinic_id],
        );
      }

      res.status(200).json({
        message: "Dentists retrieved successfully",
        dentists: dentists.rows,
      });
    } catch (err) {
      console.error("Get dentists list error:", err.message);
      res.status(500).json({ error: "Error retrieving dentists" });
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

// DENTIST / ASSISTANT / PATIENT / ADMIN: GET ALL TOOTH STATUS HISTORY FOR A RECORD
router.get(
  "/:record_id/tooth-history",
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

      const history = await pool.query(
        `SELECT *
         FROM public.tooth_status_history
         WHERE record_id = $1
         ORDER BY created_at DESC, history_id DESC`,
        [record_id],
      );

      res.status(200).json({
        message: "Tooth status history retrieved successfully",
        history: history.rows,
      });
    } catch (err) {
      console.error("Get tooth history error:", err.message);
      res.status(500).json({ error: "Error retrieving tooth status history" });
    }
  },
);

// DENTIST / ASSISTANT / PATIENT / ADMIN: GET HISTORY FOR ONE TOOTH
router.get(
  "/:record_id/teeth/:tooth_number/history",
  authenticateToken,
  authorizeRoles(
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
    "Admin",
  ),
  async (req, res) => {
    const { record_id, tooth_number } = req.params;

    try {
      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      const history = await pool.query(
        `SELECT *
         FROM public.tooth_status_history
         WHERE record_id = $1
         AND tooth_number = $2
         ORDER BY created_at DESC, history_id DESC`,
        [record_id, String(tooth_number)],
      );

      res.status(200).json({
        message: "Tooth history retrieved successfully",
        tooth_number: String(tooth_number),
        history: history.rows,
      });
    } catch (err) {
      console.error("Get single tooth history error:", err.message);
      res.status(500).json({ error: "Error retrieving tooth history" });
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

      const dentitionType = normalizeDentitionType(
        access.record.dentition_type,
      );

      if (!dentitionType) {
        return res.status(400).json({
          error:
            "Dental Record Policy: This patient record has no valid dentition type. Please update the patient profile to Adult or Child.",
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

      const toothHistoryResult = await pool.query(
        `SELECT *
         FROM public.tooth_status_history
         WHERE record_id = $1
         ORDER BY created_at DESC, history_id DESC`,
        [record_id],
      );

      res.status(200).json({
        message: "Dental record details retrieved successfully",
        dental_record: {
          ...access.record,
          dentition_type: dentitionType,
          valid_tooth_numbers: getValidToothNumbersByDentition(dentitionType),
          dentition_label: getDentitionLabel(dentitionType),
        },
        teeth: teethResult.rows,
        treatments: treatmentsResult.rows,
        tooth_status_history: toothHistoryResult.rows,
        policy: {
          name: "Dental Record Creation Policy",
          applied_rules: [
            "Record belongs to authorized role scope.",
            "Archived records cannot be modified.",
            "Adult/Child dentition type controls valid tooth numbers.",
            "Treatments must be attached to existing teeth.",
            "Tooth status changes are stored in tooth_status_history.",
            "Record source identifies whether the record is new, old encoded, scanned, or PDA-based.",
          ],
        },
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
    const { tooth_number, tooth_status, notes } = req.body || {};

    if (!tooth_number) {
      return res.status(400).json({ error: "Tooth number is required" });
    }

    const normalizedStatus = normalizeToothStatus(tooth_status);

    if (!isValidToothStatus(normalizedStatus)) {
      return res.status(400).json({
        error:
          "Invalid tooth status. Use Sound, Caries, Filled, Missing, Crown, Impacted, Root Canal Treated, or For Extraction.",
      });
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

      const dentitionType = normalizeDentitionType(
        access.record.dentition_type,
      );

      if (!dentitionType) {
        return res.status(400).json({
          error:
            "Dental Record Policy: Patient dentition type must be set to Adult or Child before adding teeth.",
        });
      }

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
        [record_id, Number(tooth_number), normalizedStatus],
      );

      await addToothStatusHistory({
        record_id,
        tooth_number: Number(tooth_number),
        old_status: null,
        new_status: normalizedStatus,
        notes: notes || "Tooth status added.",
        changed_by: req.user.user_id,
        change_type: "Status Added",
      });

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
        description: `Added tooth #${newTooth.rows[0].tooth_number} with status ${normalizedStatus} to ${getDentitionLabel(
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
    const { tooth_status, notes } = req.body || {};

    if (!tooth_status) {
      return res.status(400).json({ error: "Tooth status is required" });
    }

    const normalizedStatus = normalizeToothStatus(tooth_status);

    if (!isValidToothStatus(normalizedStatus)) {
      return res.status(400).json({
        error:
          "Invalid tooth status. Use Sound, Caries, Filled, Missing, Crown, Impacted, Root Canal Treated, or For Extraction.",
      });
    }

    try {
      const toothResult = await pool.query(
        `SELECT tooth_id, record_id, tooth_number, tooth_status
         FROM public.teeth
         WHERE tooth_id = $1`,
        [tooth_id],
      );

      if (toothResult.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
      }

      const oldTooth = toothResult.rows[0];
      const record_id = oldTooth.record_id;
      const tooth_number = oldTooth.tooth_number;
      const oldStatus = normalizeToothStatus(oldTooth.tooth_status);

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      if (oldStatus === normalizedStatus) {
        return res.status(200).json({
          message: "No status change detected.",
          tooth: oldTooth,
        });
      }

      const updatedTooth = await pool.query(
        `UPDATE public.teeth
         SET tooth_status = $1
         WHERE tooth_id = $2
         RETURNING *`,
        [normalizedStatus, tooth_id],
      );

      await addToothStatusHistory({
        record_id,
        tooth_number,
        old_status: oldStatus,
        new_status: normalizedStatus,
        notes: notes || null,
        changed_by: req.user.user_id,
        change_type: "Status Update",
      });

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
        description: `Updated tooth #${tooth_number} status from ${oldStatus} to ${normalizedStatus} in dental record #${record_id}.`,
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

// DENTIST / ASSISTANT: REMOVE / RESET TOOTH STATUS
router.delete(
  "/teeth/:tooth_id/status",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    const { tooth_id } = req.params;
    const { notes } = req.body || {};

    try {
      const toothResult = await pool.query(
        `SELECT tooth_id, record_id, tooth_number, tooth_status
         FROM public.teeth
         WHERE tooth_id = $1`,
        [tooth_id],
      );

      if (toothResult.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
      }

      const oldTooth = toothResult.rows[0];
      const record_id = oldTooth.record_id;
      const tooth_number = oldTooth.tooth_number;
      const oldStatus = normalizeToothStatus(oldTooth.tooth_status);
      const resetStatus = "Sound";

      const access = await getAccessibleRecord(req, record_id);

      if (!access.allowed) {
        return res.status(access.statusCode).json({ error: access.error });
      }

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Cannot modify an archived dental record.",
        });
      }

      if (oldStatus === resetStatus) {
        return res.status(200).json({
          message: "Tooth status is already Sound.",
          tooth: oldTooth,
        });
      }

      const updatedTooth = await pool.query(
        `UPDATE public.teeth
         SET tooth_status = $1
         WHERE tooth_id = $2
         RETURNING *`,
        [resetStatus, tooth_id],
      );

      await addToothStatusHistory({
        record_id,
        tooth_number,
        old_status: oldStatus,
        new_status: resetStatus,
        notes: notes || "Status removed/reset to Sound.",
        changed_by: req.user.user_id,
        change_type: "Status Removed",
      });

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "REMOVE_TOOTH_STATUS",
        module: "Dental Records",
        description: `Removed/reset tooth #${tooth_number} status from ${oldStatus} to ${resetStatus} in dental record #${record_id}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Tooth status removed/reset successfully",
        tooth: updatedTooth.rows[0],
      });
    } catch (err) {
      console.error("Remove tooth status error:", err.message);
      res.status(500).json({ error: "Error removing tooth status" });
    }
  },
);

// DENTIST / ASSISTANT: ADD TREATMENT TO TOOTH
router.post(
  "/teeth/:tooth_id/treatments",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
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

// DENTIST / ASSISTANT: UPDATE TREATMENT
router.put(
  "/treatments/:treatment_id",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
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

      if (access.record.status === "Archived") {
        return res.status(400).json({
          error: "Dental record is already archived.",
        });
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

      const existingClinicRecord = await pool.query(
        `SELECT 
            existing.record_id
         FROM public.dental_records existing
         JOIN public.dentists existing_dentist
           ON existing.dentist_id = existing_dentist.dentist_id
         JOIN public.dentists target_dentist
           ON target_dentist.dentist_id = $2
         WHERE existing.patient_id = $1
         AND existing_dentist.clinic_id = target_dentist.clinic_id
         AND COALESCE(existing.status, 'Active') = 'Active'
         AND existing.record_id <> $3
         LIMIT 1`,
        [access.record.patient_id, access.record.dentist_id, record_id],
      );

      if (existingClinicRecord.rows.length > 0) {
        return res.status(409).json({
          error:
            "Dental Record Creation Policy: Cannot restore this record because the patient already has another active dental record under the same clinic.",
          existing_record_id: existingClinicRecord.rows[0].record_id,
        });
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
