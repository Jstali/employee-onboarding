const { query } = require("./config/database");

const migrateDatabase = async () => {
  try {
    console.log("🔧 Starting database migration...");

    // Add personal_email column to master_employees table if it doesn't exist
    try {
      await query(`
        ALTER TABLE master_employees 
        ADD COLUMN IF NOT EXISTS personal_email VARCHAR(100)
      `);
      console.log("✅ Added personal_email column to master_employees table");
    } catch (error) {
      console.log(
        "ℹ️ personal_email column already exists or error:",
        error.message
      );
    }

    // Add employee_id column to master_employees table if it doesn't exist
    try {
      await query(`
        ALTER TABLE master_employees 
        ADD COLUMN IF NOT EXISTS employee_id VARCHAR(6)
      `);
      console.log("✅ Added employee_id column to master_employees table");
    } catch (error) {
      console.log(
        "ℹ️ employee_id column already exists or error:",
        error.message
      );
    }

    // Add unique constraint to employee_id if it doesn't exist
    try {
      await query(`
        ALTER TABLE master_employees 
        ADD CONSTRAINT IF NOT EXISTS unique_employee_id UNIQUE (employee_id)
      `);
      console.log("✅ Added unique constraint to employee_id column");
    } catch (error) {
      console.log(
        "ℹ️ unique constraint on employee_id already exists or error:",
        error.message
      );
    }

    // Add form_submitted column to users table if it doesn't exist
    try {
      await query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS form_submitted BOOLEAN DEFAULT false
      `);
      console.log("✅ Added form_submitted column to users table");
    } catch (error) {
      console.log(
        "ℹ️ form_submitted column already exists or error:",
        error.message
      );
    }

    // Add onboarded column to users table if it doesn't exist
    try {
      await query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false
      `);
      console.log("✅ Added onboarded column to users table");
    } catch (error) {
      console.log(
        "ℹ️ onboarded column already exists or error:",
        error.message
      );
    }

    // Add form_submitted column to master_employees table if it doesn't exist
    try {
      await query(`
        ALTER TABLE master_employees 
        ADD COLUMN IF NOT EXISTS form_submitted BOOLEAN DEFAULT false
      `);
      console.log("✅ Added form_submitted column to master_employees table");
    } catch (error) {
      console.log(
        "ℹ️ form_submitted column already exists or error:",
        error.message
      );
    }

    console.log("🎉 Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    process.exit(1);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  migrateDatabase();
}

module.exports = { migrateDatabase };
