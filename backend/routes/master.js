const express = require("express");
const { query } = require("../config/database");
const {
  authenticate,
  requireHRorAdmin,
  requireAdmin,
  logAction,
} = require("../middleware/auth");

const router = express.Router();

// Apply authentication to all master routes
router.use(authenticate);

// Get all employees with filters (HR/Admin only)
router.get("/", requireHRorAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      employeeType,
      role,
      department,
      status,
      search,
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params = [];
    let paramCount = 0;

    // Add filters
    if (employeeType) {
      paramCount++;
      whereClause += ` AND employee_type = $${paramCount}`;
      params.push(employeeType);
    }

    if (role) {
      paramCount++;
      whereClause += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (department) {
      paramCount++;
      whereClause += ` AND department = $${paramCount}`;
      params.push(department);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM master_employees ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get employees with manager names
    const employeesResult = await query(
      `SELECT 
        me.id,
        me.user_id,
        me.name,
        me.email,
        me.employee_type,
        me.role,
        me.status,
        me.department,
        me.join_date,
        me.manager_id,
        me.created_at,
        me.updated_at,
        manager.name as manager_name
      FROM master_employees me
      LEFT JOIN master_employees manager ON me.manager_id = manager.id
      ${whereClause}
      ORDER BY me.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
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
    console.error("Get master employees error:", error);
    res.status(500).json({ error: "Failed to get employees" });
  }
});

// Get employee's own profile (accessible to all authenticated users)
router.get("/profile", async (req, res) => {
  try {
    const profileResult = await query(
      `SELECT 
        me.id,
        me.user_id,
        me.name,
        me.email,
        me.employee_type,
        me.role,
        me.status,
        me.department,
        me.join_date,
        me.manager_id,
        me.created_at,
        me.updated_at,
        manager.name as manager_name
      FROM master_employees me
      LEFT JOIN master_employees manager ON me.manager_id = manager.id
      WHERE me.user_id = $1`,
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.json({ profile: null });
    }

    res.json({ profile: profileResult.rows[0] });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Get departments for filter dropdown (HR/Admin only)
router.get("/departments/list", requireHRorAdmin, async (req, res) => {
  try {
    const departmentsResult = await query(
      "SELECT DISTINCT department FROM master_employees WHERE department IS NOT NULL ORDER BY department"
    );

    res.json({
      departments: departmentsResult.rows.map((row) => row.department),
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({ error: "Failed to get departments" });
  }
});

// Get single employee profile (HR/Admin only)
router.get("/:id", requireHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const employeeResult = await query(
      `SELECT 
        me.id,
        me.user_id,
        me.name,
        me.email,
        me.employee_type,
        me.role,
        me.status,
        me.department,
        me.join_date,
        me.manager_id,
        me.created_at,
        me.updated_at,
        manager.name as manager_name,
        u.status as user_status
      FROM master_employees me
      LEFT JOIN master_employees manager ON me.manager_id = manager.id
      LEFT JOIN users u ON me.user_id = u.id
      WHERE me.id = $1`,
      [id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ employee: employeeResult.rows[0] });
  } catch (error) {
    console.error("Get master employee error:", error);
    res.status(500).json({ error: "Failed to get employee" });
  }
});

// Add new employee manually (HR/Admin only)
router.post("/", requireHRorAdmin, async (req, res) => {
  try {
    let { name, email, employeeType, role, department, joinDate, managerId } =
      req.body;

    // Clean up empty strings and convert to null for optional fields
    joinDate = joinDate || null;
    managerId = managerId || null;

    console.log("Received create employee request:", {
      name,
      email,
      employeeType,
      role,
      department,
      joinDate,
      managerId,
    });

    // Validate required fields
    if (!name || !email || !employeeType || !role || !department) {
      console.log("Validation failed - missing fields:", {
        hasName: !!name,
        hasEmail: !!email,
        hasEmployeeType: !!employeeType,
        hasRole: !!role,
        hasDepartment: !!department,
      });
      return res.status(400).json({
        error: "Name, email, employee type, role, and department are required",
      });
    }

    // Check if email already exists
    const existingEmployee = await query(
      "SELECT id FROM master_employees WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingEmployee.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Insert new employee
    const newEmployee = await query(
      `INSERT INTO master_employees (
        name, email, employee_type, role, department, join_date, manager_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name,
        email.toLowerCase(),
        employeeType,
        role,
        department,
        joinDate || null,
        managerId || null, // Convert empty string to null
      ]
    );

    // Log action
    await logAction(
      req.user.id,
      "master_employee_created",
      {
        employee_id: newEmployee.rows[0].id,
        employee_email: email,
        employee_name: name,
      },
      req
    );

    res.status(201).json({
      message: "Employee added successfully",
      employee: newEmployee.rows[0],
    });
  } catch (error) {
    console.error("Create master employee error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      where: error.where,
    });

    // Provide more specific error messages
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Email already exists in the system" });
    } else if (error.code === "23514") {
      return res.status(400).json({
        error:
          "Invalid data provided. Please check employee type and role values",
      });
    } else if (error.code === "23503") {
      return res.status(400).json({ error: "Invalid reference data provided" });
    } else {
      return res.status(500).json({
        error: "Failed to create employee",
        details: error.message,
        code: error.code,
      });
    }
  }
});

// Update employee information (HR/Admin only)
router.put("/:id", requireHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      employeeType,
      role,
      department,
      joinDate,
      managerId,
      status,
    } = req.body;

    // Check if employee exists
    const existingEmployee = await query(
      "SELECT id FROM master_employees WHERE id = $1",
      [id]
    );

    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if email already exists (excluding current employee)
    if (email) {
      const emailExists = await query(
        "SELECT id FROM master_employees WHERE email = $1 AND id != $2",
        [email.toLowerCase(), id]
      );

      if (emailExists.rows.length > 0) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    // Update employee
    const updateResult = await query(
      `UPDATE master_employees SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        employee_type = COALESCE($3, employee_type),
        role = COALESCE($4, role),
        department = COALESCE($5, department),
        join_date = COALESCE($6, join_date),
        manager_id = COALESCE($7, manager_id),
        status = COALESCE($8, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *`,
      [
        name,
        email?.toLowerCase(),
        employeeType,
        role,
        department,
        joinDate || null,
        managerId || null, // Convert empty string to null
        status,
        id,
      ]
    );

    // Log action
    await logAction(
      req.user.id,
      "master_employee_updated",
      {
        employee_id: id,
        updated_fields: Object.keys(req.body).filter(
          (key) => req.body[key] !== undefined
        ),
      },
      req
    );

    res.json({
      message: "Employee updated successfully",
      employee: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Update master employee error:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

// Deactivate/remove employee (HR/Admin only)
router.delete("/:id", requireHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const existingEmployee = await query(
      "SELECT id, name, email FROM master_employees WHERE id = $1",
      [id]
    );

    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = existingEmployee.rows[0];

    // Soft delete - change status to inactive
    await query(
      "UPDATE master_employees SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    // Log action
    await logAction(
      req.user.id,
      "master_employee_deactivated",
      {
        employee_id: id,
        employee_email: employee.email,
        employee_name: employee.name,
      },
      req
    );

    res.json({ message: "Employee deactivated successfully" });
  } catch (error) {
    console.error("Deactivate master employee error:", error);
    res.status(500).json({ error: "Failed to deactivate employee" });
  }
});

// Hard delete employee permanently (HR/Admin only)
router.delete("/:id/permanent", requireHRorAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const existingEmployee = await query(
      "SELECT id, name, email FROM master_employees WHERE id = $1",
      [id]
    );

    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const employee = existingEmployee.rows[0];

    // Check if employee has any dependent records
    const dependentRecords = await query(
      "SELECT COUNT(*) as count FROM master_employees WHERE manager_id = $1",
      [id]
    );

    if (parseInt(dependentRecords.rows[0].count) > 0) {
      return res.status(400).json({
        error:
          "Cannot delete employee. This employee is a manager of other employees. Please reassign or deactivate them first.",
      });
    }

    // Hard delete - permanently remove from database
    await query("DELETE FROM master_employees WHERE id = $1", [id]);

    // Log action
    await logAction(
      req.user.id,
      "master_employee_deleted_permanently",
      {
        employee_id: id,
        employee_email: employee.email,
        employee_name: employee.name,
      },
      req
    );

    res.json({ message: "Employee permanently deleted" });
  } catch (error) {
    console.error("Hard delete master employee error:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

module.exports = router;
