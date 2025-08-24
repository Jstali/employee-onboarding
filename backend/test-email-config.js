const { sendEmail } = require("./utils/email");

const testEmailConfiguration = async () => {
  try {
    console.log(
      "🧪 Testing Email Configuration with New Gmail App Password..."
    );
    console.log("📧 Configuration Details:");
    console.log("   Host:", process.env.SMTP_HOST || "smtp.gmail.com");
    console.log("   Port:", process.env.SMTP_PORT || 587);
    console.log("   User:", process.env.SMTP_USER || "alpha@nxen.com");
    console.log(
      "   Password:",
      process.env.SMTP_PASS
        ? "SET (length: " + process.env.SMTP_PASS.length + ")"
        : "NOT SET"
    );

    console.log("\n📤 Attempting to send test email...");

    const result = await sendEmail(
      "test@example.com", // Replace with your actual email for testing
      "Test Email - Gmail App Password Configuration",
      `<p>Hello!</p>
       <p>This is a test email to verify the Gmail App Password configuration.</p>
       <p>If you receive this email, the configuration is working correctly!</p>
       <p>Best regards,<br>HR Team</p>`
    );

    console.log("✅ Test email sent successfully!");
    console.log("   Message ID:", result.messageId);
    console.log("   Response:", result.response);

    return true;
  } catch (error) {
    console.error("❌ Test email failed:", error.message);
    console.error("   Error code:", error.code);
    console.error("   Response:", error.response);
    return false;
  }
};

// Run test if this file is executed directly
if (require.main === module) {
  testEmailConfiguration()
    .then((success) => {
      if (success) {
        console.log("\n🎉 Email configuration test PASSED!");
        console.log("✅ Your Gmail App Password is working correctly!");
        console.log(
          "✅ Emails will now be sent successfully from the HR dashboard!"
        );
      } else {
        console.log("\n💥 Email configuration test FAILED!");
        console.log(
          "❌ Please check the error details above and fix the configuration."
        );
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Test execution failed:", error);
      process.exit(1);
    });
}

module.exports = { testEmailConfiguration };
