const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Access denied. No valid token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Access denied. No token provided.",
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in environment variables.");

    return res.status(500).json({
      error: "Server authentication configuration error.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.user_id || !decoded.email || !decoded.role) {
      return res.status(403).json({
        error: "Invalid token payload.",
      });
    }

    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(403).json({
        error: "Session expired. Please log in again.",
      });
    }

    return res.status(403).json({
      error: "Invalid token. Please log in again.",
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Access denied. Authentication required.",
      });
    }

    const normalizedUserRole = String(req.user.role || "").trim();
    const normalizedAllowedRoles = allowedRoles.map((role) =>
      String(role || "").trim(),
    );

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      return res.status(403).json({
        error:
          "Access denied. You do not have permission to access this resource.",
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
