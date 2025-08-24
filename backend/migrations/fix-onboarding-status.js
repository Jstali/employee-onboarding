const { query } = require("../config/database");

async function fixOnboardingStatus() {
  try {
    console.log("🔧 Fixing onboarding status fields...");

    // 1. Add missing status fields to Users table
    console.log("📝 Adding status fields to Users table...");
    await query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS form_submitted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS hr_approved BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);

    // 2. Update existing users to have proper default values
    console.log("🔄 Updating existing users with default values...");
    await query(`
      UPDATE "Users" 
      SET 
        form_submitted = COALESCE(form_submitted, FALSE),
        hr_approved = COALESCE(hr_approved, FALSE),
        onboarded = COALESCE(onboarded, FALSE),
        is_first_login = COALESCE(is_first_login, TRUE)
      WHERE form_submitted IS NULL 
         OR hr_approved IS NULL 
         OR onboarded IS NULL 
         OR is_first_login IS NULL;
    `);

    // 3. Set HR user as already onboarded
    console.log("👔 Setting HR user as onboarded...");
    await query(`
      UPDATE "Users" 
      SET 
        onboarded = TRUE,
        hr_approved = TRUE,
        form_submitted = TRUE,
        is_first_login = FALSE
      WHERE email = 'hr@nxzen.com';
    `);

    // 4. Create employee_forms table if it doesn't exist
    console.log("📋 Creating employee_forms table...");
    await query(`
      CREATE TABLE IF NOT EXISTS employee_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
        type VARCHAR(20) CHECK (type IN ('intern', 'contract', 'fulltime')),
        form_data JSONB,
        files JSONB,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by INTEGER REFERENCES "Users"(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Create attendance table if it doesn't exist
    console.log("📊 Creating attendance table...");
    await query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'wfh', 'leave')),
        reason TEXT,
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Create master_employees table if it doesn't exist
    console.log("👥 Creating master_employees table...");
    await query(`
      CREATE TABLE IF NOT EXISTS master_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        employee_type VARCHAR(50),
        role VARCHAR(50),
        status VARCHAR(50),
        department VARCHAR(100),
        join_date DATE,
        manager_id INTEGER REFERENCES "Users"(id),
        employee_id VARCHAR(6) UNIQUE,
        company_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Create indexes for better performance
    console.log("🔍 Creating indexes...");
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_form_submitted ON "Users"(form_submitted);
      CREATE INDEX IF NOT EXISTS idx_users_hr_approved ON "Users"(hr_approved);
      CREATE INDEX IF NOT EXISTS idx_users_onboarded ON "Users"(onboarded);
      CREATE INDEX IF NOT EXISTS idx_employee_forms_employee_id ON employee_forms(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_forms_status ON employee_forms(status);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    `);

    console.log("✅ Onboarding status fields fixed successfully!");

    // Show current table structure
    console.log("\n📊 Current Users table structure:");
    const usersStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      ORDER BY ordinal_position;
    `);

    usersStructure.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name}: ${row.data_type} (nullable: ${
          row.is_nullable === "YES" ? "YES" : "NO"
        })`
      );
    });

    // Show current user statuses
    console.log("\n👥 Current user statuses:");
    const userStatuses = await query(`
      SELECT email, role, form_submitted, hr_approved, onboarded, is_first_login
      FROM "Users";
    `);

    userStatuses.rows.forEach((user) => {
      console.log(
        `  - ${user.email} (${user.role}): form_submitted=${user.form_submitted}, hr_approved=${user.hr_approved}, onboarded=${user.onboarded}, first_login=${user.is_first_login}`
      );
    });
  } catch (error) {
    console.error("❌ Error fixing onboarding status:", error);
    throw error;
  }
}

// Run the migration
fixOnboardingStatus()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
