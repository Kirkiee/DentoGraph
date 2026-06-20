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
              record_id: record.record_id,
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

      const mergedXrays = xrayResults.flat();

      setXrays(mergedXrays);
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
        xray_id: xray.xray_id,
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
      month: "long",
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

          <Text style={styles.title}>X-rays</Text>

          <Text style={styles.subtitle}>
            View your uploaded dental X-rays and AI-assisted annotations.
          </Text>
        </View>

        {xrays.length === 0 ? (
          <View style={styles.emptyCard}>
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
                    <View style={styles.pdfBox}>
                      <Text style={styles.pdfIcon}>PDF</Text>
                      <Text style={styles.pdfText}>X-ray document</Text>
                    </View>
                  ) : imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.xrayPreviewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.pdfBox}>
                      <Text style={styles.pdfIcon}>XR</Text>
                      <Text style={styles.pdfText}>No preview available</Text>
                    </View>
                  )}
                </View>

                <View style={styles.xrayInfo}>
                  <Text style={styles.xrayTitle}>X-ray #{xray.xray_id}</Text>

                  <Text style={styles.detailText}>
                    Record: #{xray.record_id || record?.record_id || "N/A"}
                  </Text>

                  {xray.tooth_number ? (
                    <Text style={styles.detailText}>
                      Tooth: #{xray.tooth_number}
                    </Text>
                  ) : null}

                  {record?.dentist_name ? (
                    <Text style={styles.detailText}>
                      Dentist: {record.dentist_name}
                    </Text>
                  ) : null}

                  {record?.clinic_name ? (
                    <Text style={styles.detailText}>
                      Clinic: {record.clinic_name}
                    </Text>
                  ) : null}

                  <Text style={styles.detailText}>
                    Uploaded: {formatDateTime(xray.upload_date)}
                  </Text>

                  <Text style={styles.detailText}>
                    File Size: {formatFileSize(xray.file_size_bytes)}
                  </Text>

                  <Pressable
                    style={styles.viewButton}
                    onPress={() => openXrayDetails(xray)}
                  >
                    <Text style={styles.viewButtonText}>View X-ray</Text>
                  </Pressable>
                </View>
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
              <Text style={styles.modalTitle}>
                X-ray #{selectedXray?.xray_id}
              </Text>

              {selectedXrayUrl && isPdfFile(selectedXray) ? (
                <View style={styles.pdfModalBox}>
                  <Text style={styles.pdfIconLarge}>PDF</Text>
                  <Text style={styles.pdfText}>This X-ray is a PDF file.</Text>

                  <Pressable
                    style={styles.openFileButton}
                    onPress={() => Linking.openURL(selectedXrayUrl)}
                  >
                    <Text style={styles.openFileButtonText}>
                      Open PDF File
                    </Text>
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
                  <Text style={styles.pdfIconLarge}>XR</Text>
                  <Text style={styles.pdfText}>No X-ray preview available.</Text>
                </View>
              )}

              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoText}>
                  Record: #{selectedXray?.record_id || "N/A"}
                </Text>

                {selectedXray?.tooth_number ? (
                  <Text style={styles.modalInfoText}>
                    Tooth: #{selectedXray.tooth_number}
                  </Text>
                ) : null}

                <Text style={styles.modalInfoText}>
                  Uploaded: {formatDateTime(selectedXray?.upload_date)}
                </Text>

                <Text style={styles.modalInfoText}>
                  File Size: {formatFileSize(selectedXray?.file_size_bytes)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Annotations</Text>

              {loadingAnnotations ? (
                <View style={styles.annotationsLoadingBox}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>
                    Loading annotations...
                  </Text>
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
    marginTop: 10,
    color: "#718096",
    fontSize: 14,
  },
  header: {
    marginTop: 22,
    marginBottom: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#edf2f7",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginBottom: 18,
  },
  backButtonText: {
    color: "#2b6cb0",
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#718096",
    lineHeight: 21,
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
  },
  xrayCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  xrayPreviewBox: {
    height: 170,
    borderRadius: 18,
    backgroundColor: "#edf2f7",
    overflow: "hidden",
    marginBottom: 14,
  },
  xrayPreviewImage: {
    width: "100%",
    height: "100%",
  },
  pdfBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pdfIcon: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  pdfIconLarge: {
    fontSize: 38,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 8,
  },
  pdfText: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "700",
  },
  xrayInfo: {
    gap: 2,
  },
  xrayTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 5,
  },
  viewButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 12,
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
    borderRadius: 24,
    padding: 18,
    maxHeight: "90%",
  },
  modalScroll: {
    maxHeight: "92%",
  },
  modalScrollContent: {
    paddingBottom: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 14,
  },
  modalXrayImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#edf2f7",
    borderRadius: 18,
    marginBottom: 14,
  },
  pdfModalBox: {
    backgroundColor: "#edf2f7",
    borderRadius: 18,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  openFileButton: {
    backgroundColor: "#2b6cb0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 14,
  },
  openFileButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  modalInfoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 12,
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
  },
  annotationCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  annotationTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  annotationLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "900",
  },
  annotationStatusBadge: {
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
  },
  annotationMeta: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "700",
  },
  closeButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});