const { query } = require("../config/database");

async function fixEmployeeStatus() {
  try {
    console.log("🔧 Fixing employee statuses...");

    // Update employees who are already onboarded to have hr_approved=true
    console.log(
      "🔄 Setting hr_approved=true for already onboarded employees..."
    );
    const result = await query(`
      UPDATE users 
      SET hr_approved = TRUE
      WHERE role = 'employee' 
        AND onboarded = TRUE 
        AND hr_approved = FALSE;
    `);

    console.log(`✅ Updated ${result.rowCount} employees`);

    // Show current employee statuses
    console.log("\n👥 Current employee statuses:");
    const userStatuses = await query(`
      SELECT email, role, form_submitted, hr_approved, onboarded, is_first_login
      FROM users
      WHERE role = 'employee';
    `);

    userStatuses.rows.forEach((user) => {
      console.log(
        `  - ${user.email}: form_submitted=${user.form_submitted}, hr_approved=${user.hr_approved}, onboarded=${user.onboarded}, first_login=${user.is_first_login}`
      );
    });
  } catch (error) {
    console.error("❌ Error fixing employee statuses:", error);
    throw error;
  }
}

// Run the migration
fixEmployeeStatus()
  .then(() => {
    console.log("🎉 Employee status fix completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Employee status fix failed:", error);
    process.exit(1);
  });
