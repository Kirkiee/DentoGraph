import { apiGet } from "./apiClient";

const withToken = (token, fallbackMessage) => ({
  token,
  fallbackMessage,
});

export const getPatientDentalRecords = async (token) =>
  apiGet(
    "/dental-records/patient/my-records/list",
    withToken(token, "Failed to load dental records."),
  );

export const getDentalRecordDetails = async ({ token, record_id }) =>
  apiGet(
    `/dental-records/${record_id}`,
    withToken(token, "Failed to load dental record details."),
  );

export const getDentalRecordToothHistory = async ({
  token,
  record_id,
}) =>
  apiGet(
    `/dental-records/${record_id}/tooth-history`,
    withToken(token, "Failed to load tooth-status history."),
  );

export const getSingleToothHistory = async ({
  token,
  record_id,
  tooth_number,
}) =>
  apiGet(
    `/dental-records/${record_id}/teeth/${encodeURIComponent(
      tooth_number,
    )}/history`,
    withToken(token, "Failed to load the selected tooth history."),
  );