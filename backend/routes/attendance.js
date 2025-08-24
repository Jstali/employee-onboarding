const express = require("express");
const { query } = require("../config/database");
const { authenticate, authorize, logAction } = require("../middleware/auth");
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
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image, PDF, and document files are allowed"));
    }
  },
});

// Helper function to check if date is weekend
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

// Helper function to get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

// Mark attendance for current user
router.post("/mark", authenticate, async (req, res) => {
  try {
    const { status, reason } = req.body;
    const userId = req.user.id;
    const today = getCurrentDate();

    // Validate input
    if (!status || !["present", "wfh", "leave"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Invalid status. Must be present, wfh, or leave" });
    }

    if (status === "leave" && !reason) {
      return res.status(400).json({ error: "Reason is required for leave" });
    }

    // Check if it's weekend
    if (isWeekend(new Date(today))) {
      return res
        .status(400)
        .json({ error: "Cannot mark attendance on weekends" });
    }

    // Check if attendance already marked for today
    const existingAttendance = await query(
      "SELECT id FROM attendance WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (existingAttendance.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Attendance already marked for today" });
    }

    // Insert attendance record
    const result = await query(
      `INSERT INTO attendance (user_id, date, status, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, date, status, reason, marked_at`,
      [userId, today, status, reason]
    );

    // Log action
    await logAction(
      userId,
      "attendance_marked",
      {
        date: today,
        status: status,
        reason: reason,
      },
      req
    );

    res.json({
      message: "Attendance marked successfully",
      attendance: result.rows[0],
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

// Get current user's attendance for a date range
router.get("/my-attendance", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let queryText = `
      SELECT date, status, reason, marked_at
      FROM attendance 
      WHERE user_id = $1
    `;
    let queryParams = [userId];

    if (startDate && endDate) {
      queryText += " AND date BETWEEN $2 AND $3 ORDER BY date DESC";
      queryParams.push(startDate, endDate);
    } else {
      queryText += " ORDER BY date DESC LIMIT 30";
    }

    const result = await query(queryText, queryParams);

    res.json({
      attendance: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get my attendance error:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// Get current user's attendance calendar (current month)
router.get("/my-calendar", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const startDate = `${targetYear}-${targetMonth
      .toString()
      .padStart(2, "0")}-01`;
    const endDate = new Date(targetYear, targetMonth, 0)
      .toISOString()
      .split("T")[0];

    // Get attendance for the month
    const attendanceResult = await query(
      `SELECT date, status, reason
       FROM attendance 
       WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate]
    );

    // Create calendar data
    const calendar = [];
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetYear}-${targetMonth
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      const dayOfWeek = new Date(date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const attendance = attendanceResult.rows.find((a) => a.date === date);

      calendar.push({
        date,
        dayOfWeek,
        isWeekend,
        status: isWeekend ? "weekend" : attendance?.status || "not_marked",
        reason: attendance?.reason || null,
      });
    }

    res.json({
      calendar,
      month: targetMonth,
      year: targetYear,
      totalDays: daysInMonth,
    });
  } catch (error) {
    console.error("Get my calendar error:", error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

// HR: Get all employees attendance (filtered)
router.get("/all", authenticate, authorize(["hr"]), async (req, res) => {
  try {
    const {
      employeeId,
      department,
      startDate,
      endDate,
      status,
      month,
      year,
      leavesGreaterThan,
    } = req.query;

    let queryText = `
      SELECT 
        a.id,
        a.user_id as employee_id,
        a.date,
        a.status,
        a.reason,
        a.marked_at,
        u.name as employee_name,
        u.email as employee_email,
        u.department,
        u.employee_type
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    let queryParams = [];
    let paramCount = 0;

    if (employeeId) {
      paramCount++;
      queryText += ` AND a.user_id = $${paramCount}`;
      queryParams.push(employeeId);
    }

    if (department) {
      paramCount++;
      queryText += ` AND u.department = $${paramCount}`;
      queryParams.push(department);
    }

    if (startDate && endDate) {
      paramCount++;
      queryText += ` AND a.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    if (month && year) {
      paramCount++;
      queryText += ` AND EXTRACT(MONTH FROM a.date) = $${paramCount} AND EXTRACT(YEAR FROM a.date) = $${
        paramCount + 1
      }`;
      queryParams.push(month, year);
      paramCount++;
    }

    if (status) {
      paramCount++;
      queryText += ` AND a.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Filter by leaves greater than specified number
    if (leavesGreaterThan && leavesGreaterThan > 0) {
      paramCount++;
      queryText += ` AND a.user_id IN (
        SELECT user_id FROM attendance 
        WHERE status = 'leave' 
        GROUP BY user_id 
        HAVING COUNT(*) > $${paramCount}
      )`;
      queryParams.push(leavesGreaterThan);
    }

    queryText += " ORDER BY a.date DESC, u.name";

    const result = await query(queryText, queryParams);

    res.json({
      attendance: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get all attendance error:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

// HR: Get attendance summary for dashboard
router.get("/summary", authenticate, authorize(["hr"]), async (req, res) => {
  try {
    const { startDate, endDate, leavesGreaterThan } = req.query;

    let dateFilter = "";
    let queryParams = [];
    let paramCount = 0;

    if (startDate && endDate) {
      dateFilter = "WHERE date BETWEEN $1 AND $2";
      queryParams = [startDate, endDate];
      paramCount = 2;
    }

    // Filter by leaves greater than specified number
    if (leavesGreaterThan && leavesGreaterThan > 0) {
      if (dateFilter) {
        dateFilter += ` AND user_id IN (
          SELECT user_id FROM attendance 
          WHERE status = 'leave' 
          GROUP BY user_id 
          HAVING COUNT(*) > $${paramCount + 1}
        )`;
        queryParams.push(leavesGreaterThan);
      } else {
        dateFilter = `WHERE user_id IN (
          SELECT user_id FROM attendance 
          WHERE status = 'leave' 
          GROUP BY user_id 
          HAVING COUNT(*) > $1
        )`;
        queryParams = [leavesGreaterThan];
      }
    }

    // Get attendance counts
    const summaryResult = await query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM attendance 
       ${dateFilter}
       GROUP BY status`,
      queryParams
    );

    // Get total employees
    const totalEmployeesResult = await query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'employee' AND status = 'active'"
    );

    const summary = {
      present: 0,
      absent: 0,
      wfh: 0,
      leave: 0,
      total: 0,
      totalEmployees: parseInt(totalEmployeesResult.rows[0].total),
    };

    summaryResult.rows.forEach((row) => {
      summary[row.status] = parseInt(row.count);
      summary.total += parseInt(row.count);
    });

    // Calculate percentages
    summary.presentPercentage =
      summary.totalEmployees > 0
        ? Math.round((summary.present / summary.totalEmployees) * 100)
        : 0;
    summary.wfhPercentage =
      summary.totalEmployees > 0
        ? Math.round((summary.wfh / summary.totalEmployees) * 100)
        : 0;
    summary.leavePercentage =
      summary.totalEmployees > 0
        ? Math.round((summary.leave / summary.totalEmployees) * 100)
        : 0;

    res.json(summary);
  } catch (error) {
    console.error("Get attendance summary error:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// HR: Export attendance data as CSV
router.get("/export", authenticate, authorize(["hr"]), async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employeeId,
      department,
      format = "csv",
    } = req.query;

    let queryText = `
      SELECT 
        u.name as employee_name,
        u.email as employee_email,
        u.department,
        u.employee_type,
        a.date,
        a.status,
        a.reason,
        a.marked_at
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    let queryParams = [];
    let paramCount = 0;

    if (employeeId) {
      paramCount++;
      queryText += ` AND a.user_id = $${paramCount}`;
      queryParams.push(employeeId);
    }

    if (department) {
      paramCount++;
      queryText += ` AND u.department = $${paramCount}`;
      queryParams.push(department);
    }

    if (startDate && endDate) {
      paramCount++;
      queryText += ` AND a.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      queryParams.push(startDate, endDate);
      paramCount++;
    }

    queryText += " ORDER BY a.date DESC, u.name";

    const result = await query(queryText, queryParams);

    if (format === "csv") {
      // Generate CSV
      const csvHeader =
        "Employee Name,Email,Department,Employee Type,Date,Status,Reason,Marked At\n";
      const csvData = result.rows
        .map(
          (row) =>
            `"${row.employee_name}","${row.employee_email}","${
              row.department || ""
            }","${row.employee_type || ""}","${row.date}","${row.status}","${
              row.reason || ""
            }","${row.marked_at}"`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attendance_${startDate || "all"}_${
          endDate || "data"
        }.csv"`
      );
      res.send(csvHeader + csvData);
    } else {
      // Return JSON for Excel processing
      res.json({
        attendance: result.rows,
        total: result.rows.length,
        exportDate: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Export attendance error:", error);
    res.status(500).json({ error: "Failed to export attendance" });
  }
});

// HR: Get employee attendance calendar
router.get(
  "/employee-calendar/:employeeId",
  authenticate,
  authorize(["hr"]),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { month, year } = req.query;

      const currentDate = new Date();
      const targetMonth = month || currentDate.getMonth() + 1;
      const targetYear = year || currentDate.getFullYear();

      const startDate = `${targetYear}-${targetMonth
        .toString()
        .padStart(2, "0")}-01`;
      const endDate = new Date(targetYear, targetMonth, 0)
        .toISOString()
        .split("T")[0];

      // Get employee info
      const employeeResult = await query(
        "SELECT name, email, department, employee_type FROM users WHERE id = $1",
        [employeeId]
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get attendance for the month
      const attendanceResult = await query(
        `SELECT date, status, reason
       FROM attendance 
       WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [employeeId, startDate, endDate]
      );

      // Create calendar data
      const calendar = [];
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${targetYear}-${targetMonth
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const dayOfWeek = new Date(date).getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const attendance = attendanceResult.rows.find((a) => a.date === date);

        calendar.push({
          date,
          dayOfWeek,
          isWeekend,
          status: isWeekend ? "weekend" : attendance?.status || "not_marked",
          reason: attendance?.reason || null,
        });
      }

      res.json({
        employee: employeeResult.rows[0],
        calendar,
        month: targetMonth,
        year: targetYear,
        totalDays: daysInMonth,
      });
    } catch (error) {
      console.error("Get employee calendar error:", error);
      res.status(500).json({ error: "Failed to fetch employee calendar" });
    }
  }
);

// HR: Update attendance (for corrections)
router.put(
  "/:attendanceId",
  authenticate,
  authorize(["hr"]),
  async (req, res) => {
    try {
      const { attendanceId } = req.params;
      const { status, reason } = req.body;

      if (!status || !["present", "wfh", "leave"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      if (status === "leave" && !reason) {
        return res.status(400).json({ error: "Reason is required for leave" });
      }

      const result = await query(
        `UPDATE attendance 
       SET status = $1, reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
        [status, reason, attendanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Attendance record not found" });
      }

      // Log action
      await logAction(
        req.user.id,
        "attendance_updated",
        {
          attendanceId,
          oldStatus: result.rows[0].status,
          newStatus: status,
          reason,
        },
        req
      );

      res.json({
        message: "Attendance updated successfully",
        attendance: result.rows[0],
      });
    } catch (error) {
      console.error("Update attendance error:", error);
      res.status(500).json({ error: "Failed to update attendance" });
    }
  }
);

// HR: Delete attendance record
router.delete(
  "/:attendanceId",
  authenticate,
  authorize(["hr"]),
  async (req, res) => {
    try {
      const { attendanceId } = req.params;

      const result = await query(
        "DELETE FROM attendance WHERE id = $1 RETURNING *",
        [attendanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Attendance record not found" });
      }

      // Log action
      await logAction(
        req.user.id,
        "attendance_deleted",
        {
          attendanceId,
          deletedRecord: result.rows[0],
        },
        req
      );

      res.json({
        message: "Attendance record deleted successfully",
        deletedRecord: result.rows[0],
      });
    } catch (error) {
      console.error("Delete attendance error:", error);
      res.status(500).json({ error: "Failed to delete attendance" });
    }
  }
);

module.exports = router;
