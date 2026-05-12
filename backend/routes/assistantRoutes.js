const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// CREATE DENTAL ASSISTANT PROFILE
router.post('/profile', authenticateToken, authorizeRoles('Assistant'), async (req, res) => {
  const user_id = req.user.user_id;
  const { license_number, availability, status } = req.body;

  try {
    // Check if assistant profile already exists
    const existingProfile = await pool.query(
      'SELECT * FROM dental_assistants WHERE user_id = $1',
      [user_id]
    );

    if (existingProfile.rows.length > 0) {
      return res.status(400).json({
        error: 'Dental assistant profile already exists'
      });
    }

    const newAssistant = await pool.query(
      `INSERT INTO dental_assistants
       (user_id, license_number, availability, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, license_number, availability, status || 'Active']
    );

    res.status(201).json({
      message: 'Dental assistant profile created successfully',
      assistant: newAssistant.rows[0]
    });

  } catch (err) {
    console.error('Create dental assistant profile error:', err.message);
    res.status(500).json({ error: 'Error creating dental assistant profile' });
  }
});

// GET OWN DENTAL ASSISTANT PROFILE
router.get('/profile', authenticateToken, authorizeRoles('Assistant'), async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const assistantProfile = await pool.query(
      `SELECT 
          dental_assistants.assistant_id,
          dental_assistants.user_id,
          users.name,
          users.email,
          dental_assistants.license_number,
          dental_assistants.availability,
          dental_assistants.status
       FROM dental_assistants
       JOIN users ON dental_assistants.user_id = users.user_id
       WHERE dental_assistants.user_id = $1`,
      [user_id]
    );

    if (assistantProfile.rows.length === 0) {
      return res.status(404).json({
        error: 'Dental assistant profile not found'
      });
    }

    res.status(200).json({
      message: 'Dental assistant profile retrieved successfully',
      assistant: assistantProfile.rows[0]
    });

  } catch (err) {
    console.error('Get dental assistant profile error:', err.message);
    res.status(500).json({ error: 'Error retrieving dental assistant profile' });
  }
});

// UPDATE OWN DENTAL ASSISTANT PROFILE
router.put('/profile', authenticateToken, authorizeRoles('Assistant'), async (req, res) => {
  const user_id = req.user.user_id;
  const { license_number, availability, status } = req.body;

  try {
    const updatedAssistant = await pool.query(
      `UPDATE dental_assistants
       SET license_number = $1,
           availability = $2,
           status = $3
       WHERE user_id = $4
       RETURNING *`,
      [license_number, availability, status, user_id]
    );

    if (updatedAssistant.rows.length === 0) {
      return res.status(404).json({
        error: 'Dental assistant profile not found'
      });
    }

    res.status(200).json({
      message: 'Dental assistant profile updated successfully',
      assistant: updatedAssistant.rows[0]
    });

  } catch (err) {
    console.error('Update dental assistant profile error:', err.message);
    res.status(500).json({ error: 'Error updating dental assistant profile' });
  }
});

// ADMIN: GET ALL DENTAL ASSISTANT PROFILES
router.get('/', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const assistants = await pool.query(
      `SELECT 
          dental_assistants.assistant_id,
          dental_assistants.user_id,
          users.name,
          users.email,
          dental_assistants.license_number,
          dental_assistants.availability,
          dental_assistants.status
       FROM dental_assistants
       JOIN users ON dental_assistants.user_id = users.user_id
       ORDER BY dental_assistants.assistant_id`
    );

    res.status(200).json(assistants.rows);

  } catch (err) {
    console.error('Get all dental assistants error:', err.message);
    res.status(500).json({ error: 'Error retrieving dental assistants' });
  }
});

module.exports = router;