const { query } = require("./config/database");

async function fixExistingEmployees() {
  try {
    console.log("🔧 Fixing existing employee statuses...");

    // First, let's see what the current statuses are
    console.log("\n📊 Current employee statuses:");
    const currentStatuses = await query(`
      SELECT id, name, email, role, form_submitted, hr_approved, onboarded, status
      FROM users 
      WHERE role = 'employee'
      ORDER BY email;
    `);

    currentStatuses.rows.forEach((user) => {
      console.log(
        `  - ${user.email}: form_submitted=${user.form_submitted}, onboarded=${user.onboarded}, status=${user.status}`
      );
    });

    // Fix employees who have form_submitted=true but haven't actually submitted forms
    console.log(
      "\n🔧 Fixing employees with incorrect form_submitted status..."
    );

    // Check if employee_details table has data for each employee
    const employeesToFix = await query(`
      SELECT u.id, u.name, u.email, u.form_submitted, u.onboarded, u.status
      FROM users u
      LEFT JOIN employee_details ed ON u.id = ed.user_id
      WHERE u.role = 'employee' 
        AND u.form_submitted = true 
        AND ed.user_id IS NULL
    `);

    if (employeesToFix.rows.length > 0) {
      console.log(
        `\n📝 Found ${employeesToFix.rows.length} employees with incorrect form_submitted status:`
      );
      employeesToFix.rows.forEach((emp) => {
        console.log(
          `  - ${emp.email}: form_submitted=${emp.form_submitted}, onboarded=${emp.onboarded}`
        );
      });

      // Fix these employees
      for (const emp of employeesToFix.rows) {
        await query(
          `
          UPDATE users 
          SET 
            form_submitted = false,
            onboarded = false,
            status = 'pending',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
          [emp.id]
        );

        console.log(
          `✅ Fixed ${emp.email}: set form_submitted=false, onboarded=false, status='pending'`
        );
      }
    } else {
      console.log("✅ No employees found with incorrect form_submitted status");
    }

    // Also check for employees who have onboarded=true but form_submitted=false
    console.log(
      "\n🔧 Checking for employees with onboarded=true but form_submitted=false..."
    );
    const onboardedWithoutForm = await query(`
      SELECT id, name, email, form_submitted, onboarded, status
      FROM users 
      WHERE role = 'employee' 
        AND onboarded = true 
        AND form_submitted = false
    `);

    if (onboardedWithoutForm.rows.length > 0) {
      console.log(
        `\n📝 Found ${onboardedWithoutForm.rows.length} employees with onboarded=true but form_submitted=false:`
      );
      onboardedWithoutForm.rows.forEach((emp) => {
        console.log(
          `  - ${emp.email}: form_submitted=${emp.form_submitted}, onboarded=${emp.onboarded}`
        );
      });

      // Fix these employees
      for (const emp of onboardedWithoutForm.rows) {
        await query(
          `
          UPDATE users 
          SET 
            onboarded = false,
            status = 'pending',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
          [emp.id]
        );

        console.log(
          `✅ Fixed ${emp.email}: set onboarded=false, status='pending'`
        );
      }
    } else {
      console.log(
        "✅ No employees found with onboarded=true but form_submitted=false"
      );
    }

    // Show final statuses
    console.log("\n📊 Final employee statuses after fixes:");
    const finalStatuses = await query(`
      SELECT id, name, email, role, form_submitted, hr_approved, onboarded, status
      FROM users 
      WHERE role = 'employee'
      ORDER BY email;
    `);

    finalStatuses.rows.forEach((user) => {
      console.log(
        `  - ${user.email}: form_submitted=${user.form_submitted}, onboarded=${user.onboarded}, status=${user.status}`
      );
    });

    console.log("\n✅ Employee status fixes completed!");
  } catch (error) {
    console.error("❌ Error fixing employee statuses:", error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixExistingEmployees();
