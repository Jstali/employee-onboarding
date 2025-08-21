const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../config/database");
const { authenticate, requireAdmin, logAction } = require("../middleware/auth");

const router = express.Router();

// Apply authentication to all admin routes
router.use(authenticate);
router.use(requireAdmin);

// Create new HR user
router.post("/hr-users", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    // Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create HR user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, status, created_at`,
      [name, email.toLowerCase(), passwordHash, "hr", "approved"]
    );

    const newHRUser = userResult.rows[0];

    // Log action
    await logAction(
      req.user.id,
      "hr_user_created",
      {
        hr_user_id: newHRUser.id,
        hr_user_email: email,
      },
      req
    );

    res.status(201).json({
      message: "HR user created successfully",
      hrUser: newHRUser,
    });
  } catch (error) {
    console.error("Create HR user error:", error);
    res.status(500).json({ error: "Failed to create HR user" });
  }
});

// Get all HR users
router.get("/hr-users", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      "SELECT COUNT(*) FROM users WHERE role = $1",
      ["hr"]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get HR users with pagination
    const hrUsersResult = await query(
      `SELECT id, name, email, status, created_at, updated_at
       FROM users 
       WHERE role = 'hr'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      hrUsers: hrUsersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get HR users error:", error);
    res.status(500).json({ error: "Failed to get HR users" });
  }
});

// Get HR user by ID
router.get("/hr-users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const hrUserResult = await query(
      "SELECT id, name, email, status, created_at, updated_at FROM users WHERE id = $1 AND role = $2",
      [id, "hr"]
    );

    if (hrUserResult.rows.length === 0) {
      return res.status(404).json({ error: "HR user not found" });
    }

    res.json({ hrUser: hrUserResult.rows[0] });
  } catch (error) {
    console.error("Get HR user error:", error);
    res.status(500).json({ error: "Failed to get HR user" });
  }
});

// Update HR user
router.put("/hr-users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status } = req.body;

    // Check if HR user exists
    const hrUserExists = await query(
      "SELECT id FROM users WHERE id = $1 AND role = $2",
      [id, "hr"]
    );

    if (hrUserExists.rows.length === 0) {
      return res.status(404).json({ error: "HR user not found" });
    }

    // Check if email already exists (if changing email)
    if (email) {
      const existingEmail = await query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.toLowerCase(), id]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (email) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      params.push(email.toLowerCase());
    }

    if (status && ["approved", "rejected"].includes(status)) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Add updated_at and id to params
    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(id);

    // Update HR user
    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramCount}`,
      params
    );

    // Log action
    await logAction(
      req.user.id,
      "hr_user_updated",
      {
        hr_user_id: id,
        updates: { name, email, status },
      },
      req
    );

    res.json({ message: "HR user updated successfully" });
  } catch (error) {
    console.error("Update HR user error:", error);
    res.status(500).json({ error: "Failed to update HR user" });
  }
});

// Delete HR user
router.delete("/hr-users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if HR user exists
    const hrUserExists = await query(
      "SELECT id, name FROM users WHERE id = $1 AND role = $2",
      [id, "hr"]
    );

    if (hrUserExists.rows.length === 0) {
      return res.status(404).json({ error: "HR user not found" });
    }

    // Check if HR user has any employees assigned
    const employeesCount = await query(
      "SELECT COUNT(*) FROM users WHERE manager_id = $1",
      [id]
    );

    if (parseInt(employeesCount.rows[0].count) > 0) {
      return res.status(400).json({
        error:
          "Cannot delete HR user. They have employees assigned as manager.",
      });
    }

    // Delete HR user
    await query("DELETE FROM users WHERE id = $1", [id]);

    // Log action
    await logAction(
      req.user.id,
      "hr_user_deleted",
      {
        hr_user_id: id,
        hr_user_name: hrUserExists.rows[0].name,
      },
      req
    );

    res.json({ message: "HR user deleted successfully" });
  } catch (error) {
    console.error("Delete HR user error:", error);
    res.status(500).json({ error: "Failed to delete HR user" });
  }
});

// Change HR user password
router.patch("/hr-users/:id/password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters long" });
    }

    // Check if HR user exists
    const hrUserExists = await query(
      "SELECT id FROM users WHERE id = $1 AND role = $2",
      [id, "hr"]
    );

    if (hrUserExists.rows.length === 0) {
      return res.status(404).json({ error: "HR user not found" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [passwordHash, id]
    );

    // Log action
    await logAction(
      req.user.id,
      "hr_password_changed",
      { hr_user_id: id },
      req
    );

    res.json({ message: "HR user password changed successfully" });
  } catch (error) {
    console.error("Change HR password error:", error);
    res.status(500).json({ error: "Failed to change HR user password" });
  }
});

// Get system statistics
router.get("/statistics", async (req, res) => {
  try {
    // Get user counts by role and status
    const userStats = await query(`
      SELECT 
        role,
        status,
        COUNT(*) as count
      FROM users 
      GROUP BY role, status
      ORDER BY role, status
    `);

    // Get employee counts by type
    const employeeTypeStats = await query(`
      SELECT 
        employee_type,
        COUNT(*) as count
      FROM users 
      WHERE role = 'employee'
      GROUP BY employee_type
      ORDER BY employee_type
    `);

    // Get recent activity (last 7 days)
    const recentActivity = await query(`
      SELECT 
        al.action,
        al.created_at,
        u.name as user_name,
        u.role as user_role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY al.created_at DESC
      LIMIT 20
    `);

    // Get total counts
    const totalUsers = await query("SELECT COUNT(*) FROM users");
    const totalEmployees = await query(
      "SELECT COUNT(*) FROM users WHERE role = 'employee'"
    );
    const totalHR = await query("SELECT COUNT(*) FROM users WHERE role = 'hr'");
    const pendingApprovals = await query(
      "SELECT COUNT(*) FROM users WHERE role = 'employee' AND status = 'pending'"
    );

    res.json({
      userStatistics: userStats.rows,
      employeeTypeStatistics: employeeTypeStats.rows,
      recentActivity: recentActivity.rows,
      totals: {
        users: parseInt(totalUsers.rows[0].count),
        employees: parseInt(totalEmployees.rows[0].count),
        hrUsers: parseInt(totalHR.rows[0].count),
        pendingApprovals: parseInt(pendingApprovals.rows[0].count),
      },
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({ error: "Failed to get system statistics" });
  }
});

// Get audit logs
router.get("/audit-logs", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      action,
      userId,
      startDate,
      endDate,
    } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramCount = 0;

    if (action) {
      paramCount++;
      whereClause += ` AND al.action = $${paramCount}`;
      params.push(action);
    }

    if (userId) {
      paramCount++;
      whereClause += ` AND al.user_id = $${paramCount}`;
      params.push(userId);
    }

    if (startDate) {
      paramCount++;
      whereClause += ` AND al.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND al.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get audit logs with pagination
    const paginationParams = [...params, parseInt(limit), parseInt(offset)];

    const logsResult = await query(
      `SELECT 
        al.id,
        al.action,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.name as user_name,
        u.role as user_role
       FROM audit_logs al
       JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      paginationParams
    );

    res.json({
      auditLogs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

// System health check
router.get("/health", async (req, res) => {
  try {
    // Check database connection
    const dbCheck = await query("SELECT 1 as health");
    const dbHealthy = dbCheck.rows.length > 0;

    // Check email service (optional)
    const emailService = require("../services/emailService");
    const emailHealthy = await emailService.testEmailConfig();

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "healthy" : "unhealthy",
        email: emailHealthy ? "healthy" : "unhealthy",
      },
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
