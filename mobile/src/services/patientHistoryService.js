import { apiGet } from "./apiClient";

export const getPatientHistoricalRecords = async (token) =>
  apiGet("/patient-transfers/historical-records", {
    token,
    fallbackMessage: "Unable to load historical dental records.",
  });