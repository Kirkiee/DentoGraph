const nodemailer = require("nodemailer");

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration is incomplete. Please check SMTP_HOST, SMTP_USER, and SMTP_PASS.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  return sendEmail({
    to,
    subject: "Verify your DentoGraph email address",
    text: `Hello ${name},

Thank you for registering with DentoGraph.

Please verify your email address using this link:
${verificationUrl}

This link will expire in 24 hours.

If you did not create this account, you can ignore this email.

DentoGraph Team`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1a202c; line-height: 1.6;">
        <h2>Verify your DentoGraph email address</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with DentoGraph.</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;padding:12px 18px;background:#2b6cb0;color:#ffffff;text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not create this account, you can ignore this email.</p>
        <p>DentoGraph Team</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  return sendEmail({
    to,
    subject: "Reset your DentoGraph password",
    text: `Hello ${name},

We received a request to reset your DentoGraph password.

Reset your password using this link:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, you can ignore this email.

DentoGraph Team`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1a202c; line-height: 1.6;">
        <h2>Reset your DentoGraph password</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your DentoGraph password.</p>
        <p>Click the button below to reset your password:</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 18px;background:#2b6cb0;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>DentoGraph Team</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
