const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// GET ALL ROLES
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

// REGISTER USER WITH ROLE + CREATE ROLE PROFILE
router.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    role_id,
    license_number,
    specialization,
    availability,
  } = req.body || {};

  if (!name || !email || !password || !role_id) {
    return res.status(400).json({
      error: "Name, email, password, and role_id are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role exists
    const roleCheck = await client.query(
      "SELECT role_id, role_name FROM public.roles WHERE role_id = $1",
      [role_id],
    );

    if (roleCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid role_id" });
    }

    const roleName = roleCheck.rows[0].role_name;

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    const newUser = await client.query(
      `INSERT INTO public.users (name, email, password, status)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, status, created_at`,
      [name, email, hashedPassword, "Active"],
    );

    const userId = newUser.rows[0].user_id;

    // Assign role
    await client.query(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [userId, role_id],
    );

    // Create role-specific profile
    if (roleName === "Dentist") {
      await client.query(
        `INSERT INTO public.dentists
         (user_id, license_number, specialization, availability, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          license_number || `DEN-${userId}`,
          specialization || "General Dentistry",
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          "Active",
        ],
      );
    }

    if (roleName === "Assistant") {
      await client.query(
        `INSERT INTO public.assistants
         (user_id, license_number, availability, status)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          license_number || `AST-${userId}`,
          availability || "Monday to Friday, 9:00 AM - 5:00 PM",
          "Active",
        ],
      );
    }

    if (roleName === "Patient") {
      await client.query(
        `INSERT INTO public.patients
         (user_id)
         VALUES ($1)`,
        [userId],
      );
    }

    await client.query("COMMIT");

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

// LOGIN USER WITH ROLE
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

// ADMIN: GET ALL USERS
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
            r.role_name
         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id
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

// ADMIN: GET SINGLE USER
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
            r.role_name
         FROM public.users u
         LEFT JOIN public.user_roles ur ON u.user_id = ur.user_id
         LEFT JOIN public.roles r ON ur.role_id = r.role_id
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

// ADMIN: UPDATE USER STATUS
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

// ADMIN: UPDATE USER ROLE + ENSURE ROLE PROFILE EXISTS
router.put(
  "/admin/users/:user_id/role",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    const { user_id } = req.params;
    const { role_id, license_number, specialization, availability } =
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

      // Dentist profile
      if (newRole.role_name === "Dentist") {
        const dentistCheck = await client.query(
          "SELECT dentist_id FROM public.dentists WHERE user_id = $1",
          [user_id],
        );

        if (dentistCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.dentists
             (user_id, license_number, specialization, availability, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user_id,
              license_number || `DEN-${user_id}`,
              specialization || "General Dentistry",
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
            ],
          );
        } else {
          await client.query(
            `UPDATE public.dentists
             SET license_number = COALESCE($1, license_number),
                 specialization = COALESCE($2, specialization),
                 availability = COALESCE($3, availability)
             WHERE user_id = $4`,
            [
              license_number || null,
              specialization || null,
              availability || null,
              user_id,
            ],
          );
        }
      }

      // Assistant profile
      if (newRole.role_name === "Assistant") {
        const assistantCheck = await client.query(
          "SELECT assistant_id FROM public.assistants WHERE user_id = $1",
          [user_id],
        );

        if (assistantCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO public.assistants
             (user_id, license_number, availability, status)
             VALUES ($1, $2, $3, $4)`,
            [
              user_id,
              license_number || `AST-${user_id}`,
              availability || "Monday to Friday, 9:00 AM - 5:00 PM",
              "Active",
            ],
          );
        } else {
          await client.query(
            `UPDATE public.assistants
             SET license_number = COALESCE($1, license_number),
                 availability = COALESCE($2, availability)
             WHERE user_id = $3`,
            [license_number || null, availability || null, user_id],
          );
        }
      }

      // Patient profile
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

// PROTECTED PROFILE ROUTE
router.get("/profile", authenticateToken, async (req, res) => {
  res.json({
    message: "Protected profile route accessed successfully",
    user: req.user,
  });
});

// ADMIN DASHBOARD
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

// DENTIST DASHBOARD
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

// PATIENT DASHBOARD
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

// ASSISTANT DASHBOARD
router.get(
  "/assistant/dashboard",
  authenticateToken,
  authorizeRoles("Assistant"),
  (req, res) => {
    res.json({
      message: "Welcome to the Dental Assistant Dashboard",
      user: req.user,
    });
  },
);

// CLINICAL AREA
router.get(
  "/clinical-area",
  authenticateToken,
  authorizeRoles("Dentist", "Assistant"),
  (req, res) => {
    res.json({
      message: "Clinical area accessed successfully",
      user: req.user,
    });
  },
);

module.exports = router;
