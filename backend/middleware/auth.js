const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/database");

// In-memory token storage (in production, use Redis or database)
const tokenStore = new Map();

// Generate opaque token
const generateToken = () => {
  return uuidv4();
};

// Store token with user info
const storeToken = (token, userData) => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

  tokenStore.set(token, {
    ...userData,
    expiresAt,
  });

  return token;
};

// Validate token
const validateToken = (token) => {
  const tokenData = tokenStore.get(token);

  if (!tokenData) {
    return null;
  }

  if (new Date() > tokenData.expiresAt) {
    tokenStore.delete(token);
    return null;
  }

  return tokenData;
};

// Revoke token
const revokeToken = (token) => {
  tokenStore.delete(token);
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const userData = validateToken(token);

    if (!userData) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    // Check if user still exists and is active
    const user = await query(
      "SELECT id, name, email, role, employee_type, manager_id, status FROM users WHERE id = $1",
      [userData.id]
    );

    if (user.rows.length === 0 || user.rows[0].status === "rejected") {
      revokeToken(token);
      return res
        .status(401)
        .json({ error: "User not found or account deactivated." });
    }

    req.user = user.rows[0];
    req.token = token;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed." });
  }
};

// Role-based access control middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated." });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

// Specific role middlewares
const requireAdmin = authorize("admin");
const requireHR = authorize("hr");
const requireEmployee = authorize("employee");
const requireHRorAdmin = authorize("hr", "admin");

// Log user action
const logAction = async (userId, action, details = {}, req) => {
  try {
    await query(
      "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)",
      [
        userId,
        action,
        JSON.stringify(details),
        req.ip || req.connection.remoteAddress,
        req.get("User-Agent"),
      ]
    );
  } catch (error) {
    console.error("Error logging action:", error);
  }
};

module.exports = {
  generateToken,
  storeToken,
  validateToken,
  revokeToken,
  authenticate,
  authorize,
  requireAdmin,
  requireHR,
  requireEmployee,
  requireHRorAdmin,
  logAction,
};
