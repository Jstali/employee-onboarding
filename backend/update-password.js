const { query } = require("./config/database");
const bcrypt = require("bcryptjs");

async function updateHRPassword() {
  try {
    const newPassword = "hr123";
    const hash = bcrypt.hashSync(newPassword, 12);

    await query("UPDATE users SET password_hash = $1 WHERE email = $2", [
      hash,
      "hr@company.com",
    ]);
    console.log("✅ HR password updated successfully!");
    console.log("📧 Email: hr@company.com");
    console.log("🔑 Password: hr123");
  } catch (err) {
    console.error("❌ Error updating password:", err.message);
  }
}

updateHRPassword();
