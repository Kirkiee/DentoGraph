require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const patientRoutes = require("./routes/patientRoutes");
const patientDocumentRoutes = require("./routes/patientDocumentRoutes");
const dentistRoutes = require("./routes/dentistRoutes");
const assistantRoutes = require("./routes/assistantRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const dentalRecordRoutes = require("./routes/dentalRecordRoutes");
const xrayRoutes = require("./routes/xrayRoutes");
const clinicRoutes = require("./routes/clinicRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const paymongoRoutes = require("./routes/paymongoRoutes");
const arSimulationRoutes = require("./routes/arSimulationRoutes");

const app = express();

app.use(cors());

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

/*
  STATIC UPLOADS FIX

  This makes files inside:
  backend/uploads/xrays
  backend/uploads/ar-simulations

  available through:
  http://localhost:5000/uploads/xrays/file.png
  http://localhost:5000/uploads/ar-simulations/file.png
*/
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("DentoGraph API is running");
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM public.users");
    res.json(result.rows);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).send("Server error");
  }
});

app.get("/debug/uploads", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const uploadsPath = path.join(__dirname, "uploads");
  const xraysPath = path.join(__dirname, "uploads", "xrays");
  const arPath = path.join(__dirname, "uploads", "ar-simulations");

  res.json({
    backendDir: __dirname,
    uploadsPath,
    uploadsExists: fs.existsSync(uploadsPath),
    xraysPath,
    xraysExists: fs.existsSync(xraysPath),
    xrayFiles: fs.existsSync(xraysPath) ? fs.readdirSync(xraysPath) : [],
    arPath,
    arExists: fs.existsSync(arPath),
    arFiles: fs.existsSync(arPath) ? fs.readdirSync(arPath) : [],
  });
});

app.get("/debug/uploads/:folder/:filename", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const { folder, filename } = req.params;
  const filePath = path.join(__dirname, "uploads", folder, filename);

  res.json({
    found: fs.existsSync(filePath),
    checkedPath: filePath,
  });
});

app.get("/debug/check-xray/:filename", (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", "xrays", filename);

  res.json({
    filename,
    checkedPath: filePath,
    exists: fs.existsSync(filePath),
  });
});

// User management routes
app.use("/api/users", userRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/patient-documents", patientDocumentRoutes);
app.use("/api/dentists", dentistRoutes);
app.use("/api/assistants", assistantRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/dental-records", dentalRecordRoutes);
app.use("/api/xrays", xrayRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/payments", paymongoRoutes);
app.use("/api/ar-simulations", arSimulationRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving uploads from: ${path.join(__dirname, "uploads")}`);
});
