import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import { WEB_APP_ORIGIN } from "../config/api";

const buildInjectedSessionScript = ({ token, user }) => {
  const safeToken = JSON.stringify(String(token || ""));
  const safeUser = JSON.stringify(JSON.stringify(user || {}));

  return `
    (function () {
      try {
        localStorage.setItem("token", ${safeToken});
        localStorage.setItem("user", ${safeUser});
        localStorage.setItem("rememberMe", "true");
        localStorage.setItem("dentograph-theme", "light");
        window.dispatchEvent(new Event("storage"));
      } catch (error) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SESSION_INJECTION_ERROR",
            message: error && error.message ? error.message : "Unable to prepare the session."
          })
        );
      }
    })();
    true;
  `;
};

export default function PatientDental3DViewerScreen({
  token,
  user,
  recordId,
  onBack,
}) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [pageError, setPageError] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);

  const viewerUrl = useMemo(
    () => `${WEB_APP_ORIGIN}/patient/records/${recordId}/3d-view`,
    [recordId],
  );

  const injectedJavaScriptBeforeContentLoaded = useMemo(
    () => buildInjectedSessionScript({ token, user }),
    [token, user],
  );

  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }

        onBack?.();
        return true;
      },
    );

    return () => subscription.remove();
  }, [canGoBack, onBack]);

  const handleMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === "SESSION_INJECTION_ERROR") {
        setPageError(payload.message);
      }
    } catch (error) {
      // Ignore messages that are not JSON.
    }
  };

  const handleNavigationRequest = (request) => {
    const url = String(request.url || "");

    if (
      url.includes("/auth/login") ||
      url.endsWith("/login") ||
      url.includes("/forgot-password")
    ) {
      setPageError(
        "The 3D viewer could not restore the Patient session. Return to the record and try again.",
      );
      return false;
    }

    return true;
  };

  const reloadViewer = () => {
    setPageError("");
    setLoading(true);
    webViewRef.current?.reload();
  };

  if (!recordId) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="alert-circle-outline" size={42} color="#94a3b8" />
        <Text style={styles.centerStateTitle}>No dental record selected</Text>
        <Pressable style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Record</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to dental record"
        >
          <Ionicons name="arrow-back" size={21} color="#1d4ed8" />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>3D Dental Visualization</Text>
          <Text style={styles.subtitle}>Dental Record #{recordId}</Text>
        </View>

        <Pressable
          style={styles.refreshButton}
          onPress={reloadViewer}
          accessibilityRole="button"
          accessibilityLabel="Refresh 3D viewer"
        >
          <Ionicons name="refresh" size={20} color="#1d4ed8" />
        </Pressable>
      </View>

      <View style={styles.readOnlyBanner}>
        <Ionicons name="lock-closed-outline" size={19} color="#166534" />
        <Text style={styles.readOnlyText}>
          This Patient view is read-only. Select a tooth inside the viewer to
          review its condition and recorded status history.
        </Text>
      </View>

      {pageError ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={26} color="#b91c1c" />
          <Text style={styles.errorTitle}>Unable to load the 3D viewer</Text>
          <Text style={styles.errorText}>{pageError}</Text>

          <View style={styles.errorActions}>
            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>Back to Record</Text>
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={reloadViewer}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.viewerContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: viewerUrl }}
            style={styles.webView}
            originWhitelist={["https://*"]}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            injectedJavaScriptBeforeContentLoaded={
              injectedJavaScriptBeforeContentLoaded
            }
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigationRequest}
            onNavigationStateChange={(state) => {
              setCanGoBack(Boolean(state.canGoBack));
            }}
            onLoadStart={() => {
              setLoading(true);
              setPageError("");
            }}
            onLoadProgress={({ nativeEvent }) => {
              setLoadProgress(nativeEvent.progress || 0);
            }}
            onLoadEnd={() => setLoading(false)}
            onHttpError={({ nativeEvent }) => {
              setPageError(
                `The 3D viewer returned HTTP ${nativeEvent.statusCode}.`,
              );
              setLoading(false);
            }}
            onError={({ nativeEvent }) => {
              setPageError(
                nativeEvent.description ||
                  "Unable to connect to the DentoGraph 3D viewer.",
              );
              setLoading(false);
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
          />

          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingTitle}>
                Loading 3D dental chart...
              </Text>
              <Text style={styles.loadingProgress}>
                {Math.round(loadProgress * 100)}%
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#bbf7d0",
  },
  readOnlyText: {
    flex: 1,
    color: "#166534",
    fontSize: 11,
    lineHeight: 17,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(248, 250, 252, 0.94)",
  },
  loadingTitle: {
    color: "#334155",
    fontWeight: "800",
  },
  loadingProgress: {
    color: "#64748b",
    fontSize: 12,
  },
  errorCard: {
    alignItems: "center",
    gap: 9,
    margin: 18,
    padding: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 16,
  },
  errorTitle: {
    color: "#991b1b",
    fontSize: 17,
    fontWeight: "900",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  errorActions: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 6,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 22,
    backgroundColor: "#f8fafc",
  },
  centerStateTitle: {
    color: "#334155",
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    backgroundColor: "#f1f5f9",
    borderRadius: 11,
  },
  secondaryButtonText: {
    color: "#475569",
    fontWeight: "800",
  },
});
