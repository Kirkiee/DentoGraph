import { API_BASE_URL } from "../config/api";

const parseResponse = async (response, fallbackMessage) => {
  const text = await response.text();

  console.log("STATUS:", response.status);
  console.log("RAW RESPONSE:", text.slice(0, 500));

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error("Server returned a non-JSON response.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
};

export const loginUser = async ({ email, password }) => {
  const loginUrl = `${API_BASE_URL}/users/login`;

  console.log("LOGIN URL:", loginUrl);

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  return parseResponse(response, "Login failed");
};

export const registerPatient = async ({
  firstName,
  lastName,
  email,
  contactNumber,
  password,
  confirmPassword,
}) => {
  const registerUrl = `${API_BASE_URL}/users/register`;

  console.log("REGISTER URL:", registerUrl);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const response = await fetch(registerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: fullName,
      email,
      contact_number: contactNumber,
      password,
      confirmPassword,
      role_id: 3,
    }),
  });

  return parseResponse(
    response,
    "Unable to create patient account. Please try again."
  );
};

export const forgotPassword = async ({ email }) => {
  const forgotPasswordUrl = `${API_BASE_URL}/users/forgot-password`;

  console.log("FORGOT PASSWORD URL:", forgotPasswordUrl);

  const response = await fetch(forgotPasswordUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
    }),
  });

  return parseResponse(
    response,
    "Unable to send password reset email. Please try again."
  );
};

export const resetPassword = async ({ token, password, confirmPassword }) => {
  const resetPasswordUrl = `${API_BASE_URL}/users/reset-password/${token}`;

  console.log("RESET PASSWORD URL:", resetPasswordUrl);

  const response = await fetch(resetPasswordUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      password,
      confirmPassword,
    }),
  });

  return parseResponse(response, "Unable to reset password. Please try again.");
};

export const resendVerificationEmail = async ({ email }) => {
  const resendVerificationUrl = `${API_BASE_URL}/users/resend-verification`;

  console.log("RESEND VERIFICATION URL:", resendVerificationUrl);

  const response = await fetch(resendVerificationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
    }),
  });

  return parseResponse(
    response,
    "Unable to resend verification email. Please try again."
  );
};

export const verifyEmail = async ({ token }) => {
  const verifyEmailUrl = `${API_BASE_URL}/users/verify-email/${token}`;

  console.log("VERIFY EMAIL URL:", verifyEmailUrl);

  const response = await fetch(verifyEmailUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseResponse(response, "Unable to verify email.");
};