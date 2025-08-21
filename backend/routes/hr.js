const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { query } = require("../config/database");
const {
  authenticate,
  requireHRorAdmin,
  logAction,
} = require("../middleware/auth");
const {
  sendEmployeeCredentials,
  sendNotificationEmail,
} = require("../services/emailService");

const router = express.Router();

// Apply authentication to all HR routes
router.use(authenticate);
router.use(requireHRorAdmin);

// Create new employee account
router.post("/employees", async (req, res) => {
  try {
    const { name, email, employeeType, managerId } = req.body;

    // Validate input
    if (!name || !email || !employeeType) {
      return res
        .status(400)
        .json({ error: "Name, email, and employee type are required" });
    }

    if (!["intern", "contract", "fulltime"].includes(employeeType)) {
      return res.status(400).json({ error: "Invalid employee type" });
    }

    // Check if email already exists
    const existingUser = await query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generate random password
    const password =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-4);
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, employee_type, manager_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, employee_type, manager_id, status`,
      [
        name,
        email.toLowerCase(),
        passwordHash,
        "employee",
        employeeType,
        managerId || null,
        "pending",
      ]
    );

    const newUser = userResult.rows[0];

    // Create employee details record
    await query(
      `INSERT INTO employee_details (user_id)
       VALUES ($1)`,
      [newUser.id]
    );

    // Send email with credentials
    try {
      await sendEmployeeCredentials(email, name, { email, password });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Continue even if email fails
    }

    // Log action
    await logAction(
      req.user.id,
      "employee_created",
      {
        employee_id: newUser.id,
        employee_email: email,
        employee_type: employeeType,
      },
      req
    );

    res.status(201).json({
      message: "Employee created successfully",
      employee: newUser,
      credentials: { email, password },
    });
  } catch (error) {
    console.error("Create employee error:", error);
    res.status(500).json({ error: "Failed to create employee" });
  }
});

// Get all employees
router.get("/employees", async (req, res) => {
  try {
    const { status, employeeType, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    // Build WHERE clause for filtering
    let whereClause = "WHERE u.role = 'employee'";
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND u.status = $${paramCount}`;
      params.push(status);
    }

    if (employeeType) {
      paramCount++;
      whereClause += ` AND u.employee_type = $${paramCount}`;
      params.push(employeeType);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get employees with pagination
    const paginationParams = [...params, parseInt(limit), parseInt(offset)];

    const employeesResult = await query(
      `SELECT u.id, u.name, u.email, u.employee_type, u.manager_id, u.status, u.created_at,
              m.name as manager_name
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      paginationParams
    );

    res.json({
      employees: employeesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({ error: "Failed to get employees" });
  }
});

// Get employee details
router.get("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const employeeResult = await query(
      `SELECT u.id, u.name, u.email, u.employee_type, u.manager_id, u.status, u.created_at,
              m.name as manager_name,
              ed.*
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN employee_details ed ON u.id = ed.user_id
       WHERE u.id = $1 AND u.role = 'employee'`,
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ employee: employeeResult.rows[0] });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({ error: "Failed to get employee" });
  }
});

// Update employee details
router.put("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if employee exists
    const employeeExists = await query(
      "SELECT id FROM users WHERE id = $1 AND role = $2",
      [id, "employee"]
    );

    if (employeeExists.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Update user table
    const userUpdates = [];
    const userParams = [];
    let paramCount = 0;

    if (updateData.name) {
      paramCount++;
      userUpdates.push(`name = $${paramCount}`);
      userParams.push(updateData.name);
    }

    if (updateData.employeeType) {
      paramCount++;
      userUpdates.push(`employee_type = $${paramCount}`);
      userParams.push(updateData.employeeType);
    }

    if (updateData.managerId !== undefined) {
      paramCount++;
      userUpdates.push(`manager_id = $${paramCount}`);
      userParams.push(updateData.managerId);
    }

    if (userUpdates.length > 0) {
      paramCount++;
      userParams.push(id);
      await query(
        `UPDATE users SET ${userUpdates.join(
          ", "
        )}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount}`,
        userParams
      );
    }

    // Update employee details table
    if (updateData.employeeDetails) {
      const detailsResult = await query(
        "SELECT id FROM employee_details WHERE user_id = $1",
        [id]
      );

      if (detailsResult.rows.length > 0) {
        // Update existing record
        await query(
          `UPDATE employee_details SET 
           personal_info = COALESCE($1, personal_info),
           bank_info = COALESCE($2, bank_info),
           aadhar_number = COALESCE($3, aadhar_number),
           pan_number = COALESCE($4, pan_number),
           passport_number = COALESCE($5, passport_number),
           education_info = COALESCE($6, education_info),
           tech_certificates = COALESCE($7, tech_certificates),
           photo_url = COALESCE($8, photo_url),
           work_experience = COALESCE($9, work_experience),
           contract_period = COALESCE($10, contract_period),
           join_date = COALESCE($11, join_date),
           updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $12`,
          [
            updateData.employeeDetails.personal_info,
            updateData.employeeDetails.bank_info,
            updateData.employeeDetails.aadhar_number,
            updateData.employeeDetails.pan_number,
            updateData.employeeDetails.passport_number,
            updateData.employeeDetails.education_info,
            updateData.employeeDetails.tech_certificates,
            updateData.employeeDetails.photo_url,
            updateData.employeeDetails.work_experience,
            updateData.employeeDetails.contract_period,
            updateData.employeeDetails.join_date,
            id,
          ]
        );
      } else {
        // Create new record
        await query(
          `INSERT INTO employee_details (
           user_id, personal_info, bank_info, aadhar_number, pan_number, passport_number,
           education_info, tech_certificates, photo_url, work_experience, contract_period, join_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            id,
            updateData.employeeDetails.personal_info,
            updateData.employeeDetails.bank_info,
            updateData.employeeDetails.aadhar_number,
            updateData.employeeDetails.pan_number,
            updateData.employeeDetails.passport_number,
            updateData.employeeDetails.education_info,
            updateData.employeeDetails.tech_certificates,
            updateData.employeeDetails.photo_url,
            updateData.employeeDetails.work_experience,
            updateData.employeeDetails.contract_period,
            updateData.employeeDetails.join_date,
          ]
        );
      }
    }

    // Log action
    await logAction(req.user.id, "employee_updated", { employee_id: id }, req);

    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// Approve/Reject employee
router.patch("/employees/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Status must be either approved or rejected" });
    }

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email, status FROM users WHERE id = $1 AND role = $2",
      [id, "employee"]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    if (employee.status === status) {
      return res.status(400).json({ error: `Employee is already ${status}` });
    }

    // Update status
    await query(
      "UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [status, id]
    );

    // Send notification email
    try {
      const subject = `Employee Account ${
        status.charAt(0).toUpperCase() + status.slice(1)
      }`;
      const message = `Dear ${
        employee.name
      },\n\nYour employee account has been ${status}. ${
        reason ? `Reason: ${reason}` : ""
      }\n\nPlease contact HR if you have any questions.`;

      await sendNotificationEmail(employee.email, subject, message);
    } catch (emailError) {
      console.error("Failed to send notification email:", emailError);
    }

    // Log action
    await logAction(
      req.user.id,
      "employee_status_changed",
      {
        employee_id: id,
        old_status: employee.status,
        new_status: status,
        reason,
      },
      req
    );

    res.json({ message: `Employee ${status} successfully` });
  } catch (error) {
    console.error("Update employee status error:", error);
    res.status(500).json({ error: "Failed to update employee status" });
  }
});

// Assign manager to employee
router.patch("/employees/:id/manager", async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({ error: "Manager ID is required" });
    }

    // Check if employee exists
    const employeeExists = await query(
      "SELECT id FROM users WHERE id = $1 AND role = $2",
      [id, "employee"]
    );

    if (employeeExists.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if manager exists and is HR or Admin
    const managerExists = await query(
      "SELECT id, name FROM users WHERE id = $1 AND role IN ($2, $3)",
      [managerId, "hr", "admin"]
    );

    if (managerExists.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "Manager not found or not approved" });
    }

    // Update manager
    await query(
      "UPDATE users SET manager_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [managerId, id]
    );

    // Log action
    await logAction(
      req.user.id,
      "manager_assigned",
      {
        employee_id: id,
        manager_id: managerId,
        manager_name: managerExists.rows[0].name,
      },
      req
    );

    res.json({ message: "Manager assigned successfully" });
  } catch (error) {
    console.error("Assign manager error:", error);
    res.status(500).json({ error: "Failed to assign manager" });
  }
});

// Get managers (approved employees or HR users)
router.get("/managers", async (req, res) => {
  try {
    const managersResult = await query(
      `SELECT id, name, email, role, employee_type
       FROM users 
       WHERE (role = 'hr' OR (role = 'employee' AND status = 'approved'))
       ORDER BY name`,
      []
    );

    res.json({ managers: managersResult.rows });
  } catch (error) {
    console.error("Get managers error:", error);
    res.status(500).json({ error: "Failed to get managers" });
  }
});

// Resend employee credentials
router.post("/employees/:id/resend-credentials", async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email FROM users WHERE id = $1 AND role = $2",
      [id, "employee"]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Generate new password if not provided
    let newPassword = password;
    if (!newPassword) {
      newPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-4);
    }

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [passwordHash, id]
    );

    // Send new credentials
    try {
      await sendEmployeeCredentials(employee.email, employee.name, {
        email: employee.email,
        password: newPassword,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      return res
        .status(500)
        .json({ error: "Failed to send email with new credentials" });
    }

    // Log action
    await logAction(
      req.user.id,
      "credentials_resent",
      {
        employee_id: id,
        employee_email: employee.email,
      },
      req
    );

    res.json({
      message: "Credentials sent successfully",
      credentials: { email: employee.email, password: newPassword },
    });
  } catch (error) {
    console.error("Resend credentials error:", error);
    res.status(500).json({ error: "Failed to resend credentials" });
  }
});

// Delete employee
router.delete("/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email, status FROM users WHERE id = $1 AND role = $2",
      [id, "employee"]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Check if employee is already approved (prevent deletion of approved employees)
    if (employee.status === "approved") {
      return res.status(400).json({ 
        error: "Cannot delete approved employees. Please contact admin for assistance." 
      });
    }

    // Delete employee details first (due to foreign key constraint)
    await query("DELETE FROM employee_details WHERE user_id = $1", [id]);

    // Delete the user
    await query("DELETE FROM users WHERE id = $1", [id]);

    // Log action
    await logAction(
      req.user.id,
      "employee_deleted",
      {
        employee_id: id,
        employee_email: employee.email,
        employee_name: employee.name,
      },
      req
    );

    res.json({ 
      message: "Employee deleted successfully",
      deletedEmployee: {
        id: employee.id,
        name: employee.name,
        email: employee.email
      }
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

// Get all employee onboarding forms (for HR to review)
router.get("/employee-forms", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, employeeType } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE u.role = 'employee'";
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND u.status = $${paramCount}`;
      params.push(status);
    }

    if (employeeType) {
      paramCount++;
      whereClause += ` AND u.employee_type = $${paramCount}`;
      params.push(employeeType);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get employee forms with details
    const formsResult = await query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_type,
        u.status,
        u.manager_id,
        u.created_at,
        ed.personal_info,
        ed.bank_info,
        ed.aadhar_number,
        ed.pan_number,
        ed.passport_number,
        ed.education_info,
        ed.tech_certificates,
        ed.photo_url,
        ed.work_experience,
        ed.contract_period,
        ed.join_date,
        m.name as manager_name
      FROM users u
      LEFT JOIN employee_details ed ON u.id = ed.user_id
      LEFT JOIN users m ON u.manager_id = m.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    res.json({
      forms: formsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Get employee forms error:", error);
    res.status(500).json({ error: "Failed to get employee forms" });
  }
});

// Get specific employee onboarding form
router.get("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const formResult = await query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.employee_type,
        u.status,
        u.manager_id,
        u.created_at,
        ed.personal_info,
        ed.bank_info,
        ed.aadhar_number,
        ed.pan_number,
        ed.passport_number,
        ed.education_info,
        ed.tech_certificates,
        ed.photo_url,
        ed.work_experience,
        ed.contract_period,
        ed.join_date,
        m.name as manager_name
      FROM users u
      LEFT JOIN employee_details ed ON u.id = ed.user_id
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.id = $1 AND u.role = 'employee'`,
      [id]
    );

    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee form not found" });
    }

    res.json({ form: formResult.rows[0] });
  } catch (error) {
    console.error("Get employee form error:", error);
    res.status(500).json({ error: "Failed to get employee form" });
  }
});

// Update employee onboarding form (HR can edit)
router.patch("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, status FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const allowedFields = [
      "personalInfo",
      "bankInfo",
      "aadharNumber",
      "panNumber",
      "passportNumber",
      "educationInfo",
      "techCertificates",
      "photoUrl",
      "workExperience",
      "contractPeriod",
      "joinDate",
    ];

    // Filter out invalid fields
    const validUpdates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        validUpdates[field] = updateData[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Check if employee details exist
    const existingDetails = await query(
      "SELECT id FROM employee_details WHERE user_id = $1",
      [id]
    );

    if (existingDetails.rows.length === 0) {
      return res.status(404).json({ error: "Employee form not found" });
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (validUpdates.personalInfo !== undefined) {
      paramCount++;
      updates.push(`personal_info = $${paramCount}`);
      params.push(validUpdates.personalInfo);
    }

    if (validUpdates.bankInfo !== undefined) {
      paramCount++;
      updates.push(`bank_info = $${paramCount}`);
      params.push(validUpdates.bankInfo);
    }

    if (validUpdates.aadharNumber !== undefined) {
      paramCount++;
      updates.push(`aadhar_number = $${paramCount}`);
      params.push(validUpdates.aadharNumber);
    }

    if (validUpdates.panNumber !== undefined) {
      paramCount++;
      updates.push(`pan_number = $${paramCount}`);
      params.push(validUpdates.panNumber);
    }

    if (validUpdates.passportNumber !== undefined) {
      paramCount++;
      updates.push(`passport_number = $${paramCount}`);
      params.push(validUpdates.passportNumber);
    }

    if (validUpdates.educationInfo !== undefined) {
      paramCount++;
      updates.push(`education_info = $${paramCount}`);
      params.push(validUpdates.educationInfo);
    }

    if (validUpdates.techCertificates !== undefined) {
      paramCount++;
      updates.push(`tech_certificates = $${paramCount}`);
      params.push(validUpdates.techCertificates);
    }

    if (validUpdates.photoUrl !== undefined) {
      paramCount++;
      updates.push(`photo_url = $${paramCount}`);
      params.push(validUpdates.photoUrl);
    }

    if (validUpdates.workExperience !== undefined) {
      paramCount++;
      updates.push(`work_experience = $${paramCount}`);
      params.push(validUpdates.workExperience);
    }

    if (validUpdates.contractPeriod !== undefined) {
      paramCount++;
      updates.push(`contract_period = $${paramCount}`);
      params.push(validUpdates.contractPeriod);
    }

    if (validUpdates.joinDate !== undefined) {
      paramCount++;
      updates.push(`join_date = $${paramCount}`);
      params.push(validUpdates.joinDate);
    }

    // Add user_id to params
    paramCount++;
    params.push(id);

    const updateQuery = `
      UPDATE employee_details 
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE user_id = $${paramCount}
    `;

    await query(updateQuery, params);

    // Log action
    await logAction(
      req.user.id,
      "employee_form_updated",
      {
        employee_id: id,
        updated_fields: Object.keys(validUpdates),
      },
      req
    );

    res.json({ message: "Employee form updated successfully" });
  } catch (error) {
    console.error("Update employee form error:", error);
    res.status(500).json({ error: "Failed to update employee form" });
  }
});

// Create/Initialize employee onboarding form (HR can create empty form)
router.post("/employee-forms/:id/initialize", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, status FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if form already exists
    const existingForm = await query(
      "SELECT id FROM employee_details WHERE user_id = $1",
      [id]
    );

    if (existingForm.rows.length > 0) {
      return res.status(400).json({ error: "Employee form already exists" });
    }

    // Create empty form
    await query(
      `INSERT INTO employee_details (user_id, created_at, updated_at)
       VALUES ($1, NOW(), NOW())`,
      [id]
    );

    // Log action
    await logAction(
      req.user.id,
      "employee_form_initialized",
      {
        employee_id: id,
      },
      req
    );

    res.json({ message: "Employee form initialized successfully" });
  } catch (error) {
    console.error("Initialize employee form error:", error);
    res.status(500).json({ error: "Failed to initialize employee form" });
  }
});

// Delete employee onboarding form
router.delete("/employee-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employeeResult = await query(
      "SELECT id, name, email, status FROM users WHERE id = $1 AND role = 'employee'",
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = employeeResult.rows[0];

    // Delete employee details first
    await query("DELETE FROM employee_details WHERE user_id = $1", [id]);

    // Log action
    await logAction(
      req.user.id,
      "employee_form_deleted",
      {
        employee_id: id,
        employee_email: employee.email,
        employee_name: employee.name,
      },
      req
    );

    res.json({ message: "Employee form deleted successfully" });
  } catch (error) {
    console.error("Delete employee form error:", error);
    res.status(500).json({ error: "Failed to delete employee form" });
  }
});

module.exports = router;
