import { apiGet, apiPost, apiPut } from "./apiClient";

const withToken = (token, fallbackMessage) => ({
  token,
  fallbackMessage,
});

export const getTransferDestinationClinics = async (token) =>
  apiGet(
    "/patient-transfers/destination-clinics",
    withToken(token, "Unable to load destination clinics."),
  );

export const getPatientTransferRequests = async (token) =>
  apiGet(
    "/patient-transfers/patient/requests",
    withToken(token, "Unable to load transfer requests."),
  );

export const createPatientTransferRequest = async ({
  token,
  destination_clinic_id,
  include_profile,
  include_dental_records,
  include_xrays,
  include_appointments,
  consent_confirmed,
  consent_statement,
}) =>
  apiPost(
    "/patient-transfers/requests",
    {
      destination_clinic_id,
      include_profile,
      include_dental_records,
      include_xrays,
      include_appointments,
      consent_confirmed,
      consent_statement,
    },
    withToken(token, "Unable to submit the transfer request."),
  );

export const cancelPatientTransferRequest = async ({
  token,
  transfer_id,
}) =>
  apiPut(
    `/patient-transfers/patient/requests/${transfer_id}/cancel`,
    {},
    withToken(token, "Unable to cancel the transfer request."),
  );

export const getPatientTransferPackage = async ({
  token,
  transfer_id,
}) =>
  apiGet(
    `/patient-transfers/requests/${transfer_id}/package`,
    withToken(token, "Unable to open the transferred information package."),
  );