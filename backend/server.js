require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const fs = require("fs");
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

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Needed when deployed behind Hostinger/proxy so rate-limit gets correct IP
app.set("trust proxy", 1);

// ===============================
// SECURITY HEADERS
// ===============================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

// ===============================
// CORS WHITELIST
// ===============================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dentograph.site",
  "https://www.dentograph.site",
  "https://app.dentograph.site",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from tools like Postman, Thunder Client, mobile apps, or same-origin requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ===============================
// BODY PARSERS
// ===============================

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

// ===============================
// UPLOAD FOLDER SETUP
// ===============================

const uploadsPath = path.join(__dirname, "uploads");
const xraysPath = path.join(__dirname, "uploads", "xrays");
const arPath = path.join(__dirname, "uploads", "ar-simulations");
const documentsPath = path.join(__dirname, "uploads", "patient-documents");

[uploadsPath, xraysPath, arPath, documentsPath].forEach((folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
});

// Serve uploaded files
app.use(
  "/uploads",
  express.static(uploadsPath, {
    dotfiles: "deny",
    index: false,
    maxAge: isProduction ? "1d" : 0,
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// ===============================
// HEALTH CHECK ROUTES
// ===============================

app.get("/", (req, res) => {
  res.status(200).json({
    message: "DentoGraph API is running",
    environment: NODE_ENV,
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check database error:", err.message);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

// ===============================
// DEBUG ROUTES - DEVELOPMENT ONLY
// ===============================

if (!isProduction) {
  app.get("/debug/uploads", (req, res) => {
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
      documentsPath,
      documentsExists: fs.existsSync(documentsPath),
      documentFiles: fs.existsSync(documentsPath)
        ? fs.readdirSync(documentsPath)
        : [],
    });
  });

  app.get("/debug/uploads/:folder/:filename", (req, res) => {
    const { folder, filename } = req.params;
    const allowedFolders = ["xrays", "ar-simulations", "patient-documents"];

    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        error: "Invalid folder.",
      });
    }

    const filePath = path.join(__dirname, "uploads", folder, filename);

    res.json({
      found: fs.existsSync(filePath),
      checkedPath: filePath,
    });
  });

  app.get("/debug/check-xray/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", "xrays", filename);

    res.json({
      filename,
      checkedPath: filePath,
      exists: fs.existsSync(filePath),
    });
  });
}

// ===============================
// API ROUTES
// ===============================

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

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS policy does not allow this origin.",
    });
  }

  res.status(err.status || 500).json({
    error: isProduction
      ? "Server error. Please try again later."
      : err.message || "Server error.",
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Serving uploads from: ${uploadsPath}`);
});
