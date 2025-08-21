const express = require("express");
const { query } = require("../config/database");
const {
  authenticate,
  requireEmployee,
  logAction,
} = require("../middleware/auth");

const router = express.Router();

// Apply authentication to all employee routes
router.use(authenticate);
router.use(requireEmployee);

// Get employee's own profile and details
router.get("/profile", async (req, res) => {
  try {
    const employeeResult = await query(
      `SELECT u.id, u.name, u.email, u.employee_type, u.manager_id, u.status, u.created_at,
              m.name as manager_name,
              ed.*
       FROM users u
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN employee_details ed ON u.id = ed.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ employee: employeeResult.rows[0] });
  } catch (error) {
    console.error("Get employee profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Submit/Update employee onboarding form
router.post("/onboarding-form", async (req, res) => {
  try {
    const {
      personalInfo,
      bankInfo,
      aadharNumber,
      panNumber,
      passportNumber,
      educationInfo,
      techCertificates,
      photoUrl,
      workExperience,
      contractPeriod,
      joinDate,
    } = req.body;

    // Validate required fields based on employee type
    const requiredFields = [
      "personalInfo",
      "bankInfo",
      "aadharNumber",
      "panNumber",
      "educationInfo",
    ];

    if (req.user.employee_type === "contract") {
      requiredFields.push("workExperience", "contractPeriod");
    } else if (req.user.employee_type === "fulltime") {
      requiredFields.push("joinDate", "passportNumber");
    }

    // Check if all required fields are provided
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          error: `${field
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()} is required for ${
            req.user.employee_type
          } employees`,
        });
      }
    }

    // Check if employee details already exist
    const existingDetails = await query(
      "SELECT id FROM employee_details WHERE user_id = $1",
      [req.user.id]
    );

    if (existingDetails.rows.length > 0) {
      // Update existing record
      await query(
        `UPDATE employee_details SET 
         personal_info = $1,
         bank_info = $2,
         aadhar_number = $3,
         pan_number = $4,
         passport_number = $5,
         education_info = $6,
         tech_certificates = $7,
         photo_url = $8,
         work_experience = $9,
         contract_period = $10,
         join_date = $11,
         updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $12`,
        [
          personalInfo,
          bankInfo,
          aadharNumber,
          panNumber,
          passportNumber || null,
          educationInfo,
          techCertificates || null,
          photoUrl || null,
          workExperience || null,
          contractPeriod || null,
          joinDate || null,
          req.user.id,
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
          req.user.id,
          personalInfo,
          bankInfo,
          aadharNumber,
          panNumber,
          passportNumber || null,
          educationInfo,
          techCertificates || null,
          photoUrl || null,
          workExperience || null,
          contractPeriod || null,
          joinDate || null,
        ]
      );
    }

    // Log action
    await logAction(
      req.user.id,
      "onboarding_form_submitted",
      {
        employee_type: req.user.employee_type,
        has_photo: !!photoUrl,
        has_certificates: !!techCertificates,
      },
      req
    );

    res.json({ message: "Onboarding form submitted successfully" });
  } catch (error) {
    console.error("Submit onboarding form error:", error);
    res.status(500).json({ error: "Failed to submit onboarding form" });
  }
});

// Get employee's onboarding form
router.get("/onboarding-form", async (req, res) => {
  try {
    const formResult = await query(
      "SELECT * FROM employee_details WHERE user_id = $1",
      [req.user.id]
    );

    if (formResult.rows.length === 0) {
      return res.json({ form: null });
    }

    res.json({ form: formResult.rows[0] });
  } catch (error) {
    console.error("Get onboarding form error:", error);
    res.status(500).json({ error: "Failed to get onboarding form" });
  }
});

// Update specific sections of the form
router.patch("/onboarding-form", async (req, res) => {
  try {
    const updateData = req.body;
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
      [req.user.id]
    );

    if (existingDetails.rows.length === 0) {
      return res
        .status(404)
        .json({
          error:
            "Onboarding form not found. Please submit the complete form first.",
        });
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

    // Add updated_at and user_id to params
    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(req.user.id);

    // Update the form
    await query(
      `UPDATE employee_details SET ${updates.join(
        ", "
      )} WHERE user_id = $${paramCount}`,
      params
    );

    // Log action
    await logAction(
      req.user.id,
      "onboarding_form_updated",
      {
        updated_fields: Object.keys(validUpdates),
      },
      req
    );

    res.json({ message: "Onboarding form updated successfully" });
  } catch (error) {
    console.error("Update onboarding form error:", error);
    res.status(500).json({ error: "Failed to update onboarding form" });
  }
});

// Get form requirements based on employee type
router.get("/form-requirements", async (req, res) => {
  try {
    const requirements = {
      intern: {
        required: [
          "personalInfo",
          "bankInfo",
          "aadharNumber",
          "panNumber",
          "educationInfo",
        ],
        optional: ["techCertificates", "photoUrl"],
        description:
          "Intern employees need to provide basic personal, bank, and identity information along with education details.",
      },
      contract: {
        required: [
          "personalInfo",
          "bankInfo",
          "aadharNumber",
          "panNumber",
          "educationInfo",
          "workExperience",
          "contractPeriod",
        ],
        optional: ["techCertificates", "photoUrl"],
        description:
          "Contract employees need to provide all basic information plus work experience and contract period details.",
      },
      fulltime: {
        required: [
          "personalInfo",
          "bankInfo",
          "aadharNumber",
          "panNumber",
          "educationInfo",
          "joinDate",
          "passportNumber",
        ],
        optional: ["techCertificates", "photoUrl"],
        description:
          "Full-time employees need to provide all basic information plus join date and passport details.",
      },
    };

    const employeeType = req.user.employee_type;
    const formRequirements = requirements[employeeType] || requirements.intern;

    res.json({
      employeeType,
      requirements: formRequirements,
      currentStatus: req.user.status,
    });
  } catch (error) {
    console.error("Get form requirements error:", error);
    res.status(500).json({ error: "Failed to get form requirements" });
  }
});

// Check form completion status
router.get("/form-status", async (req, res) => {
  try {
    const formResult = await query(
      "SELECT * FROM employee_details WHERE user_id = $1",
      [req.user.id]
    );

    if (formResult.rows.length === 0) {
      return res.json({
        completed: false,
        progress: 0,
        missingFields: [],
        message: "Form not started",
      });
    }

    const form = formResult.rows[0];
    const employeeType = req.user.employee_type;

    // Define required fields based on employee type
    let requiredFields = [
      "personal_info",
      "bank_info",
      "aadhar_number",
      "pan_number",
      "education_info",
    ];

    if (employeeType === "contract") {
      requiredFields.push("work_experience", "contract_period");
    } else if (employeeType === "fulltime") {
      requiredFields.push("join_date", "passport_number");
    }

    // Check which required fields are missing
    const missingFields = [];
    let completedFields = 0;

    for (const field of requiredFields) {
      if (
        form[field] &&
        (typeof form[field] === "object"
          ? Object.keys(form[field]).length > 0
          : form[field].toString().trim() !== "")
      ) {
        completedFields++;
      } else {
        missingFields.push(field.replace(/_/g, " "));
      }
    }

    const progress = Math.round(
      (completedFields / requiredFields.length) * 100
    );
    const completed = progress === 100;

    res.json({
      completed,
      progress,
      missingFields,
      message: completed
        ? "Form completed"
        : `${completedFields}/${requiredFields.length} sections completed`,
    });
  } catch (error) {
    console.error("Get form status error:", error);
    res.status(500).json({ error: "Failed to get form status" });
  }
});

// Get manager information
router.get("/manager", async (req, res) => {
  try {
    if (!req.user.manager_id) {
      return res.json({ manager: null, message: "No manager assigned yet" });
    }

    const managerResult = await query(
      "SELECT id, name, email, role, employee_type FROM users WHERE id = $1",
      [req.user.manager_id]
    );

    if (managerResult.rows.length === 0) {
      return res.json({ manager: null, message: "Manager not found" });
    }

    res.json({ manager: managerResult.rows[0] });
  } catch (error) {
    console.error("Get manager error:", error);
    res.status(500).json({ error: "Failed to get manager information" });
  }
});

module.exports = router;
