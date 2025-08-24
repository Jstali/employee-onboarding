const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5434,
  database: process.env.DB_NAME || "lastdb",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "Stali",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Database connection error:", err);
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("📊 Database connection established");

    // Create tables if they don't exist
    await createTables(client);

    client.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

const createTables = async (client) => {
  try {
    // Users table - Updated for new authentication flow
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('hr', 'employee')),
        employee_type VARCHAR(20) CHECK (employee_type IN ('intern', 'contract', 'fulltime')),
        manager_id UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        is_first_login BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee Details table - Updated for file uploads
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        
        -- Personal Information
        personal_info JSONB,
        
        -- Bank Information
        bank_info JSONB,
        
        -- Identity Documents
        aadhar_number VARCHAR(12),
        pan_number VARCHAR(10),
        passport_number VARCHAR(20),
        
        -- Education
        education_info JSONB,
        
        -- Technical Certifications
        tech_certificates JSONB,
        
        -- Optional Fields
        photo_url TEXT,
        work_experience JSONB,
        contract_period JSONB,
        join_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee Documents table - New table for file management
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        is_required BOOLEAN DEFAULT false,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Attendance table - New table for attendance management
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'wfh', 'leave')),
        reason TEXT,
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Audit/Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_is_first_login ON users(is_first_login);
      CREATE INDEX IF NOT EXISTS idx_employee_details_user_id ON employee_details(user_id);
      CREATE INDEX IF NOT EXISTS idx_employee_documents_user_id ON employee_documents(user_id);
      CREATE INDEX IF NOT EXISTS idx_employee_documents_type ON employee_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    // Insert default HR user if not exists
    const hrExists = await client.query(
      "SELECT id FROM users WHERE role = $1 LIMIT 1",
      ["hr"]
    );

    if (hrExists.rows.length === 0) {
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("hr123", 12);

      await client.query(
        `
        INSERT INTO users (name, email, password_hash, role, status, is_first_login)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        ["HR Manager", "hr@nxzen.com", hashedPassword, "hr", "active", false]
      );

      console.log("👔 Default HR user created (hr@nxzen.com / hr123)");
    }

    // Create master_employees table
    await client.query(`
      CREATE TABLE IF NOT EXISTS master_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        employee_id VARCHAR(6) UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        personal_email VARCHAR(100),
        employee_type VARCHAR(20) CHECK (employee_type IN ('intern','contract','fulltime')),
        role VARCHAR(20) CHECK (role IN ('employee','manager','hr')),
        status VARCHAR(20) DEFAULT 'active',
        department VARCHAR(50),
        join_date DATE,
        manager_id UUID REFERENCES master_employees(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_master_employees_email ON master_employees(email)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_master_employees_user_id ON master_employees(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_master_employees_status ON master_employees(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_master_employees_department ON master_employees(department)
    `);

    // Insert default HR into master_employees if not exists
    const hrExistsMaster = await client.query(
      "SELECT id FROM master_employees WHERE email = $1",
      ["hr@nxzen.com"]
    );

    if (hrExistsMaster.rows.length === 0) {
      await client.query(`
        INSERT INTO master_employees (user_id, name, email, employee_type, role, status, department, join_date)
        SELECT id, name, email, 'fulltime', role, status, 'HR', created_at::date
        FROM users WHERE email = 'hr@nxzen.com'
      `);
    }

    console.log("📋 Database tables created successfully");
  } catch (error) {
    console.error("❌ Error creating tables:", error);
    throw error;
  }
};

module.exports = {
  pool,
  connectDB,
  query: (text, params) => pool.query(text, params),
};
