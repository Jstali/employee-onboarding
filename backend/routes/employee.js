const express = require("express");
const { query } = require("../config/database");
const { authenticate, logAction } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image, PDF, and document files are allowed"));
    }
  },
});

// Check if user needs to change password
router.get("/check-password-status", authenticate, async (req, res) => {
  try {
    const userResult = await query(
      "SELECT is_first_login FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      needsPasswordChange: userResult.rows[0].is_first_login,
    });
  } catch (error) {
    console.error("Check password status error:", error);
    res.status(500).json({ error: "Failed to check password status" });
  }
});

// Change password (for first login)
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ 
        error: "New password must be at least 6 characters long" 
      });
    }

    // Hash new password
    const bcrypt = require("bcryptjs");
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password and mark as not first login
    await query(
      `UPDATE users 
       SET password_hash = $1, is_first_login = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newPasswordHash, req.user.id]
    );

    // Log password change
    await logAction(req.user.id, "first_password_set", {}, req);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Get onboarding form data
router.get("/onboarding-form", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is active
    const userResult = await query(
      "SELECT status FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userResult.rows[0].status === "active") {
      return res.status(200).json({ 
        message: "User is already active. Redirect to attendance portal.",
        status: "active"
      });
    }

    // Get existing form data
    const formResult = await query(
      "SELECT * FROM employee_details WHERE user_id = $1",
      [userId]
    );

    // Get uploaded documents
    const documentsResult = await query(
      "SELECT * FROM employee_documents WHERE user_id = $1 ORDER BY document_type, created_at",
      [userId]
    );

    let formData = {
      personalInfo: {},
      bankInfo: {},
      educationInfo: {},
      techCertificates: {},
      workExperience: {},
      contractPeriod: {},
      documents: documentsResult.rows,
    };

    if (formResult.rows.length > 0) {
      const existingForm = formResult.rows[0];
      formData = {
        ...formData,
        personalInfo: existingForm.personal_info || {},
        bankInfo: existingForm.bank_info || {},
        educationInfo: existingForm.education_info || {},
        techCertificates: existingForm.tech_certificates || {},
        workExperience: existingForm.work_experience || {},
        contractPeriod: existingForm.contract_period || {},
        aadharNumber: existingForm.aadhar_number || "",
        panNumber: existingForm.pan_number || "",
        passportNumber: existingForm.passport_number || "",
        joinDate: existingForm.join_date || "",
        photoUrl: existingForm.photo_url || "",
      };
    }

    res.json({ formData });
  } catch (error) {
    console.error("Get onboarding form error:", error);
    res.status(500).json({ error: "Failed to fetch form data" });
  }
});

// Submit onboarding form with file uploads
router.post("/onboarding-form", authenticate, upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "aadharDocument", maxCount: 1 },
  { name: "panDocument", maxCount: 1 },
  { name: "tenthMarksheet", maxCount: 1 },
  { name: "twelfthMarksheet", maxCount: 1 },
  { name: "degreeCertificate", maxCount: 1 },
]), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      personalInfo,
      bankInfo,
      educationInfo,
      techCertificates,
      workExperience,
      contractPeriod,
      aadharNumber,
      panNumber,
      passportNumber,
      joinDate,
    } = req.body;

    // Parse JSON fields
    const parsedPersonalInfo = typeof personalInfo === "string" ? JSON.parse(personalInfo) : personalInfo;
    const parsedBankInfo = typeof bankInfo === "string" ? JSON.parse(bankInfo) : bankInfo;
    const parsedEducationInfo = typeof educationInfo === "string" ? JSON.parse(educationInfo) : educationInfo;
    const parsedTechCertificates = typeof techCertificates === "string" ? JSON.parse(techCertificates) : techCertificates;
    const parsedWorkExperience = typeof workExperience === "string" ? JSON.parse(workExperience) : workExperience;
    const parsedContractPeriod = typeof contractPeriod === "string" ? JSON.parse(contractPeriod) : contractPeriod;

    // Handle file uploads
    const files = req.files;
    let photoUrl = "";
    const documents = [];

    if (files.profilePhoto && files.profilePhoto[0]) {
      photoUrl = `/uploads/${files.profilePhoto[0].filename}`;
    }

    // Process document uploads
    const documentTypes = {
      aadharDocument: "aadhar",
      panDocument: "pan",
      tenthMarksheet: "tenth_marksheet",
      twelfthMarksheet: "twelfth_marksheet",
      degreeCertificate: "degree_certificate",
    };

    for (const [fieldName, documentType] of Object.entries(documentTypes)) {
      if (files[fieldName] && files[fieldName][0]) {
        const file = files[fieldName][0];
        documents.push({
          documentType,
          fileName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          isRequired: documentType === "aadhar" || documentType === "pan",
        });
      }
    }

    // Check if form already exists
    const existingForm = await query(
      "SELECT id FROM employee_details WHERE user_id = $1",
      [userId]
    );

    if (existingForm.rows.length > 0) {
      // Update existing form
      await query(
        `UPDATE employee_details 
         SET personal_info = $1, bank_info = $2, education_info = $3, 
             tech_certificates = $4, work_experience = $5, contract_period = $6,
             aadhar_number = $7, pan_number = $8, passport_number = $9,
             join_date = $10, photo_url = $11, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $12`,
        [
          JSON.stringify(parsedPersonalInfo),
          JSON.stringify(parsedBankInfo),
          JSON.stringify(parsedEducationInfo),
          JSON.stringify(parsedTechCertificates),
          JSON.stringify(parsedWorkExperience),
          JSON.stringify(parsedContractPeriod),
          aadharNumber || null,
          panNumber || null,
          passportNumber || null,
          joinDate || null,
          photoUrl || null,
          userId,
        ]
      );
    } else {
      // Insert new form
      await query(
        `INSERT INTO employee_details (
          user_id, personal_info, bank_info, education_info, tech_certificates,
          work_experience, contract_period, aadhar_number, pan_number, 
          passport_number, join_date, photo_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          JSON.stringify(parsedPersonalInfo),
          JSON.stringify(parsedBankInfo),
          JSON.stringify(parsedEducationInfo),
          JSON.stringify(parsedTechCertificates),
          JSON.stringify(parsedWorkExperience),
          JSON.stringify(parsedContractPeriod),
          aadharNumber || null,
          panNumber || null,
          passportNumber || null,
          joinDate || null,
          photoUrl || null,
        ]
      );
    }

    // Save documents to database
    for (const doc of documents) {
      await query(
        `INSERT INTO employee_documents (
          user_id, document_type, file_name, file_path, file_size, mime_type, is_required
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          doc.documentType,
          doc.fileName,
          doc.filePath,
          doc.fileSize,
          doc.mimeType,
          doc.isRequired,
        ]
      );
    }

    // Log form submission
    await logAction(userId, "onboarding_form_submitted", {
      hasPhoto: !!photoUrl,
      documentsCount: documents.length,
    }, req);

    res.json({
      message: "Onboarding form submitted successfully",
      photoUrl,
      documentsCount: documents.length,
    });
  } catch (error) {
    console.error("Submit onboarding form error:", error);
    res.status(500).json({ error: "Failed to submit form" });
  }
});

// Get form requirements based on employee type
router.get("/form-requirements", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      "SELECT employee_type FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const employeeType = userResult.rows[0].employee_type || "fulltime";

    const requirements = {
      personalInfo: {
        required: true,
        fields: ["firstName", "lastName", "email", "phone", "address", "emergencyContact"],
      },
      bankInfo: {
        required: true,
        fields: ["accountNumber", "bankName", "ifscCode", "branchName"],
      },
      educationInfo: {
        required: true,
        fields: ["highestQualification", "institution", "yearOfCompletion"],
      },
      documents: {
        profilePhoto: { required: true, types: ["jpg", "jpeg", "png"] },
        aadhar: { required: true, types: ["jpg", "jpeg", "png", "pdf"] },
        pan: { required: true, types: ["jpg", "jpeg", "png", "pdf"] },
        tenthMarksheet: { required: false, types: ["jpg", "jpeg", "png", "pdf"] },
        twelfthMarksheet: { required: false, types: ["jpg", "jpeg", "png", "pdf"] },
        degreeCertificate: { required: false, types: ["jpg", "jpeg", "png", "pdf"] },
      },
    };

    // Add contract-specific requirements
    if (employeeType === "contract") {
      requirements.contractPeriod = {
        required: true,
        fields: ["startDate", "endDate", "contractType", "terms"],
      };
    }

    res.json({ requirements, employeeType });
  } catch (error) {
    console.error("Get form requirements error:", error);
    res.status(500).json({ error: "Failed to fetch requirements" });
  }
});

// Get current user profile
router.get("/profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      `SELECT u.id, u.name, u.email, u.role, u.employee_type, u.status, u.created_at,
              ed.join_date, ed.photo_url
       FROM users u
       LEFT JOIN employee_details ed ON u.id = ed.user_id
       WHERE u.id = $1`,
      [userId]
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

// Get form status
router.get("/form-status", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await query(
      "SELECT status FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const formResult = await query(
      "SELECT id FROM employee_details WHERE user_id = $1",
      [userId]
    );

    const status = {
      userStatus: userResult.rows[0].status,
      formSubmitted: formResult.rows.length > 0,
      canAccessAttendance: userResult.rows[0].status === "active",
    };

    res.json(status);
  } catch (error) {
    console.error("Get form status error:", error);
    res.status(500).json({ error: "Failed to get form status" });
  }
});

// Get manager information
router.get("/manager", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const managerResult = await query(
      `SELECT u.id, u.name, u.email, u.role
       FROM users u
       WHERE u.id = (SELECT manager_id FROM users WHERE id = $1)`,
      [userId]
    );

    if (managerResult.rows.length === 0) {
      return res.json({ manager: null });
    }

    res.json({ manager: managerResult.rows[0] });
  } catch (error) {
    console.error("Get manager error:", error);
    res.status(500).json({ error: "Failed to get manager information" });
  }
});

module.exports = router;
