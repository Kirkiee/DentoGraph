import {
  apiGet,
  apiPost,
  apiPut,
} from "./apiClient";

export const getPatientProfile = (token) =>
  apiGet("/patients/profile", {
    token,
    fallbackMessage: "Unable to load patient profile.",
  });

export const updatePatientProfile = ({ token, profile }) =>
  apiPut("/patients/profile", profile, {
    token,
    fallbackMessage: "Unable to update patient profile.",
  });

export const requestProfileVerification = ({
  token,
  type,
  value,
}) =>
  apiPost(
    "/patients/profile/verification/request",
    { type, value },
    {
      token,
      fallbackMessage: "Unable to send the verification code.",
    },
  );

export const confirmProfileVerification = ({
  token,
  type,
  code,
}) =>
  apiPost(
    "/patients/profile/verification/confirm",
    { type, code },
    {
      token,
      fallbackMessage: "Unable to verify the requested change.",
    },
  );