const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/database");
const { authenticate, authorize, logAction } = require("../middleware/auth");
const { sendEmail } = require("../utils/email");

const router = express.Router();

// Apply authentication and authorization to all HR routes
router.use(authenticate);
router.use(authorize(["hr"]));

// Test email endpoint using new email service
router.post("/test-email", async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: "Test email address is required" });
    }

    await sendEmail(
      testEmail,
      "Test Email from Employee Onboarding System",
      `<p>Hello!</p>
       <p>This is a test email from the Employee Onboarding System.</p>
       <p>If you received this, the email service is working correctly.</p>
       <p>Best regards,<br>HR Team</p>`
    );

    res.json({
      message: "Test email sent successfully",
      to: testEmail,
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      error: "Email test failed",
      details: error.message,
    });
  }
});

// Check if Employee ID already exists in the system
router.get("/check-employee-id/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Check in master_employees table only
    const masterResult = await query(
      "SELECT id FROM master_employees WHERE employee_id = $1",
      [employeeId]
    );

    const exists = masterResult.rows.length > 0;

    res.json({ exists });
  } catch (error) {
    console.error("Check Employee ID error:", error);
    res.status(500).json({ error: "Failed to check Employee ID" });
  }
});

// Create new employee
router.post("/employees", async (req, res) => {
  try {
    console.log("🔍 HR Debug - Creating new employee with data:", req.body);

    const { name, email, employeeType, department, managerId, joinDate } =
      req.body;

    // Validate required fields
    if (!name || !email || !employeeType || !department) {
      console.log("❌ HR Debug - Missing required fields:", {
        name,
        email,
        employeeType,
        department,
      });
      return res.status(400).json({
        error: "Name, email, employee type, and department are required",
      });
    }

    // Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error:
          "Employee with this email already exists. Use the resend invitation feature to send a new email.",
        code: "DUPLICATE_EMAIL",
        existingEmployeeId: existingUser.rows[0].id,
      });
    }

    // Generate temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user - they need to fill out the form first
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, employee_type, department, manager_id, join_date, is_first_login, form_submitted, onboarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, email, employee_type, department, manager_id`,
      [
        name,
        email.toLowerCase(),
        hashedPassword,
        "employee",
        employeeType,
        department,
        managerId || null,
        joinDate || null,
        true,
        false, // form_submitted = false - they haven't submitted form yet
        false, // onboarded = false - they need to complete onboarding first
      ]
    );

    const newUser = userResult.rows[0];

    // Note: Employee is NOT automatically added to master_employees table
    // They will be added only after HR assigns a manager and explicitly adds them

    // Send onboarding email with credentials
    let emailSent = false;
    let emailError = null;

    try {
      const emailSubject = "Employee Onboarding Login Details";
      const emailHtml = `
        <h2>Welcome to the company!</h2>
        <p>Your employee account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Login URL:</strong> <a href="http://localhost:3000/login">http://localhost:3000/login</a></li>
          <li><strong>Email:</strong> ${newUser.email}</li>
          <li><strong>Temporary Password:</strong> ${tempPassword}</li>
        </ul>
        <p><strong>Important:</strong> Please reset your password after logging in.</p>
        <p>Best regards,<br>HR Team</p>
      `;

      await sendEmail(newUser.email, emailSubject, emailHtml);
      console.log("✅ Onboarding email sent successfully to:", newUser.email);
      emailSent = true;
    } catch (err) {
      console.error("❌ Failed to send onboarding email:", err);
      emailError = err.message;
    }

    // Log action
    await logAction(
      req.user.id,
      "employee_created_pending",
      {
        employeeId: newUser.id,
        employeeEmail: newUser.email,
        employeeType: newUser.employee_type,
        department: newUser.department,
        emailSent: emailSent,
        emailError: emailError ? emailError.message : null,
      },
      req
    );

    // Provide appropriate response based on email status
    if (emailSent) {
      res.json({
        message:
          "Employee created successfully! Credentials sent via email. Employee needs to complete onboarding form.",
        employee: newUser,
        note: "Employee will be added to master table after completing onboarding form and manager assignment",
        emailStatus: "sent",
      });
    } else {
      res.json({
        message:
          "Employee created successfully! However, email delivery failed.",
        employee: newUser,
        note: "Employee will be added to master table after completing onboarding form and manager assignment. Please check email configuration.",
        emailStatus: "failed",
        emailError: emailError ? emailError.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("❌ HR Debug - Create employee error:", error);
    console.error("❌ HR Debug - Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // Provide more specific error messages
    if (error.code === "23505") {
      // Unique constraint violation
      res.status(400).json({
        error: "Employee with this email already exists",
      });
    } else if (error.code === "23503") {
      // Foreign key constraint violation
      res.status(400).json({
        error: "Invalid manager ID or department",
      });
    } else {
      res.status(500).json({
        error: "Failed to create employee. Please try again.",
      });
    }
  }
});

// Get all employees
router.get("/employees", async (req, res) => {
  try {
    console.log("🔍 HR Debug - Fetching employees...");
    const { status, department, employeeType, showDeleted, search } = req.query;

    let queryText = `
      SELECT u.id, u.name, u.email, u.employee_type, u.department, u.created_at,
             u.manager_id, m.name as manager_name,
             u.form_submitted, u.hr_approved, u.onboarded
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.role = 'employee'
    `;
    let queryParams = [];
    let paramCount = 0;

    // Note: Status filtering has been removed since the status column was removed
    // All employees are now considered active by default

    if (department) {
      paramCount++;
      queryText += ` AND u.department = $${paramCount}`;
      queryParams.push(department);
    }

    if (employeeType) {
      paramCount++;
      queryText += ` AND u.employee_type = $${paramCount}`;
      queryParams.push(employeeType);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    queryText += " ORDER BY u.created_at DESC";

    console.log("🔍 HR Debug - Final query:", queryText);
    console.log("🔍 HR Debug - Query params:", queryParams);

    const result = await query(queryText, queryParams);
    console.log("🔍 HR Debug - Query result rows:", result.rows.length);

    res.json({
      employees: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("❌ HR Debug - Get employees error:", error);
    console.error("❌ HR Debug - Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

// Get all managers (users who can be assigned as managers)
router.get("/managers", async (req, res) => {
  try {
    // Get managers from master_employees table (these are the predefined managers)
    const result = await query(`
      SELECT u.id, u.name, u.email, u.role, u.employee_type, u.department
      FROM users u
      JOIN master_employees me ON u.id = me.user_id
      WHERE u.name IN ('Pradeep', 'Vamshi', 'Vinod', 'Rakesh')
      ORDER BY u.name
    `);

    res.json({
      managers: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get managers error:", error);
    res.status(500).json({ error: "Failed to fetch managers" });
  }
});

// Get single employee
router.get("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.name, u.email, u.employee_type, u.department, u.status, u.created_at,
              u.manager_id, m.name as manager_name,
              ed.*
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN employee_details ed ON u.id = ed.user_id
       WHERE u.id = $1 AND u.role = 'employee'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ employee: result.rows[0] });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

// Status update functionality has been removed

// Resend invitation email to existing employee
router.post("/employees/:id/resend-invitation", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔍 HR Debug - Resending invitation email to employee ID:", id);

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email, role, employee_type, department FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Generate new temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Update the employee's password
    await query(
      `UPDATE users 
       SET password_hash = $1, is_first_login = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, id]
    );

    // Send new invitation email
    let emailSent = false;
    let emailError = null;

    try {
      const emailSubject = "Employee Onboarding Login Details - New Invitation";
      const emailHtml = `
        <h2>Welcome back to the company!</h2>
        <p>A new invitation has been sent to your email address.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Login URL:</strong> <a href="http://localhost:3000/login">http://localhost:3000/login</a></li>
          <li><strong>Email:</strong> ${employee.email}</li>
          <li><strong>New Temporary Password:</strong> ${tempPassword}</li>
        </ul>
        <p><strong>Important:</strong> Please reset your password after logging in.</p>
        <p>Best regards,<br>HR Team</p>
      `;

      await sendEmail(employee.email, emailSubject, emailHtml);
      console.log(
        "✅ Invitation email resent successfully to:",
        employee.email
      );
      emailSent = true;
    } catch (err) {
      console.error("❌ Failed to resend invitation email:", err);
      emailError = err.message;
    }

    // Log action
    await logAction(
      req.user.id,
      "invitation_email_resent",
      {
        employeeId: employee.id,
        employeeEmail: employee.email,
        employeeName: employee.name,
        emailSent: emailSent,
        emailError: emailError ? emailError.message : null,
      },
      req
    );

    // Provide response based on email status
    if (emailSent) {
      res.json({
        message: "Invitation email resent successfully!",
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
        },
        note: "New temporary password has been sent. Employee will need to reset their password on first login.",
        emailStatus: "sent",
      });
    } else {
      res.status(500).json({
        error: "Failed to resend invitation email",
        details: emailError ? emailError.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("❌ HR Debug - Resend invitation error:", error);
    res.status(500).json({ error: "Failed to resend invitation email" });
  }
});

// Update employee manager
router.patch("/employees/:id/manager", async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    // Validate manager exists and is an employee or manager
    if (managerId) {
      const managerResult = await query(
        "SELECT id, role FROM users WHERE id = $1 AND role IN ('employee', 'manager')",
        [managerId]
      );

      if (managerResult.rows.length === 0) {
        return res.status(400).json({
          error: "Invalid manager ID",
        });
      }
    }

    // Update user manager
    const result = await query(
      `UPDATE users 
       SET manager_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role = 'employee'
       RETURNING id, name, email, manager_id`,
      [managerId || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Update master_employees table
    await query(
      `UPDATE master_employees 
       SET manager_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [managerId || null, id]
    );

    // Log action
    await logAction(
      req.user.id,
      "employee_manager_updated",
      {
        employeeId: id,
        employeeName: result.rows[0].name,
        managerId: managerId || null,
      },
      req
    );

    res.json({
      message: "Employee manager updated successfully",
      employee: result.rows[0],
    });
  } catch (error) {
    console.error("Update employee manager error:", error);
    res.status(500).json({ error: "Failed to update employee manager" });
  }
});

// Delete employee (soft delete by default)
router.delete("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type = "soft" } = req.query; // "soft" or "hard"

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    if (type === "hard") {
      // Hard delete - permanently remove from database
      console.log(
        `🗑️ Hard deleting employee: ${employee.name} (${employee.email})`
      );

      // Delete from audit_logs first (no CASCADE constraint)
      await query("DELETE FROM audit_logs WHERE user_id = $1", [id]);

      // Delete from master_employees first
      await query("DELETE FROM master_employees WHERE user_id = $1", [id]);

      // Delete from users table
      await query("DELETE FROM users WHERE id = $1", [id]);

      // Note: Related data (forms, documents, attendance) will be deleted via CASCADE constraints

      console.log(`✅ Employee hard deleted successfully: ${employee.name}`);
    } else {
      // Soft delete - mark as deleted but keep data
      console.log(
        `🗑️ Soft deleting employee: ${employee.name} (${employee.email})`
      );

      // Update users table to mark as deleted
      await query(
        `UPDATE users 
         SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      // Update master_employees table to mark as deleted
      await query(
        `UPDATE master_employees 
         SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [id]
      );

      console.log(`✅ Employee soft deleted successfully: ${employee.name}`);
    }

    // Log action
    await logAction(
      req.user.id,
      type === "hard" ? "employee_hard_deleted" : "employee_soft_deleted",
      {
        employeeId: id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        deleteType: type,
      },
      req
    );

    res.json({
      message: `Employee ${
        type === "hard" ? "permanently deleted" : "deleted"
      } successfully`,
      deletedEmployee: employee,
      deleteType: type,
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

// Hard delete employee (permanently remove)
router.delete("/employees/:id/permanent", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    console.log(
      `🗑️ Hard deleting employee: ${employee.name} (${employee.email})`
    );

    // Delete from audit_logs first (no CASCADE constraint)
    await query("DELETE FROM audit_logs WHERE user_id = $1", [id]);

    // Delete from master_employees first
    await query("DELETE FROM master_employees WHERE user_id = $1", [id]);

    // Delete user
    await query("DELETE FROM users WHERE id = $1", [id]);

    // Note: Related data (forms, documents, attendance) will be deleted via CASCADE constraints

    // Log action
    await logAction(
      req.user.id,
      "employee_hard_deleted",
      {
        employeeId: id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        deleteType: "hard",
      },
      req
    );

    console.log(`✅ Employee hard deleted successfully: ${employee.name}`);

    res.json({
      message: "Employee permanently deleted successfully",
      deletedEmployee: employee,
      deleteType: "hard",
    });
  } catch (error) {
    console.error("Hard delete employee error:", error);
    res.status(500).json({ error: "Failed to permanently delete employee" });
  }
});

// Restore soft-deleted employee
router.patch("/employees/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    console.log(`🔄 Restoring employee: ${employee.name} (${employee.email})`);

    // Restore master_employees status to active
    await query(
      `UPDATE master_employees 
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [id]
    );

    // Log action
    await logAction(
      req.user.id,
      "employee_restored",
      {
        employeeId: id,
        employeeName: employee.name,
        employeeEmail: employee.email,
      },
      req
    );

    console.log(`✅ Employee restored successfully: ${employee.name}`);

    res.json({
      message: "Employee restored successfully",
      restoredEmployee: { ...employee, status: "pending" },
    });
  } catch (error) {
    console.error("Restore employee error:", error);
    res.status(500).json({ error: "Failed to restore employee" });
  }
});

// Resend credentials
router.post("/employees/:id/resend-credentials", async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee details
    const employeeResult = await query(
      "SELECT id, name, email FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Generate new temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Update password and reset first login flag
    await query(
      `UPDATE users 
       SET password_hash = $1, is_first_login = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, id]
    );

    // Send email with new credentials
    try {
      await sendEmail(
        employee.email,
        "Updated Login Credentials - Nxzen",
        `<h2>Updated Login Credentials</h2>
         <p>Hello ${employee.name},</p>
         <p>Your login credentials have been updated. Please use the following:</p>
         <p><strong>Email:</strong> ${employee.email}</p>
         <p><strong>New Temporary Password:</strong> ${tempPassword}</p>
         <p><strong>Important:</strong> You will be required to change your password on your next login.</p>
         <p>Best regards,<br>HR Team</p>`
      );
      console.log("✅ Credentials email sent successfully to:", employee.email);
    } catch (emailError) {
      console.error("❌ Failed to send credentials email:", emailError);
      return res.status(500).json({
        error: "Failed to send email with new credentials",
      });
    }

    // Log action
    await logAction(
      req.user.id,
      "credentials_resent",
      {
        employeeId: id,
        employeeName: employee.name,
        employeeEmail: employee.email,
      },
      req
    );

    res.json({
      message: "Credentials resent successfully",
      tempPassword,
    });
  } catch (error) {
    console.error("Resend credentials error:", error);
    res.status(500).json({ error: "Failed to resend credentials" });
  }
});

// Approve employee onboarding
router.put("/employees/:id/onboard", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      "🔍 HR Onboarding Debug - Starting onboarding approval for employee:",
      id
    );
    console.log("🔍 HR Onboarding Debug - HR User ID:", req.user?.id);
    console.log("🔍 HR Onboarding Debug - HR User Role:", req.user?.role);

    // Verify HR user
    if (!req.user || req.user.role !== "hr") {
      console.log("❌ HR Onboarding Debug - Unauthorized access attempt");
      return res
        .status(403)
        .json({ error: "Only HR users can approve onboarding" });
    }

    // Check if employee exists and has submitted form
    const employeeResult = await query(
      `SELECT u.id, u.name, u.email, u.form_submitted, u.onboarded, u.status
       FROM users u
       WHERE u.id = $1 AND u.role = 'employee'`,
      [id]
    );

    console.log(
      "🔍 HR Onboarding Debug - Employee query result:",
      employeeResult.rows
    );

    if (employeeResult.rows.length === 0) {
      console.log("❌ HR Onboarding Debug - Employee not found");
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];
    console.log("🔍 HR Onboarding Debug - Employee data:", employee);

    if (!employee.form_submitted) {
      console.log("❌ HR Onboarding Debug - Employee has not submitted form");
      return res.status(400).json({
        error: "Employee has not submitted onboarding form yet",
      });
    }

    if (employee.onboarded) {
      console.log("❌ HR Onboarding Debug - Employee already onboarded");
      return res.status(400).json({
        error: "Employee is already onboarded",
      });
    }

    console.log(
      "✅ HR Onboarding Debug - All checks passed, proceeding with onboarding..."
    );

    // Update employee as approved by HR
    console.log("🔍 HR Onboarding Debug - Updating users table...");
    await query(
      `UPDATE users 
       SET hr_approved = true, onboarded = true, status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    console.log("✅ HR Onboarding Debug - Users table updated successfully");

    // Update master_employees table
    console.log("🔍 HR Onboarding Debug - Updating master_employees table...");
    await query(
      `UPDATE master_employees 
       SET onboarded = true, status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [id]
    );
    console.log(
      "✅ HR Onboarding Debug - Master employees table updated successfully"
    );

    // Send onboarding approval email
    try {
      await sendEmail(
        employee.email,
        "Onboarding Approved - Welcome to Nxzen!",
        `<h2>Onboarding Approved!</h2>
         <p>Hello ${employee.name},</p>
         <p>Congratulations! Your onboarding has been approved by HR.</p>
         <p>You can now access the Attendance Portal and start marking your daily attendance.</p>
         <p>Please log in with your credentials and navigate to the Attendance Portal.</p>
         <p>Best regards,<br>HR Team</p>`
      );
      console.log(
        "✅ Onboarding approval email sent successfully to:",
        employee.email
      );
    } catch (emailError) {
      console.error("❌ Failed to send onboarding approval email:", emailError);
      // Don't fail the request if email fails
    }

    // Log action
    try {
      await logAction(
        req.user.id,
        "employee_onboarded",
        {
          employeeId: id,
          employeeName: employee.name,
          employeeEmail: employee.email,
        },
        req
      );
      console.log("✅ HR Onboarding Debug - Action logged successfully");
    } catch (logError) {
      console.error("❌ HR Onboarding Debug - Failed to log action:", logError);
      // Don't fail the request if logging fails
    }

    console.log(
      "✅ HR Onboarding Debug - Onboarding approval completed successfully"
    );
    res.json({
      message: "Employee onboarding approved successfully",
      employee: { ...employee, onboarded: true, status: "approved" },
    });
  } catch (error) {
    console.error("Approve onboarding error:", error);
    res.status(500).json({ error: "Failed to approve onboarding" });
  }
});

// Reject employee onboarding
router.put(
  "/employees/:id/reject-onboarding",
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      console.log(
        "🔍 HR Onboarding Debug - Starting onboarding rejection for employee:",
        id
      );
      console.log("🔍 HR Onboarding Debug - HR User ID:", req.user?.id);
      console.log("🔍 HR Onboarding Debug - HR User Role:", req.user?.role);

      // Check if user is HR
      if (req.user?.role !== "hr") {
        console.log("❌ HR Onboarding Debug - Unauthorized access attempt");
        return res
          .status(403)
          .json({ error: "Only HR users can reject onboarding" });
      }

      // Get employee details
      const result = await query(
        `SELECT u.id, u.name, u.email, u.form_submitted, u.onboarded, u.status
       FROM users u
       WHERE u.id = $1 AND u.role = 'employee'`,
        [id]
      );

      if (result.rows.length === 0) {
        console.log("❌ HR Onboarding Debug - Employee not found");
        return res.status(404).json({ error: "Employee not found" });
      }

      const employee = result.rows[0];
      console.log("🔍 HR Onboarding Debug - Employee data:", employee);

      if (!employee.form_submitted) {
        console.log("❌ HR Onboarding Debug - Employee has not submitted form");
        return res.status(400).json({
          error: "Employee has not submitted onboarding form yet",
        });
      }

      if (employee.onboarded) {
        console.log("❌ HR Onboarding Debug - Employee already onboarded");
        return res.status(400).json({
          error: "Employee is already onboarded",
        });
      }

      console.log(
        "✅ HR Onboarding Debug - All checks passed, proceeding with onboarding rejection..."
      );

      // Update employee as rejected
      console.log("🔍 HR Onboarding Debug - Updating users table...");
      await query(
        `UPDATE users 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
        [id]
      );
      console.log("✅ HR Onboarding Debug - Users table updated successfully");

      // Update master_employees table if exists
      console.log(
        "🔍 HR Onboarding Debug - Updating master_employees table..."
      );
      await query(
        `UPDATE master_employees 
       SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
        [id]
      );
      console.log(
        "✅ HR Onboarding Debug - Master employees table updated successfully"
      );

      // Send onboarding rejection email
      try {
        const emailError = await sendEmail(
          employee.email,
          "Onboarding Rejected - Next Steps",
          `<h2>Onboarding Status Update</h2>
         <p>Dear ${employee.name},</p>
         <p>Your onboarding application has been reviewed and unfortunately, it has been rejected by HR.</p>
         <p>Please contact HR for more details about the rejection and what steps you can take next.</p>
         <p>Best regards,<br>HR Team</p>`
        );
        console.log(
          "✅ Onboarding rejection email sent successfully to:",
          employee.email
        );
      } catch (emailError) {
        console.error(
          "❌ Failed to send onboarding rejection email:",
          emailError
        );
      }

      // Log the action
      try {
        await query(
          `INSERT INTO audit_logs (user_id, action, details, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [
            id,
            "onboarding_rejected",
            `Onboarding rejected by HR user ${req.user.id}`,
          ]
        );
        console.log("✅ HR Onboarding Debug - Action logged successfully");
      } catch (logError) {
        console.error(
          "❌ HR Onboarding Debug - Failed to log action:",
          logError
        );
      }

      console.log(
        "✅ HR Onboarding Debug - Onboarding rejection completed successfully"
      );

      res.json({
        message: "Employee onboarding rejected successfully",
        employee: { ...employee, status: "rejected" },
      });
    } catch (error) {
      console.error("Reject onboarding error:", error);
      res.status(500).json({ error: "Failed to reject onboarding" });
    }
  }
);

// Get employee onboarding status for HR
router.get("/employees/:id/onboarding-status", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.name, u.email, u.form_submitted, u.onboarded, u.status, u.employee_type, u.department,
               ed.id as form_id, ed.created_at as form_created_at, ed.updated_at as form_updated_at
        FROM users u
        LEFT JOIN employee_details ed ON u.id = ed.user_id
        WHERE u.id = $1 AND u.role = 'employee'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = result.rows[0];

    res.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        formSubmitted: employee.form_submitted || false,
        onboarded: employee.onboarded || false,
        status: employee.status,
        employeeType: employee.employee_type,
        department: employee.department,
        hasForm: !!employee.form_id,
        formCreatedAt: employee.form_created_at,
        formUpdatedAt: employee.form_updated_at,
      },
    });
  } catch (error) {
    console.error("Get onboarding status error:", error);
    res.status(500).json({ error: "Failed to get onboarding status" });
  }
});

// Get employee onboarding forms
router.get("/employee-forms", async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let queryText = `
      SELECT DISTINCT u.id, u.name, u.email, u.employee_type, u.department, u.created_at,
             ed.id as form_id, ed.created_at as form_created_at, ed.updated_at as form_updated_at,
             COALESCE(ed.status, 'pending') as form_status,
             COALESCE(doc_counts.document_count, 0) as document_count
      FROM users u
      INNER JOIN employee_details ed ON u.id = ed.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as document_count
        FROM employee_documents
        GROUP BY user_id
      ) doc_counts ON u.id = doc_counts.user_id
      WHERE u.role = 'employee' AND ed.id IS NOT NULL
    `;
    let queryParams = [];
    let paramCount = 0;

    // Status filtering removed - forms no longer have status

    if (search) {
      paramCount++;
      queryText += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get total count first
    let countQuery = `
      SELECT COUNT(*) 
      FROM users u
      INNER JOIN employee_details ed ON u.id = ed.user_id
      WHERE u.role = 'employee' AND ed.id IS NOT NULL
    `;

    if (search) {
      countQuery += ` AND (u.name ILIKE $1 OR u.email ILIKE $1)`;
    }

    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    queryText +=
      " ORDER BY u.created_at DESC LIMIT $" +
      (paramCount + 1) +
      " OFFSET $" +
      (paramCount + 2);
    queryParams.push(limitNum, offset);

    const result = await query(queryText, queryParams);

    console.log("🔍 Backend Debug - Forms query result:", {
      totalForms: result.rows.length,
      allForms: result.rows.map((row) => ({
        userId: row.id,
        formId: row.form_id,
        name: row.name,
        email: row.email,
      })),
    });

    const pages = Math.ceil(total / limitNum);

    res.json({
      forms: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: pages,
      },
    });
  } catch (error) {
    console.error("Get employee forms error:", error);
    res.status(500).json({ error: "Failed to fetch employee forms" });
  }
});

// Get specific employee form
router.get("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find form by form_id first, then by user_id
    let formResult = await query(
      `SELECT ed.*, u.name, u.email, u.employee_type, u.department
       FROM employee_details ed
       JOIN users u ON ed.user_id = u.id
       WHERE ed.id = $1`,
      [id]
    );

    // If not found by form_id, try by user_id
    if (formResult.rows.length === 0) {
      formResult = await query(
        `SELECT ed.*, u.name, u.email, u.employee_type, u.department
         FROM employee_details ed
         JOIN users u ON ed.user_id = u.id
         WHERE u.id = $1`,
        [id]
      );
    }

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    const form = formResult.rows[0];

    // Get uploaded documents for this employee
    const documentsResult = await query(
      `SELECT document_type, file_name, file_path, file_size, mime_type, is_required, created_at
       FROM employee_documents 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [form.user_id]
    );

    const documents = documentsResult.rows.map((doc) => ({
      documentType: doc.document_type,
      fileName: doc.file_name,
      filePath: doc.file_path,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      isRequired: doc.is_required,
      createdAt: doc.created_at,
      downloadUrl: `/uploads/${doc.file_path.split("/").pop()}`, // Extract filename from path
    }));

    // Transform snake_case to camelCase for frontend
    const transformedForm = {
      id: form.id,
      userId: form.user_id,
      personalInfo: form.personal_info || {},
      bankInfo: form.bank_info || {},
      aadharNumber: form.aadhar_number || "",
      panNumber: form.pan_number || "",
      passportNumber: form.passport_number || "",
      educationInfo: form.education_info || {},
      techCertificates: form.tech_certificates || {},
      photoUrl: form.photo_url || "",
      workExperience: form.work_experience || {},
      contractPeriod: form.contract_period || {},
      joinDate: form.join_date || "",
      createdAt: form.created_at,
      updatedAt: form.updated_at,
      documents: documents, // Include uploaded documents
      employee: {
        name: form.name,
        email: form.email,
        employeeType: form.employee_type,
        department: form.department,
      },
    };

    res.json({ form: transformedForm });
  } catch (error) {
    console.error("Get employee form error:", error);
    res.status(500).json({ error: "Failed to fetch employee form" });
  }
});

// Update employee form
router.put("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if form exists
    const formExists = await query(
      "SELECT id FROM employee_details WHERE id = $1",
      [id]
    );

    if (formExists.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramCount = 0;

    const allowedFields = [
      "personal_info",
      "bank_info",
      "aadhar_number",
      "pan_number",
      "passport_number",
      "education_info",
      "tech_certificates",
      "work_experience",
      "contract_period",
      "join_date",
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        params.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Add updated_at and id to params
    paramCount++;
    updates.push("updated_at = CURRENT_TIMESTAMP");
    paramCount++;
    params.push(id);

    // Update the form
    await query(
      `UPDATE employee_details SET ${updates.join(
        ", "
      )} WHERE id = $${paramCount}`,
      params
    );

    // Log action
    await logAction(
      req.user.id,
      "employee_form_updated",
      {
        formId: id,
        updatedFields: Object.keys(updateData),
      },
      req
    );

    res.json({ message: "Employee form updated successfully" });
  } catch (error) {
    console.error("Update employee form error:", error);
    res.status(500).json({ error: "Failed to update employee form" });
  }
});

// Update employee form status
// Form status functionality has been removed

// Delete employee form
router.delete("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔍 Delete Debug - Attempting to delete form with ID:", id);

    // Check if form exists
    const formExists = await query(
      "SELECT id FROM employee_details WHERE id = $1",
      [id]
    );

    console.log("🔍 Delete Debug - Form exists check result:", {
      formId: id,
      found: formExists.rows.length > 0,
      rows: formExists.rows,
    });

    if (formExists.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Delete the form
    await query("DELETE FROM employee_details WHERE id = $1", [id]);

    // Log action
    await logAction(
      req.user.id,
      "employee_form_deleted",
      {
        formId: id,
      },
      req
    );

    res.json({ message: "Employee form deleted successfully" });
  } catch (error) {
    console.error("Delete employee form error:", error);
    res.status(500).json({ error: "Failed to delete employee form" });
  }
});

// Add onboarded employee to master table (after Employee ID and manager assignment)
router.post("/employees/:id/add-to-master", async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId, employeeId } = req.body;

    // Check if employee exists and is onboarded
    const employeeResult = await query(
      `SELECT id, name, email, employee_type, department, onboarded, manager_id, join_date
       FROM users 
       WHERE id = $1 AND role = 'employee'`,
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Check if employee is onboarded
    if (!employee.onboarded) {
      return res.status(400).json({
        error: "Employee must be onboarded before adding to master table",
        currentStatus: employee.onboarded ? "onboarded" : "not onboarded",
      });
    }

    // Check if employee already exists in master table
    const existingMaster = await query(
      "SELECT id FROM master_employees WHERE user_id = $1",
      [id]
    );

    if (existingMaster.rows.length > 0) {
      return res.status(400).json({
        error: "Employee is already in master table",
      });
    }

    // Validate Employee ID (6 digits)
    if (!employeeId) {
      return res.status(400).json({
        error: "Employee ID is required",
      });
    }

    if (!/^\d{6}$/.test(employeeId)) {
      return res.status(400).json({
        error: "Employee ID must be exactly 6 digits",
      });
    }

    // Check if Employee ID already exists in master table
    const existingEmployeeId = await query(
      "SELECT id FROM master_employees WHERE employee_id = $1",
      [employeeId]
    );

    if (existingEmployeeId.rows.length > 0) {
      return res.status(400).json({
        error: "Employee ID already exists in master table",
      });
    }

    // Validate manager assignment
    if (!managerId) {
      return res.status(400).json({
        error: "Manager must be assigned before adding to master table",
      });
    }

    // Verify manager exists and is valid
    const managerResult = await query(
      `SELECT u.id as user_id, u.name, u.role, me.id as master_id 
       FROM users u 
       LEFT JOIN master_employees me ON u.id = me.user_id 
       WHERE u.id = $1 AND (u.role = 'hr' OR u.role = 'employee')`,
      [managerId]
    );

    if (managerResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid manager ID" });
    }

    const manager = managerResult.rows[0];
    if (!manager.master_id) {
      return res.status(400).json({
        error: "Manager must be in master employees table first",
      });
    }

    // Add employee to master_employees table with the new Employee ID field
    await query(
      `INSERT INTO master_employees (user_id, employee_id, name, email, employee_type, role, status, department, join_date, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        employee.id,
        employeeId, // New 6-digit Employee ID
        employee.name,
        employee.email,
        employee.employee_type,
        "employee",
        "active", // Set status to active in master table
        employee.department,
        employee.join_date,
        manager.master_id, // Use master_employees.id instead of user_id
      ]
    );

    // Update user's manager_id if not already set
    if (!employee.manager_id) {
      await query(
        "UPDATE users SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [managerId, id]
      );
    }

    // Log action
    await logAction(
      req.user.id,
      "employee_added_to_master",
      {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        assignedEmployeeId: employeeId,
        managerId: managerId,
        managerName: managerResult.rows[0].name,
      },
      req
    );

    console.log(
      `✅ Employee ${employee.name} (ID: ${employeeId}) added to master table with manager ${managerResult.rows[0].name}`
    );

    res.json({
      message: "Employee successfully added to master table",
      employee: {
        ...employee,
        employee_id: employeeId,
        manager_id: managerId,
        manager_name: managerResult.rows[0].name,
      },
      masterTableStatus: "active",
    });
  } catch (error) {
    console.error("Add to master table error:", error);
    res.status(500).json({ error: "Failed to add employee to master table" });
  }
});

// Get onboarded employees (not yet in master table)
router.get("/onboarded-employees", async (req, res) => {
  try {
    const result = await query(`
      SELECT u.id, u.name, u.email, u.employee_type, u.department, 
             u.manager_id, u.join_date, u.created_at,
             m.name as manager_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.role = 'employee' 
        AND u.onboarded = true
        AND (u.id NOT IN (
          SELECT user_id FROM master_employees WHERE user_id IS NOT NULL
        ) OR NOT EXISTS (
          SELECT 1 FROM master_employees WHERE user_id = u.id
        ))
      ORDER BY u.created_at DESC
    `);

    res.json({
      onboardedEmployees: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get onboarded employees error:", error);
    res.status(500).json({ error: "Failed to fetch onboarded employees" });
  }
});

// Get departments list
router.get("/departments", async (req, res) => {
  try {
    const result = await query(
      "SELECT DISTINCT department FROM users WHERE role = 'employee' AND department IS NOT NULL ORDER BY department"
    );

    res.json({
      departments: result.rows.map((row) => row.department),
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

// Update form status
router.patch("/employee-forms/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log("🔍 HR Debug - Updating form status:", {
      formId: id,
      newStatus: status,
    });

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    // Check if form exists in employee_details table
    const formExists = await query(
      "SELECT id FROM employee_details WHERE id = $1",
      [id]
    );

    if (formExists.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    // First, try to add status column if it doesn't exist
    try {
      await query(
        "ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'"
      );
      await query(
        "ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP"
      );
      await query(
        "ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS approved_by UUID"
      );
      console.log("✅ Added status columns to employee_details table");
    } catch (alterError) {
      console.log(
        "ℹ️ Status columns already exist or couldn't be added:",
        alterError.message
      );
    }

    // Update the form status in employee_details table
    let approvedAt = null;
    let approvedBy = null;

    if (status === "approved") {
      approvedAt = new Date();
      approvedBy = req.user.id;
    }

    const updateResult = await query(
      `UPDATE employee_details 
       SET status = $1, 
           updated_at = CURRENT_TIMESTAMP,
           approved_at = $2,
           approved_by = $3
       WHERE id = $4
       RETURNING id, status, updated_at, approved_at, approved_by`,
      [status, approvedAt, approvedBy, id]
    );

    // If form is approved, also update the user's onboarded status
    if (status === "approved") {
      // Get the user_id from the form
      const formUserResult = await query(
        "SELECT user_id FROM employee_details WHERE id = $1",
        [id]
      );

      if (formUserResult.rows.length > 0) {
        const userId = formUserResult.rows[0].user_id;

        // Update the user's status fields
        await query(
          "UPDATE users SET hr_approved = true, onboarded = true WHERE id = $1",
          [userId]
        );

        console.log(
          "✅ User status updated for user ID:",
          userId,
          "- hr_approved: true, onboarded: true"
        );
      }
    }

    console.log("✅ Form status updated successfully:", updateResult.rows[0]);

    res.json({
      message: "Form status updated successfully",
      form: updateResult.rows[0],
    });
  } catch (error) {
    console.error("❌ Update form status error:", error);
    res.status(500).json({ error: "Failed to update form status" });
  }
});

// Get HR dashboard statistics
router.get("/statistics", async (req, res) => {
  try {
    // Total employees
    const totalEmployeesResult = await query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'employee'"
    );

    // Employees by department
    const departmentResult = await query(
      "SELECT department, COUNT(*) as count FROM users WHERE role = 'employee' AND department IS NOT NULL GROUP BY department"
    );

    // Forms submitted
    const formsResult = await query(
      "SELECT COUNT(*) as total FROM employee_details"
    );

    const statistics = {
      totalEmployees: parseInt(totalEmployeesResult.rows[0].total),
      totalForms: parseInt(formsResult.rows[0].total),
      byDepartment: {},
    };

    departmentResult.rows.forEach((row) => {
      statistics.byDepartment[row.department] = parseInt(row.count);
    });

    res.json(statistics);
  } catch (error) {
    console.error("Get HR statistics error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;
