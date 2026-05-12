const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// CREATE PATIENT PROFILE
router.post('/profile', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;
  const { contact_number, date_of_birth, address, gender, medical_history } = req.body;

  try {
    // Check if patient profile already exists
    const existingProfile = await pool.query(
      'SELECT * FROM patients WHERE user_id = $1',
      [user_id]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(400).json({
        error: 'Patient profile already exists'
      });
    }

    const newPatient = await pool.query(
      `INSERT INTO patients 
       (user_id, contact_number, date_of_birth, address, gender, medical_history)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user_id, contact_number, date_of_birth, address, gender, medical_history]
    );

    res.status(201).json({
      message: 'Patient profile created successfully',
      patient: newPatient.rows[0]
    });

  } catch (err) {
    console.error('Create patient profile error:', err.message);
    res.status(500).json({ error: 'Error creating patient profile' });
  }
});

// GET OWN PATIENT PROFILE
router.get('/profile', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const patientProfile = await pool.query(
      `SELECT 
          patients.patient_id,
          patients.user_id,
          users.name,
          users.email,
          patients.contact_number,
          patients.date_of_birth,
          patients.address,
          patients.gender,
          patients.medical_history
       FROM patients
       JOIN users ON patients.user_id = users.user_id
       WHERE patients.user_id = $1`,
      [user_id]
    );

    if (patientProfile.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found'
      });
    }

    res.status(200).json({
      message: 'Patient profile retrieved successfully',
      patient: patientProfile.rows[0]
    });

  } catch (err) {
    console.error('Get patient profile error:', err.message);
    res.status(500).json({ error: 'Error retrieving patient profile' });
  }
});

// UPDATE OWN PATIENT PROFILE
router.put('/profile', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;
  const { contact_number, date_of_birth, address, gender, medical_history } = req.body;

  try {
    const updatedPatient = await pool.query(
      `UPDATE patients
       SET contact_number = $1,
           date_of_birth = $2,
           address = $3,
           gender = $4,
           medical_history = $5
       WHERE user_id = $6
       RETURNING *`,
      [contact_number, date_of_birth, address, gender, medical_history, user_id]
    );

    if (updatedPatient.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found'
      });
    }

    res.status(200).json({
      message: 'Patient profile updated successfully',
      patient: updatedPatient.rows[0]
    });

  } catch (err) {
    console.error('Update patient profile error:', err.message);
    res.status(500).json({ error: 'Error updating patient profile' });
  }
});

// ADMIN: GET ALL PATIENT PROFILES
router.get('/', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const patients = await pool.query(
      `SELECT 
          patients.patient_id,
          patients.user_id,
          users.name,
          users.email,
          patients.contact_number,
          patients.date_of_birth,
          patients.address,
          patients.gender,
          patients.medical_history
       FROM patients
       JOIN users ON patients.user_id = users.user_id
       ORDER BY patients.patient_id`
    );

    res.status(200).json(patients.rows);

  } catch (err) {
    console.error('Get all patients error:', err.message);
    res.status(500).json({ error: 'Error retrieving patients' });
  }
});

module.exports = router;