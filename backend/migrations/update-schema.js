const { query } = require("../config/database");

async function updateSchema() {
  try {
    console.log("🔧 Starting database schema update...");

    // 1. Update users table to add temp_password field
    console.log("📝 Updating users table...");
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS temp_password VARCHAR(255),
      ADD COLUMN IF NOT EXISTS company_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS doj DATE;
    `);

    // 2. Create employee_forms table if not exists
    console.log("📋 Creating employee_forms table...");
    await query(`
      CREATE TABLE IF NOT EXISTS employee_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) CHECK (type IN ('intern', 'contract', 'fulltime')),
        form_data JSONB,
        files JSONB,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Create leave_requests table if not exists
    console.log("🏖️ Creating leave_requests table...");
    await query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        leave_type VARCHAR(20) CHECK (leave_type IN ('sick', 'casual', 'annual', 'other')),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        approved_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Update attendance table to match requirements
    console.log("📊 Updating attendance table...");
    await query(`
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS employee_id VARCHAR(6),
      ADD COLUMN IF NOT EXISTS reason TEXT,
      ADD COLUMN IF NOT EXISTS clock_in_time TIME,
      ADD COLUMN IF NOT EXISTS clock_out_time TIME;
    `);

    // 5. Create indexes for better performance
    console.log("🔍 Creating indexes...");
    await query(`
      CREATE INDEX IF NOT EXISTS idx_employee_forms_employee_id ON employee_forms(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_forms_status ON employee_forms(status);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
    `);

    // 6. Update master_employees table to match requirements
    console.log("👥 Updating master_employees table...");
    await query(`
      ALTER TABLE master_employees 
      ADD COLUMN IF NOT EXISTS company_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS doj DATE;
    `);

    // 7. Update default HR user with company email
    console.log("👔 Updating HR user...");
    await query(`
      UPDATE users 
      SET company_email = 'hr@nxzen.com', doj = created_at::date 
      WHERE email = 'hr@nxzen.com' AND company_email IS NULL;
    `);

    console.log("✅ Database schema updated successfully!");

    // Show current table structure
    console.log("\n📊 Current database structure:");

    const tables = [
      "users",
      "employee_forms",
      "leave_requests",
      "attendance",
      "master_employees",
    ];
    for (const table of tables) {
      try {
        const result = await query(
          `
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position;
        `,
          [table]
        );

        console.log(`\n📋 ${table.toUpperCase()} table:`);
        result.rows.forEach((col) => {
          console.log(
            `  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`
          );
        });
      } catch (err) {
        console.log(`❌ Could not read ${table} table structure:`, err.message);
      }
    }
  } catch (error) {
    console.error("❌ Schema update failed:", error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  updateSchema()
    .then(() => {
      console.log("🎉 Migration completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { updateSchema };
