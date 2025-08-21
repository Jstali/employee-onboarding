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
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'hr', 'employee')),
        employee_type VARCHAR(20) CHECK (employee_type IN ('intern', 'contract', 'fulltime')),
        manager_id UUID REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee Details table
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
      CREATE INDEX IF NOT EXISTS idx_employee_details_user_id ON employee_details(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    // Insert default admin user if not exists
    const adminExists = await client.query(
      "SELECT id FROM users WHERE role = $1 LIMIT 1",
      ["admin"]
    );

    if (adminExists.rows.length === 0) {
      const bcrypt = require("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 12);

      await client.query(
        `
        INSERT INTO users (name, email, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          "System Admin",
          "admin@company.com",
          hashedPassword,
          "admin",
          "approved",
        ]
      );

      console.log(
        "👑 Default admin user created (admin@company.com / admin123)"
      );
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
