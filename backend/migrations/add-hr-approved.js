const { query } = require("../config/database");

async function addHrApproved() {
  try {
    console.log("🔧 Adding hr_approved field to users table...");

    // Add hr_approved field to users table
    console.log("📝 Adding hr_approved field...");
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS hr_approved BOOLEAN DEFAULT FALSE;
    `);

    // Update existing users to have proper default values
    console.log("🔄 Setting default values for existing users...");
    await query(`
      UPDATE users 
      SET hr_approved = FALSE
      WHERE hr_approved IS NULL;
    `);

    // Set HR user as already approved
    console.log("👔 Setting HR user as approved...");
    await query(`
      UPDATE users 
      SET 
        hr_approved = TRUE,
        onboarded = TRUE,
        form_submitted = TRUE,
        is_first_login = FALSE
      WHERE email = 'hr@nxzen.com';
    `);

    console.log("✅ hr_approved field added successfully!");

    // Show current table structure
    console.log("\n📊 Current users table structure:");
    const usersStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    usersStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable === 'YES' ? 'YES' : 'NO'})`);
    });

    // Show current user statuses
    console.log("\n👥 Current user statuses:");
    const userStatuses = await query(`
      SELECT email, role, form_submitted, hr_approved, onboarded, is_first_login
      FROM users;
    `);
    
    userStatuses.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.role}): form_submitted=${user.form_submitted}, hr_approved=${user.hr_approved}, onboarded=${user.onboarded}, first_login=${user.is_first_login}`);
    });

  } catch (error) {
    console.error("❌ Error adding hr_approved field:", error);
    throw error;
  }
}

// Run the migration
addHrApproved()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
