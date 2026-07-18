import { API_TIMEOUT_MS, buildApiUrl } from "../config/api";
import {
  clearPatientSession,
  loadPatientSession,
} from "./sessionService";

let sessionExpiredHandler = null;

export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = typeof handler === "function" ? handler : null;
};

const createApiError = ({
  message,
  status = 0,
  data = {},
  code = "REQUEST_FAILED",
}) => {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  error.code = code;
  error.response = {
    status,
    data,
  };
  error.email_unverified = Boolean(data?.email_unverified);

  return error;
};

const parseResponse = async (response, fallbackMessage) => {
  const rawText = await response.text();
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw createApiError({
        message: "The server returned an invalid response.",
        status: response.status,
        code: "INVALID_SERVER_RESPONSE",
      });
    }
  }

  if (!response.ok) {
    throw createApiError({
      message: data.error || data.message || fallbackMessage,
      status: response.status,
      data,
      code: "HTTP_ERROR",
    });
  }

  return data;
};

const shouldExpireSession = (status, data) => {
  const message = String(data?.error || data?.message || "").toLowerCase();

  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  return (
    message.includes("session expired") ||
    message.includes("invalid token") ||
    message.includes("no valid token") ||
    message.includes("no token provided")
  );
};

export const apiRequest = async (
  path,
  {
    method = "GET",
    body,
    headers = {},
    token,
    authenticated = true,
    timeoutMs = API_TIMEOUT_MS,
    fallbackMessage = "The request could not be completed.",
  } = {},
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let authToken = token;

    if (authenticated && !authToken) {
      const savedSession = await loadPatientSession();
      authToken = savedSession?.token || null;
    }

    const requestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    const hasFormData =
      typeof FormData !== "undefined" && body instanceof FormData;

    if (body !== undefined && body !== null && !hasFormData) {
      requestHeaders["Content-Type"] =
        requestHeaders["Content-Type"] || "application/json";
    }

    if (authenticated && authToken) {
      requestHeaders.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(buildApiUrl(path), {
      method,
      headers: requestHeaders,
      body:
        body === undefined || body === null
          ? undefined
          : hasFormData
            ? body
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data = {};

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        throw createApiError({
          message: "The server returned an invalid response.",
          status: response.status,
          code: "INVALID_SERVER_RESPONSE",
        });
      }
    }

    if (!response.ok) {
      if (authenticated && shouldExpireSession(response.status, data)) {
        await clearPatientSession();

        if (sessionExpiredHandler) {
          sessionExpiredHandler({
            message:
              data.error || data.message || "Session expired. Please log in again.",
          });
        }
      }

      throw createApiError({
        message: data.error || data.message || fallbackMessage,
        status: response.status,
        data,
        code: "HTTP_ERROR",
      });
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createApiError({
        message:
          "The request timed out. Check your internet connection and try again.",
        code: "REQUEST_TIMEOUT",
      });
    }

    if (error?.code || error?.response) {
      throw error;
    }

    throw createApiError({
      message:
        "Unable to connect to DentoGraph. Check your internet connection and try again.",
      code: "NETWORK_ERROR",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const apiGet = (path, options = {}) =>
  apiRequest(path, {
    ...options,
    method: "GET",
  });

export const apiPost = (path, body, options = {}) =>
  apiRequest(path, {
    ...options,
    method: "POST",
    body,
  });

export const apiPut = (path, body, options = {}) =>
  apiRequest(path, {
    ...options,
    method: "PUT",
    body,
  });

export const apiDelete = (path, options = {}) =>
  apiRequest(path, {
    ...options,
    method: "DELETE",
  });

export { parseResponse };