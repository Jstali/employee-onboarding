const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: "./config.env" });
const multer = require("multer");

const authRoutes = require("./routes/auth");
const hrRoutes = require("./routes/hr");
const employeeRoutes = require("./routes/employee");
const attendanceRoutes = require("./routes/attendance");
const masterRoutes = require("./routes/master");
const { connectDB } = require("./config/database");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5022;

// Connect to database
connectDB();

// Rate limiting - MUCH more lenient for authentication
const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes (very short window)
  max: process.env.NODE_ENV === "development" ? 200 : 100, // 200 in dev, 100 in prod
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "2 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  skipFailedRequests: false, // Count failed attempts
  // Development mode: even more lenient
  ...(process.env.NODE_ENV === "development" && {
    windowMs: 1 * 60 * 1000, // 1 minute in development
    max: 200, // 200 attempts per minute in development
  }),
});

// General rate limiting - more lenient
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 minutes (more lenient)
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5180",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors(corsOptions));
app.use(morgan("combined"));

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Apply rate limiting
app.use("/api/auth", authLimiter); // More lenient for authentication
app.use(generalLimiter); // General rate limiting for other routes

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/master", masterRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Rate limit status endpoint
app.get("/rate-limit-status", (req, res) => {
  res.json({
    message: "Rate limit status endpoint",
    currentTime: new Date().toISOString(),
    endpoints: {
      auth: "2 min window, 100 max requests (200 in dev)",
      general: "15 min window, 500 max requests",
    },
  });
});

// Rate limit reset endpoint (for development/testing)
app.post("/rate-limit-reset", (req, res) => {
  if (process.env.NODE_ENV === "development") {
    // Reset rate limit for the requesting IP
    res.json({
      message: "Rate limit reset for development",
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(403).json({
      error: "Rate limit reset only available in development mode",
    });
  }
});

// Global error handling
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large. Maximum size is 5MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files uploaded.",
      });
    }
    return res.status(400).json({
      error: "File upload error: " + err.message,
    });
  }

  if (
    err.message &&
    err.message.includes("Only image, PDF, and document files are allowed")
  ) {
    return res.status(400).json({
      error:
        "Invalid file type. Only image, PDF, and document files are allowed.",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5180"}`
  );
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(
    `📊 Rate limit status: http://localhost:${PORT}/rate-limit-status`
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});
