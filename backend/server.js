require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const patientRoutes = require('./routes/patientRoutes');
const dentistRoutes = require('./routes/dentistRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const dentalRecordRoutes = require('./routes/dentalRecordRoutes');
const xrayRoutes = require('./routes/xrayRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('DentoGraph API is running');
});

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).send('Server error');
  }
});

// User management routes
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/dentists', dentistRoutes);
app.use('/api/assistants', assistantRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dental-records', dentalRecordRoutes);
app.use('/api/xrays', xrayRoutes);

app.listen(5000, () => {
  console.log('Server running on port 5000');
});