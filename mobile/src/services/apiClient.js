import { API_TIMEOUT_MS, buildApiUrl } from "../config/api";
import {
  clearPatientSession,
  loadPatientSession,
} from "./sessionService";
import {
  isDeviceOffline,
  refreshNetworkStatus,
} from "./networkService";

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
    } catch {
      throw createApiError({
        message: "DentoGraph returned an invalid server response.",
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

const expireCurrentSession = async () => {
  await clearPatientSession();

  if (sessionExpiredHandler) {
    sessionExpiredHandler();
  }
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const request = async (
  path,
  {
    method = "GET",
    token,
    body,
    headers = {},
    fallbackMessage = "Unable to complete the request.",
    timeoutMs = API_TIMEOUT_MS,
    retryCount,
  } = {},
) => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const safeRetryCount =
    retryCount === undefined
      ? normalizedMethod === "GET"
        ? 1
        : 0
      : Math.max(0, Number(retryCount) || 0);

  const session = token ? null : await loadPatientSession();
  const accessToken = token || session?.token || null;

  const executeRequest = async (attempt) => {
    await refreshNetworkStatus().catch(() => {});

    if (isDeviceOffline()) {
      throw createApiError({
        message:
          "You are offline. Reconnect to the internet and try again.",
        code: "OFFLINE",
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(buildApiUrl(path), {
        method: normalizedMethod,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
          ...headers,
        },
        body:
          body === undefined
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await response.clone().text();
      let responseData = {};

      if (rawText) {
        try {
          responseData = JSON.parse(rawText);
        } catch {
          responseData = {};
        }
      }

      if (shouldExpireSession(response.status, responseData)) {
        await expireCurrentSession();
      }

      if (
        attempt < safeRetryCount &&
        normalizedMethod === "GET" &&
        response.status >= 500
      ) {
        await wait(650 * (attempt + 1));
        return executeRequest(attempt + 1);
      }

      return parseResponse(response, fallbackMessage);
    } catch (error) {
      if (error?.code === "OFFLINE") {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw createApiError({
          message:
            "DentoGraph took too long to respond. Check your connection and try again.",
          code: "REQUEST_TIMEOUT",
        });
      }

      if (
        attempt < safeRetryCount &&
        normalizedMethod === "GET" &&
        (error instanceof TypeError || error?.code === "NETWORK_ERROR")
      ) {
        await wait(650 * (attempt + 1));
        return executeRequest(attempt + 1);
      }

      if (error?.status || error?.code === "INVALID_SERVER_RESPONSE") {
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

  return executeRequest(0);
};

export const apiGet = (path, options = {}) =>
  request(path, { ...options, method: "GET" });

export const apiPost = (path, body, options = {}) =>
  request(path, { ...options, method: "POST", body });

export const apiPut = (path, body, options = {}) =>
  request(path, { ...options, method: "PUT", body });

export const apiPatch = (path, body, options = {}) =>
  request(path, { ...options, method: "PATCH", body });

export const apiDelete = (path, options = {}) =>
  request(path, { ...options, method: "DELETE" });

export { createApiError };