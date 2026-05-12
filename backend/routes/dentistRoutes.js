const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// CREATE DENTIST PROFILE
router.post('/profile', authenticateToken, authorizeRoles('Dentist'), async (req, res) => {
  const user_id = req.user.user_id;
  const { license_number, specialization, availability, status } = req.body;

  try {
    // Check if dentist profile already exists
    const existingProfile = await pool.query(
      'SELECT * FROM dentists WHERE user_id = $1',
      [user_id]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(400).json({
        error: 'Dentist profile already exists'
      });
    }

    const newDentist = await pool.query(
      `INSERT INTO dentists 
       (user_id, license_number, specialization, availability, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, license_number, specialization, availability, status || 'Active']
    );

    res.status(201).json({
      message: 'Dentist profile created successfully',
      dentist: newDentist.rows[0]
    });

  } catch (err) {
    console.error('Create dentist profile error:', err.message);
    res.status(500).json({ error: 'Error creating dentist profile' });
  }
});

// GET OWN DENTIST PROFILE
router.get('/profile', authenticateToken, authorizeRoles('Dentist'), async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const dentistProfile = await pool.query(
      `SELECT 
          dentists.dentist_id,
          dentists.user_id,
          users.name,
          users.email,
          dentists.license_number,
          dentists.specialization,
          dentists.availability,
          dentists.status
       FROM dentists
       JOIN users ON dentists.user_id = users.user_id
       WHERE dentists.user_id = $1`,
      [user_id]
    );

    if (dentistProfile.rows.length === 0) {
      return res.status(404).json({
        error: 'Dentist profile not found'
      });
    }

    res.status(200).json({
      message: 'Dentist profile retrieved successfully',
      dentist: dentistProfile.rows[0]
    });

  } catch (err) {
    console.error('Get dentist profile error:', err.message);
    res.status(500).json({ error: 'Error retrieving dentist profile' });
  }
});

// UPDATE OWN DENTIST PROFILE
router.put('/profile', authenticateToken, authorizeRoles('Dentist'), async (req, res) => {
  const user_id = req.user.user_id;
  const { license_number, specialization, availability, status } = req.body;

  try {
    const updatedDentist = await pool.query(
      `UPDATE dentists
       SET license_number = $1,
           specialization = $2,
           availability = $3,
           status = $4
       WHERE user_id = $5
       RETURNING *`,
      [license_number, specialization, availability, status, user_id]
    );

    if (updatedDentist.rows.length === 0) {
      return res.status(404).json({
        error: 'Dentist profile not found'
      });
    }

    res.status(200).json({
      message: 'Dentist profile updated successfully',
      dentist: updatedDentist.rows[0]
    });

  } catch (err) {
    console.error('Update dentist profile error:', err.message);
    res.status(500).json({ error: 'Error updating dentist profile' });
  }
});

// ADMIN: GET ALL DENTIST PROFILES
router.get('/', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const dentists = await pool.query(
      `SELECT 
          dentists.dentist_id,
          dentists.user_id,
          users.name,
          users.email,
          dentists.license_number,
          dentists.specialization,
          dentists.availability,
          dentists.status
       FROM dentists
       JOIN users ON dentists.user_id = users.user_id
       ORDER BY dentists.dentist_id`
    );

    res.status(200).json(dentists.rows);

  } catch (err) {
    console.error('Get all dentists error:', err.message);
    res.status(500).json({ error: 'Error retrieving dentists' });
  }
});

module.exports = router;