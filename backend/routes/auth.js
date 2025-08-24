const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/database");
const {
  generateToken,
  storeToken,
  revokeToken,
  authenticate,
  logAction,
} = require("../middleware/auth");

const router = express.Router();

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const userResult = await query(
      "SELECT id, name, email, password_hash, role, employee_type, manager_id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken();
    storeToken(token, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Log login action
    await logAction(user.id, "user_login", { ip: req.ip }, req);

    // Return user data (without password) and token
    const { password_hash, ...userData } = user;
    res.json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout route
router.post("/logout", authenticate, async (req, res) => {
  try {
    // Revoke token
    revokeToken(req.token);

    // Log logout action
    await logAction(req.user.id, "user_logout", {}, req);

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

// Change password route
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters long" });
    }

    // Get current user with password
    const userResult = await query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash
    );
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newPasswordHash, req.user.id]
    );

    // Log password change
    await logAction(req.user.id, "password_changed", {}, req);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Get current user profile
router.get("/profile", authenticate, async (req, res) => {
  try {
    const userResult = await query(
      "SELECT id, name, email, role, employee_type, manager_id, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Refresh token (optional - extend token expiry)
router.post("/refresh", authenticate, async (req, res) => {
  try {
    // Generate new token
    const newToken = generateToken();
    storeToken(newToken, {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });

    // Revoke old token
    revokeToken(req.token);

    res.json({
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

module.exports = router;
