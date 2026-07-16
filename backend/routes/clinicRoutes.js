const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  sendVerificationEmail,
  sendClinicApplicationReceivedEmail,
  sendClinicApplicationApprovedEmail,
  sendClinicApplicationRejectedEmail,
} = require("../utils/emailSender");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const { verifyTurnstileMiddleware } = require("../utils/verifyTurnstile");

const getClinicOwnerLoginUrl = () => `${getFrontendBaseUrl()}/auth/login`;

const getClinicRegistrationUrl = () =>
  `${getFrontendBaseUrl()}/clinic/register`;

const normalizeServiceName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const parseClinicServicesInput = (services) => {
  if (Array.isArray(services)) {
    return [
      ...new Map(
        services
          .map(normalizeServiceName)
          .filter(Boolean)
          .map((serviceName) => [serviceName.toLowerCase(), serviceName]),
      ).values(),
    ];
  }

  const rawValue = String(services || "").trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (Array.isArray(parsedValue)) {
      return parseClinicServicesInput(parsedValue);
    }
  } catch {
    // Backward compatibility for the legacy comma-separated request format.
  }

  return [
    ...new Map(
      rawValue
        .split(",")
        .map(normalizeServiceName)
        .filter(Boolean)
        .map((serviceName) => [serviceName.toLowerCase(), serviceName]),
    ).values(),
  ];
};

const clinicServicesToLegacyText = (services) =>
  parseClinicServicesInput(services).join(", ");

const syncClinicServices = async (client, clinicId, services) => {
  const serviceNames = parseClinicServicesInput(services);

  await client.query(
    `DELETE FROM public.clinic_services
     WHERE clinic_id = $1`,
    [clinicId],
  );

  for (const serviceName of serviceNames) {
    const normalizedName = serviceName.toLowerCase();

    const serviceResult = await client.query(
      `INSERT INTO public.dental_services
       (
         service_name,
         normalized_name,
         is_active
       )
       VALUES ($1, $2, TRUE)
       ON CONFLICT (normalized_name)
       DO UPDATE SET
         service_name = EXCLUDED.service_name,
         is_active = TRUE,
         updated_at = CURRENT_TIMESTAMP
       RETURNING service_id`,
      [serviceName, normalizedName],
    );

    await client.query(
      `INSERT INTO public.clinic_services
       (
         clinic_id,
         service_id,
         is_active
       )
       VALUES ($1, $2, TRUE)
       ON CONFLICT (clinic_id, service_id)
       DO UPDATE SET
         is_active = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [clinicId, serviceResult.rows[0].service_id],
    );
  }

  return serviceNames;
};

const getNormalizedClinicServices = async (client, clinicId) => {
  const result = await client.query(
    `SELECT
       ds.service_id,
       ds.service_name,
       ds.service_category
     FROM public.clinic_services cs
     JOIN public.dental_services ds
       ON ds.service_id = cs.service_id
     WHERE cs.clinic_id = $1
       AND cs.is_active = TRUE
       AND ds.is_active = TRUE
     ORDER BY ds.service_name ASC`,
    [clinicId],
  );

  return result.rows;
};

const CLINIC_WEEK_DAYS = [
  { day_of_week: 1, day_name: "Monday" },
  { day_of_week: 2, day_name: "Tuesday" },
  { day_of_week: 3, day_name: "Wednesday" },
  { day_of_week: 4, day_name: "Thursday" },
  { day_of_week: 5, day_name: "Friday" },
  { day_of_week: 6, day_name: "Saturday" },
  { day_of_week: 7, day_name: "Sunday" },
];

const normalizeOperatingTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const createDefaultOperatingHours = () =>
  CLINIC_WEEK_DAYS.map(({ day_of_week, day_name }) => ({
    day_of_week,
    day_name,
    is_open: day_of_week !== 7,
    opening_time: day_of_week !== 7 ? "10:00" : null,
    closing_time: day_of_week !== 7 ? "17:00" : null,
  }));

const parseOperatingHoursInput = (value) => {
  let schedule = value;

  if (typeof schedule === "string") {
    try {
      schedule = JSON.parse(schedule);
    } catch {
      schedule = null;
    }
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return createDefaultOperatingHours();
  }

  const byDay = new Map(
    schedule.map((entry) => [Number(entry?.day_of_week), entry]),
  );

  return CLINIC_WEEK_DAYS.map(({ day_of_week, day_name }) => {
    const entry = byDay.get(day_of_week);
    const isOpen = Boolean(entry?.is_open);

    return {
      day_of_week,
      day_name,
      is_open: isOpen,
      opening_time: isOpen ? normalizeOperatingTime(entry?.opening_time) : null,
      closing_time: isOpen ? normalizeOperatingTime(entry?.closing_time) : null,
    };
  });
};

const validateOperatingHours = (schedule) => {
  if (!schedule.some((entry) => entry.is_open)) {
    return "At least one clinic operating day is required.";
  }

  for (const entry of schedule) {
    if (!entry.is_open) continue;

    if (!entry.opening_time || !entry.closing_time) {
      return `${entry.day_name} requires opening and closing times.`;
    }

    if (entry.closing_time <= entry.opening_time) {
      return `${entry.day_name} closing time must be later than opening time.`;
    }
  }

  return "";
};

const formatOperatingTime = (value) => {
  const normalized = normalizeOperatingTime(value);

  if (!normalized) return "";

  const [hourText, minuteText] = normalized.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";

  return `${hour % 12 || 12}:${minuteText} ${suffix}`;
};

const operatingHoursToLegacyText = (schedule) =>
  schedule
    .map((entry) =>
      entry.is_open
        ? `${entry.day_name}: ${formatOperatingTime(
            entry.opening_time,
          )} - ${formatOperatingTime(entry.closing_time)}`
        : `${entry.day_name}: Closed`,
    )
    .join(", ");

const syncClinicOperatingHours = async (client, clinicId, scheduleInput) => {
  const schedule = parseOperatingHoursInput(scheduleInput);
  const validationError = validateOperatingHours(schedule);

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  for (const entry of schedule) {
    await client.query(
      `INSERT INTO public.clinic_operating_hours
       (
         clinic_id,
         day_of_week,
         is_open,
         opening_time,
         closing_time
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clinic_id, day_of_week)
       DO UPDATE SET
         is_open = EXCLUDED.is_open,
         opening_time = EXCLUDED.opening_time,
         closing_time = EXCLUDED.closing_time,
         updated_at = CURRENT_TIMESTAMP`,
      [
        clinicId,
        entry.day_of_week,
        entry.is_open,
        entry.opening_time,
        entry.closing_time,
      ],
    );
  }

  return schedule;
};

const getClinicOperatingHours = async (client, clinicId) => {
  const result = await client.query(
    `SELECT
       day_of_week,
       CASE day_of_week
         WHEN 1 THEN 'Monday'
         WHEN 2 THEN 'Tuesday'
         WHEN 3 THEN 'Wednesday'
         WHEN 4 THEN 'Thursday'
         WHEN 5 THEN 'Friday'
         WHEN 6 THEN 'Saturday'
         WHEN 7 THEN 'Sunday'
       END AS day_name,
       is_open,
       CASE
         WHEN opening_time IS NULL THEN NULL
         ELSE TO_CHAR(opening_time, 'HH24:MI')
       END AS opening_time,
       CASE
         WHEN closing_time IS NULL THEN NULL
         ELSE TO_CHAR(closing_time, 'HH24:MI')
       END AS closing_time
     FROM public.clinic_operating_hours
     WHERE clinic_id = $1
     ORDER BY day_of_week`,
    [clinicId],
  );

  return result.rows;
};

const attachNormalizedOperatingHours = async (client, clinic) => {
  if (!clinic?.clinic_id) return clinic;

  const schedule = await getClinicOperatingHours(client, clinic.clinic_id);

  return {
    ...clinic,
    operating_hours_schedule: schedule,
    opening_hours:
      schedule.length > 0
        ? operatingHoursToLegacyText(schedule)
        : clinic.opening_hours || "",
  };
};

const attachNormalizedServices = async (client, clinic) => {
  if (!clinic?.clinic_id) return clinic;

  const normalizedServices = await getNormalizedClinicServices(
    client,
    clinic.clinic_id,
  );

  const clinicWithServices = {
    ...clinic,
    service_options: normalizedServices,
    services:
      normalizedServices.length > 0
        ? normalizedServices.map((service) => service.service_name).join(", ")
        : clinic.services || "",
  };

  return attachNormalizedOperatingHours(client, clinicWithServices);
};

// ===============================
// PUBLIC: GET ACTIVE CLINICS FOR PATIENT REGISTRATION
// ===============================
router.get("/public/list", async (req, res) => {
  try {
    const clinics = await pool.query(
      `SELECT
          clinic_id,
          clinic_name,
          address,
          latitude,
          longitude,
          COALESCE(
            (
              SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
              FROM public.clinic_services cs
              JOIN public.dental_services ds
                ON ds.service_id = cs.service_id
              WHERE cs.clinic_id = public.clinics.clinic_id
                AND cs.is_active = TRUE
                AND ds.is_active = TRUE
            ),
            services
          ) AS services,
          contact_number,
          opening_hours,
          status
       FROM public.clinics
       WHERE status = 'Active'
       ORDER BY clinic_name ASC`,
    );

    const normalizedClinics = await Promise.all(
      clinics.rows.map((clinic) => attachNormalizedServices(pool, clinic)),
    );

    res.status(200).json({
      message: "Public clinic list retrieved successfully.",
      clinics: normalizedClinics,
    });
  } catch (err) {
    console.error("Get public clinic list error:", err.message);
    res.status(500).json({
      error: "Error retrieving public clinic list.",
    });
  }
});

// ===============================
// PUBLIC / CLINIC OWNER / ADMIN: GEOCODE A PHILIPPINE CLINIC ADDRESS
// Public access is required because first-time clinic registration happens
// before the clinic owner has an authentication token.
// Uses OpenStreetMap Nominatim through the backend so the frontend does not
// need to call the third-party service directly.
// ===============================
router.get("/geocode", async (req, res) => {
  const address = String(req.query.address || "")
    .replace(/\s+/g, " ")
    .trim();

  if (address.length < 3) {
    return res.status(400).json({
      error: "Enter a more complete clinic address before locating it.",
    });
  }

  const normalizeQuery = (value) =>
    String(value || "")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s+/g, " ")
      .replace(/,+/g, ",")
      .replace(/^,\s*|,\s*$/g, "")
      .trim();

  const ensurePhilippines = (value) => {
    const cleaned = normalizeQuery(value);

    if (/\b(philippines|pilipinas)\b/i.test(cleaned)) {
      return cleaned;
    }

    return `${cleaned}, Philippines`;
  };

  const buildQueryVariants = (value) => {
    const cleaned = normalizeQuery(value);
    const parts = cleaned
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const variants = [cleaned, ensurePhilippines(cleaned)];

    for (let startIndex = 1; startIndex < parts.length; startIndex += 1) {
      const broaderAddress = parts.slice(startIndex).join(", ");

      if (broaderAddress.length >= 3) {
        variants.push(broaderAddress);
        variants.push(ensurePhilippines(broaderAddress));
      }
    }

    const withoutLabels = cleaned
      .replace(
        /\b(barangay|brgy\.?|municipality of|city of|province of)\b/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .trim();

    if (withoutLabels && withoutLabels !== cleaned) {
      variants.push(withoutLabels);
      variants.push(ensurePhilippines(withoutLabels));
    }

    return [...new Set(variants.map(normalizeQuery).filter(Boolean))].slice(
      0,
      10,
    );
  };

  const queryNominatim = async (query) => {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "ph",
      dedupe: "1",
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-PH,en;q=0.9",
          "User-Agent":
            process.env.NOMINATIM_USER_AGENT ||
            "DentoGraph/1.0 (clinic address geocoding; Philippines)",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Geocoding provider returned ${response.status}.`);
    }

    const rawResults = await response.json();

    return (Array.isArray(rawResults) ? rawResults : [])
      .map((item) => ({
        place_id: item.place_id,
        osm_type: item.osm_type || null,
        osm_id: item.osm_id || null,
        display_name: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        type: item.type || null,
        category: item.category || null,
        address: item.address || {},
        matched_query: query,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
      );
  };

  try {
    const queryVariants = buildQueryVariants(address);
    const collectedResults = [];
    const seenResults = new Set();

    for (const query of queryVariants) {
      const results = await queryNominatim(query);

      for (const result of results) {
        const resultKey =
          result.osm_type && result.osm_id
            ? `${result.osm_type}-${result.osm_id}`
            : `${result.latitude.toFixed(6)}-${result.longitude.toFixed(6)}`;

        if (!seenResults.has(resultKey)) {
          seenResults.add(resultKey);
          collectedResults.push(result);
        }
      }

      if (collectedResults.length >= 5) {
        break;
      }
    }

    const results = collectedResults.slice(0, 5);

    return res.status(200).json({
      message:
        results.length > 0
          ? "Address matches retrieved successfully."
          : "No matching Philippine address was found.",
      query: address,
      attempted_queries: queryVariants,
      results,
    });
  } catch (err) {
    console.error("Clinic address geocoding error:", err.message);

    return res.status(502).json({
      error:
        "The address lookup service is temporarily unavailable. Please try again.",
    });
  }
});

// ===============================
// RATE LIMITERS
// ===============================

const clinicRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many clinic registration attempts. Please try again later.",
  },
});

const clinicBrandingUploadDir = path.join(
  __dirname,
  "../uploads/clinic-branding",
);

if (!fs.existsSync(clinicBrandingUploadDir)) {
  fs.mkdirSync(clinicBrandingUploadDir, { recursive: true });
}

const clinicBrandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, clinicBrandingUploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, `clinic-logo-${uniqueSuffix}${extension}`);
  },
});

const clinicBrandingFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ];

  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
    return;
  }

  cb(
    new Error("Only JPG, JPEG, PNG, WEBP, and SVG logo files are allowed."),
    false,
  );
};

const uploadClinicLogo = multer({
  storage: clinicBrandingStorage,
  fileFilter: clinicBrandingFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const deleteClinicBrandingFile = (filePath) => {
  if (!filePath || !String(filePath).startsWith("uploads/clinic-branding/")) {
    return;
  }

  const absolutePath = path.join(__dirname, "..", filePath);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

// ===============================
// CLINIC VERIFICATION DOCUMENT UPLOADS
// ===============================

const clinicVerificationUploadDir = path.join(
  __dirname,
  "../uploads/clinic-verification",
);

if (!fs.existsSync(clinicVerificationUploadDir)) {
  fs.mkdirSync(clinicVerificationUploadDir, { recursive: true });
}

const clinicVerificationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, clinicVerificationUploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;

    cb(null, `clinic-verification-${uniqueSuffix}${extension}`);
  },
});

const clinicVerificationFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];
  const allowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) &&
    allowedExtensions.includes(extension)
  ) {
    cb(null, true);
    return;
  }

  cb(
    new Error(
      "Clinic verification documents must be PDF, JPG, JPEG, PNG, or WEBP files.",
    ),
    false,
  );
};

const uploadClinicVerificationDocuments = multer({
  storage: clinicVerificationStorage,
  fileFilter: clinicVerificationFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 4,
  },
}).fields([
  { name: "business_registration", maxCount: 1 },
  { name: "business_permit", maxCount: 1 },
  { name: "owner_government_id", maxCount: 1 },
  { name: "clinic_license", maxCount: 1 },
]);

const getUploadedClinicVerificationFiles = (req) => {
  const files = req.files || {};

  return {
    business_registration: files.business_registration?.[0] || null,
    business_permit: files.business_permit?.[0] || null,
    owner_government_id: files.owner_government_id?.[0] || null,
    clinic_license: files.clinic_license?.[0] || null,
  };
};

const toStoredClinicVerificationPath = (file) => {
  if (!file) return null;
  return path.posix.join("uploads", "clinic-verification", file.filename);
};

const deleteClinicVerificationFile = (filePath) => {
  if (
    !filePath ||
    !String(filePath).startsWith("uploads/clinic-verification/")
  ) {
    return;
  }

  const absolutePath = path.join(__dirname, "..", filePath);

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

const deleteUploadedClinicVerificationFiles = (req) => {
  const files = getUploadedClinicVerificationFiles(req);

  Object.values(files).forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

const runClinicVerificationUpload = (req, res, next) => {
  uploadClinicVerificationDocuments(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    deleteUploadedClinicVerificationFiles(req);

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "Each clinic verification document must not exceed 10 MB."
            : "Unable to upload the clinic verification documents.",
      });
    }

    return res.status(400).json({
      error: err.message || "Invalid clinic verification document.",
    });
  });
};

// ===============================
// HELPER FUNCTIONS
// ===============================

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const cleanText = (value) => {
  return String(value || "").trim();
};

const normalizeHexColor = (value, fallback) => {
  const color = cleanText(value);
  if (!color) return fallback;
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) return null;
  return color.toUpperCase();
};

const normalizeBrandingPayload = (body = {}) => {
  const primaryColor = normalizeHexColor(body.primary_color, "#2563EB");
  const secondaryColor = normalizeHexColor(body.secondary_color, "#0F172A");

  if (!primaryColor || !secondaryColor) {
    return {
      valid: false,
      error:
        "Brand colors must use six-digit hexadecimal format, such as #2563EB.",
    };
  }

  return {
    valid: true,
    branding: {
      brand_name: normalizeNullable(cleanText(body.brand_name)),
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      welcome_message: normalizeNullable(cleanText(body.welcome_message)),
    },
  };
};

const normalizeEmail = (email) => {
  return String(email || "")
    .trim()
    .toLowerCase();
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
};

const validatePasswordStrength = (password) => {
  const value = String(password || "");

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(value)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "Password must contain at least one special character.";
  }

  return null;
};

const getPasswordRules = () => {
  return [
    "At least 8 characters long.",
    "At least one uppercase letter.",
    "At least one lowercase letter.",
    "At least one number.",
    "At least one special character.",
  ];
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const getFrontendBaseUrl = () => {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
};

const generateEmailVerification = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expiresAt,
  };
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return null;

  return numberValue;
};

const getFreePlan = async (client) => {
  const result = await client.query(
    `SELECT 
        plan_id,
        plan_name,
        plan_tier,
        price,
        billing_cycle,
        max_dentists,
        max_assistants,
        max_patients,
        max_records,
        max_xrays,
        storage_limit_mb,
        status
     FROM public.subscription_plans
     WHERE LOWER(plan_name) = 'free'
     AND COALESCE(status, 'Active') = 'Active'
     ORDER BY plan_id ASC
     LIMIT 1`,
  );

  return result.rows[0] || null;
};

const getClinicOwnerRole = async (client) => {
  const result = await client.query(
    `SELECT role_id, role_name
     FROM public.roles
     WHERE role_name = 'Clinic Owner'
     LIMIT 1`,
  );

  return result.rows[0] || null;
};

const markExpiredSubscriptionIfNeeded = async (client, ownerUserId) => {
  const expired = await client.query(
    `UPDATE public.owner_subscriptions
     SET subscription_status = 'Expired',
         updated_at = CURRENT_TIMESTAMP
     WHERE owner_user_id = $1
       AND end_date IS NOT NULL
       AND end_date < CURRENT_TIMESTAMP
       AND subscription_status <> 'Expired'
     RETURNING
       owner_subscription_id,
       owner_user_id,
       subscription_status`,
    [ownerUserId],
  );

  if (expired.rows.length > 0) {
    await client.query(
      `UPDATE public.clinics
       SET subscription_status = 'Expired'
       WHERE owner_user_id = $1`,
      [ownerUserId],
    );
  }

  return expired.rows[0] || null;
};

const getOwnerSubscriptionSource = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT
        os.owner_subscription_id,
        os.owner_user_id,
        os.plan_id AS subscription_plan_id,
        os.start_date AS subscription_start_date,
        os.end_date AS subscription_end_date,
        os.subscription_status,
        os.auto_renew,
        sp.plan_name,
        sp.plan_tier,
        sp.price,
        COALESCE(os.billing_cycle, sp.billing_cycle) AS billing_cycle,
        sp.max_clinics,
        sp.max_dentists,
        sp.max_assistants,
        sp.max_patients,
        sp.max_records,
        sp.max_xrays,
        sp.storage_limit_mb
     FROM public.owner_subscriptions os
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE os.owner_user_id = $1
     LIMIT 1`,
    [ownerUserId],
  );

  return result.rows[0] || null;
};

const getOwnerLocations = async (client, ownerUserId) => {
  const result = await client.query(
    `SELECT
        c.clinic_id,
        c.clinic_name,
        c.address,
        c.latitude,
        c.longitude,
        COALESCE(
              (
                SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
                FROM public.clinic_services cs
                JOIN public.dental_services ds
                  ON ds.service_id = cs.service_id
                WHERE cs.clinic_id = c.clinic_id
                  AND cs.is_active = TRUE
                  AND ds.is_active = TRUE
              ),
              c.services
            ) AS services,
        c.contact_number,
        c.opening_hours,
        c.brand_name,
        c.brand_logo_url,
        COALESCE(c.primary_color, '#2563EB') AS primary_color,
        COALESCE(c.secondary_color, '#0F172A') AS secondary_color,
        c.welcome_message,
        os.plan_id AS subscription_plan_id,
        os.start_date AS subscription_start_date,
        os.end_date AS subscription_end_date,
        COALESCE(os.subscription_status, 'Active') AS subscription_status,
        c.owner_user_id,
        owner_user.name AS owner_name,
        owner_user.email AS owner_email,
        sp.plan_name,
        sp.plan_tier,
        sp.price,
        sp.billing_cycle,
        sp.max_clinics,
        sp.max_dentists,
        sp.max_assistants,
        sp.max_patients,
        sp.max_records,
        sp.max_xrays,
        sp.storage_limit_mb,
        c.status,
        c.created_at
     FROM public.clinics c
     LEFT JOIN public.users owner_user
       ON c.owner_user_id = owner_user.user_id
     LEFT JOIN public.owner_subscriptions os
       ON os.owner_user_id = c.owner_user_id
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     ORDER BY c.created_at ASC NULLS LAST, c.clinic_id ASC`,
    [ownerUserId],
  );

  return result.rows;
};

const getOwnerLocationById = async (client, ownerUserId, clinicId) => {
  const result = await client.query(
    `SELECT
        c.clinic_id,
        c.clinic_name,
        c.address,
        c.latitude,
        c.longitude,
        COALESCE(
              (
                SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
                FROM public.clinic_services cs
                JOIN public.dental_services ds
                  ON ds.service_id = cs.service_id
                WHERE cs.clinic_id = c.clinic_id
                  AND cs.is_active = TRUE
                  AND ds.is_active = TRUE
              ),
              c.services
            ) AS services,
        c.contact_number,
        c.opening_hours,
        c.brand_name,
        c.brand_logo_url,
        COALESCE(c.primary_color, '#2563EB') AS primary_color,
        COALESCE(c.secondary_color, '#0F172A') AS secondary_color,
        c.welcome_message,
        os.plan_id AS subscription_plan_id,
        os.start_date AS subscription_start_date,
        os.end_date AS subscription_end_date,
        COALESCE(os.subscription_status, 'Active') AS subscription_status,
        c.owner_user_id,
        owner_user.name AS owner_name,
        owner_user.email AS owner_email,
        sp.plan_name,
        sp.plan_tier,
        sp.price,
        sp.billing_cycle,
        sp.max_dentists,
        sp.max_assistants,
        sp.max_patients,
        sp.max_records,
        sp.max_xrays,
        sp.storage_limit_mb,
        c.status,
        c.created_at
     FROM public.clinics c
     LEFT JOIN public.users owner_user
       ON c.owner_user_id = owner_user.user_id
     LEFT JOIN public.owner_subscriptions os
       ON os.owner_user_id = c.owner_user_id
     LEFT JOIN public.subscription_plans sp
       ON os.plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     AND c.clinic_id = $2
     LIMIT 1`,
    [ownerUserId, clinicId],
  );

  return result.rows[0] || null;
};

const getLocationUsage = async (client, clinicId) => {
  const dentistCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.dentists
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const assistantCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.assistants
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const patientCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.patients
     WHERE clinic_id = $1`,
    [clinicId],
  );

  const fallbackPatientCount = await client.query(
    `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND COALESCE(dr.status, 'Active') = 'Active'`,
    [clinicId],
  );

  const recordCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.dental_records dr
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1
     AND COALESCE(dr.status, 'Active') = 'Active'`,
    [clinicId],
  );

  const xrayCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [clinicId],
  );

  const storageUsage = await client.query(
    `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
     FROM public.xray_images x
     JOIN public.dental_records dr ON x.record_id = dr.record_id
     JOIN public.dentists d ON dr.dentist_id = d.dentist_id
     WHERE d.clinic_id = $1`,
    [clinicId],
  );

  const directPatients = Number(patientCount.rows[0].count || 0);
  const fallbackPatients = Number(fallbackPatientCount.rows[0].count || 0);
  const totalBytes = Number(storageUsage.rows[0].total_bytes || 0);
  const storageUsedMb = totalBytes / 1024 / 1024;

  return {
    dentists: dentistCount.rows[0].count,
    assistants: assistantCount.rows[0].count,
    patients: Math.max(directPatients, fallbackPatients),
    records: recordCount.rows[0].count,
    xrays: xrayCount.rows[0].count,
    storage_used_mb: Number(storageUsedMb.toFixed(2)),
    storage_used_bytes: totalBytes,
  };
};

const getOwnerAggregateUsage = async (client, ownerUserId) => {
  const locations = await getOwnerLocations(client, ownerUserId);

  const billableLocations = locations.filter((location) => {
    return ["Active", "Inactive"].includes(String(location.status || "Active"));
  });

  const usageByLocation = [];
  const totalUsage = {
    dentists: 0,
    assistants: 0,
    patients: 0,
    records: 0,
    xrays: 0,
    storage_used_mb: 0,
    storage_used_bytes: 0,
  };

  for (const location of billableLocations) {
    const usage = await getLocationUsage(client, location.clinic_id);

    usageByLocation.push({
      clinic_id: location.clinic_id,
      clinic_name: location.clinic_name,
      usage,
    });

    totalUsage.dentists += Number(usage.dentists || 0);
    totalUsage.assistants += Number(usage.assistants || 0);
    totalUsage.patients += Number(usage.patients || 0);
    totalUsage.records += Number(usage.records || 0);
    totalUsage.xrays += Number(usage.xrays || 0);
    totalUsage.storage_used_bytes += Number(usage.storage_used_bytes || 0);
  }

  totalUsage.storage_used_mb = Number(
    (totalUsage.storage_used_bytes / 1024 / 1024).toFixed(2),
  );

  return {
    locations,
    usage_by_location: usageByLocation,
    usage: totalUsage,
  };
};

// ===============================
// PUBLIC: REGISTER CLINIC OWNER + FIRST CLINIC LOCATION
// The owner and clinic remain inactive until an Admin approves the
// submitted clinic verification documents.
// ===============================

router.post(
  "/register",
  clinicRegisterLimiter,
  runClinicVerificationUpload,
  verifyTurnstileMiddleware,
  async (req, res) => {
    const {
      owner_name,
      owner_email,
      password,
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      operating_hours_schedule,
    } = req.body || {};

    const uploadedFiles = getUploadedClinicVerificationFiles(req);
    const cleanOwnerName = cleanText(owner_name);
    const cleanOwnerEmail = normalizeEmail(owner_email);
    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);
    const normalizedServices = parseClinicServicesInput(services);
    const cleanServices = normalizedServices.join(", ");
    const normalizedOperatingHours = parseOperatingHoursInput(
      operating_hours_schedule,
    );
    const operatingHoursError = validateOperatingHours(
      normalizedOperatingHours,
    );
    const cleanOpeningHours = operatingHoursToLegacyText(
      normalizedOperatingHours,
    );
    const cleanContactNumber = cleanText(contact_number);
    const normalizedLatitude = normalizeNumber(latitude);
    const normalizedLongitude = normalizeNumber(longitude);
    const passwordError = validatePasswordStrength(password);

    const failRegistration = (status, payload) => {
      deleteUploadedClinicVerificationFiles(req);
      return res.status(status).json(payload);
    };

    if (
      !cleanOwnerName ||
      !cleanOwnerEmail ||
      !password ||
      !cleanClinicName ||
      !cleanAddress
    ) {
      return failRegistration(400, {
        error:
          "Owner name, owner email, password, clinic name, and address are required.",
      });
    }

    if (!isValidEmail(cleanOwnerEmail)) {
      return failRegistration(400, {
        error: "Please enter a valid owner email address.",
      });
    }

    if (passwordError) {
      return failRegistration(400, {
        error: passwordError,
        password_rules: getPasswordRules(),
      });
    }

    if (normalizedServices.length === 0) {
      return failRegistration(400, {
        error: "Please select at least one clinic service.",
      });
    }

    if (operatingHoursError) {
      return failRegistration(400, {
        error: operatingHoursError,
      });
    }

    if (
      normalizedLatitude === null ||
      normalizedLongitude === null ||
      normalizedLatitude < -90 ||
      normalizedLatitude > 90 ||
      normalizedLongitude < -180 ||
      normalizedLongitude > 180
    ) {
      return failRegistration(400, {
        error:
          "Select a valid located address before submitting the clinic application.",
      });
    }

    if (
      !uploadedFiles.business_registration ||
      !uploadedFiles.business_permit ||
      !uploadedFiles.owner_government_id
    ) {
      return failRegistration(400, {
        error:
          "Business registration, current business permit, and Clinic Owner government ID are required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const role = await getClinicOwnerRole(client);

      if (!role) {
        await client.query("ROLLBACK");
        return failRegistration(400, {
          error:
            "Clinic Owner role was not found. Please add the Clinic Owner role first.",
        });
      }

      const freePlan = await getFreePlan(client);

      if (!freePlan) {
        await client.query("ROLLBACK");
        return failRegistration(400, {
          error:
            "Free subscription plan was not found. Please create an active Free plan first.",
        });
      }

      const emailCheck = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cleanOwnerEmail],
      );

      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return failRegistration(400, {
          error: "Email already exists. Please use another email address.",
        });
      }

      const duplicateClinicCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         LIMIT 1`,
        [cleanClinicName, cleanAddress],
      );

      if (duplicateClinicCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return failRegistration(400, {
          error: "A clinic with the same name and address already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newOwner = await client.query(
        `INSERT INTO public.users
         (
           name,
           email,
           password,
           status,
           email_verified,
           email_verification_token,
           email_verification_expires
         )
         VALUES ($1, $2, $3, 'Inactive', TRUE, NULL, NULL)
         RETURNING user_id, name, email, status, email_verified, created_at`,
        [cleanOwnerName, cleanOwnerEmail, hashedPassword],
      );

      const ownerUserId = newOwner.rows[0].user_id;

      await client.query(
        `INSERT INTO public.user_roles
         (user_id, role_id)
         VALUES ($1, $2)`,
        [ownerUserId, role.role_id],
      );

      const newClinic = await client.query(
        `INSERT INTO public.clinics
         (
           clinic_name,
           address,
           latitude,
           longitude,
           services,
           contact_number,
           opening_hours,
           owner_user_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending Review', CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizedLatitude,
          normalizedLongitude,
          normalizeNullable(cleanServices),
          normalizeNullable(cleanContactNumber),
          normalizeNullable(cleanOpeningHours),
          ownerUserId,
        ],
      );

      const clinicId = newClinic.rows[0].clinic_id;

      await syncClinicServices(client, clinicId, normalizedServices);
      await syncClinicOperatingHours(
        client,
        clinicId,
        normalizedOperatingHours,
      );

      await client.query(
        `INSERT INTO public.owner_subscriptions
         (
           owner_user_id,
           plan_id,
           subscription_status,
           billing_cycle,
           start_date,
           end_date,
           auto_renew
         )
         VALUES ($1, $2, 'Active', $3, NULL, NULL, FALSE)
         ON CONFLICT (owner_user_id)
         DO UPDATE SET
           plan_id = EXCLUDED.plan_id,
           subscription_status = EXCLUDED.subscription_status,
           billing_cycle = EXCLUDED.billing_cycle,
           updated_at = CURRENT_TIMESTAMP`,
        [ownerUserId, freePlan.plan_id, freePlan.billing_cycle || "Monthly"],
      );

      const newApplication = await client.query(
        `INSERT INTO public.clinic_verification_applications
         (
           clinic_id,
           owner_user_id,
           business_registration_path,
           business_registration_original_name,
           business_registration_mime_type,
           business_permit_path,
           business_permit_original_name,
           business_permit_mime_type,
           owner_government_id_path,
           owner_government_id_original_name,
           owner_government_id_mime_type,
           clinic_license_path,
           clinic_license_original_name,
           clinic_license_mime_type,
           verification_status
         )
         VALUES (
           $1, $2,
           $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11,
           $12, $13, $14,
           'Pending'
         )
         RETURNING application_id, verification_status, submitted_at`,
        [
          clinicId,
          ownerUserId,
          toStoredClinicVerificationPath(uploadedFiles.business_registration),
          uploadedFiles.business_registration.originalname,
          uploadedFiles.business_registration.mimetype,
          toStoredClinicVerificationPath(uploadedFiles.business_permit),
          uploadedFiles.business_permit.originalname,
          uploadedFiles.business_permit.mimetype,
          toStoredClinicVerificationPath(uploadedFiles.owner_government_id),
          uploadedFiles.owner_government_id.originalname,
          uploadedFiles.owner_government_id.mimetype,
          toStoredClinicVerificationPath(uploadedFiles.clinic_license),
          uploadedFiles.clinic_license?.originalname || null,
          uploadedFiles.clinic_license?.mimetype || null,
        ],
      );

      await client.query("COMMIT");

      await createAuditLog({
        user_id: ownerUserId,
        action: "SUBMIT_CLINIC_APPLICATION",
        module: "Clinic Registration",
        description: `Clinic owner ${cleanOwnerName} submitted ${cleanClinicName} for administrator verification.`,
        ip_address: req.ip,
      }).catch((auditError) => {
        console.error(
          "Clinic application audit log error:",
          auditError.message,
        );
      });

      let notificationSent = true;

      try {
        await sendClinicApplicationReceivedEmail({
          to: cleanOwnerEmail,
          ownerName: cleanOwnerName,
          clinicName: cleanClinicName,
          applicationId: newApplication.rows[0].application_id,
        });
      } catch (emailError) {
        notificationSent = false;
        console.error(
          "Clinic application received email error:",
          emailError.message,
        );
      }

      return res.status(201).json({
        message:
          "Clinic application submitted successfully. Your account and clinic will remain inactive until an Administrator reviews and approves the submitted documents.",
        owner: newOwner.rows[0],
        role: role.role_name,
        clinic: newClinic.rows[0],
        application: newApplication.rows[0],
        subscription_plan: freePlan,
        approval_required: true,
        notification_sent: notificationSent,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      deleteUploadedClinicVerificationFiles(req);

      console.error("Clinic registration error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A duplicate clinic application already exists.",
        });
      }

      return res.status(500).json({
        error: "Error submitting clinic application.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: LIST CLINIC VERIFICATION APPLICATIONS
// ===============================

router.get(
  "/admin/verification-applications",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const requestedStatus = cleanText(req.query.status || "Pending");
    const allowedStatuses = ["All", "Pending", "Approved", "Rejected"];

    if (!allowedStatuses.includes(requestedStatus)) {
      return res.status(400).json({
        error: "Invalid clinic application status filter.",
      });
    }

    try {
      const values = [];
      let statusCondition = "";

      if (requestedStatus !== "All") {
        values.push(requestedStatus);
        statusCondition = `WHERE a.verification_status = $${values.length}`;
      }

      const applications = await pool.query(
        `SELECT
            a.application_id,
            a.clinic_id,
            a.owner_user_id,
            a.verification_status,
            a.rejection_reason,
            a.submitted_at,
            a.reviewed_at,
            a.business_registration_original_name,
            a.business_permit_original_name,
            a.owner_government_id_original_name,
            a.clinic_license_original_name,
            c.clinic_name,
            c.address,
            c.latitude,
            c.longitude,
            COALESCE(
              (
                SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
                FROM public.clinic_services cs
                JOIN public.dental_services ds
                  ON ds.service_id = cs.service_id
                WHERE cs.clinic_id = c.clinic_id
                  AND cs.is_active = TRUE
                  AND ds.is_active = TRUE
              ),
              c.services
            ) AS services,
            c.contact_number,
            c.opening_hours,
            c.status AS clinic_status,
            u.name AS owner_name,
            u.email AS owner_email,
            u.status AS owner_status,
            reviewer.name AS reviewed_by_name
         FROM public.clinic_verification_applications a
         JOIN public.clinics c ON c.clinic_id = a.clinic_id
         JOIN public.users u ON u.user_id = a.owner_user_id
         LEFT JOIN public.users reviewer ON reviewer.user_id = a.reviewed_by
         ${statusCondition}
         ORDER BY
           CASE WHEN a.verification_status = 'Pending' THEN 0 ELSE 1 END,
           a.submitted_at DESC`,
        values,
      );

      return res.status(200).json({
        message: "Clinic verification applications retrieved successfully.",
        status_filter: requestedStatus,
        applications: applications.rows,
      });
    } catch (err) {
      console.error("Get clinic verification applications error:", err.message);
      return res.status(500).json({
        error: "Error retrieving clinic verification applications.",
      });
    }
  },
);

// ===============================
// ADMIN: OPEN A CLINIC VERIFICATION DOCUMENT
// ===============================

router.get(
  "/admin/verification-applications/:application_id/document/:document_type",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const applicationId = Number(req.params.application_id);
    const documentType = cleanText(req.params.document_type);
    const documentMap = {
      business_registration: {
        path: "business_registration_path",
        name: "business_registration_original_name",
        mime: "business_registration_mime_type",
      },
      business_permit: {
        path: "business_permit_path",
        name: "business_permit_original_name",
        mime: "business_permit_mime_type",
      },
      owner_government_id: {
        path: "owner_government_id_path",
        name: "owner_government_id_original_name",
        mime: "owner_government_id_mime_type",
      },
      clinic_license: {
        path: "clinic_license_path",
        name: "clinic_license_original_name",
        mime: "clinic_license_mime_type",
      },
    };

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: "Invalid clinic application ID." });
    }

    const documentFields = documentMap[documentType];

    if (!documentFields) {
      return res.status(400).json({ error: "Invalid document type." });
    }

    try {
      const result = await pool.query(
        `SELECT
            ${documentFields.path} AS document_path,
            ${documentFields.name} AS original_name,
            ${documentFields.mime} AS mime_type
         FROM public.clinic_verification_applications
         WHERE application_id = $1
         LIMIT 1`,
        [applicationId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Clinic application not found." });
      }

      const document = result.rows[0];

      if (!document.document_path) {
        return res.status(404).json({ error: "Document was not submitted." });
      }

      const absolutePath = path.join(__dirname, "..", document.document_path);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: "Document file was not found." });
      }

      res.setHeader(
        "Content-Type",
        document.mime_type || "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(document.original_name || "clinic-document")}`,
      );
      res.setHeader("Cache-Control", "private, no-store");

      return res.sendFile(absolutePath);
    } catch (err) {
      console.error("Open clinic verification document error:", err.message);
      return res.status(500).json({
        error: "Error opening clinic verification document.",
      });
    }
  },
);

// ===============================
// ADMIN: APPROVE OR REJECT A CLINIC APPLICATION
// Rejection permanently removes the pending owner, clinic, application,
// and verification files because the account has never been activated.
// ===============================

router.put(
  "/admin/verification-applications/:application_id/review",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const applicationId = Number(req.params.application_id);
    const decision = cleanText(req.body.decision);
    const rejectionReason = cleanText(req.body.rejection_reason);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: "Invalid clinic application ID." });
    }

    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({
        error: "Decision must be Approved or Rejected.",
      });
    }

    if (decision === "Rejected" && rejectionReason.length < 5) {
      return res.status(400).json({
        error: "Enter a clear rejection reason with at least 5 characters.",
      });
    }

    const client = await pool.connect();
    let application = null;

    try {
      await client.query("BEGIN");

      const applicationResult = await client.query(
        `SELECT
            a.*,
            c.clinic_name,
            c.status AS clinic_status,
            u.name AS owner_name,
            u.email AS owner_email,
            u.status AS owner_status
         FROM public.clinic_verification_applications a
         JOIN public.clinics c ON c.clinic_id = a.clinic_id
         JOIN public.users u ON u.user_id = a.owner_user_id
         WHERE a.application_id = $1
         FOR UPDATE OF a, c, u`,
        [applicationId],
      );

      if (applicationResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Clinic application not found." });
      }

      application = applicationResult.rows[0];

      if (application.verification_status !== "Pending") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `This clinic application has already been ${application.verification_status.toLowerCase()}.`,
        });
      }

      if (decision === "Approved") {
        await client.query(
          `UPDATE public.clinic_verification_applications
           SET verification_status = 'Approved',
               rejection_reason = NULL,
               reviewed_by = $1,
               reviewed_at = CURRENT_TIMESTAMP
           WHERE application_id = $2`,
          [req.user.user_id, applicationId],
        );

        await client.query(
          `UPDATE public.clinics
           SET status = 'Active'
           WHERE clinic_id = $1`,
          [application.clinic_id],
        );

        await client.query(
          `UPDATE public.users
           SET status = 'Active',
               email_verified = TRUE,
               email_verification_token = NULL,
               email_verification_expires = NULL
           WHERE user_id = $1`,
          [application.owner_user_id],
        );

        await client.query("COMMIT");

        await createAuditLog({
          user_id: req.user.user_id,
          action: "APPROVE_CLINIC_APPLICATION",
          module: "Clinic Verification",
          description: `Approved clinic application for ${application.clinic_name}, owned by ${application.owner_name}.`,
          ip_address: req.ip,
        }).catch((auditError) => {
          console.error("Approve clinic audit log error:", auditError.message);
        });

        let notificationSent = true;

        try {
          await sendClinicApplicationApprovedEmail({
            to: application.owner_email,
            ownerName: application.owner_name,
            clinicName: application.clinic_name,
            loginUrl: getClinicOwnerLoginUrl(),
          });
        } catch (emailError) {
          notificationSent = false;
          console.error(
            "Clinic application approval email error:",
            emailError.message,
          );
        }

        return res.status(200).json({
          message:
            "Clinic application approved. The clinic and Clinic Owner account are now active.",
          application_id: applicationId,
          clinic_id: application.clinic_id,
          owner_user_id: application.owner_user_id,
          verification_status: "Approved",
          notification_sent: notificationSent,
        });
      }

      try {
        await sendClinicApplicationRejectedEmail({
          to: application.owner_email,
          ownerName: application.owner_name,
          clinicName: application.clinic_name,
          rejectionReason,
          registrationUrl: getClinicRegistrationUrl(),
        });
      } catch (emailError) {
        await client.query("ROLLBACK");

        console.error(
          "Clinic application rejection email error:",
          emailError.message,
        );

        return res.status(502).json({
          error:
            "The rejection email could not be sent, so the clinic application was not deleted. Check the email configuration and try again.",
          notification_sent: false,
          application_preserved: true,
        });
      }

      const uploadedPaths = [
        application.business_registration_path,
        application.business_permit_path,
        application.owner_government_id_path,
        application.clinic_license_path,
      ].filter(Boolean);

      // Preserve historical audit records while removing their reference
      // to the pending Clinic Owner account. The registration audit entry can
      // otherwise prevent the user row from being deleted through its FK.
      await client.query(
        `UPDATE public.audit_logs
         SET user_id = NULL
         WHERE user_id = $1`,
        [application.owner_user_id],
      );

      await client.query(
        `DELETE FROM public.user_roles
         WHERE user_id = $1`,
        [application.owner_user_id],
      );

      // Clinic deletion cascades to clinic_verification_applications
      // and clinic_services.
      await client.query(
        `DELETE FROM public.clinics
         WHERE clinic_id = $1`,
        [application.clinic_id],
      );

      await client.query(
        `DELETE FROM public.users
         WHERE user_id = $1`,
        [application.owner_user_id],
      );

      await client.query("COMMIT");

      uploadedPaths.forEach(deleteClinicVerificationFile);

      await createAuditLog({
        user_id: req.user.user_id,
        action: "REJECT_CLINIC_APPLICATION",
        module: "Clinic Verification",
        description: `Rejected and deleted clinic application for ${application.clinic_name}. Reason: ${rejectionReason}`,
        ip_address: req.ip,
      }).catch((auditError) => {
        console.error("Reject clinic audit log error:", auditError.message);
      });

      return res.status(200).json({
        message:
          "Clinic application rejected. The pending clinic, owner account, and verification documents were permanently removed.",
        application_id: applicationId,
        verification_status: "Rejected",
        notification_sent: true,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Review clinic application error:", err.message);

      return res.status(500).json({
        error:
          decision === "Approved"
            ? "Error approving clinic application."
            : "Error rejecting clinic application.",
        database_code: err.code || null,
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN / STAFF: GET ALL CLINICS
// ===============================

router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Dentist", "Assistant", "Dental Assistant"),
  async (req, res) => {
    try {
      const clinics = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.address,
            c.latitude,
            c.longitude,
            COALESCE(
              (
                SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
                FROM public.clinic_services cs
                JOIN public.dental_services ds
                  ON ds.service_id = cs.service_id
                WHERE cs.clinic_id = c.clinic_id
                  AND cs.is_active = TRUE
                  AND ds.is_active = TRUE
              ),
              c.services
            ) AS services,
            c.contact_number,
            c.opening_hours,
            os.plan_id AS subscription_plan_id,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.price,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,
            c.status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp
           ON os.plan_id = sp.plan_id
         ORDER BY c.clinic_id DESC`,
      );

      res.status(200).json({
        message: "Clinics retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Get clinics error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinics",
      });
    }
  },
);

// ===============================
// PATIENT / ADMIN / DENTIST / ASSISTANT: CLINIC DISCOVERY LIST
// ===============================

router.get(
  "/discovery/list",
  authenticateToken,
  authorizeRoles(
    "Patient",
    "Admin",
    "Dentist",
    "Assistant",
    "Dental Assistant",
  ),
  async (req, res) => {
    try {
      const clinics = await pool.query(
        `SELECT 
            clinic_id,
            clinic_name,
            address,
            latitude,
            longitude,
            services,
            contact_number,
            opening_hours,
            status,
            created_at
         FROM public.clinics
         WHERE status = 'Active'
         ORDER BY clinic_name ASC`,
      );

      res.status(200).json({
        message: "Clinic discovery list retrieved successfully",
        clinics: clinics.rows,
      });
    } catch (err) {
      console.error("Clinic discovery error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic discovery list",
      });
    }
  },
);

// AUTHENTICATED: CURRENT CLINIC WHITE-LABEL BRANDING
router.get("/branding/current", authenticateToken, async (req, res) => {
  const requestedClinicId = req.query.clinic_id
    ? Number(req.query.clinic_id)
    : null;

  if (
    req.query.clinic_id &&
    (!Number.isInteger(requestedClinicId) || requestedClinicId <= 0)
  ) {
    return res.status(400).json({
      error: "A valid clinic location ID is required.",
    });
  }

  try {
    let clinicId = requestedClinicId;

    if (req.user.role === "Clinic Owner") {
      if (clinicId) {
        const owned = await pool.query(
          `SELECT clinic_id
           FROM public.clinics
           WHERE clinic_id = $1 AND owner_user_id = $2
           LIMIT 1`,
          [clinicId, req.user.user_id],
        );

        if (owned.rows.length === 0) {
          return res.status(403).json({
            error:
              "Selected clinic location does not belong to this Clinic Owner account.",
          });
        }
      } else {
        const firstOwned = await pool.query(
          `SELECT clinic_id
           FROM public.clinics
           WHERE owner_user_id = $1
           ORDER BY CASE WHEN status = 'Active' THEN 0 ELSE 1 END, clinic_id
           LIMIT 1`,
          [req.user.user_id],
        );
        clinicId = firstOwned.rows[0]?.clinic_id || null;
      }
    } else if (req.user.role === "Dentist") {
      const result = await pool.query(
        `SELECT clinic_id FROM public.dentists WHERE user_id = $1 LIMIT 1`,
        [req.user.user_id],
      );
      clinicId = result.rows[0]?.clinic_id || null;
    } else if (
      req.user.role === "Assistant" ||
      req.user.role === "Dental Assistant"
    ) {
      const result = await pool.query(
        `SELECT clinic_id FROM public.assistants WHERE user_id = $1 LIMIT 1`,
        [req.user.user_id],
      );
      clinicId = result.rows[0]?.clinic_id || null;
    } else if (req.user.role === "Patient") {
      const result = await pool.query(
        `SELECT clinic_id FROM public.patients WHERE user_id = $1 LIMIT 1`,
        [req.user.user_id],
      );
      clinicId = result.rows[0]?.clinic_id || null;
    } else if (req.user.role === "Admin" && !clinicId) {
      return res.status(200).json({
        branding: {
          clinic_id: null,
          clinic_name: "DentoGraph",
          brand_name: "DentoGraph",
          brand_logo_url: null,
          primary_color: "#2563EB",
          secondary_color: "#0F172A",
          welcome_message: null,
        },
      });
    }

    if (!clinicId) {
      return res.status(404).json({
        error: "No clinic location is assigned to this account.",
      });
    }

    const result = await pool.query(
      `SELECT
          clinic_id,
          clinic_name,
          status,
          COALESCE(NULLIF(brand_name, ''), clinic_name) AS brand_name,
          brand_logo_url,
          COALESCE(primary_color, '#2563EB') AS primary_color,
          COALESCE(secondary_color, '#0F172A') AS secondary_color,
          welcome_message,
          contact_number,
          address
       FROM public.clinics
       WHERE clinic_id = $1
       LIMIT 1`,
      [clinicId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Clinic location was not found." });
    }

    return res.status(200).json({ branding: result.rows[0] });
  } catch (err) {
    console.error("Get current clinic branding error:", err.message);
    return res.status(500).json({
      error: "Error retrieving clinic branding.",
    });
  }
});

// CLINIC OWNER: UPLOAD OWN LOCATION BRAND LOGO
router.post(
  "/owner/locations/:clinic_id/branding/logo",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  (req, res, next) => {
    uploadClinicLogo.single("logo")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "Clinic logo must not exceed 5 MB.",
          });
        }

        return res.status(400).json({
          error: err.message || "Clinic logo upload failed.",
        });
      }

      if (err) {
        return res.status(400).json({
          error: err.message || "Invalid clinic logo file.",
        });
      }

      next();
    });
  },
  async (req, res) => {
    const clinicId = Number(req.params.clinic_id);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      if (req.file) {
        deleteClinicBrandingFile(
          `uploads/clinic-branding/${req.file.filename}`,
        );
      }

      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please select a clinic logo image.",
      });
    }

    const newLogoPath = `uploads/clinic-branding/${req.file.filename}`;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const ownedLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinicId,
      );

      if (!ownedLocation) {
        deleteClinicBrandingFile(newLogoPath);
        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Selected clinic location does not belong to this Clinic Owner account.",
        });
      }

      const previousLogoResult = await client.query(
        `SELECT brand_logo_url
         FROM public.clinics
         WHERE clinic_id = $1
         AND owner_user_id = $2
         LIMIT 1`,
        [clinicId, req.user.user_id],
      );

      const previousLogo = previousLogoResult.rows[0]?.brand_logo_url || null;

      const updated = await client.query(
        `UPDATE public.clinics
         SET brand_logo_url = $1
         WHERE clinic_id = $2
         AND owner_user_id = $3
         RETURNING
           clinic_id,
           clinic_name,
           COALESCE(NULLIF(brand_name, ''), clinic_name) AS brand_name,
           brand_logo_url,
           COALESCE(primary_color, '#2563EB') AS primary_color,
           COALESCE(secondary_color, '#0F172A') AS secondary_color,
           welcome_message`,
        [newLogoPath, clinicId, req.user.user_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPLOAD_CLINIC_LOGO",
        module: "Clinic White Label",
        description: `Uploaded a new brand logo for ${ownedLocation.clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      if (previousLogo && previousLogo !== newLogoPath) {
        deleteClinicBrandingFile(previousLogo);
      }

      return res.status(200).json({
        message: "Clinic logo uploaded successfully.",
        branding: updated.rows[0],
        logo_path: newLogoPath,
        logo_url: `/${newLogoPath}`,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      deleteClinicBrandingFile(newLogoPath);

      console.error("Upload clinic logo error:", err.message);

      return res.status(500).json({
        error: "Error uploading clinic logo.",
      });
    } finally {
      client.release();
    }
  },
);

// CLINIC OWNER: REMOVE OWN LOCATION BRAND LOGO
router.delete(
  "/owner/locations/:clinic_id/branding/logo",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const clinicId = Number(req.params.clinic_id);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const ownedLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinicId,
      );

      if (!ownedLocation) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Selected clinic location does not belong to this Clinic Owner account.",
        });
      }

      const logoResult = await client.query(
        `SELECT brand_logo_url
         FROM public.clinics
         WHERE clinic_id = $1
         AND owner_user_id = $2
         LIMIT 1`,
        [clinicId, req.user.user_id],
      );

      const previousLogo = logoResult.rows[0]?.brand_logo_url || null;

      const updated = await client.query(
        `UPDATE public.clinics
         SET brand_logo_url = NULL
         WHERE clinic_id = $1
         AND owner_user_id = $2
         RETURNING
           clinic_id,
           clinic_name,
           COALESCE(NULLIF(brand_name, ''), clinic_name) AS brand_name,
           brand_logo_url,
           COALESCE(primary_color, '#2563EB') AS primary_color,
           COALESCE(secondary_color, '#0F172A') AS secondary_color,
           welcome_message`,
        [clinicId, req.user.user_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "REMOVE_CLINIC_LOGO",
        module: "Clinic White Label",
        description: `Removed the brand logo for ${ownedLocation.clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      deleteClinicBrandingFile(previousLogo);

      return res.status(200).json({
        message: "Clinic logo removed successfully.",
        branding: updated.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Remove clinic logo error:", err.message);

      return res.status(500).json({
        error: "Error removing clinic logo.",
      });
    } finally {
      client.release();
    }
  },
);

// CLINIC OWNER: UPDATE OWN LOCATION WHITE-LABEL BRANDING
router.put(
  "/owner/locations/:clinic_id/branding",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const clinicId = Number(req.params.clinic_id);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    const normalized = normalizeBrandingPayload(req.body);

    if (!normalized.valid) {
      return res.status(400).json({ error: normalized.error });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const ownedLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinicId,
      );

      if (!ownedLocation) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "Selected clinic location does not belong to this Clinic Owner account.",
        });
      }

      const branding = normalized.branding;

      const updated = await client.query(
        `UPDATE public.clinics
         SET brand_name = $1,
             primary_color = $2,
             secondary_color = $3,
             welcome_message = $4
         WHERE clinic_id = $5
         AND owner_user_id = $6
         RETURNING
           clinic_id,
           clinic_name,
           COALESCE(NULLIF(brand_name, ''), clinic_name) AS brand_name,
           brand_logo_url,
           primary_color,
           secondary_color,
           welcome_message`,
        [
          branding.brand_name,
          branding.primary_color,
          branding.secondary_color,
          branding.welcome_message,
          clinicId,
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_BRANDING",
        module: "Clinic White Label",
        description: `Updated white-label branding for ${ownedLocation.clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Clinic white-label branding updated successfully.",
        branding: updated.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Update clinic branding error:", err.message);
      return res.status(500).json({
        error: "Error updating clinic white-label branding.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET ALL OWN CLINIC LOCATIONS
// ===============================

router.get(
  "/owner/locations",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
      }

      const locations = await getOwnerLocations(client, req.user.user_id);

      res.status(200).json({
        message: "Clinic owner locations retrieved successfully.",
        shared_subscription: subscriptionSource,
        locations,
      });
    } catch (err) {
      console.error("Get clinic owner locations error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner locations.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET SINGLE OWN LOCATION
// ===============================

router.get(
  "/owner/locations/:clinic_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const client = await pool.connect();

    try {
      const location = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!location) {
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      res.status(200).json({
        message: "Clinic owner location retrieved successfully.",
        shared_subscription: subscriptionSource,
        location,
        clinic: location,
      });
    } catch (err) {
      console.error("Get clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN LOCATION WHITE-LABEL BRANDING
router.put(
  "/owner/locations/:clinic_id/branding",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const clinicId = Number(req.params.clinic_id);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({
        error: "A valid clinic location ID is required.",
      });
    }

    const normalized = normalizeBrandingPayload(req.body);

    if (!normalized.valid) {
      return res.status(400).json({ error: normalized.error });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const ownedLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinicId,
      );

      if (!ownedLocation) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "Selected clinic location does not belong to this Clinic Owner account.",
        });
      }

      const branding = normalized.branding;

      const updated = await client.query(
        `UPDATE public.clinics
         SET brand_name = $1,
             primary_color = $2,
             secondary_color = $3,
             welcome_message = $4
         WHERE clinic_id = $5
         AND owner_user_id = $6
         RETURNING
           clinic_id,
           clinic_name,
           COALESCE(NULLIF(brand_name, ''), clinic_name) AS brand_name,
           brand_logo_url,
           primary_color,
           secondary_color,
           welcome_message`,
        [
          branding.brand_name,
          branding.primary_color,
          branding.secondary_color,
          branding.welcome_message,
          clinicId,
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_BRANDING",
        module: "Clinic White Label",
        description: `Updated white-label branding for ${ownedLocation.clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Clinic white-label branding updated successfully.",
        branding: updated.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Update clinic branding error:", err.message);
      return res.status(500).json({
        error: "Error updating clinic white-label branding.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET ALL OWN CLINIC LOCATIONS
// ===============================

router.get(
  "/owner/locations",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
      }

      const locations = await getOwnerLocations(client, req.user.user_id);

      res.status(200).json({
        message: "Clinic owner locations retrieved successfully.",
        shared_subscription: subscriptionSource,
        locations,
      });
    } catch (err) {
      console.error("Get clinic owner locations error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner locations.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET SINGLE OWN LOCATION
// ===============================

router.get(
  "/owner/locations/:clinic_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const client = await pool.connect();

    try {
      const location = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!location) {
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      res.status(200).json({
        message: "Clinic owner location retrieved successfully.",
        shared_subscription: subscriptionSource,
        location,
        clinic: location,
      });
    } catch (err) {
      console.error("Get clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: CREATE NEW LOCATION UNDER SAME SUBSCRIPTION
// ===============================

router.post(
  "/owner/locations",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      operating_hours_schedule,
    } = req.body || {};

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);
    const normalizedServices = parseClinicServicesInput(services);
    const cleanServices = normalizedServices.join(", ");
    const normalizedOperatingHours = parseOperatingHoursInput(
      operating_hours_schedule,
    );
    const operatingHoursError = validateOperatingHours(
      normalizedOperatingHours,
    );
    const cleanOpeningHours = operatingHoursToLegacyText(
      normalizedOperatingHours,
    );
    const cleanContactNumber = cleanText(contact_number);

    if (!cleanClinicName || !cleanAddress) {
      return res.status(400).json({
        error: "Clinic location name and address are required.",
      });
    }

    if (normalizedServices.length === 0) {
      return res.status(400).json({
        error: "Select at least one clinic service.",
      });
    }

    if (operatingHoursError) {
      return res.status(400).json({
        error: operatingHoursError,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (!subscriptionSource) {
        const freePlan = await getFreePlan(client);

        if (!freePlan) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error:
              "No shared subscription was found and the Free plan is unavailable.",
          });
        }

        await client.query(
          `INSERT INTO public.owner_subscriptions
           (
             owner_user_id,
             plan_id,
             subscription_status,
             billing_cycle,
             start_date,
             end_date,
             auto_renew
           )
           VALUES ($1, $2, 'Active', $3, NULL, NULL, FALSE)
           ON CONFLICT (owner_user_id)
           DO NOTHING`,
          [
            req.user.user_id,
            freePlan.plan_id,
            freePlan.billing_cycle || "Monthly",
          ],
        );

        subscriptionSource = await getOwnerSubscriptionSource(
          client,
          req.user.user_id,
        );
      }

      const existingLocationCount = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM public.clinics
         WHERE owner_user_id = $1
         AND status IN ('Active', 'Inactive')`,
        [req.user.user_id],
      );

      const maxClinics =
        subscriptionSource.max_clinics === null ||
        subscriptionSource.max_clinics === undefined
          ? null
          : Number(subscriptionSource.max_clinics);

      const currentLocationCount = Number(
        existingLocationCount.rows[0].count || 0,
      );

      if (maxClinics !== null && currentLocationCount >= maxClinics) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `The shared ${subscriptionSource.plan_name || "subscription"} plan has reached its clinic location limit. Limit: ${maxClinics}.`,
        });
      }

      const isExpiredByDate =
        subscriptionSource.subscription_end_date &&
        new Date(subscriptionSource.subscription_end_date) < new Date();

      if (
        subscriptionSource.subscription_status !== "Active" ||
        isExpiredByDate
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error:
            "The shared Clinic Owner subscription is inactive or expired. Renew the subscription before creating another clinic location.",
        });
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         LIMIT 1`,
        [cleanClinicName, cleanAddress],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "A clinic location with the same name and address already exists.",
        });
      }

      const newLocation = await client.query(
        `INSERT INTO public.clinics
         (
           clinic_name,
           address,
           latitude,
           longitude,
           services,
           contact_number,
           opening_hours,
           owner_user_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanContactNumber),
          normalizeNullable(cleanOpeningHours),
          req.user.user_id,
        ],
      );

      await syncClinicServices(
        client,
        newLocation.rows[0].clinic_id,
        normalizedServices,
      );

      await syncClinicOperatingHours(
        client,
        newLocation.rows[0].clinic_id,
        normalizedOperatingHours,
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_CLINIC_LOCATION",
        module: "Clinic Owner Locations",
        description: `Clinic owner created location ${newLocation.rows[0].clinic_name} under the shared subscription.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      const normalizedLocation = await attachNormalizedServices(
        client,
        newLocation.rows[0],
      );

      res.status(201).json({
        message:
          "Clinic location created successfully under the same clinic owner subscription.",
        shared_subscription: subscriptionSource,
        location: normalizedLocation,
        clinic: normalizedLocation,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Create clinic owner location error:", err.message);
      res.status(500).json({
        error: "Error creating clinic owner location.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN LOCATION
// ===============================

router.put(
  "/owner/locations/:clinic_id",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      operating_hours_schedule,
      status,
    } = req.body || {};

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);
    const normalizedServices = parseClinicServicesInput(services);
    const cleanServices = normalizedServices.join(", ");
    const normalizedOperatingHours = parseOperatingHoursInput(
      operating_hours_schedule,
    );
    const operatingHoursError = validateOperatingHours(
      normalizedOperatingHours,
    );
    const cleanOpeningHours = operatingHoursToLegacyText(
      normalizedOperatingHours,
    );

    if (!cleanClinicName || !cleanAddress) {
      return res.status(400).json({
        error: "Clinic location name and address are required.",
      });
    }

    if (normalizedServices.length === 0) {
      return res.status(400).json({
        error: "Select at least one clinic service.",
      });
    }

    if (operatingHoursError) {
      return res.status(400).json({
        error: operatingHoursError,
      });
    }

    const allowedStatuses = ["Active", "Inactive"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use Active or Inactive.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingLocation = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!existingLocation) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         AND clinic_id <> $3
         LIMIT 1`,
        [cleanClinicName, cleanAddress, clinic_id],
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "Another clinic location with the same name and address already exists.",
        });
      }

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
      }

      const updatedLocation = await client.query(
        `UPDATE public.clinics
         SET clinic_name = $1,
             address = $2,
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7,
             status = COALESCE($8, status)
         WHERE clinic_id = $9
         AND owner_user_id = $10
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanOpeningHours),
          normalizeNullable(status),
          clinic_id,
          req.user.user_id,
        ],
      );

      await syncClinicServices(
        client,
        updatedLocation.rows[0].clinic_id,
        normalizedServices,
      );

      await syncClinicOperatingHours(
        client,
        updatedLocation.rows[0].clinic_id,
        normalizedOperatingHours,
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_LOCATION",
        module: "Clinic Owner Locations",
        description: `Clinic owner updated location ${updatedLocation.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      const normalizedLocation = await attachNormalizedServices(
        client,
        updatedLocation.rows[0],
      );

      res.status(200).json({
        message: "Clinic location updated successfully.",
        shared_subscription: subscriptionSource,
        location: normalizedLocation,
        clinic: normalizedLocation,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Update clinic owner location error:", {
        message: err.message,
        code: err.code,
        constraint: err.constraint,
        detail: err.detail,
      });

      res.status(err.statusCode || 500).json({
        error:
          err.statusCode === 400
            ? err.message
            : "Error updating clinic owner location.",
        database_code: err.code || null,
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET SINGLE LOCATION USAGE
// ===============================

router.get(
  "/owner/locations/:clinic_id/usage",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const { clinic_id } = req.params;
    const client = await pool.connect();

    try {
      const location = await getOwnerLocationById(
        client,
        req.user.user_id,
        clinic_id,
      );

      if (!location) {
        return res.status(404).json({
          error: "Clinic location not found under this clinic owner account.",
        });
      }

      const expiredSubscription = await markExpiredSubscriptionIfNeeded(
        client,
        req.user.user_id,
      );

      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      const usage = await getLocationUsage(client, clinic_id);

      res.status(200).json({
        message: "Clinic owner location usage retrieved successfully.",
        shared_subscription: subscriptionSource,
        location: expiredSubscription
          ? {
              ...location,
              subscription_status: expiredSubscription.subscription_status,
            }
          : location,
        clinic: expiredSubscription
          ? {
              ...location,
              subscription_status: expiredSubscription.subscription_status,
            }
          : location,
        usage,
      });
    } catch (err) {
      console.error("Get clinic owner location usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner location usage.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN CLINIC
// Backward compatible: returns first owned location and all locations.
// ===============================

router.get(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (subscriptionSource) {
      }

      const locations = await getOwnerLocations(client, req.user.user_id);

      if (locations.length === 0) {
        return res.status(404).json({
          error: "No clinic location is linked to this clinic owner account.",
        });
      }

      res.status(200).json({
        message: "Clinic owner clinic locations retrieved successfully.",
        clinic: locations[0],
        locations,
        shared_subscription: subscriptionSource,
      });
    } catch (err) {
      console.error("Get clinic owner clinic error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner clinic locations.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: UPDATE OWN CLINIC PROFILE
// Backward compatible: updates first owned location.
// ===============================

router.put(
  "/owner/my-clinic",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const locations = await getOwnerLocations(client, req.user.user_id);

      if (locations.length === 0) {
        return res.status(404).json({
          error: "No clinic location is linked to this clinic owner account.",
        });
      }

      req.params.clinic_id = locations[0].clinic_id;

      const {
        clinic_name,
        address,
        latitude,
        longitude,
        services,
        contact_number,
        opening_hours,
      } = req.body || {};

      const cleanClinicName = cleanText(clinic_name);
      const cleanAddress = cleanText(address);

      if (!cleanClinicName || !cleanAddress) {
        return res.status(400).json({
          error: "Clinic name and address are required.",
        });
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)
         AND clinic_id <> $3
         LIMIT 1`,
        [cleanClinicName, cleanAddress, locations[0].clinic_id],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Another clinic location with the same name and address already exists.",
        });
      }

      const updatedClinic = await client.query(
        `UPDATE public.clinics
         SET clinic_name = $1,
             address = $2,
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7
         WHERE clinic_id = $8
         AND owner_user_id = $9
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanText(services)),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanOpeningHours),
          locations[0].clinic_id,
          req.user.user_id,
        ],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_CLINIC_PROFILE",
        module: "Clinic Owner Profile",
        description: `Clinic owner updated clinic profile for ${updatedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic profile updated successfully.",
        clinic: updatedClinic.rows[0],
      });
    } catch (err) {
      console.error("Update clinic owner profile error:", err.message);
      res.status(500).json({
        error: "Error updating clinic profile.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN SHARED SUBSCRIPTION USAGE
// Aggregates usage across all owned clinic locations.
// ===============================

router.get(
  "/owner/usage",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const subscriptionSource = await getOwnerSubscriptionSource(
        client,
        req.user.user_id,
      );

      if (!subscriptionSource) {
        return res.status(404).json({
          error:
            "No active clinic location is linked to this clinic owner account.",
        });
      }

      await markExpiredSubscriptionIfNeeded(client, req.user.user_id);

      const refreshedSubscriptionSource =
        (await getOwnerSubscriptionSource(client, req.user.user_id)) ||
        subscriptionSource;

      const aggregate = await getOwnerAggregateUsage(client, req.user.user_id);

      res.status(200).json({
        message:
          "Clinic owner shared subscription usage retrieved successfully.",
        clinic: refreshedSubscriptionSource,
        shared_subscription: refreshedSubscriptionSource,
        locations: aggregate.locations,
        usage_by_location: aggregate.usage_by_location,
        usage: aggregate.usage,
        location_count: aggregate.locations.filter((location) =>
          ["Active", "Inactive"].includes(String(location.status || "Active")),
        ).length,
        active_location_count: aggregate.locations.filter(
          (location) => String(location.status || "Active") === "Active",
        ).length,
      });
    } catch (err) {
      console.error("Get clinic owner usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner usage.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: MONITOR CLINIC SUBSCRIPTIONS
// Table-ready SaaS view: one Clinic Owner can have many clinic locations.
// ===============================

router.get(
  "/admin/subscriptions",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      await pool.query(
        `UPDATE public.owner_subscriptions
         SET subscription_status = 'Expired',
             updated_at = CURRENT_TIMESTAMP
         WHERE end_date IS NOT NULL
           AND end_date < CURRENT_TIMESTAMP
           AND subscription_status <> 'Expired'`,
      );

      const subscriptions = await pool.query(
        `SELECT
           c.clinic_id,
           c.clinic_name,
           c.owner_user_id,
           owner_user.name AS owner_name,
           owner_user.email AS owner_email,

           COUNT(*) OVER (PARTITION BY c.owner_user_id)::int
             AS owner_location_count,

           COUNT(*) FILTER (
             WHERE COALESCE(c.status, 'Active') = 'Active'
           ) OVER (PARTITION BY c.owner_user_id)::int
             AS owner_active_location_count,

           CASE
             WHEN COUNT(*) OVER (PARTITION BY c.owner_user_id) > 1
               THEN 'Shared across locations'
             ELSE 'Single location'
           END AS subscription_scope,

           os.owner_subscription_id,
           os.plan_id AS subscription_plan_id,
           sp.plan_name,
           sp.plan_tier,
           sp.price,
           COALESCE(os.billing_cycle, sp.billing_cycle) AS billing_cycle,
           sp.max_clinics,
           sp.max_dentists,
           sp.max_assistants,
           sp.max_patients,
           sp.max_records,
           sp.max_xrays,
           sp.storage_limit_mb,

           os.start_date AS subscription_start_date,
           os.end_date AS subscription_end_date,
           COALESCE(os.subscription_status, 'Active')
             AS subscription_status,
           os.auto_renew,

           CASE
             WHEN os.plan_id IS NULL THEN 'No Plan'
             WHEN os.end_date IS NULL
               THEN COALESCE(os.subscription_status, 'Active')
             WHEN os.end_date < CURRENT_TIMESTAMP THEN 'Expired'
             WHEN os.end_date <= CURRENT_TIMESTAMP + INTERVAL '7 days'
               THEN 'Expiring Soon'
             ELSE COALESCE(os.subscription_status, 'Active')
           END AS monitoring_status,

           CASE
             WHEN os.end_date IS NULL THEN NULL
             ELSE CEIL(
               EXTRACT(
                 EPOCH FROM (os.end_date - CURRENT_TIMESTAMP)
               ) / 86400
             )::int
           END AS days_remaining,

           c.status AS clinic_status,
           c.created_at

         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp
           ON os.plan_id = sp.plan_id
         ORDER BY
           CASE
             WHEN os.plan_id IS NULL THEN 1
             WHEN os.end_date < CURRENT_TIMESTAMP THEN 2
             WHEN os.end_date <= CURRENT_TIMESTAMP + INTERVAL '7 days'
               THEN 3
             ELSE 4
           END,
           owner_user.name ASC NULLS LAST,
           os.end_date ASC NULLS LAST,
           c.clinic_name ASC`,
      );

      const rows = subscriptions.rows;

      const uniqueOwnerIds = new Set(
        rows
          .map((item) => item.owner_user_id)
          .filter(
            (ownerUserId) => ownerUserId !== null && ownerUserId !== undefined,
          ),
      );

      res.status(200).json({
        message:
          "Clinic owner shared subscription monitoring retrieved successfully.",
        subscriptions: rows,
        summary: {
          total: rows.length,
          total_clinic_locations: rows.length,
          total_owner_accounts: uniqueOwnerIds.size,
          active: rows.filter((item) => item.monitoring_status === "Active")
            .length,
          expiring_soon: rows.filter(
            (item) => item.monitoring_status === "Expiring Soon",
          ).length,
          expired: rows.filter((item) => item.monitoring_status === "Expired")
            .length,
          no_plan: rows.filter((item) => item.monitoring_status === "No Plan")
            .length,
        },
      });
    } catch (err) {
      console.error("Admin subscription monitoring error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic owner shared subscription monitoring",
      });
    }
  },
);

// ===============================
// ADMIN: GET CLINIC SUBSCRIPTION USAGE
// ===============================

router.get(
  "/:clinic_id/subscription-usage",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicResult = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            os.plan_id AS subscription_plan_id,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp
           ON os.plan_id = sp.plan_id
         WHERE c.clinic_id = $1`,
        [clinic_id],
      );

      if (clinicResult.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const dentistCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dentists
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      const assistantCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.assistants
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      const patientCount = await pool.query(
        `SELECT COUNT(DISTINCT dr.patient_id)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [clinic_id],
      );

      const recordCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.dental_records dr
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1
         AND COALESCE(dr.status, 'Active') = 'Active'`,
        [clinic_id],
      );

      const xrayCount = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      const storageUsage = await pool.query(
        `SELECT COALESCE(SUM(COALESCE(x.file_size_bytes, 0)), 0)::bigint AS total_bytes
         FROM public.xray_images x
         JOIN public.dental_records dr ON x.record_id = dr.record_id
         JOIN public.dentists d ON dr.dentist_id = d.dentist_id
         WHERE d.clinic_id = $1`,
        [clinic_id],
      );

      const totalBytes = Number(storageUsage.rows[0].total_bytes || 0);
      const storageUsedMb = totalBytes / 1024 / 1024;

      res.status(200).json({
        message: "Clinic subscription usage retrieved successfully",
        clinic: clinicResult.rows[0],
        usage: {
          dentists: dentistCount.rows[0].count,
          assistants: assistantCount.rows[0].count,
          patients: patientCount.rows[0].count,
          records: recordCount.rows[0].count,
          xrays: xrayCount.rows[0].count,
          storage_used_mb: Number(storageUsedMb.toFixed(2)),
          storage_used_bytes: totalBytes,
        },
      });
    } catch (err) {
      console.error("Get clinic subscription usage error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic subscription usage",
      });
    }
  },
);

// ===============================
// ADMIN / STAFF: GET SINGLE CLINIC
// ===============================

router.get(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles(
    "Admin",
    "Dentist",
    "Assistant",
    "Dental Assistant",
    "Patient",
  ),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinic = await pool.query(
        `SELECT 
            c.clinic_id,
            c.clinic_name,
            c.address,
            c.latitude,
            c.longitude,
            COALESCE(
              (
                SELECT STRING_AGG(ds.service_name, ', ' ORDER BY ds.service_name)
                FROM public.clinic_services cs
                JOIN public.dental_services ds
                  ON ds.service_id = cs.service_id
                WHERE cs.clinic_id = c.clinic_id
                  AND cs.is_active = TRUE
                  AND ds.is_active = TRUE
              ),
              c.services
            ) AS services,
            c.contact_number,
            c.opening_hours,
            os.plan_id AS subscription_plan_id,
            c.owner_user_id,
            owner_user.name AS owner_name,
            owner_user.email AS owner_email,
            sp.plan_name,
            sp.price,
            sp.max_dentists,
            sp.max_assistants,
            sp.max_patients,
            sp.max_records,
            sp.max_xrays,
            sp.storage_limit_mb,
            c.status,
            c.created_at
         FROM public.clinics c
         LEFT JOIN public.users owner_user
           ON c.owner_user_id = owner_user.user_id
         LEFT JOIN public.owner_subscriptions os
           ON os.owner_user_id = c.owner_user_id
         LEFT JOIN public.subscription_plans sp
           ON os.plan_id = sp.plan_id
         WHERE c.clinic_id = $1`,
        [clinic_id],
      );

      if (clinic.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const normalizedClinic = await attachNormalizedServices(
        pool,
        clinic.rows[0],
      );

      res.status(200).json({
        message: "Clinic retrieved successfully",
        clinic: normalizedClinic,
      });
    } catch (err) {
      console.error("Get clinic error:", err.message);
      res.status(500).json({
        error: "Error retrieving clinic",
      });
    }
  },
);

// ===============================
// ADMIN: CREATE CLINIC
// ===============================

router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      operating_hours_schedule,
      subscription_plan_id,
      status,
      owner_user_id,
    } = req.body || {};

    const cleanClinicName = cleanText(clinic_name);
    const cleanAddress = cleanText(address);

    if (!cleanClinicName || !cleanAddress) {
      return res.status(400).json({
        error: "Clinic name and address are required",
      });
    }

    const normalizedServices = parseClinicServicesInput(services);
    const cleanServices = normalizedServices.join(", ");
    const normalizedOperatingHours = parseOperatingHoursInput(
      operating_hours_schedule,
    );
    const operatingHoursError = validateOperatingHours(
      normalizedOperatingHours,
    );
    const cleanOpeningHours = operatingHoursToLegacyText(
      normalizedOperatingHours,
    );

    if (normalizedServices.length === 0) {
      return res.status(400).json({
        error: "Select at least one clinic service.",
      });
    }

    if (operatingHoursError) {
      return res.status(400).json({
        error: operatingHoursError,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      if (subscription_plan_id) {
        const planCheck = await client.query(
          `SELECT plan_id
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        if (planCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Subscription plan not found",
          });
        }
      }

      if (owner_user_id) {
        const ownerCheck = await client.query(
          `SELECT user_id
           FROM public.users
           WHERE user_id = $1`,
          [owner_user_id],
        );

        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Selected clinic owner user not found",
          });
        }
      }

      const duplicateCheck = await client.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE LOWER(clinic_name) = LOWER($1)
         AND LOWER(address) = LOWER($2)`,
        [cleanClinicName, cleanAddress],
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "A clinic location with the same name and address already exists",
        });
      }

      const newClinic = await client.query(
        `INSERT INTO public.clinics
         (
           clinic_name,
           address,
           latitude,
           longitude,
           services,
           contact_number,
           opening_hours,
           owner_user_id,
           status,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'Active'), CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          cleanClinicName,
          cleanAddress,
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanOpeningHours),
          normalizeNumber(owner_user_id),
          status || "Active",
        ],
      );

      await syncClinicServices(
        client,
        newClinic.rows[0].clinic_id,
        normalizedServices,
      );

      await syncClinicOperatingHours(
        client,
        newClinic.rows[0].clinic_id,
        normalizedOperatingHours,
      );

      if (owner_user_id && subscription_plan_id) {
        const selectedPlan = await client.query(
          `SELECT plan_id, billing_cycle
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        await client.query(
          `INSERT INTO public.owner_subscriptions
           (
             owner_user_id,
             plan_id,
             subscription_status,
             billing_cycle,
             start_date,
             end_date,
             auto_renew
           )
           VALUES ($1, $2, 'Active', $3, CURRENT_TIMESTAMP, NULL, FALSE)
           ON CONFLICT (owner_user_id)
           DO UPDATE SET
             plan_id = EXCLUDED.plan_id,
             subscription_status = 'Active',
             billing_cycle = EXCLUDED.billing_cycle,
             updated_at = CURRENT_TIMESTAMP`,
          [
            owner_user_id,
            subscription_plan_id,
            selectedPlan.rows[0]?.billing_cycle || "Monthly",
          ],
        );
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_CLINIC",
        module: "Clinic Management",
        description: `Created clinic: ${newClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      const normalizedClinic = await attachNormalizedServices(
        client,
        newClinic.rows[0],
      );

      res.status(201).json({
        message: "Clinic created successfully",
        clinic: normalizedClinic,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Create clinic error:", err.message);
      res.status(500).json({
        error: "Error creating clinic",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: UPDATE CLINIC
// ===============================

router.put(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    const {
      clinic_name,
      address,
      latitude,
      longitude,
      services,
      contact_number,
      opening_hours,
      operating_hours_schedule,
      subscription_plan_id,
      status,
      owner_user_id,
    } = req.body || {};

    const normalizedServices = parseClinicServicesInput(services);
    const cleanServices = normalizedServices.join(", ");
    const normalizedOperatingHours =
      operating_hours_schedule === undefined
        ? null
        : parseOperatingHoursInput(operating_hours_schedule);
    const operatingHoursError = normalizedOperatingHours
      ? validateOperatingHours(normalizedOperatingHours)
      : "";
    const cleanOpeningHours = normalizedOperatingHours
      ? operatingHoursToLegacyText(normalizedOperatingHours)
      : normalizeNullable(cleanText(opening_hours));

    if (operatingHoursError) {
      return res.status(400).json({
        error: operatingHoursError,
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const clinicCheck = await client.query(
        `SELECT *
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      if (subscription_plan_id) {
        const planCheck = await client.query(
          `SELECT plan_id
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        if (planCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Subscription plan not found",
          });
        }
      }

      if (owner_user_id) {
        const ownerCheck = await client.query(
          `SELECT user_id
           FROM public.users
           WHERE user_id = $1`,
          [owner_user_id],
        );

        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({
            error: "Selected clinic owner user not found",
          });
        }
      }

      const oldClinic = clinicCheck.rows[0];

      const updatedClinic = await client.query(
        `UPDATE public.clinics
         SET clinic_name = COALESCE($1, clinic_name),
             address = COALESCE($2, address),
             latitude = $3,
             longitude = $4,
             services = $5,
             contact_number = $6,
             opening_hours = $7,
             owner_user_id = COALESCE($8, owner_user_id),
             status = COALESCE($9, status)
         WHERE clinic_id = $10
         RETURNING *`,
        [
          normalizeNullable(cleanText(clinic_name)),
          normalizeNullable(cleanText(address)),
          normalizeNumber(latitude),
          normalizeNumber(longitude),
          normalizeNullable(cleanServices),
          normalizeNullable(cleanText(contact_number)),
          normalizeNullable(cleanOpeningHours),
          normalizeNumber(owner_user_id),
          normalizeNullable(status),
          clinic_id,
        ],
      );

      const targetOwnerUserId =
        normalizeNumber(owner_user_id) ||
        updatedClinic.rows[0].owner_user_id ||
        oldClinic.owner_user_id;

      if (
        subscription_plan_id !== undefined &&
        subscription_plan_id !== null &&
        subscription_plan_id !== "" &&
        targetOwnerUserId
      ) {
        const selectedPlan = await client.query(
          `SELECT
             plan_id,
             billing_cycle
           FROM public.subscription_plans
           WHERE plan_id = $1`,
          [subscription_plan_id],
        );

        if (selectedPlan.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            error: "Subscription plan not found",
          });
        }

        await client.query(
          `INSERT INTO public.owner_subscriptions
           (
             owner_user_id,
             plan_id,
             subscription_status,
             billing_cycle,
             start_date,
             end_date,
             auto_renew
           )
           VALUES (
             $1,
             $2,
             'Active',
             $3,
             CURRENT_TIMESTAMP,
             NULL,
             FALSE
           )
           ON CONFLICT (owner_user_id)
           DO UPDATE SET
             plan_id = EXCLUDED.plan_id,
             subscription_status = 'Active',
             billing_cycle = EXCLUDED.billing_cycle,
             updated_at = CURRENT_TIMESTAMP`,
          [
            targetOwnerUserId,
            subscription_plan_id,
            selectedPlan.rows[0].billing_cycle || "Monthly",
          ],
        );

        const ownerSubscription = await getOwnerSubscriptionSource(
          client,
          targetOwnerUserId,
        );
      }

      if (services !== undefined) {
        await syncClinicServices(
          client,
          updatedClinic.rows[0].clinic_id,
          normalizedServices,
        );
      }

      if (operating_hours_schedule !== undefined) {
        await syncClinicOperatingHours(
          client,
          updatedClinic.rows[0].clinic_id,
          normalizedOperatingHours,
        );
      }

      const newStatus = updatedClinic.rows[0].status;
      const oldStatus = oldClinic.status;

      let action = "UPDATE_CLINIC";
      let description = `Updated clinic: ${updatedClinic.rows[0].clinic_name}.`;

      if (oldStatus !== newStatus && newStatus === "Inactive") {
        action = "ARCHIVE_CLINIC";
        description = `Deactivated clinic: ${updatedClinic.rows[0].clinic_name}.`;
      }

      if (oldStatus !== newStatus && newStatus === "Active") {
        action = "RESTORE_CLINIC";
        description = `Activated clinic: ${updatedClinic.rows[0].clinic_name}.`;
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action,
        module: "Clinic Management",
        description,
        ip_address: req.ip,
      });

      await client.query("COMMIT");

      const normalizedClinic = await attachNormalizedServices(
        client,
        updatedClinic.rows[0],
      );

      res.status(200).json({
        message: "Clinic updated successfully",
        clinic: normalizedClinic,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Update clinic error:", err.message);
      res.status(500).json({
        error: "Error updating clinic",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// ADMIN: ARCHIVE / DEACTIVATE CLINIC
// ===============================

router.put(
  "/:clinic_id/archive",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const archivedClinic = await pool.query(
        `UPDATE public.clinics
         SET status = 'Inactive'
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "ARCHIVE_CLINIC",
        module: "Clinic Management",
        description: `Archived clinic: ${archivedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic archived successfully",
        clinic: archivedClinic.rows[0],
      });
    } catch (err) {
      console.error("Archive clinic error:", err.message);
      res.status(500).json({
        error: "Error archiving clinic",
      });
    }
  },
);

// ===============================
// ADMIN: RESTORE / ACTIVATE CLINIC
// ===============================

router.put(
  "/:clinic_id/restore",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const restoredClinic = await pool.query(
        `UPDATE public.clinics
         SET status = 'Active'
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "RESTORE_CLINIC",
        module: "Clinic Management",
        description: `Restored clinic: ${restoredClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic restored successfully",
        clinic: restoredClinic.rows[0],
      });
    } catch (err) {
      console.error("Restore clinic error:", err.message);
      res.status(500).json({
        error: "Error restoring clinic",
      });
    }
  },
);

// ===============================
// ADMIN: DELETE CLINIC PERMANENTLY
// ===============================

router.delete(
  "/:clinic_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { clinic_id } = req.params;

    try {
      const clinicCheck = await pool.query(
        `SELECT clinic_id
         FROM public.clinics
         WHERE clinic_id = $1`,
        [clinic_id],
      );

      if (clinicCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Clinic not found",
        });
      }

      const dentistCheck = await pool.query(
        `SELECT dentist_id
         FROM public.dentists
         WHERE clinic_id = $1
         LIMIT 1`,
        [clinic_id],
      );

      const assistantCheck = await pool.query(
        `SELECT assistant_id
         FROM public.assistants
         WHERE clinic_id = $1
         LIMIT 1`,
        [clinic_id],
      );

      if (dentistCheck.rows.length > 0 || assistantCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Cannot delete this clinic because it still has assigned dentists or assistants. Archive it instead.",
        });
      }

      const deletedClinic = await pool.query(
        `DELETE FROM public.clinics
         WHERE clinic_id = $1
         RETURNING *`,
        [clinic_id],
      );

      await createAuditLog({
        user_id: req.user.user_id,
        action: "DELETE_CLINIC",
        module: "Clinic Management",
        description: `Deleted clinic permanently: ${deletedClinic.rows[0].clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: "Clinic deleted permanently",
        clinic: deletedClinic.rows[0],
      });
    } catch (err) {
      console.error("Delete clinic error:", err.message);
      res.status(500).json({
        error: "Error deleting clinic",
      });
    }
  },
);

module.exports = router;
