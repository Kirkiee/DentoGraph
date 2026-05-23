const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// DENTIST: CREATE DENTAL RECORD FOR A PATIENT
router.post(
  "/",
  authenticateToken,
  authorizeRoles("Dentist"),
  async (req, res) => {
    const user_id = req.user.user_id;
    const { patient_id } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    try {
      const dentistResult = await pool.query(
        "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
        [user_id],
      );

      if (dentistResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Dentist profile not found. Please create your dentist profile first.",
        });
      }

      const dentist_id = dentistResult.rows[0].dentist_id;

      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE patient_id = $1",
        [patient_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const newRecord = await pool.query(
        `INSERT INTO public.dental_records
         (patient_id, dentist_id, date_created, last_updated)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [patient_id, dentist_id],
      );

      res.status(201).json({
        message: "Dental record created successfully",
        dental_record: newRecord.rows[0],
      });
    } catch (err) {
      console.error("Create dental record error:", err.message);
      res.status(500).json({ error: "Error creating dental record" });
    }
  },
);

// DENTIST / ASSISTANT / ADMIN: GET ALL DENTAL RECORDS
router.get(
  "/",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Admin"),
  async (req, res) => {
    try {
      const records = await pool.query(
        `SELECT 
            dr.record_id,
            dr.patient_id,
            patient_user.name AS patient_name,
            dr.dentist_id,
            dentist_user.name AS dentist_name,
            dr.date_created,
            dr.last_updated
         FROM public.dental_records dr
         JOIN public.patients p ON dr.patient_id = p.patient_id
         JOIN public.users patient_user ON p.user_id = patient_user.user_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         JOIN public.users dentist_user ON d.user_id = dentist_user.user_id
         ORDER BY dr.record_id DESC`,
      );

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
  authorizeRoles("Dentist", "Assistant", "Admin"),
  async (req, res) => {
    try {
      const patients = await pool.query(
        `SELECT 
            p.patient_id,
            p.user_id,
            u.name AS patient_name,
            u.email
         FROM public.patients p
         JOIN public.users u ON p.user_id = u.user_id
         ORDER BY u.name ASC`,
      );

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
      const patientResult = await pool.query(
        "SELECT patient_id FROM public.patients WHERE user_id = $1",
        [user_id],
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      const patient_id = patientResult.rows[0].patient_id;

      const records = await pool.query(
        `SELECT 
            dr.record_id,
            dr.patient_id,
            patient_user.name AS patient_name,
            dr.dentist_id,
            dentist_user.name AS dentist_name,
            dr.date_created,
            dr.last_updated
         FROM public.dental_records dr
         JOIN public.patients p ON dr.patient_id = p.patient_id
         JOIN public.users patient_user ON p.user_id = patient_user.user_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         JOIN public.users dentist_user ON d.user_id = dentist_user.user_id
         WHERE dr.patient_id = $1
         ORDER BY dr.date_created DESC`,
        [patient_id],
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
  authorizeRoles("Dentist", "Assistant", "Patient", "Admin"),
  async (req, res) => {
    const { record_id } = req.params;

    try {
      const recordResult = await pool.query(
        `SELECT 
            dr.record_id,
            dr.patient_id,
            patient_user.name AS patient_name,
            dr.dentist_id,
            dentist_user.name AS dentist_name,
            dr.date_created,
            dr.last_updated
         FROM public.dental_records dr
         JOIN public.patients p ON dr.patient_id = p.patient_id
         JOIN public.users patient_user ON p.user_id = patient_user.user_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         JOIN public.users dentist_user ON d.user_id = dentist_user.user_id
         WHERE dr.record_id = $1`,
        [record_id],
      );

      if (recordResult.rows.length === 0) {
        return res.status(404).json({ error: "Dental record not found" });
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
        dental_record: recordResult.rows[0],
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
  authorizeRoles("Dentist", "Assistant"),
  async (req, res) => {
    const { record_id } = req.params;
    const { tooth_number, tooth_status } = req.body;

    if (!tooth_number) {
      return res.status(400).json({ error: "Tooth number is required" });
    }

    try {
      const recordCheck = await pool.query(
        "SELECT record_id FROM public.dental_records WHERE record_id = $1",
        [record_id],
      );

      if (recordCheck.rows.length === 0) {
        return res.status(404).json({ error: "Dental record not found" });
      }

      const duplicateCheck = await pool.query(
        `SELECT tooth_id
         FROM public.teeth
         WHERE record_id = $1 AND tooth_number = $2`,
        [record_id, tooth_number],
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
        [record_id, tooth_number, tooth_status || "Normal"],
      );

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [record_id],
      );

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
  authorizeRoles("Dentist", "Assistant"),
  async (req, res) => {
    const { tooth_id } = req.params;
    const { tooth_status } = req.body;

    if (!tooth_status) {
      return res.status(400).json({ error: "Tooth status is required" });
    }

    try {
      const updatedTooth = await pool.query(
        `UPDATE public.teeth
         SET tooth_status = $1
         WHERE tooth_id = $2
         RETURNING *`,
        [tooth_status, tooth_id],
      );

      if (updatedTooth.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
      }

      await pool.query(
        `UPDATE public.dental_records
         SET last_updated = CURRENT_TIMESTAMP
         WHERE record_id = $1`,
        [updatedTooth.rows[0].record_id],
      );

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
    const { procedure_type, description, treatment_date } = req.body;

    if (!procedure_type) {
      return res.status(400).json({ error: "Procedure type is required" });
    }

    try {
      const toothCheck = await pool.query(
        "SELECT * FROM public.teeth WHERE tooth_id = $1",
        [tooth_id],
      );

      if (toothCheck.rows.length === 0) {
        return res.status(404).json({ error: "Tooth not found" });
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
        [toothCheck.rows[0].record_id],
      );

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
    const { procedure_type, description, treatment_date } = req.body;

    if (!procedure_type || !treatment_date) {
      return res.status(400).json({
        error: "Procedure type and treatment date are required",
      });
    }

    try {
      const updatedTreatment = await pool.query(
        `UPDATE public.treatments
         SET procedure_type = $1,
             description = $2,
             treatment_date = $3
         WHERE treatment_id = $4
         RETURNING *`,
        [procedure_type, description || null, treatment_date, treatment_id],
      );

      if (updatedTreatment.rows.length === 0) {
        return res.status(404).json({ error: "Treatment not found" });
      }

      const toothResult = await pool.query(
        "SELECT record_id FROM public.teeth WHERE tooth_id = $1",
        [updatedTreatment.rows[0].tooth_id],
      );

      if (toothResult.rows.length > 0) {
        await pool.query(
          `UPDATE public.dental_records
           SET last_updated = CURRENT_TIMESTAMP
           WHERE record_id = $1`,
          [toothResult.rows[0].record_id],
        );
      }

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

module.exports = router;
