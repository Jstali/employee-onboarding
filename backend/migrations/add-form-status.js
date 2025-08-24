const { query } = require("../config/database");

async function addFormStatus() {
  try {
    console.log("🔧 Adding status field to employee_details table...");

    // Add status field to employee_details table
    console.log("📝 Adding status field...");
    await query(`
      ALTER TABLE employee_details 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
    `);

    // Update existing records to have 'pending' status
    console.log("🔄 Setting default status for existing forms...");
    await query(`
      UPDATE employee_details 
      SET status = 'pending' 
      WHERE status IS NULL;
    `);

    console.log("✅ Status field added successfully!");

    // Show current table structure
    console.log("\n📊 Current employee_details table structure:");
    const tableStructure = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'employee_details' 
      ORDER BY ordinal_position;
    `);

    tableStructure.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name}: ${row.data_type} (nullable: ${
          row.is_nullable === "YES" ? "YES" : "NO"
        })`
      );
    });

    // Show current form statuses
    console.log("\n📋 Current form statuses:");
    const formStatuses = await query(`
      SELECT ed.id, ed.status, u.name, u.email
      FROM employee_details ed
      JOIN users u ON ed.user_id = u.id
      LIMIT 10;
    `);

    formStatuses.rows.forEach((form) => {
      console.log(
        `  - Form ${form.id}: ${form.status} (${form.name} - ${form.email})`
      );
    });
  } catch (error) {
    console.error("❌ Error adding status field:", error);
    throw error;
  }
}

// Run the migration
addFormStatus()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });
