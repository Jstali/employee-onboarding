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
  console.log("🔍 Token Debug - Validating token:", token);
  console.log("🔍 Token Debug - Token store size:", tokenStore.size);
  console.log(
    "🔍 Token Debug - Available tokens:",
    Array.from(tokenStore.keys())
  );

  const tokenData = tokenStore.get(token);
  console.log("🔍 Token Debug - Token data found:", tokenData);

  if (!tokenData) {
    console.log("❌ Token Debug - Token not found in store");
    return null;
  }

  if (new Date() > tokenData.expiresAt) {
    console.log("❌ Token Debug - Token expired at:", tokenData.expiresAt);
    tokenStore.delete(token);
    return null;
  }

  console.log(
    "✅ Token Debug - Token is valid, expires at:",
    tokenData.expiresAt
  );
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

    console.log("🔐 Auth Debug - Token received:", token ? "Yes" : "No");
    console.log(
      "🔐 Auth Debug - Full Authorization header:",
      req.header("Authorization")
    );

    if (!token) {
      console.log("❌ Auth Debug - No token provided");
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const userData = validateToken(token);
    console.log(
      "🔐 Auth Debug - Token validation result:",
      userData ? "Valid" : "Invalid"
    );
    console.log("🔐 Auth Debug - User data from token:", userData);

    if (!userData) {
      console.log("❌ Auth Debug - Invalid or expired token");
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    // Check if user still exists and is active
    console.log(
      "🔐 Auth Debug - Looking up user in database with ID:",
      userData.id
    );
    const user = await query(
      "SELECT id, name, email, role, employee_type, manager_id, status FROM users WHERE id = $1",
      [userData.id]
    );

    console.log("🔐 Auth Debug - Database query result:", user.rows);
    console.log("🔐 Auth Debug - User status:", user.rows[0]?.status);

    if (user.rows.length === 0 || user.rows[0].status === "rejected") {
      console.log("❌ Auth Debug - User not found or rejected");
      revokeToken(token);
      return res
        .status(401)
        .json({ error: "User not found or account deactivated." });
    }

    console.log(
      "✅ Auth Debug - Authentication successful for user:",
      user.rows[0].email
    );
    req.user = user.rows[0];
    req.token = token;
    next();
  } catch (error) {
    console.error("❌ Auth Debug - Authentication error:", error);
    res.status(500).json({ error: "Authentication failed." });
  }
};

// Role-based access control middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten the roles array to handle cases where authorize(["hr"]) is called
    const flatRoles = roles.flat();

    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated." });
    }

    if (!flatRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Access denied. Insufficient permissions." });
    }

    next();
  };
};

// Specific role middlewares
const requireHR = authorize("hr");
const requireEmployee = authorize("employee");
const requireHRorAdmin = authorize("hr");

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
  requireHR,
  requireEmployee,
  requireHRorAdmin,
  logAction,
};
