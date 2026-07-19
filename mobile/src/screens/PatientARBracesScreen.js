import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PermissionStateCard from "../components/PermissionStateCard";
import {
  getCameraPermissionState,
  getPermissionMessage,
  openApplicationSettings,
  PERMISSION_STATUS,
  requestCameraPermission,
} from "../services/permissionService";
import { WebView } from "react-native-webview";

import { WEB_APP_ORIGIN } from "../config/api";
import {
  handleTrustedWebNavigation,
  TRUSTED_WEBVIEW_PROPS,
} from "../utils/webViewSecurity";
import {
  buildARSimulationImageUrl,
  deleteARPreview,
  getMyARPreviews,
} from "../services/arSimulationService";

const formatDateTime = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getStyleLabel = (value) => {
  switch (String(value || "metal").toLowerCase()) {
    case "ceramic":
      return "Ceramic Braces";
    case "blue":
      return "Blue Braces";
    case "pink":
      return "Pink Braces";
    case "green":
      return "Green Braces";
    case "purple":
      return "Purple Braces";
    default:
      return "Metal Braces";
  }
};

const getStatusStyle = (status) => {
  const normalized = String(status || "Pending Review").toLowerCase();

  if (normalized.includes("approved")) {
    return {
      container: styles.approvedBadge,
      text: styles.approvedBadgeText,
    };
  }

  if (normalized.includes("reject")) {
    return {
      container: styles.rejectedBadge,
      text: styles.rejectedBadgeText,
    };
  }

  return {
    container: styles.pendingBadge,
    text: styles.pendingBadgeText,
  };
};

const buildInjectedSessionScript = ({ token, user }) => {
  const safeToken = JSON.stringify(String(token || ""));
  const safeUser = JSON.stringify(JSON.stringify(user || {}));

  return `
    (function () {
      try {
        localStorage.setItem("token", ${safeToken});
        localStorage.setItem("user", ${safeUser});
        localStorage.setItem("rememberMe", "true");
        window.dispatchEvent(new Event("storage"));
      } catch (error) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SESSION_ERROR",
            message: error && error.message
              ? error.message
              : "Unable to prepare the Patient session."
          })
        );
      }
    })();
    true;
  `;
};

const PreviewCard = ({ preview, onOpen, onDelete, deleting }) => {
  const badge = getStatusStyle(preview.review_status);

  return (
    <View style={styles.previewCard}>
      <Pressable onPress={() => onOpen(preview)}>
        <Image
          source={{ uri: buildARSimulationImageUrl(preview.image_path) }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      </Pressable>

      <View style={styles.previewContent}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHeaderText}>
            <Text style={styles.previewTitle}>
              {getStyleLabel(preview.brace_style)}
            </Text>
            <Text style={styles.previewDate}>
              {formatDateTime(preview.created_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, badge.container]}>
            <Text style={[styles.statusBadgeText, badge.text]}>
              {preview.review_status || "Pending Review"}
            </Text>
          </View>
        </View>

        <Text style={styles.previewMeta}>
          Dental Record #{preview.record_id || "Not linked"}
        </Text>

        {preview.notes ? (
          <Text style={styles.previewNotes}>{preview.notes}</Text>
        ) : null}

        <View style={styles.previewActions}>
          <Pressable
            style={styles.viewButton}
            onPress={() => onOpen(preview)}
          >
            <Ionicons name="expand-outline" size={17} color="#1d4ed8" />
            <Text style={styles.viewButtonText}>View Preview</Text>
          </Pressable>

          <Pressable
            style={styles.deleteButton}
            onPress={() => onDelete(preview)}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={17} color="#b91c1c" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default function PatientARBracesScreen({
  token,
  user,
}) {
  const webViewRef = useRef(null);

  const [previews, setPreviews] = useState([]);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [simulatorVisible, setSimulatorVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorError, setSimulatorError] = useState("");
  const [webCanGoBack, setWebCanGoBack] = useState(false);
  const [cameraPermission, setCameraPermission] = useState({
    status: PERMISSION_STATUS.UNDETERMINED,
    granted: false,
    canAskAgain: true,
  });
  const [checkingCameraPermission, setCheckingCameraPermission] =
    useState(false);

  const simulatorUrl = `${WEB_APP_ORIGIN}/patient/ar-braces?embed=mobile`;

  const injectedSessionScript = useMemo(
    () => buildInjectedSessionScript({ token, user }),
    [token, user],
  );

  useEffect(() => {
    loadPreviews();
    refreshCameraPermission();
  }, []);

  const refreshCameraPermission = async () => {
    try {
      setCheckingCameraPermission(true);
      const permission = await getCameraPermissionState();
      setCameraPermission(permission);
      return permission;
    } finally {
      setCheckingCameraPermission(false);
    }
  };

  const ensureCameraPermission = async () => {
    try {
      setCheckingCameraPermission(true);
      let permission = await getCameraPermissionState();

      if (!permission.granted && permission.canAskAgain) {
        permission = await requestCameraPermission();
      }

      setCameraPermission(permission);
      return permission.granted;
    } finally {
      setCheckingCameraPermission(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "android" || !simulatorVisible) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (webCanGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }

        setSimulatorVisible(false);
        return true;
      },
    );

    return () => subscription.remove();
  }, [simulatorVisible, webCanGoBack]);

  const loadPreviews = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const response = await getMyARPreviews(token);
      setPreviews(
        Array.isArray(response.simulations)
          ? response.simulations
          : Array.isArray(response.previews)
            ? response.previews
            : [],
      );
    } catch (error) {
      Alert.alert(
        "AR Braces Error",
        error.message || "Unable to load saved AR braces previews.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openPreview = (preview) => {
    setSelectedPreview(preview);
    setPreviewVisible(true);
  };

  const confirmDelete = (preview) => {
    Alert.alert(
      "Delete AR Preview",
      "Delete this saved braces simulation preview?",
      [
        { text: "Keep Preview", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(preview.simulation_id);

              const response = await deleteARPreview({
                token,
                simulationId: preview.simulation_id,
              });

              Alert.alert(
                "Preview Deleted",
                response.message || "The AR braces preview was deleted.",
              );

              await loadPreviews();
            } catch (error) {
              Alert.alert(
                "Delete Failed",
                error.message || "Unable to delete the AR braces preview.",
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const openSimulator = async () => {
    const allowed = await ensureCameraPermission();

    if (!allowed) {
      return;
    }

    setSimulatorError("");
    setSimulatorLoading(true);
    setSimulatorVisible(true);
  };

  const closeSimulator = () => {
    setSimulatorVisible(false);
    setSimulatorError("");
    setWebCanGoBack(false);
    loadPreviews({ refresh: true });
  };

  const handleWebMessage = (event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === "SESSION_ERROR") {
        setSimulatorError(payload.message);
      }
    } catch (error) {
      // Ignore non-JSON messages.
    }
  };

  const handleNavigationRequest = (request) => {
    let allowed = true;

    handleTrustedWebNavigation({
      request,
      onBlocked: () => {
        allowed = false;
        setSimulatorError(
          "A navigation request outside the trusted DentoGraph website was blocked.",
        );
      },
    });

    return allowed;
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>
          Loading AR braces previews...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPreviews({ refresh: true })}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>AR Braces Simulation</Text>
          <Text style={styles.subtitle}>
            Preview braces styles using the camera and review saved simulations.
          </Text>
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={21} color="#1d4ed8" />
          <Text style={styles.noticeText}>
            Simulations are visual previews only and are not a diagnosis,
            treatment plan, or guarantee of orthodontic results.
          </Text>
        </View>

        {!cameraPermission.granted ? (
          <View style={styles.permissionCardWrapper}>
            <PermissionStateCard
              icon="camera-outline"
              title="Camera access needed"
              message={getPermissionMessage({
                permissionName: "Camera",
                status: cameraPermission.status,
                purpose: "show the live AR braces preview",
              })}
              actionLabel={
                cameraPermission.status === PERMISSION_STATUS.BLOCKED
                  ? "Open Settings"
                  : "Allow Camera"
              }
              secondaryLabel="Check Permission Again"
              busy={checkingCameraPermission}
              onAction={
                cameraPermission.status === PERMISSION_STATUS.BLOCKED
                  ? openApplicationSettings
                  : ensureCameraPermission
              }
              onSecondary={refreshCameraPermission}
            />
          </View>
        ) : null}

        <Pressable style={styles.launchButton} onPress={openSimulator}>
          <View style={styles.launchIcon}>
            <Ionicons name="camera-outline" size={26} color="#ffffff" />
          </View>

          <View style={styles.launchText}>
            <Text style={styles.launchTitle}>Open Live AR Simulator</Text>
            <Text style={styles.launchSubtitle}>
              Try Metal, Ceramic, and colored braces using live face tracking.
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#ffffff" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Previews</Text>
          <Text style={styles.countBadge}>{previews.length}</Text>
        </View>

        {previews.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="happy-outline" size={42} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No saved previews</Text>
            <Text style={styles.emptyText}>
              Open the live simulator, select a braces style, and save a
              preview under one of your dental records.
            </Text>
          </View>
        ) : (
          previews.map((preview) => (
            <PreviewCard
              key={preview.simulation_id}
              preview={preview}
              onOpen={openPreview}
              onDelete={confirmDelete}
              deleting={deletingId === preview.simulation_id}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {getStyleLabel(selectedPreview?.brace_style)}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {formatDateTime(selectedPreview?.created_at)}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setPreviewVisible(false)}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>

            {selectedPreview ? (
              <Image
                source={{
                  uri: buildARSimulationImageUrl(selectedPreview.image_path),
                }}
                style={styles.fullPreviewImage}
                resizeMode="contain"
              />
            ) : null}

            {selectedPreview?.notes ? (
              <Text style={styles.modalNotes}>{selectedPreview.notes}</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={simulatorVisible}
        animationType="slide"
        onRequestClose={closeSimulator}
      >
        <View style={styles.simulatorContainer}>
          <View style={styles.simulatorHeader}>
            <Pressable style={styles.simulatorBack} onPress={closeSimulator}>
              <Ionicons name="arrow-back" size={21} color="#1d4ed8" />
            </Pressable>

            <View style={styles.simulatorHeaderText}>
              <Text style={styles.simulatorTitle}>Live AR Braces</Text>
              <Text style={styles.simulatorSubtitle}>
                Return here after saving your preview.
              </Text>
            </View>

            <Pressable
              style={styles.simulatorRefresh}
              onPress={() => webViewRef.current?.reload()}
            >
              <Ionicons name="refresh" size={20} color="#1d4ed8" />
            </Pressable>
          </View>

          {simulatorError ? (
            <View style={styles.simulatorErrorCard}>
              <Ionicons name="warning-outline" size={28} color="#b91c1c" />
              <Text style={styles.simulatorErrorTitle}>
                Unable to open AR simulator
              </Text>
              <Text style={styles.simulatorErrorText}>{simulatorError}</Text>
              <Pressable style={styles.retryButton} onPress={openSimulator}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.webViewContainer}>
              <WebView
                ref={webViewRef}
                source={{ uri: simulatorUrl }}
                style={styles.webView}
                {...TRUSTED_WEBVIEW_PROPS}
                mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onShouldStartLoadWithRequest={handleNavigationRequest}
                injectedJavaScriptBeforeContentLoaded={injectedSessionScript}
                onMessage={handleWebMessage}
                onNavigationStateChange={(state) =>
                  setWebCanGoBack(Boolean(state.canGoBack))
                }
                onLoadStart={() => {
                  setSimulatorLoading(true);
                  setSimulatorError("");
                }}
                onLoadEnd={() => setSimulatorLoading(false)}
                onHttpError={({ nativeEvent }) => {
                  setSimulatorError(
                    `The AR simulator returned HTTP ${nativeEvent.statusCode}.`,
                  );
                  setSimulatorLoading(false);
                }}
                onError={({ nativeEvent }) => {
                  setSimulatorError(
                    nativeEvent.description ||
                      "Unable to connect to the AR braces simulator.",
                  );
                  setSimulatorLoading(false);
                }}
                setSupportMultipleWindows={false}
              />

              {simulatorLoading ? (
                <View style={styles.webLoadingOverlay}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.webLoadingText}>
                    Loading AR braces simulator...
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 18, paddingBottom: 40 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
  },
  centerStateText: { color: "#64748b" },
  header: { marginBottom: 14 },
  title: { color: "#0f172a", fontSize: 27, fontWeight: "800" },
  subtitle: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 19,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 14,
    padding: 13,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 13,
  },
  noticeText: {
    flex: 1,
    color: "#1e40af",
    fontSize: 12,
    lineHeight: 18,
  },
  permissionCardWrapper: {
    marginBottom: 14,
  },
  launchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    padding: 15,
    backgroundColor: "#2563eb",
    borderRadius: 16,
  },
  launchIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 15,
  },
  launchText: { flex: 1 },
  launchTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  launchSubtitle: {
    marginTop: 4,
    color: "#dbeafe",
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: { color: "#0f172a", fontSize: 19, fontWeight: "800" },
  countBadge: {
    minWidth: 24,
    paddingVertical: 3,
    paddingHorizontal: 7,
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  previewCard: {
    marginBottom: 14,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  previewImage: { width: "100%", height: 230, backgroundColor: "#0f172a" },
  previewContent: { gap: 9, padding: 14 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  previewHeaderText: { flex: 1 },
  previewTitle: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  previewDate: { marginTop: 3, color: "#64748b", fontSize: 10 },
  statusBadge: {
    maxWidth: 120,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "800", textAlign: "center" },
  approvedBadge: { backgroundColor: "#dcfce7" },
  approvedBadgeText: { color: "#15803d" },
  rejectedBadge: { backgroundColor: "#fee2e2" },
  rejectedBadgeText: { color: "#b91c1c" },
  pendingBadge: { backgroundColor: "#fef3c7" },
  pendingBadgeText: { color: "#92400e" },
  previewMeta: { color: "#64748b", fontSize: 11 },
  previewNotes: { color: "#475569", fontSize: 12, lineHeight: 18 },
  previewActions: { flexDirection: "row", gap: 8 },
  viewButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
  },
  viewButtonText: { color: "#1d4ed8", fontSize: 11, fontWeight: "800" },
  deleteButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  deleteButtonText: { color: "#b91c1c", fontSize: 11, fontWeight: "800" },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  emptyTitle: { color: "#334155", fontWeight: "800" },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  previewModalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  previewModalCard: {
    maxHeight: "90%",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: "#0f172a", fontSize: 17, fontWeight: "900" },
  modalSubtitle: { marginTop: 3, color: "#64748b", fontSize: 10 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 19,
  },
  fullPreviewImage: { width: "100%", height: 430, backgroundColor: "#0f172a" },
  modalNotes: {
    padding: 14,
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  simulatorContainer: { flex: 1, backgroundColor: "#f8fafc" },
  simulatorHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  simulatorBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  simulatorHeaderText: { flex: 1 },
  simulatorTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900" },
  simulatorSubtitle: { marginTop: 2, color: "#64748b", fontSize: 10 },
  simulatorRefresh: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 20,
  },
  webViewContainer: { flex: 1, backgroundColor: "#ffffff" },
  webView: { flex: 1, backgroundColor: "#ffffff" },
  webLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(248, 250, 252, 0.94)",
  },
  webLoadingText: { color: "#475569", fontWeight: "800" },
  simulatorErrorCard: {
    alignItems: "center",
    gap: 9,
    margin: 18,
    padding: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 16,
  },
  simulatorErrorTitle: { color: "#991b1b", fontSize: 17, fontWeight: "900" },
  simulatorErrorText: {
    color: "#b91c1c",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 18,
    backgroundColor: "#2563eb",
    borderRadius: 10,
  },
  retryButtonText: { color: "#ffffff", fontWeight: "800" },
});