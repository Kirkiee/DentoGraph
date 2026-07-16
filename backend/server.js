require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
});

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
const walkInPatientRoutes = require("./routes/walkInPatientRoutes");

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

app.set("trust proxy", 1);

// ===============================
// ENVIRONMENT CHECK
// ===============================

console.log("Environment:", NODE_ENV);
console.log("Backend directory:", __dirname);
console.log("PAYMONGO SECRET EXISTS:", !!process.env.PAYMONGO_SECRET_KEY);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// ===============================
// CORS
// ===============================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://dentograph.site",
  "https://www.dentograph.site",
  "https://app.dentograph.site",
  "https://api.dentograph.site",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "Content-Type"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ===============================
// SECURITY HEADERS
// ===============================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    crossOriginEmbedderPolicy: false,
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
const xraysPath = path.join(uploadsPath, "xrays");
const arPath = path.join(uploadsPath, "ar-simulations");
const documentsPath = path.join(uploadsPath, "patient-documents");
const clinicBrandingPath = path.join(uploadsPath, "clinic-branding");

const uploadFolders = [
  uploadsPath,
  xraysPath,
  arPath,
  documentsPath,
  clinicBrandingPath,
];

uploadFolders.forEach((folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, {
      recursive: true,
    });
  }
});

// ===============================
// STATIC UPLOAD DELIVERY
// ===============================

app.use(
  "/uploads",
  express.static(uploadsPath, {
    dotfiles: "deny",
    index: false,
    fallthrough: true,
    maxAge: isProduction ? "1d" : 0,
    immutable: false,
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

      if (
        filePath.endsWith(".svg") ||
        filePath.endsWith(".png") ||
        filePath.endsWith(".jpg") ||
        filePath.endsWith(".jpeg") ||
        filePath.endsWith(".webp")
      ) {
        res.setHeader(
          "Cache-Control",
          isProduction ? "public, max-age=86400" : "no-store",
        );
      }
    },
  }),
);

// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.status(200).json({
    message: "DentoGraph API is running",
    environment: NODE_ENV,
    frontend_url: process.env.FRONTEND_URL || null,
    paymongo_key_loaded: !!process.env.PAYMONGO_SECRET_KEY,
    uploads_url: "/uploads",
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected",
      uploads: {
        root: fs.existsSync(uploadsPath),
        xrays: fs.existsSync(xraysPath),
        ar_simulations: fs.existsSync(arPath),
        patient_documents: fs.existsSync(documentsPath),
        clinic_branding: fs.existsSync(clinicBrandingPath),
      },
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

      clinicBrandingPath,
      clinicBrandingExists: fs.existsSync(clinicBrandingPath),
      clinicBrandingFiles: fs.existsSync(clinicBrandingPath)
        ? fs.readdirSync(clinicBrandingPath)
        : [],
    });
  });

  app.get("/debug/uploads/:folder/:filename", (req, res) => {
    const { folder, filename } = req.params;

    const allowedFolders = [
      "xrays",
      "ar-simulations",
      "patient-documents",
      "clinic-branding",
    ];

    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        error: "Invalid folder.",
      });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(uploadsPath, folder, safeFilename);

    return res.json({
      found: fs.existsSync(filePath),
      checkedPath: filePath,
      publicUrl: `/uploads/${folder}/${safeFilename}`,
    });
  });

  app.get("/debug/check-xray/:filename", (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(xraysPath, safeFilename);

    return res.json({
      filename: safeFilename,
      checkedPath: filePath,
      exists: fs.existsSync(filePath),
      publicUrl: `/uploads/xrays/${safeFilename}`,
    });
  });

  app.get("/debug/check-clinic-logo/:filename", (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(clinicBrandingPath, safeFilename);

    return res.json({
      filename: safeFilename,
      checkedPath: filePath,
      exists: fs.existsSync(filePath),
      publicUrl: `/uploads/clinic-branding/${safeFilename}`,
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
app.use("/api/walk-in-patients", walkInPatientRoutes);

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (err.message && err.message.includes("Not allowed by CORS")) {
    return res.status(403).json({
      error: "CORS policy does not allow this origin.",
      origin: req.headers.origin || null,
    });
  }

  return res.status(err.status || 500).json({
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
  console.log(`Serving clinic branding from: ${clinicBrandingPath}`);
});
