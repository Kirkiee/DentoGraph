import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getPatientDentalRecords } from "../services/dentalRecordService";
import {
  buildXrayFileUrl,
  getXrayAnnotations,
  getXraysByRecord,
} from "../services/xrayService";

export default function PatientXraysScreen({ token, onBack }) {
  const [xrays, setXrays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedXray, setSelectedXray] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);

  useEffect(() => {
    loadPatientXrays();
  }, []);

  const normalizeRecords = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.dental_records)) return data.dental_records;
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const normalizeXrays = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.xrays)) return data.xrays;
    if (Array.isArray(data.xray_images)) return data.xray_images;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const loadPatientXrays = async () => {
    try {
      setLoading(true);

      const recordsData = await getPatientDentalRecords(token);
      const records = normalizeRecords(recordsData);

      const xrayResults = await Promise.all(
        records.map(async (record) => {
          try {
            const xrayData = await getXraysByRecord({
              token,
              recordId: record.record_id,
            });

            const recordXrays = normalizeXrays(xrayData);

            return recordXrays.map((xray) => ({
              ...xray,
              record_context: record,
            }));
          } catch (error) {
            console.log(
              `Failed to load X-rays for record ${record.record_id}:`,
              error.message
            );
            return [];
          }
        })
      );

      setXrays(xrayResults.flat());
    } catch (error) {
      Alert.alert(
        "X-rays Error",
        error.message || "Unable to load patient X-rays."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadPatientXrays();
    } finally {
      setRefreshing(false);
    }
  };

  const openXrayDetails = async (xray) => {
    setSelectedXray(xray);
    setAnnotations([]);
    setDetailsModalVisible(true);

    try {
      setLoadingAnnotations(true);

      const data = await getXrayAnnotations({
        token,
        xrayId: xray.xray_id,
      });

      if (Array.isArray(data.annotations)) {
        setAnnotations(data.annotations);
      } else {
        setAnnotations([]);
      }
    } catch (error) {
      console.log("Annotation load error:", error.message);
      setAnnotations([]);
    } finally {
      setLoadingAnnotations(false);
    }
  };

  const closeXrayDetails = () => {
    setDetailsModalVisible(false);
    setSelectedXray(null);
    setAnnotations([]);
  };

  const formatDateTime = (value) => {
    if (!value) return "No date available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return `${date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })} ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };

  const formatFileSize = (bytes) => {
    const value = Number(bytes || 0);

    if (!value) return "Unknown size";

    const mb = value / (1024 * 1024);

    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }

    const kb = value / 1024;
    return `${kb.toFixed(1)} KB`;
  };

  const isPdfFile = (xray) => {
    const path = String(xray?.file_path || "").toLowerCase();
    return path.endsWith(".pdf");
  };

  const getStatusBadgeStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "confirmed") return styles.confirmedBadge;
    if (normalized === "rejected") return styles.rejectedBadge;
    if (normalized === "suggested") return styles.suggestedBadge;

    return styles.suggestedBadge;
  };

  const getStatusTextStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "confirmed") return styles.confirmedText;
    if (normalized === "rejected") return styles.rejectedText;
    if (normalized === "suggested") return styles.suggestedText;

    return styles.suggestedText;
  };

  const selectedXrayUrl = selectedXray
    ? buildXrayFileUrl(selectedXray.file_path)
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading X-rays...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="image-outline" size={27} color="#2b6cb0" />
            </View>

            <View style={styles.headerTextBlock}>
              <Text style={styles.title}>X-rays</Text>
              <Text style={styles.subtitle}>
                View dental images and AI-assisted annotations.
              </Text>
            </View>
          </View>
        </View>

        {xrays.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="images-outline" size={30} color="#2b6cb0" />
            </View>

            <Text style={styles.emptyTitle}>No X-rays found</Text>
            <Text style={styles.emptyText}>
              Your uploaded dental X-rays will appear here once your dentist or
              assistant adds them to your record.
            </Text>
          </View>
        ) : (
          xrays.map((xray, index) => {
            const imageUrl = buildXrayFileUrl(xray.file_path);
            const record = xray.record_context;

            return (
              <View key={xray.xray_id || index} style={styles.xrayCard}>
                <View style={styles.xrayPreviewBox}>
                  {isPdfFile(xray) ? (
                    <View style={styles.filePlaceholder}>
                      <Ionicons
                        name="document-text-outline"
                        size={38}
                        color="#2b6cb0"
                      />
                      <Text style={styles.filePlaceholderText}>
                        X-ray PDF Document
                      </Text>
                    </View>
                  ) : imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.xrayPreviewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.filePlaceholder}>
                      <Ionicons name="image-outline" size={38} color="#2b6cb0" />
                      <Text style={styles.filePlaceholderText}>
                        No preview available
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.xrayTopRow}>
                  <View style={styles.xrayTitleBlock}>
                    <Text style={styles.xrayTitle}>X-ray #{xray.xray_id}</Text>
                    <Text style={styles.xraySubtitle}>
                      Record #{xray.record_id || record?.record_id || "N/A"}
                    </Text>
                  </View>

                  <View style={styles.xrayBadge}>
                    <Text style={styles.xrayBadgeText}>
                      {isPdfFile(xray) ? "PDF" : "Image"}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoList}>
                  {xray.tooth_number ? (
                    <InfoRow
                      icon="medical-outline"
                      label="Tooth"
                      value={`#${xray.tooth_number}`}
                    />
                  ) : null}

                  {record?.dentist_name ? (
                    <InfoRow
                      icon="person-outline"
                      label="Dentist"
                      value={record.dentist_name}
                    />
                  ) : null}

                  {record?.clinic_name ? (
                    <InfoRow
                      icon="business-outline"
                      label="Clinic"
                      value={record.clinic_name}
                    />
                  ) : null}

                  <InfoRow
                    icon="cloud-upload-outline"
                    label="Uploaded"
                    value={formatDateTime(xray.upload_date)}
                  />

                  <InfoRow
                    icon="document-attach-outline"
                    label="File Size"
                    value={formatFileSize(xray.file_size_bytes)}
                  />
                </View>

                <Pressable
                  style={styles.viewButton}
                  onPress={() => openXrayDetails(xray)}
                >
                  <Text style={styles.viewButtonText}>View X-ray</Text>
                  <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeXrayDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="image-outline" size={24} color="#2b6cb0" />
                </View>

                <View style={styles.modalHeaderTextBlock}>
                  <Text style={styles.modalTitle}>
                    X-ray #{selectedXray?.xray_id}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Dental image and annotations
                  </Text>
                </View>
              </View>

              {selectedXrayUrl && isPdfFile(selectedXray) ? (
                <View style={styles.pdfModalBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={44}
                    color="#2b6cb0"
                  />
                  <Text style={styles.pdfText}>This X-ray is a PDF file.</Text>

                  <Pressable
                    style={styles.openFileButton}
                    onPress={() => Linking.openURL(selectedXrayUrl)}
                  >
                    <Text style={styles.openFileButtonText}>Open PDF File</Text>
                  </Pressable>
                </View>
              ) : selectedXrayUrl ? (
                <Image
                  source={{ uri: selectedXrayUrl }}
                  style={styles.modalXrayImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.pdfModalBox}>
                  <Ionicons name="image-outline" size={44} color="#2b6cb0" />
                  <Text style={styles.pdfText}>No X-ray preview available.</Text>
                </View>
              )}

              <View style={styles.modalInfoCard}>
                <DetailRow
                  label="Record"
                  value={`#${selectedXray?.record_id || "N/A"}`}
                />

                {selectedXray?.tooth_number ? (
                  <DetailRow
                    label="Tooth"
                    value={`#${selectedXray.tooth_number}`}
                  />
                ) : null}

                <DetailRow
                  label="Uploaded"
                  value={formatDateTime(selectedXray?.upload_date)}
                />

                <DetailRow
                  label="File Size"
                  value={formatFileSize(selectedXray?.file_size_bytes)}
                />
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Annotations</Text>
                <Text style={styles.sectionSubtitle}>
                  {annotations.length} annotation
                  {annotations.length === 1 ? "" : "s"} found
                </Text>
              </View>

              {loadingAnnotations ? (
                <View style={styles.annotationsLoadingBox}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>Loading annotations...</Text>
                </View>
              ) : annotations.length === 0 ? (
                <View style={styles.smallEmptyCard}>
                  <Text style={styles.smallEmptyText}>
                    No annotations available for this X-ray yet.
                  </Text>
                </View>
              ) : (
                annotations.map((annotation, index) => (
                  <View
                    key={annotation.annotation_id || index}
                    style={styles.annotationCard}
                  >
                    <View style={styles.annotationTopRow}>
                      <View style={styles.annotationIconCircle}>
                        <Ionicons
                          name="sparkles-outline"
                          size={18}
                          color="#2b6cb0"
                        />
                      </View>

                      <View style={styles.annotationTextBlock}>
                        <View style={styles.annotationTitleRow}>
                          <Text style={styles.annotationLabel}>
                            {annotation.label || "Annotation"}
                          </Text>

                          <View
                            style={[
                              styles.annotationStatusBadge,
                              getStatusBadgeStyle(annotation.status),
                            ]}
                          >
                            <Text
                              style={[
                                styles.annotationStatusText,
                                getStatusTextStyle(annotation.status),
                              ]}
                            >
                              {annotation.status || "Suggested"}
                            </Text>
                          </View>
                        </View>

                        {annotation.note ? (
                          <Text style={styles.annotationNote}>
                            {annotation.note}
                          </Text>
                        ) : null}

                        {annotation.interpretation ? (
                          <Text style={styles.annotationNote}>
                            {annotation.interpretation}
                          </Text>
                        ) : null}

                        {annotation.dentist_name ? (
                          <Text style={styles.annotationMeta}>
                            Reviewed by: {annotation.dentist_name}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable style={styles.closeButton} onPress={closeXrayDetails}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#718096" />
      <Text style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}: </Text>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#718096",
    fontSize: 14,
  },
  header: {
    marginTop: 18,
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    textAlign: "center",
  },
  xrayCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  xrayPreviewBox: {
    height: 180,
    borderRadius: 20,
    backgroundColor: "#edf2f7",
    overflow: "hidden",
    marginBottom: 15,
  },
  xrayPreviewImage: {
    width: "100%",
    height: "100%",
  },
  filePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  filePlaceholderText: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "800",
  },
  xrayTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  xrayTitleBlock: {
    flex: 1,
  },
  xrayTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  xraySubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "800",
  },
  xrayBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  xrayBadgeText: {
    color: "#2b6cb0",
    fontSize: 12,
    fontWeight: "900",
  },
  infoList: {
    gap: 8,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: "#4a5568",
    lineHeight: 20,
    fontWeight: "600",
  },
  detailLabel: {
    color: "#2d3748",
    fontWeight: "900",
  },
  viewButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  viewButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    maxHeight: "90%",
  },
  modalScroll: {
    maxHeight: "92%",
  },
  modalScrollContent: {
    paddingBottom: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTextBlock: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
  },
  modalXrayImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    marginBottom: 14,
  },
  pdfModalBox: {
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  pdfText: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "800",
    textAlign: "center",
  },
  openFileButton: {
    backgroundColor: "#2b6cb0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 4,
  },
  openFileButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  modalInfoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 18,
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
    paddingTop: 9,
    marginTop: 9,
  },
  detailRowLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "900",
    marginBottom: 3,
  },
  detailRowValue: {
    fontSize: 14,
    color: "#2d3748",
    fontWeight: "700",
    lineHeight: 19,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
  },
  annotationsLoadingBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  smallEmptyCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  smallEmptyText: {
    color: "#718096",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  annotationCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  annotationTopRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  annotationIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  annotationTextBlock: {
    flex: 1,
  },
  annotationTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  annotationLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "900",
  },
  annotationStatusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  annotationStatusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  suggestedBadge: {
    backgroundColor: "#fef3c7",
  },
  suggestedText: {
    color: "#92400e",
  },
  confirmedBadge: {
    backgroundColor: "#c6f6d5",
  },
  confirmedText: {
    color: "#2f855a",
  },
  rejectedBadge: {
    backgroundColor: "#fed7d7",
  },
  rejectedText: {
    color: "#c53030",
  },
  annotationNote: {
    fontSize: 13,
    color: "#4a5568",
    lineHeight: 19,
    marginBottom: 6,
    fontWeight: "600",
  },
  annotationMeta: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "800",
  },
  closeButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});