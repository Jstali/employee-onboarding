const { query } = require("../config/database");

async function addStatusFields() {
  try {
    console.log("🔧 Adding status fields to Users table...");

    // Add missing status fields to Users table
    console.log("📝 Adding status fields...");
    await query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS form_submitted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS hr_approved BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);

    // Update existing users to have proper default values
    console.log("🔄 Setting default values for existing users...");
    await query(`
      UPDATE "Users" 
      SET 
        form_submitted = FALSE,
        hr_approved = FALSE,
        onboarded = FALSE,
        is_first_login = TRUE
      WHERE form_submitted IS NULL;
    `);

    // Set HR user as already onboarded
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

    console.log("✅ Status fields added successfully!");

    // Show current table structure
    console.log("\n📊 Current Users table structure:");
    const usersStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      ORDER BY ordinal_position;
    `);
    
    usersStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable === 'YES' ? 'YES' : 'NO'})`);
    });

    // Show current user statuses
    console.log("\n👥 Current user statuses:");
    const userStatuses = await query(`
      SELECT email, role, form_submitted, hr_approved, onboarded, is_first_login
      FROM "Users";
    `);
    
    userStatuses.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.role}): form_submitted=${user.form_submitted}, hr_approved=${user.hr_approved}, onboarded=${user.onboarded}, first_login=${user.is_first_login}`);
    });

  } catch (error) {
    console.error("❌ Error adding status fields:", error);
    throw error;
  }
}

// Run the migration
addStatusFields()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
