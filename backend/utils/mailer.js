const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "alphanxzen@gmail.com",
    pass: "tqer yzuv inzd obeu",
  },
});

async function sendOnboardingEmail(to, tempPassword) {
  const mailOptions = {
    from: "alphanxzen@gmail.com",
    to,
    subject: "Employee Onboarding Login Details",
    text: `Welcome to the company! \n\nLogin here: http://localhost:3000/login \nEmail: ${to} \nTemporary Password: ${tempPassword}\n\nPlease reset your password after logging in.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to " + to);
    return { success: true };
  } catch (err) {
    console.error("❌ Failed to send email:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOnboardingEmail };
