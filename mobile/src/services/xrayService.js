import { buildFileUrl } from "../config/api";
import { apiGet } from "./apiClient";

const withToken = (token, fallbackMessage) => ({
  token,
  fallbackMessage,
});

export const buildXrayFileUrl = (filePath) =>
  buildFileUrl(String(filePath || "").replace(/\\/g, "/"));

export const getXraysByRecord = async ({ token, recordId }) =>
  apiGet(
    `/xrays/record/${recordId}`,
    withToken(token, "Failed to load X-rays for this dental record."),
  );

export const getXrayById = async ({ token, xrayId }) =>
  apiGet(
    `/xrays/${xrayId}`,
    withToken(token, "Failed to load the selected X-ray."),
  );

export const getXrayAnnotations = async ({ token, xrayId }) =>
  apiGet(
    `/xrays/${xrayId}/annotations`,
    withToken(token, "Failed to load X-ray annotations."),
  );