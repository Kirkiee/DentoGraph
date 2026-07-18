import { apiGet, apiPost } from "./apiClient";

export const loginUser = async ({ email, password }) =>
  apiPost(
    "/users/login",
    {
      email,
      password,
    },
    {
      authenticated: false,
      fallbackMessage: "Login failed.",
    },
  );

export const registerPatient = async ({
  firstName,
  lastName,
  email,
  contactNumber,
  password,
  confirmPassword,
}) => {
  const fullName = `${String(firstName || "").trim()} ${String(
    lastName || "",
  ).trim()}`.trim();

  return apiPost(
    "/users/register",
    {
      name: fullName,
      email,
      contact_number: contactNumber,
      password,
      confirmPassword,
      role_id: 3,
    },
    {
      authenticated: false,
      fallbackMessage:
        "Unable to create the Patient account. Please try again.",
    },
  );
};

export const forgotPassword = async ({ email }) =>
  apiPost(
    "/users/forgot-password",
    { email },
    {
      authenticated: false,
      fallbackMessage:
        "Unable to send the password reset email. Please try again.",
    },
  );

export const resetPassword = async ({
  token,
  password,
  confirmPassword,
}) =>
  apiPost(
    `/users/reset-password/${encodeURIComponent(token)}`,
    {
      password,
      confirmPassword,
    },
    {
      authenticated: false,
      fallbackMessage: "Unable to reset the password. Please try again.",
    },
  );

export const resendVerificationEmail = async (payload) => {
  const email = typeof payload === "string" ? payload : payload?.email;

  return apiPost(
    "/users/resend-verification",
    { email },
    {
      authenticated: false,
      fallbackMessage:
        "Unable to resend the verification email. Please try again.",
    },
  );
};

export const verifyEmail = async ({ token }) =>
  apiGet(`/users/verify-email/${encodeURIComponent(token)}`, {
    authenticated: false,
    fallbackMessage: "Unable to verify the email address.",
  });