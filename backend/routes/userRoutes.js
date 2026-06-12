const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const createAuditLog = require("../utils/auditLogger");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// ===============================
// HELPER FUNCTIONS
// ===============================

const normalizeNullable = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return value;
};

const isAssistantRole = (role) => {
  return role === "Assistant" || role === "Dental Assistant";
};

const checkClinicSubscriptionLimit = async (
  client,
  clinic_id,
  limitType,
  excludeUserId = null,
) => {
  if (!clinic_id) {
    return {
      allowed: true,
      message: null,
    };
  }

  const clinicPlanResult = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        sp.plan_name,
        sp.max_dentists,
        sp.max_assistants,
        sp.max_patients,
        sp.max_records,
        sp.max_xrays,
        sp.storage_limit_mb
     FROM public.clinics c
     LEFT JOIN public.subscription_plans sp
       ON c.subscription_plan_id = sp.plan_id
     WHERE c.clinic_id = $1`,
    [clinic_id],
  );

  if (clinicPlanResult.rows.length === 0) {
    return {
      allowed: false,
      message: "Selected clinic was not found.",
    };
  }

  const clinic = clinicPlanResult.rows[0];

  if (!clinic.subscription_plan_id) {
    return {
      allowed: false,
      message:
        "This clinic has no subscription plan assigned. Please assign a plan before adding staff.",
    };
  }

  if (limitType === "Dentist") {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.dentists
       WHERE clinic_id = $1
       AND ($2::int IS NULL OR user_id <> $2)`,
      [clinic_id, excludeUserId],
    );

    const currentCount = countResult.rows[0].count;
    const maxAllowed = clinic.max_dentists;

    if (maxAllowed !== null && currentCount >= maxAllowed) {
      return {
        allowed: false,
        message: `${clinic.clinic_name} has reached the dentist limit for the ${clinic.plan_name} plan. Limit: ${maxAllowed}.`,
      };
    }
  }

  if (limitType === "Assistant") {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.assistants
       WHERE clinic_id = $1
       AND ($2::int IS NULL OR user_id <> $2)`,
      [clinic_id, excludeUserId],
    );

    const currentCount = countResult.rows[0].count;
    const maxAllowed = clinic.max_assistants;

    if (maxAllowed !== null && currentCount >= maxAllowed) {
      return {
        allowed: false,
        message: `${clinic.clinic_name} has reached the assistant limit for the ${clinic.plan_name} plan. Limit: ${maxAllowed}.`,
      };
    }
  }

  return {
    allowed: true,
    message: null,
  };
};

const getClinicOwnedByUser = async (client, ownerUserId) => {
  const clinicResult = await client.query(
    `SELECT 
        c.clinic_id,
        c.clinic_name,
        c.subscription_plan_id,
        sp.plan_name,
        sp.max_dentists,
        sp.max_assistants
     FROM public.clinics c
     LEFT JOIN public.subscription_plans sp
       ON c.subscription_plan_id = sp.plan_id
     WHERE c.owner_user_id = $1
     AND c.status = 'Active'
     LIMIT 1`,
    [ownerUserId],
  );

  return clinicResult.rows[0] || null;
};

const getStaffRoleByName = async (client, requestedRole) => {
  const normalizedRole = String(requestedRole || "").trim();

  if (normalizedRole === "Dentist") {
    const result = await client.query(
      `SELECT role_id, role_name
       FROM public.roles
       WHERE role_name = 'Dentist'
       LIMIT 1`,
    );

    return result.rows[0] || null;
  }

  if (normalizedRole === "Assistant" || normalizedRole === "Dental Assistant") {
    const result = await client.query(
      `SELECT role_id, role_name
       FROM public.roles
       WHERE role_name IN ('Assistant', 'Dental Assistant')
       ORDER BY 
         CASE 
           WHEN role_name = 'Assistant' THEN 1
           WHEN role_name = 'Dental Assistant' THEN 2
           ELSE 3
         END
       LIMIT 1`,
    );

    return result.rows[0] || null;
  }

  return null;
};

// ===============================
// GET ALL ROLES
// ===============================

router.get("/roles", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.roles ORDER BY role_id",
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Roles error:", err.message);
    res.status(500).json({ error: "Error fetching roles" });
  }
});

// ===============================
// REGISTER USER WITH ROLE + CREATE ROLE PROFILE
// ===============================

router.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    role_id,
    license_number,
    specialization,
    availability,
    clinic_id,
  } = req.body || {};

  if (!name || !email || !password || !role_id) {
    return res.status(400).json({
      error: "Name, email, password, and role_id are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleCheck = await client.query(
      "SELECT role_id, role_name FROM public.roles WHERE role_id = $1",
      [role_id],
    );

    if (roleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid role_id" });
    }

    const roleName = roleCheck.rows[0].role_name;
    const normalizedClinicId = normalizeNullable(clinic_id);

    if (roleName === "Dentist" && normalizedClinicId) {
      const limitCheck = await checkClinicSubscriptionLimit(
        client,
        normalizedClinicId,
        "Dentist",
      );

      if (!limitCheck.allowed) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    if (isAssistantRole(roleName) && normalizedClinicId) {
      const limitCheck = await checkClinicSubscriptionLimit(
        client,
        normalizedClinicId,
        "Assistant",
      );

      if (!limitCheck.allowed) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: limitCheck.message });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await client.query(
      `INSERT INTO public.users (name, email, password, status)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, status, created_at`,
      [name, email, hashedPassword, "Active"],
    );

    const userId = newUser.rows[0].user_id;

    await client.query(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [userId, role_id],
    );

    if (roleName === "Dentist") {
      await client.query(
        `INSERT INTO public.dentists
         (user_id, license_number, specialization, availability, status, clinic_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          license_number || `DEN-${userId}`,
          specialization || "General Dentistry",
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          "Active",
          normalizedClinicId,
        ],
      );
    }

    if (isAssistantRole(roleName)) {
      await client.query(
        `INSERT INTO public.assistants
         (user_id, license_number, availability, status, clinic_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          license_number || `AST-${userId}`,
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          "Active",
          normalizedClinicId,
        ],
      );
    }

    if (roleName === "Patient") {
      await client.query(
        `INSERT INTO public.patients (user_id)
         VALUES ($1)`,
        [userId],
      );
    }

    await client.query("COMMIT");

    await createAuditLog({
      user_id: req.user?.user_id || null,
      action: "CREATE_USER",
      module: "User Management",
      description: `Created user account for ${newUser.rows[0].name} as ${roleName}.`,
      ip_address: req.ip,
    });

    res.status(201).json({
      message: "User registered successfully with role profile",
      user: newUser.rows[0],
      role: roleName,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Registration error:", err.message);

    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Error registering user" });
  } finally {
    client.release();
  }
});

// ===============================
// LOGIN USER WITH ROLE
// ===============================

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT 
          u.user_id,
          u.name,
          u.email,
          u.password,
          u.status,
          r.role_id,
          r.role_name
       FROM public.users u
       JOIN public.user_roles ur ON u.user_id = ur.user_id
       JOIN public.roles r ON ur.role_id = r.role_id
       WHERE u.email = $1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.status === "Inactive") {
      return res.status(403).json({
        error: "This account is inactive. Please contact the administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    await createAuditLog({
      user_id: user.user_id,
      action: "LOGIN",
      module: "Authentication",
      description: `${user.name} logged in as ${user.role_name}.`,
      ip_address: req.ip,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        status: user.status,
        role_id: user.role_id,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ===============================
// ADMIN: GET ALL USERS
// ===============================

router.get(
  "/admin/users",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const users = await pool.query(
        `SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name

         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id

         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id

         ORDER BY u.user_id DESC`,
      );

      res.status(200).json({
        message: "Users retrieved successfully",
        users: users.rows,
      });
    } catch (err) {
      console.error("Get users error:", err.message);
      res.status(500).json({ error: "Error retrieving users" });
    }
  },
);

// ===============================
// ADMIN: GET SINGLE USER
// ===============================

router.get(
  "/admin/users/:user_id",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;

    try {
      const user = await pool.query(
        `SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,
            d.clinic_id AS dentist_clinic_id,
            dc.clinic_name AS dentist_clinic_name,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability,
            a.clinic_id AS assistant_clinic_id,
            ac.clinic_name AS assistant_clinic_name

         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.clinics dc ON d.clinic_id = dc.clinic_id

         LEFT JOIN public.assistants a ON u.user_id = a.user_id
         LEFT JOIN public.clinics ac ON a.clinic_id = ac.clinic_id

         WHERE u.user_id = $1`,
        [user_id],
      );

      if (user.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        message: "User retrieved successfully",
        user: user.rows[0],
      });
    } catch (err) {
      console.error("Get single user error:", err.message);
      res.status(500).json({ error: "Error retrieving user" });
    }
  },
);

// ===============================
// ADMIN: UPDATE USER STATUS
// ===============================

router.put(
  "/admin/users/:user_id/status",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;
    const { status } = req.body || {};

    const allowedStatuses = ["Active", "Inactive"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Valid status is required. Use Active or Inactive.",
      });
    }

    try {
      if (Number(user_id) === Number(req.user.user_id)) {
        return res.status(400).json({
          error: "You cannot change your own account status.",
        });
      }

      const updatedUser = await pool.query(
        `UPDATE public.users
         SET status = $1
         WHERE user_id = $2
         RETURNING user_id, name, email, status, created_at`,
        [status, user_id],
      );

      if (updatedUser.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_USER_STATUS",
        module: "User Management",
        description: `Updated user ${updatedUser.rows[0].name} status to ${status}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `User status updated to ${status}`,
        user: updatedUser.rows[0],
      });
    } catch (err) {
      console.error("Update user status error:", err.message);
      res.status(500).json({ error: "Error updating user status" });
    }
  },
);

// ===============================
// ADMIN: UPDATE USER ROLE + ENSURE ROLE PROFILE EXISTS
// ===============================

router.put(
  "/admin/users/:user_id/role",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;

    const { role_id, license_number, specialization, availability, clinic_id } =
      req.body || {};

    if (!role_id) {
      return res.status(400).json({ error: "role_id is required" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const roleCheck = await client.query(
        "SELECT role_id, role_name FROM public.roles WHERE role_id = $1",
        [role_id],
      );

      if (roleCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid role_id" });
      }

      const newRole = roleCheck.rows[0];
      const normalizedClinicId = normalizeNullable(clinic_id);

      if (Number(user_id) === Number(req.user.user_id)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "You cannot change your own role.",
        });
      }

      const userCheck = await client.query(
        "SELECT user_id, name, email FROM public.users WHERE user_id = $1",
        [user_id],
      );

      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      if (newRole.role_name === "Dentist" && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Dentist",
          user_id,
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      if (isAssistantRole(newRole.role_name) && normalizedClinicId) {
        const limitCheck = await checkClinicSubscriptionLimit(
          client,
          normalizedClinicId,
          "Assistant",
          user_id,
        );

        if (!limitCheck.allowed) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: limitCheck.message });
        }
      }

      const existingRole = await client.query(
        "SELECT * FROM public.user_roles WHERE user_id = $1",
        [user_id],
      );

      if (existingRole.rows.length === 0) {
        await client.query(
          `INSERT INTO public.user_roles (user_id, role_id)
           VALUES ($1, $2)`,
          [user_id, role_id],
        );
      } else {
        await client.query(
          `UPDATE public.user_roles
           SET role_id = $1
           WHERE user_id = $2`,
          [role_id, user_id],
        );
      }

      if (newRole.role_name === "Dentist") {
        const dentistCheck = await client.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [user_id],
        );

        if (dentistCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.dentists
             (user_id, license_number, specialization, availability, status, clinic_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user_id,
              license_number || `DEN-${user_id}`,
              specialization || "General Dentistry",
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
              normalizedClinicId,
            ],
          );
        } else {
          await client.query(
            `UPDATE public.dentists
             SET license_number = COALESCE($1, license_number),
                 specialization = COALESCE($2, specialization),
                 availability = COALESCE($3, availability),
                 clinic_id = $4
             WHERE user_id = $5`,
            [
              normalizeNullable(license_number),
              normalizeNullable(specialization),
              normalizeNullable(availability),
              normalizedClinicId,
              user_id,
            ],
          );
        }
      }

      if (isAssistantRole(newRole.role_name)) {
        const assistantCheck = await client.query(
          "SELECT assistant_id FROM public.assistants WHERE user_id = $1",
          [user_id],
        );

        if (assistantCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.assistants
             (user_id, license_number, availability, status, clinic_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user_id,
              license_number || `AST-${user_id}`,
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
              normalizedClinicId,
            ],
          );
        } else {
          await client.query(
            `UPDATE public.assistants
             SET license_number = COALESCE($1, license_number),
                 availability = COALESCE($2, availability),
                 clinic_id = $3
             WHERE user_id = $4`,
            [
              normalizeNullable(license_number),
              normalizeNullable(availability),
              normalizedClinicId,
              user_id,
            ],
          );
        }
      }

      if (newRole.role_name === "Patient") {
        const patientCheck = await client.query(
          "SELECT patient_id FROM public.patients WHERE user_id = $1",
          [user_id],
        );

        if (patientCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.patients (user_id)
             VALUES ($1)`,
            [user_id],
          );
        }
      }

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "UPDATE_ROLE",
        module: "User Management",
        description: `Updated user ${userCheck.rows[0].name} to role ${newRole.role_name}.`,
        ip_address: req.ip,
      });

      res.status(200).json({
        message: `User role updated to ${newRole.role_name}`,
        user: userCheck.rows[0],
        role: newRole,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Update user role error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A profile record for this user already exists.",
        });
      }

      res.status(500).json({ error: "Error updating user role" });
    } finally {
      client.release();
    }
  },
);

// ===============================
// CLINIC OWNER: GET OWN STAFF
// ===============================

router.get(
  "/clinic-owner/staff",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    try {
      const clinic = await getClinicOwnedByUser(pool, req.user.user_id);

      if (!clinic) {
        return res.status(404).json({
          error: "No active clinic is linked to this clinic owner account.",
        });
      }

      const staff = await pool.query(
        `SELECT 
            u.user_id,
            u.name,
            u.email,
            u.status,
            u.created_at,

            r.role_id,
            r.role_name,

            d.dentist_id,
            d.license_number AS dentist_license_number,
            d.specialization,
            d.availability AS dentist_availability,

            a.assistant_id,
            a.license_number AS assistant_license_number,
            a.availability AS assistant_availability

         FROM public.users u
         JOIN public.user_roles ur ON u.user_id = ur.user_id
         JOIN public.roles r ON ur.role_id = r.role_id

         LEFT JOIN public.dentists d ON u.user_id = d.user_id
         LEFT JOIN public.assistants a ON u.user_id = a.user_id

         WHERE 
           (
             d.clinic_id = $1
             OR a.clinic_id = $1
           )
         AND r.role_name IN ('Dentist', 'Assistant', 'Dental Assistant')
         ORDER BY u.created_at DESC`,
        [clinic.clinic_id],
      );

      res.status(200).json({
        message: "Clinic staff retrieved successfully",
        clinic,
        staff: staff.rows,
      });
    } catch (err) {
      console.error("Get clinic owner staff error:", err.message);
      res.status(500).json({
        error: err.message || "Error retrieving clinic staff",
      });
    }
  },
);

// ===============================
// CLINIC OWNER: CREATE OWN STAFF
// ===============================

router.post(
  "/clinic-owner/staff",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  async (req, res) => {
    const {
      name,
      email,
      password,
      staff_role,
      license_number,
      specialization,
      availability,
    } = req.body || {};

    if (!name || !email || !password || !staff_role) {
      return res.status(400).json({
        error: "Name, email, password, and staff role are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clinic = await getClinicOwnedByUser(client, req.user.user_id);

      if (!clinic) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "No active clinic is linked to this clinic owner account.",
        });
      }

      const role = await getStaffRoleByName(client, staff_role);

      if (!role) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Invalid staff role. Use Dentist or Assistant.",
        });
      }

      const emailCheck = await client.query(
        `SELECT user_id
         FROM public.users
         WHERE LOWER(email) = LOWER($1)
         LIMIT 1`,
        [email],
      );

      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Email already exists. Please use another email address.",
        });
      }

      const limitType = role.role_name === "Dentist" ? "Dentist" : "Assistant";

      const limitCheck = await checkClinicSubscriptionLimit(
        client,
        clinic.clinic_id,
        limitType,
      );

      if (!limitCheck.allowed) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: limitCheck.message,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await client.query(
        `INSERT INTO public.users
         (name, email, password, status)
         VALUES ($1, $2, $3, 'Active')
         RETURNING user_id, name, email, status, created_at`,
        [name, email, hashedPassword],
      );

      const newUserId = newUser.rows[0].user_id;

      await client.query(
        `INSERT INTO public.user_roles
         (user_id, role_id)
         VALUES ($1, $2)`,
        [newUserId, role.role_id],
      );

      if (role.role_name === "Dentist") {
        await client.query(
          `INSERT INTO public.dentists
           (
             user_id,
             license_number,
             specialization,
             availability,
             status,
             clinic_id
           )
           VALUES ($1, $2, $3, $4, 'Active', $5)`,
          [
            newUserId,
            license_number || `DEN-${newUserId}`,
            specialization || "General Dentistry",
            availability || "Monday to Friday, 9:00 AM - 5:00 PM",
            clinic.clinic_id,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO public.assistants
           (
             user_id,
             license_number,
             availability,
             status,
             clinic_id
           )
           VALUES ($1, $2, $3, 'Active', $4)`,
          [
            newUserId,
            license_number || `AST-${newUserId}`,
            availability || "Monday to Friday, 9:00 AM - 5:00 PM",
            clinic.clinic_id,
          ],
        );
      }

      await client.query("COMMIT");

      await createAuditLog({
        user_id: req.user.user_id,
        action: "CREATE_CLINIC_STAFF",
        module: "Clinic Owner Staff Management",
        description: `Clinic owner created ${role.role_name} account ${name} under ${clinic.clinic_name}.`,
        ip_address: req.ip,
      });

      res.status(201).json({
        message: `${role.role_name} account created successfully under ${clinic.clinic_name}.`,
        user: newUser.rows[0],
        role: role.role_name,
        clinic,
      });
    } catch (err) {
      await client.query("ROLLBACK");

      console.error("Create clinic owner staff error:", err.message);

      if (err.code === "23505") {
        return res.status(400).json({
          error: "A duplicate record already exists.",
        });
      }

      res.status(500).json({
        error: err.message || "Error creating clinic staff account.",
      });
    } finally {
      client.release();
    }
  },
);

// ===============================
// PROTECTED PROFILE ROUTE
// ===============================

router.get("/profile", authenticateToken, async (req, res) => {
  res.json({
    message: "Protected profile route accessed successfully",
    user: req.user,
  });
});

// ===============================
// DASHBOARD ROUTES
// ===============================

router.get(
  "/admin/dashboard",
  authenticateToken,
  authorizeRoles("Admin"),
  (req, res) => {
    res.json({
      message: "Welcome to the Admin Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/clinic-owner/dashboard",
  authenticateToken,
  authorizeRoles("Clinic Owner"),
  (req, res) => {
    res.json({
      message: "Welcome to the Clinic Owner Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/dentist/dashboard",
  authenticateToken,
  authorizeRoles("Dentist"),
  (req, res) => {
    res.json({
      message: "Welcome to the Dentist Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/patient/dashboard",
  authenticateToken,
  authorizeRoles("Patient"),
  (req, res) => {
    res.json({
      message: "Welcome to the Patient Dashboard",
      user: req.user,
    });
  },
);

router.get(
  "/assistant/dashboard",
  authenticateToken,
  authorizeRoles("Assistant", "Dental Assistant"),
  (req, res) => {
    res.json({
      message: "Welcome to the Dental Assistant Dashboard",
      user: req.user,
    });
  },
);

// ===============================
// CLINICAL AREA
// ===============================

router.get(
  "/clinical-area",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant", "Dental Assistant"),
  (req, res) => {
    res.json({
      message: "Clinical area accessed successfully",
      user: req.user,
    });
  },
);

module.exports = router;
