import { apiGet } from "./apiClient";

export const getPatientDashboard = async (token) =>
  apiGet("/dashboard/patient", {
    token,
    fallbackMessage: "Unable to load the Patient dashboard.",
  });