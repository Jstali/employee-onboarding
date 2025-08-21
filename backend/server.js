const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: "./config.env" });

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const hrRoutes = require("./routes/hr");
const employeeRoutes = require("./routes/employee");
const masterRoutes = require("./routes/master");
const { connectDB } = require("./config/database");

const app = express();
const PORT = process.env.PORT || 5022;

// Connect to database
connectDB();

// Rate limiting - MUCH more lenient for authentication
const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes (very short window)
  max: 100, // limit each IP to 100 login attempts per 2 minutes (very lenient)
  message: {
    error:
      "Too many login attempts from this IP, please try again in 2 minutes.",
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
  origin: ["http://localhost:5180", "http://127.0.0.1:5180"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply rate limiting
app.use("/api/auth", authLimiter); // More lenient for authentication
app.use(generalLimiter); // General rate limiting for other routes

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/master", masterRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Employee Onboarding API is running",
    timestamp: new Date().toISOString(),
  });
});

// Rate limit status endpoint
app.get("/rate-limit-status", (req, res) => {
  res.status(200).json({
    authLimiter: {
      windowMs: "2 minutes",
      maxRequests: 100,
      description: "Login attempts per 2 minutes",
    },
    generalLimiter: {
      windowMs: "15 minutes",
      maxRequests: 500,
      description: "General requests per 15 minutes",
    },
  });
});

// Rate limit reset endpoint (for development/testing)
app.post("/rate-limit-reset", (req, res) => {
  try {
    // Reset the rate limiters
    authLimiter.resetKey(req.ip);
    generalLimiter.resetKey(req.ip);

    res.status(200).json({
      message: "Rate limits reset successfully for your IP",
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error resetting rate limits:", error);
    res.status(500).json({
      error: "Failed to reset rate limits",
      message: error.message,
    });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
