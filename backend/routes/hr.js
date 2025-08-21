const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/database");
const {
  authenticate,
  authorize,
  logAction,
} = require("../middleware/auth");
const { sendEmail } = require("../services/emailService");

const router = express.Router();

// Apply authentication and authorization to all HR routes
router.use(authenticate);
router.use(authorize(["hr"]));

// Create new employee
router.post("/employees", async (req, res) => {
  try {
    const {
      name,
      email,
      employeeType,
      department,
      managerId,
      joinDate,
    } = req.body;

    // Validate required fields
    if (!name || !email || !employeeType || !department) {
      return res.status(400).json({
        error: "Name, email, employee type, and department are required",
      });
    }

    // Check if email already exists
    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "Employee with this email already exists",
      });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, employee_type, department, manager_id, join_date, status, is_first_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email, employee_type, department, status`,
      [
        name,
        email.toLowerCase(),
        hashedPassword,
        "employee",
        employeeType,
        department,
        managerId || null,
        joinDate || null,
        "pending",
        true,
      ]
    );

    const newUser = userResult.rows[0];

    // Add to master_employees table
    await query(
      `INSERT INTO master_employees (user_id, name, email, employee_type, role, status, department, join_date, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newUser.id,
        newUser.name,
        newUser.email,
        newUser.employee_type,
        "employee",
        newUser.status,
        newUser.department,
        joinDate || null,
        managerId || null,
      ]
    );

    // Send email with credentials
    try {
      await sendEmail({
        to: newUser.email,
        subject: "Welcome to Company - Your Login Credentials",
        html: `
          <h2>Welcome to Company!</h2>
          <p>Hello ${newUser.name},</p>
          <p>Your account has been created successfully. Please use the following credentials to log in:</p>
          <p><strong>Email:</strong> ${newUser.email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>Important:</strong> You will be required to change your password on your first login.</p>
          <p>Please complete your onboarding form and submit it for approval.</p>
          <p>Best regards,<br>HR Team</p>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    // Log action
    await logAction(req.user.id, "employee_created", {
      employeeId: newUser.id,
      employeeEmail: newUser.email,
      employeeType: newUser.employee_type,
      department: newUser.department,
    }, req);

    res.status(201).json({
      message: "Employee created successfully",
      employee: newUser,
      tempPassword,
    });
  } catch (error) {
    console.error("Create employee error:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// Get all employees
router.get("/employees", async (req, res) => {
  try {
    const { status, department, search } = req.query;

    let queryText = `
      SELECT u.id, u.name, u.email, u.employee_type, u.department, u.status, u.created_at,
             u.manager_id, m.name as manager_name
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.role = 'employee'
    `;
    let queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryText += ` AND u.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (department) {
      paramCount++;
      queryText += ` AND u.department = $${paramCount}`;
      queryParams.push(department);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    queryText += " ORDER BY u.created_at DESC";

    const result = await query(queryText, queryParams);

    res.json({
      employees: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
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

// Update employee status
router.patch("/employees/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "active", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be pending, active, or rejected",
      });
    }

    // Update user status
    const result = await query(
      `UPDATE users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role = 'employee'
       RETURNING id, name, email, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Update master_employees table
    await query(
      `UPDATE master_employees 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [status, id]
    );

    const employee = result.rows[0];

    // Send email notification
    if (status === "active") {
      try {
        await sendEmail({
          to: employee.email,
          subject: "Account Approved - Welcome to Company!",
          html: `
            <h2>Account Approved!</h2>
            <p>Hello ${employee.name},</p>
            <p>Your account has been approved! You can now access the attendance portal.</p>
            <p>Please log in with your credentials and start marking your attendance.</p>
            <p>Best regards,<br>HR Team</p>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
      }
    } else if (status === "rejected") {
      try {
        await sendEmail({
          to: employee.email,
          subject: "Account Status Update",
          html: `
            <h2>Account Status Update</h2>
            <p>Hello ${employee.name},</p>
            <p>Your account has been rejected. Please contact HR for more information.</p>
            <p>Best regards,<br>HR Team</p>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
      }
    }

    // Log action
    await logAction(req.user.id, "employee_status_updated", {
      employeeId: id,
      employeeName: employee.name,
      oldStatus: employee.status,
      newStatus: status,
    }, req);

    res.json({
      message: "Employee status updated successfully",
      employee: { ...employee, status },
    });
  } catch (error) {
    console.error("Update employee status error:", error);
    res.status(500).json({ error: "Failed to update employee status" });
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
    await logAction(req.user.id, "employee_manager_updated", {
      employeeId: id,
      employeeName: result.rows[0].name,
      managerId: managerId || null,
    }, req);

    res.json({
      message: "Employee manager updated successfully",
      employee: result.rows[0],
    });
  } catch (error) {
    console.error("Update employee manager error:", error);
    res.status(500).json({ error: "Failed to update employee manager" });
  }
});

// Delete employee
router.delete("/employees/:id", async (req, res) => {
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

    // Delete from master_employees first
    await query("DELETE FROM master_employees WHERE user_id = $1", [id]);

    // Delete user
    await query("DELETE FROM users WHERE id = $1", [id]);

    // Log action
    await logAction(req.user.id, "employee_deleted", {
      employeeId: id,
      employeeName: employee.name,
      employeeEmail: employee.email,
    }, req);

    res.json({
      message: "Employee deleted successfully",
      deletedEmployee: employee,
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ error: "Failed to delete employee" });
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
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
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
      await sendEmail({
        to: employee.email,
        subject: "Updated Login Credentials - Company",
        html: `
          <h2>Updated Login Credentials</h2>
          <p>Hello ${employee.name},</p>
          <p>Your login credentials have been updated. Please use the following:</p>
          <p><strong>Email:</strong> ${employee.email}</p>
          <p><strong>New Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>Important:</strong> You will be required to change your password on your next login.</p>
          <p>Best regards,<br>HR Team</p>
        `,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      return res.status(500).json({
        error: "Failed to send email with new credentials",
      });
    }

    // Log action
    await logAction(req.user.id, "credentials_resent", {
      employeeId: id,
      employeeName: employee.name,
      employeeEmail: employee.email,
    }, req);

    res.json({
      message: "Credentials resent successfully",
      tempPassword,
    });
  } catch (error) {
    console.error("Resend credentials error:", error);
    res.status(500).json({ error: "Failed to resend credentials" });
  }
});

// Get employee onboarding forms
router.get("/employee-forms", async (req, res) => {
  try {
    const { status, search } = req.query;

    let queryText = `
      SELECT u.id, u.name, u.email, u.employee_type, u.department, u.status, u.created_at,
             ed.id as form_id, ed.created_at as form_created_at, ed.updated_at as form_updated_at
      FROM users u
      LEFT JOIN employee_details ed ON u.id = ed.user_id
      WHERE u.role = 'employee'
    `;
    let queryParams = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryText += ` AND u.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    queryText += " ORDER BY u.created_at DESC";

    const result = await query(queryText, queryParams);

    res.json({
      forms: result.rows,
      total: result.rows.length,
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

    const formResult = await query(
      `SELECT ed.*, u.name, u.email, u.employee_type, u.department, u.status
       FROM employee_details ed
       JOIN users u ON ed.user_id = u.id
       WHERE ed.id = $1`,
      [id]
    );

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    const form = formResult.rows[0];

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
      employee: {
        name: form.name,
        email: form.email,
        employeeType: form.employee_type,
        department: form.department,
        status: form.status,
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
      "personal_info", "bank_info", "aadhar_number", "pan_number", "passport_number",
      "education_info", "tech_certificates", "work_experience", "contract_period", "join_date"
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
      `UPDATE employee_details SET ${updates.join(", ")} WHERE id = $${paramCount}`,
      params
    );

    // Log action
    await logAction(req.user.id, "employee_form_updated", {
      formId: id,
      updatedFields: Object.keys(updateData),
    }, req);

    res.json({ message: "Employee form updated successfully" });
  } catch (error) {
    console.error("Update employee form error:", error);
    res.status(500).json({ error: "Failed to update employee form" });
  }
});

// Delete employee form
router.delete("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if form exists
    const formExists = await query(
      "SELECT id FROM employee_details WHERE id = $1",
      [id]
    );

    if (formExists.rows.length === 0) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Delete the form
    await query("DELETE FROM employee_details WHERE id = $1", [id]);

    // Log action
    await logAction(req.user.id, "employee_form_deleted", {
      formId: id,
    }, req);

    res.json({ message: "Employee form deleted successfully" });
  } catch (error) {
    console.error("Delete employee form error:", error);
    res.status(500).json({ error: "Failed to delete employee form" });
  }
});

// Get departments list
router.get("/departments", async (req, res) => {
  try {
    const result = await query(
      "SELECT DISTINCT department FROM users WHERE role = 'employee' AND department IS NOT NULL ORDER BY department"
    );

    res.json({
      departments: result.rows.map(row => row.department),
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

// Get HR dashboard statistics
router.get("/statistics", async (req, res) => {
  try {
    // Total employees
    const totalEmployeesResult = await query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'employee'"
    );

    // Employees by status
    const statusResult = await query(
      "SELECT status, COUNT(*) as count FROM users WHERE role = 'employee' GROUP BY status"
    );

    // Employees by department
    const departmentResult = await query(
      "SELECT department, COUNT(*) as count FROM users WHERE role = 'employee' AND department IS NOT NULL GROUP BY department"
    );

    // Forms submitted
    const formsResult = await query(
      "SELECT COUNT(*) as total FROM employee_details"
    );

    // Pending approvals
    const pendingResult = await query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'employee' AND status = 'pending'"
    );

    const statistics = {
      totalEmployees: parseInt(totalEmployeesResult.rows[0].total),
      totalForms: parseInt(formsResult.rows[0].total),
      pendingApprovals: parseInt(pendingResult.rows[0].total),
      byStatus: {},
      byDepartment: {},
    };

    statusResult.rows.forEach(row => {
      statistics.byStatus[row.status] = parseInt(row.count);
    });

    departmentResult.rows.forEach(row => {
      statistics.byDepartment[row.department] = parseInt(row.count);
    });

    res.json(statistics);
  } catch (error) {
    console.error("Get HR statistics error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

module.exports = router;
