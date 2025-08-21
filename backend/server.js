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

// Rate limiting - more lenient for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 login attempts per 15 minutes
  message: {
    error: "Too many login attempts from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting - more lenient
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per 15 minutes
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
      windowMs: "15 minutes",
      maxRequests: 20,
      description: "Login attempts per 15 minutes",
    },
    generalLimiter: {
      windowMs: "15 minutes",
      maxRequests: 200,
      description: "General requests per 15 minutes",
    },
  });
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
