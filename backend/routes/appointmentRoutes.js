const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// PATIENT: BOOK APPOINTMENT
router.post('/', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;
  const {
    dentist_id,
    appointment_date,
    appointment_type,
    notes
  } = req.body;

  try {
    // Get patient profile from logged-in user
    const patientResult = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id = $1',
      [user_id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found. Please create your patient profile first.'
      });
    }

    const patient_id = patientResult.rows[0].patient_id;

    // Check if dentist exists
    const dentistResult = await pool.query(
      'SELECT dentist_id FROM dentists WHERE dentist_id = $1',
      [dentist_id]
    );

    if (dentistResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Dentist not found'
      });
    }

    // Optional conflict check: same dentist, same appointment date/time
    const conflictCheck = await pool.query(
      `SELECT * FROM appointments
       WHERE dentist_id = $1
       AND appointment_date = $2
       AND status IN ('Pending', 'Scheduled')`,
      [dentist_id, appointment_date]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'This appointment slot is already taken'
      });
    }

    const newAppointment = await pool.query(
      `INSERT INTO appointments
       (patient_id, dentist_id, appointment_date, status, notes, appointment_type, reschedule_request)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        patient_id,
        dentist_id,
        appointment_date,
        'Pending',
        notes || null,
        appointment_type || 'Consultation',
        false
      ]
    );

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: newAppointment.rows[0]
    });

  } catch (err) {
    console.error('Book appointment error:', err.message);
    res.status(500).json({ error: 'Error booking appointment' });
  }
});

// PATIENT: VIEW OWN APPOINTMENTS
router.get('/my-appointments', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const patientResult = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id = $1',
      [user_id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found'
      });
    }

    const patient_id = patientResult.rows[0].patient_id;

    const appointments = await pool.query(
      `SELECT
          appointments.appointment_id,
          appointments.patient_id,
          appointments.dentist_id,
          users.name AS dentist_name,
          appointments.appointment_date,
          appointments.status,
          appointments.notes,
          appointments.appointment_type,
          appointments.cancellation_reason,
          appointments.reschedule_request
       FROM appointments
       JOIN dentists ON appointments.dentist_id = dentists.dentist_id
       JOIN users ON dentists.user_id = users.user_id
       WHERE appointments.patient_id = $1
       ORDER BY appointments.appointment_date DESC`,
      [patient_id]
    );

    res.status(200).json({
      message: 'Patient appointments retrieved successfully',
      appointments: appointments.rows
    });

  } catch (err) {
    console.error('Get patient appointments error:', err.message);
    res.status(500).json({ error: 'Error retrieving appointments' });
  }
});

// DENTIST: VIEW ASSIGNED APPOINTMENTS
router.get('/dentist/my-appointments', authenticateToken, authorizeRoles('Dentist'), async (req, res) => {
  const user_id = req.user.user_id;

  try {
    const dentistResult = await pool.query(
      'SELECT dentist_id FROM dentists WHERE user_id = $1',
      [user_id]
    );

    if (dentistResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Dentist profile not found'
      });
    }

    const dentist_id = dentistResult.rows[0].dentist_id;

    const appointments = await pool.query(
      `SELECT
          appointments.appointment_id,
          appointments.patient_id,
          users.name AS patient_name,
          appointments.dentist_id,
          appointments.appointment_date,
          appointments.status,
          appointments.notes,
          appointments.appointment_type,
          appointments.cancellation_reason,
          appointments.reschedule_request
       FROM appointments
       JOIN patients ON appointments.patient_id = patients.patient_id
       JOIN users ON patients.user_id = users.user_id
       WHERE appointments.dentist_id = $1
       ORDER BY appointments.appointment_date DESC`,
      [dentist_id]
    );

    res.status(200).json({
      message: 'Dentist appointments retrieved successfully',
      appointments: appointments.rows
    });

  } catch (err) {
    console.error('Get dentist appointments error:', err.message);
    res.status(500).json({ error: 'Error retrieving dentist appointments' });
  }
});

// ADMIN / ASSISTANT: VIEW ALL APPOINTMENTS
router.get('/', authenticateToken, authorizeRoles('Admin', 'Assistant'), async (req, res) => {
  try {
    const appointments = await pool.query(
      `SELECT
          appointments.appointment_id,
          appointments.patient_id,
          patient_user.name AS patient_name,
          appointments.dentist_id,
          dentist_user.name AS dentist_name,
          appointments.appointment_date,
          appointments.status,
          appointments.notes,
          appointments.appointment_type,
          appointments.cancellation_reason,
          appointments.reschedule_request
       FROM appointments
       JOIN patients ON appointments.patient_id = patients.patient_id
       JOIN users AS patient_user ON patients.user_id = patient_user.user_id
       JOIN dentists ON appointments.dentist_id = dentists.dentist_id
       JOIN users AS dentist_user ON dentists.user_id = dentist_user.user_id
       ORDER BY appointments.appointment_date DESC`
    );

    res.status(200).json({
      message: 'All appointments retrieved successfully',
      appointments: appointments.rows
    });

  } catch (err) {
    console.error('Get all appointments error:', err.message);
    res.status(500).json({ error: 'Error retrieving appointments' });
  }
});

// ADMIN / ASSISTANT: UPDATE APPOINTMENT STATUS
router.put('/:appointment_id/status', authenticateToken, authorizeRoles('Admin', 'Assistant'), async (req, res) => {
  const { appointment_id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid status. Allowed values: Pending, Scheduled, Completed, Cancelled'
    });
  }

  try {
    const updatedAppointment = await pool.query(
      `UPDATE appointments
       SET status = $1
       WHERE appointment_id = $2
       RETURNING *`,
      [status, appointment_id]
    );

    if (updatedAppointment.rows.length === 0) {
      return res.status(404).json({
        error: 'Appointment not found'
      });
    }

    res.status(200).json({
      message: 'Appointment status updated successfully',
      appointment: updatedAppointment.rows[0]
    });

  } catch (err) {
    console.error('Update appointment status error:', err.message);
    res.status(500).json({ error: 'Error updating appointment status' });
  }
});

// PATIENT: CANCEL OWN APPOINTMENT
router.put('/:appointment_id/cancel', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;
  const { appointment_id } = req.params;
  const { cancellation_reason } = req.body;

  try {
    const patientResult = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id = $1',
      [user_id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found'
      });
    }

    const patient_id = patientResult.rows[0].patient_id;

    const cancelledAppointment = await pool.query(
      `UPDATE appointments
       SET status = $1,
           cancellation_reason = $2
       WHERE appointment_id = $3
       AND patient_id = $4
       RETURNING *`,
      ['Cancelled', cancellation_reason || 'No reason provided', appointment_id, patient_id]
    );

    if (cancelledAppointment.rows.length === 0) {
      return res.status(404).json({
        error: 'Appointment not found or does not belong to this patient'
      });
    }

    res.status(200).json({
      message: 'Appointment cancelled successfully',
      appointment: cancelledAppointment.rows[0]
    });

  } catch (err) {
    console.error('Cancel appointment error:', err.message);
    res.status(500).json({ error: 'Error cancelling appointment' });
  }
});

// PATIENT: REQUEST RESCHEDULE
router.put('/:appointment_id/reschedule', authenticateToken, authorizeRoles('Patient'), async (req, res) => {
  const user_id = req.user.user_id;
  const { appointment_id } = req.params;
  const { new_appointment_date } = req.body;

  try {
    const patientResult = await pool.query(
      'SELECT patient_id FROM patients WHERE user_id = $1',
      [user_id]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Patient profile not found'
      });
    }

    const patient_id = patientResult.rows[0].patient_id;

    const rescheduledAppointment = await pool.query(
      `UPDATE appointments
       SET appointment_date = $1,
           reschedule_request = $2,
           status = $3
       WHERE appointment_id = $4
       AND patient_id = $5
       RETURNING *`,
      [new_appointment_date, true, 'Pending', appointment_id, patient_id]
    );

    if (rescheduledAppointment.rows.length === 0) {
      return res.status(404).json({
        error: 'Appointment not found or does not belong to this patient'
      });
    }

    res.status(200).json({
      message: 'Appointment reschedule request submitted successfully',
      appointment: rescheduledAppointment.rows[0]
    });

  } catch (err) {
    console.error('Reschedule appointment error:', err.message);
    res.status(500).json({ error: 'Error requesting appointment reschedule' });
  }
});

module.exports = router;