const nodemailer = require("nodemailer");

// Create transporter with better error handling
const createTransporter = () => {
  try {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587, // Using port 587 for better compatibility
      secure: false, // false for port 587, true for port 465
      auth: {
        user: process.env.SMTP_USER || "alphanxzen@gmail.com",
        pass: process.env.SMTP_PASS || "tqer yzuv inzd obeu",
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: "SSLv3",
      },
      debug: true, // Enable debug output
      logger: true, // Log to console
    });
  } catch (error) {
    console.error("❌ Failed to create email transporter:", error);
    throw error;
  }
};

async function sendEmail(to, subject, html) {
  try {
    console.log("📧 Attempting to send email...");
    console.log("   To:", to);
    console.log("   Subject:", subject);
    console.log("   From:", process.env.SMTP_USER || "alpha@nxen.com");

    const transporter = createTransporter();

    // Verify connection first
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    // Send email
    const result = await transporter.sendMail({
      from: `"HR Team" <${process.env.SMTP_USER || "alphanxzen@gmail.com"}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent successfully to:", to);
    console.log("   Message ID:", result.messageId);

    return result;
  } catch (error) {
    console.error("❌ Email send failed:", error);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command,
    });

    // Provide user-friendly error message
    if (error.code === "EAUTH") {
      throw new Error(
        "Email authentication failed. Please check Gmail App Password configuration."
      );
    } else if (error.code === "ECONNECTION") {
      throw new Error(
        "Email connection failed. Please check internet connection and SMTP settings."
      );
    } else {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
}

module.exports = { sendEmail };
