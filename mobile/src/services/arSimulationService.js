import { buildFileUrl } from "../config/api";
import { apiDelete, apiGet } from "./apiClient";

const withToken = (token, fallbackMessage) => ({
  token,
  fallbackMessage,
});

export const buildARSimulationImageUrl = (imagePath) =>
  buildFileUrl(String(imagePath || "").replace(/\\/g, "/"));

export const getMyARPreviews = async (token) =>
  apiGet(
    "/ar-simulations/my-previews",
    withToken(token, "Unable to load AR braces previews."),
  );

export const getARPreviewsByRecord = async ({ token, recordId }) =>
  apiGet(
    `/ar-simulations/record/${recordId}`,
    withToken(token, "Unable to load AR previews for this dental record."),
  );

export const deleteARPreview = async ({ token, simulationId }) =>
  apiDelete(
    `/ar-simulations/${simulationId}`,
    withToken(token, "Unable to delete the AR braces preview."),
  );