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

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const sendClinicApplicationReceivedEmail = async ({
  to,
  ownerName,
  clinicName,
  applicationId,
}) => {
  const safeOwnerName = escapeHtml(ownerName);
  const safeClinicName = escapeHtml(clinicName);
  const safeApplicationId = escapeHtml(applicationId);

  return sendEmail({
    to,
    subject: "DentoGraph clinic application received",
    text: `Hello ${ownerName},

Your clinic application for ${clinicName} has been received.

Application reference: ${applicationId}
Status: Pending Administrator Review

Your Clinic Owner account and clinic location will remain inactive while an Administrator validates the submitted information and documents.

You will receive another email when the application is approved or rejected.

DentoGraph Team`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a202c;line-height:1.65;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Clinic application received</h2>
        <p>Hello ${safeOwnerName},</p>
        <p>Your clinic application for <strong>${safeClinicName}</strong> has been received.</p>
        <div style="padding:14px 16px;border:1px solid #f6c344;border-radius:10px;background:#fffaf0;">
          <strong>Status: Pending Administrator Review</strong>
          <p style="margin:6px 0 0;">Application reference: ${safeApplicationId}</p>
        </div>
        <p>Your Clinic Owner account and clinic location will remain inactive while an Administrator validates the submitted information and documents.</p>
        <p>You will receive another email when the application is approved or rejected.</p>
        <p>DentoGraph Team</p>
      </div>
    `,
  });
};

const sendClinicApplicationApprovedEmail = async ({
  to,
  ownerName,
  clinicName,
  loginUrl,
}) => {
  const safeOwnerName = escapeHtml(ownerName);
  const safeClinicName = escapeHtml(clinicName);
  const safeLoginUrl = escapeHtml(loginUrl);

  return sendEmail({
    to,
    subject: "Your DentoGraph clinic application was approved",
    text: `Hello ${ownerName},

Your clinic application for ${clinicName} has been approved.

Your clinic location and Clinic Owner account are now active. You may sign in using your registered email address and password:
${loginUrl}

DentoGraph Team`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a202c;line-height:1.65;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Clinic application approved</h2>
        <p>Hello ${safeOwnerName},</p>
        <p>Your clinic application for <strong>${safeClinicName}</strong> has been approved.</p>
        <div style="padding:14px 16px;border:1px solid #48bb78;border-radius:10px;background:#f0fff4;">
          <strong>Your clinic and Clinic Owner account are now active.</strong>
        </div>
        <p>You may now sign in using your registered email address and password.</p>
        <p>
          <a href="${safeLoginUrl}"
             style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Sign In to DentoGraph
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${safeLoginUrl}">${safeLoginUrl}</a></p>
        <p>DentoGraph Team</p>
      </div>
    `,
  });
};

const sendClinicApplicationRejectedEmail = async ({
  to,
  ownerName,
  clinicName,
  rejectionReason,
  registrationUrl,
}) => {
  const safeOwnerName = escapeHtml(ownerName);
  const safeClinicName = escapeHtml(clinicName);
  const safeReason = escapeHtml(rejectionReason);
  const safeRegistrationUrl = escapeHtml(registrationUrl);

  return sendEmail({
    to,
    subject: "Your DentoGraph clinic application was not approved",
    text: `Hello ${ownerName},

Your clinic application for ${clinicName} was not approved.

Reason:
${rejectionReason}

The pending Clinic Owner account, clinic application, and submitted verification documents have been removed from DentoGraph.

You may submit a new application after correcting the stated issue:
${registrationUrl}

DentoGraph Team`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1a202c;line-height:1.65;max-width:640px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Clinic application not approved</h2>
        <p>Hello ${safeOwnerName},</p>
        <p>Your clinic application for <strong>${safeClinicName}</strong> was not approved.</p>
        <div style="padding:14px 16px;border:1px solid #fc8181;border-radius:10px;background:#fff5f5;">
          <strong>Reason</strong>
          <p style="margin:6px 0 0;white-space:pre-wrap;">${safeReason}</p>
        </div>
        <p>The pending Clinic Owner account, clinic application, and submitted verification documents have been removed from DentoGraph.</p>
        <p>You may submit a new application after correcting the stated issue.</p>
        <p>
          <a href="${safeRegistrationUrl}"
             style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            Submit a New Application
          </a>
        </p>
        <p>DentoGraph Team</p>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendClinicApplicationReceivedEmail,
  sendClinicApplicationApprovedEmail,
  sendClinicApplicationRejectedEmail,
};
