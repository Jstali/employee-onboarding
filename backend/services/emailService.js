const nodemailer = require("nodemailer");

// Create transporter
const createTransporter = () => {
  // Check if we have real email credentials
  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    console.log(
      "⚠️  No real email credentials found. Using test configuration."
    );
    console.log("📧 Emails will be sent to Ethereal (fake SMTP) for testing.");

    // Return test transporter (Ethereal Email)
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: "test@ethereal.email",
        pass: "test123",
      },
    });
  }

  console.log("✅ Using real Gmail SMTP configuration");
  console.log(`📧 Email will be sent from: ${process.env.EMAIL_USER}`);

  // Real email configuration
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send employee login credentials
const sendEmployeeCredentials = async (
  employeeEmail,
  employeeName,
  loginCredentials
) => {
  try {
    console.log(`📧 Attempting to send email to: ${employeeEmail}`);

    const transporter = createTransporter();

    // Verify transporter configuration
    console.log(`🔧 Transporter host: ${transporter.options.host}`);
    console.log(`🔧 Transporter port: ${transporter.options.port}`);
    console.log(`🔧 Transporter user: ${transporter.options.auth.user}`);

    const mailOptions = {
      from: `"${process.env.EMAIL_USER}" <${process.env.EMAIL_USER}>`,
      to: employeeEmail,
      subject: "Welcome to Company - Your Login Credentials",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Welcome to Company!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Employee Onboarding Portal</p>
          </div>
          
          <div style="padding: 20px; background: #f9f9f9;">
            <h2 style="color: #333; margin-top: 0;">Hello ${employeeName},</h2>
            
            <p style="color: #555; line-height: 1.6;">
              Welcome to our company! Your account has been created in our Employee Onboarding Portal. 
              Please use the following credentials to log in and complete your onboarding process.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Your Login Credentials:</h3>
              <div style="margin: 15px 0;">
                <strong style="color: #555;">Email:</strong> 
                <span style="color: #333; font-family: monospace;">${
                  loginCredentials.email
                }</span>
              </div>
              <div style="margin: 15px 0;">
                <strong style="color: #555;">Password:</strong> 
                <span style="color: #333; font-family: monospace;">${
                  loginCredentials.password
                }</span>
              </div>
            </div>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3;">
              <p style="margin: 0; color: #0d47a1;">
                <strong>Important:</strong> Please change your password after your first login for security purposes.
              </p>
            </div>
            
            <div style="margin: 25px 0;">
              <a href="${
                process.env.FRONTEND_URL || "http://localhost:3000"
              }/login" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Login to Portal
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions or need assistance, please contact the HR department.
            </p>
          </div>
          
          <div style="background: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      `,
      text: `
Welcome to Company!

Hello ${employeeName},

Welcome to our company! Your account has been created in our Employee Onboarding Portal. 
Please use the following credentials to log in and complete your onboarding process.

Your Login Credentials:
Email: ${loginCredentials.email}
Password: ${loginCredentials.password}

Important: Please change your password after your first login for security purposes.

Login URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}/login

If you have any questions or need assistance, please contact the HR department.

This is an automated message. Please do not reply to this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

// Send notification email (for approvals, rejections, etc.)
const sendNotificationEmail = async (
  toEmail,
  subject,
  message,
  isHTML = false
) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_USER}" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      ...(isHTML ? { html: message } : { text: message }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Notification email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending notification email:", error);
    throw new Error("Failed to send notification email");
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("✅ Email configuration is valid");
    return true;
  } catch (error) {
    console.error("❌ Email configuration error:", error);
    return false;
  }
};

module.exports = {
  sendEmployeeCredentials,
  sendNotificationEmail,
  testEmailConfig,
};
