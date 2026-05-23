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

// REGISTER USER WITH ROLE
router.post("/register", async (req, res) => {
  const { name, email, password, role_id } = req.body;

  if (!name || !email || !password || !role_id) {
    return res.status(400).json({
      error: "Name, email, password, and role_id are required",
    });
  }

  try {
    // Check if role exists
    const roleCheck = await pool.query(
      "SELECT * FROM public.roles WHERE role_id = $1",
      [role_id],
    );

    if (roleCheck.rows.length === 0) {
      return res.status(400).json({ error: "Invalid role_id" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user
    const newUser = await pool.query(
      `INSERT INTO public.users (name, email, password, status)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, status, created_at`,
      [name, email, hashedPassword, "Active"],
    );

    const userId = newUser.rows[0].user_id;

    // Assign role
    await pool.query(
      `INSERT INTO public.user_roles (user_id, role_id)
       VALUES ($1, $2)`,
      [userId, role_id],
    );

    res.status(201).json({
      message: "User registered successfully with role",
      user: newUser.rows[0],
      role: roleCheck.rows[0].role_name,
    });
  } catch (err) {
    console.error("Registration error:", err.message);

    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Error registering user" });
  }
});

// LOGIN USER WITH ROLE
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

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
