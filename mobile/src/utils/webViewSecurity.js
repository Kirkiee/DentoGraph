import { Linking } from "react-native";

import { WEB_APP_ORIGIN } from "../config/api";

const TRUSTED_WEB_ORIGINS = new Set([
  new URL(WEB_APP_ORIGIN).origin,
]);

const EXTERNAL_SCHEMES = [
  "mailto:",
  "tel:",
  "sms:",
  "geo:",
  "maps:",
];

export const isTrustedDentoGraphUrl = (url) => {
  const value = String(url || "").trim();

  if (!value) {
    return false;
  }

  if (value === "about:blank") {
    return true;
  }

  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" &&
      TRUSTED_WEB_ORIGINS.has(parsed.origin)
    );
  } catch {
    return false;
  }
};

export const handleTrustedWebNavigation = async ({
  request,
  onBlocked,
}) => {
  const url = String(request?.url || "").trim();

  if (isTrustedDentoGraphUrl(url)) {
    return true;
  }

  if (EXTERNAL_SCHEMES.some((scheme) => url.startsWith(scheme))) {
    const supported = await Linking.canOpenURL(url).catch(() => false);

    if (supported) {
      await Linking.openURL(url).catch(() => {});
    }

    return false;
  }

  onBlocked?.(url);
  return false;
};

export const TRUSTED_WEBVIEW_PROPS = {
  originWhitelist: ["https://dentograph.site", "about:blank"],
  javaScriptEnabled: true,
  domStorageEnabled: true,
  mixedContentMode: "never",
  allowFileAccess: false,
  allowFileAccessFromFileURLs: false,
  allowUniversalAccessFromFileURLs: false,
  thirdPartyCookiesEnabled: false,
  sharedCookiesEnabled: false,
  setSupportMultipleWindows: false,
};