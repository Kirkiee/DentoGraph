import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getDentalRecordDetails,
  getPatientDentalRecords,
} from "../services/dentalRecordService";

export default function PatientDentalRecordsScreen({ token, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedRecordDetails, setSelectedRecordDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  const normalizeRecords = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.dental_records)) return data.dental_records;
    if (Array.isArray(data.records)) return data.records;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getPatientDentalRecords(token);
      setRecords(normalizeRecords(data));
    } catch (error) {
      Alert.alert(
        "Dental Records Error",
        error.message || "Unable to load dental records."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await getPatientDentalRecords(token);
      setRecords(normalizeRecords(data));
    } catch (error) {
      Alert.alert(
        "Dental Records Error",
        error.message || "Unable to refresh dental records."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const openRecordDetails = async (record) => {
    if (!record?.record_id) {
      Alert.alert("Error", "No dental record selected.");
      return;
    }

    try {
      setLoadingDetails(true);
      setDetailsModalVisible(true);

      const data = await getDentalRecordDetails({
        token,
        record_id: record.record_id,
      });

      setSelectedRecordDetails(data);
    } catch (error) {
      setDetailsModalVisible(false);
      Alert.alert(
        "Record Details Error",
        error.message || "Unable to load dental record details."
      );
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedRecordDetails(null);
  };

  const formatDate = (value) => {
    if (!value) return "No date available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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

  const getToothBadgeStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "sound" || normalized === "normal") {
      return styles.soundBadge;
    }

    if (normalized === "caries" || normalized === "decayed") {
      return styles.cariesBadge;
    }

    if (normalized === "filled") {
      return styles.filledBadge;
    }

    if (normalized === "missing" || normalized === "for extraction") {
      return styles.missingBadge;
    }

    if (normalized === "crown" || normalized === "crowned") {
      return styles.crownBadge;
    }

    return styles.defaultToothBadge;
  };

  const getToothTextStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "sound" || normalized === "normal") {
      return styles.soundText;
    }

    if (normalized === "caries" || normalized === "decayed") {
      return styles.cariesText;
    }

    if (normalized === "filled") {
      return styles.filledText;
    }

    if (normalized === "missing" || normalized === "for extraction") {
      return styles.missingText;
    }

    if (normalized === "crown" || normalized === "crowned") {
      return styles.crownText;
    }

    return styles.defaultToothText;
  };

  const detailsRecord = selectedRecordDetails?.dental_record;
  const teeth = Array.isArray(selectedRecordDetails?.teeth)
    ? selectedRecordDetails.teeth
    : [];
  const treatments = Array.isArray(selectedRecordDetails?.treatments)
    ? selectedRecordDetails.treatments
    : [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading dental records...</Text>
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
          
          <Text style={styles.title}>Dental Records</Text>

          <Text style={styles.subtitle}>
            View your dental chart, tooth status, and treatment history.
          </Text>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No dental records found</Text>
            <Text style={styles.emptyText}>
              Your dental records will appear here once your dentist creates
              them.
            </Text>
          </View>
        ) : (
          records.map((record, index) => (
            <View
              key={record.record_id || index}
              style={styles.recordCard}
            >
              <View style={styles.recordTopRow}>
                <View style={styles.recordTitleBlock}>
                  <Text style={styles.recordTitle}>
                    Record #{record.record_id}
                  </Text>
                  <Text style={styles.recordSubtitle}>
                    {record.dentition_label ||
                      record.dentition_type ||
                      "Dental Record"}
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>
                    {record.status || "Active"}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailText}>
                Dentist: {record.dentist_name || "Not assigned"}
              </Text>

              {record.clinic_name ? (
                <Text style={styles.detailText}>
                  Clinic: {record.clinic_name}
                </Text>
              ) : null}

              <Text style={styles.detailText}>
                Created: {formatDate(record.date_created)}
              </Text>

              <Text style={styles.detailText}>
                Last Updated: {formatDate(record.last_updated)}
              </Text>

              <Pressable
                style={styles.viewButton}
                onPress={() => openRecordDetails(record)}
              >
                <Text style={styles.viewButtonText}>View Details</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetailsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {loadingDetails ? (
              <View style={styles.detailsLoadingBox}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Loading record details...</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Text style={styles.modalTitle}>Record Details</Text>

                  {detailsRecord ? (
                    <View style={styles.detailsHeaderCard}>
                      <Text style={styles.detailsRecordTitle}>
                        Record #{detailsRecord.record_id}
                      </Text>

                      <Text style={styles.detailsText}>
                        Patient: {detailsRecord.patient_name || "Patient"}
                      </Text>

                      <Text style={styles.detailsText}>
                        Dentist: {detailsRecord.dentist_name || "Not assigned"}
                      </Text>

                      {detailsRecord.clinic_name ? (
                        <Text style={styles.detailsText}>
                          Clinic: {detailsRecord.clinic_name}
                        </Text>
                      ) : null}

                      <Text style={styles.detailsText}>
                        Dentition:{" "}
                        {detailsRecord.dentition_label ||
                          detailsRecord.dentition_type ||
                          "Not specified"}
                      </Text>

                      <Text style={styles.detailsText}>
                        Created: {formatDateTime(detailsRecord.date_created)}
                      </Text>

                      <Text style={styles.detailsText}>
                        Updated: {formatDateTime(detailsRecord.last_updated)}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.sectionTitle}>Tooth Chart</Text>

                  {teeth.length === 0 ? (
                    <View style={styles.smallEmptyCard}>
                      <Text style={styles.smallEmptyText}>
                        No tooth entries found for this record.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.teethGrid}>
                      {teeth.map((tooth, index) => (
                        <View
                          key={tooth.tooth_id || index}
                          style={[
                            styles.toothCard,
                            getToothBadgeStyle(tooth.tooth_status),
                          ]}
                        >
                          <Text
                            style={[
                              styles.toothNumber,
                              getToothTextStyle(tooth.tooth_status),
                            ]}
                          >
                            {tooth.tooth_number}
                          </Text>

                          <Text
                            style={[
                              styles.toothStatus,
                              getToothTextStyle(tooth.tooth_status),
                            ]}
                          >
                            {tooth.tooth_status || "Sound"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>Treatment History</Text>

                  {treatments.length === 0 ? (
                    <View style={styles.smallEmptyCard}>
                      <Text style={styles.smallEmptyText}>
                        No treatments found for this record.
                      </Text>
                    </View>
                  ) : (
                    treatments.map((treatment, index) => (
                      <View
                        key={treatment.treatment_id || index}
                        style={styles.treatmentCard}
                      >
                        <Text style={styles.treatmentTitle}>
                          {treatment.procedure_type || "Dental Treatment"}
                        </Text>

                        <Text style={styles.treatmentText}>
                          Tooth #{treatment.tooth_number || "N/A"}
                        </Text>

                        <Text style={styles.treatmentText}>
                          Date: {formatDate(treatment.treatment_date)}
                        </Text>

                        {treatment.description ? (
                          <Text style={styles.treatmentDescription}>
                            {treatment.description}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </ScrollView>

                <Pressable
                  style={styles.closeButton}
                  onPress={closeDetailsModal}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </>
            )}
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
    marginTop: 12,
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
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  recordTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  recordTitleBlock: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  recordSubtitle: {
    fontSize: 13,
    color: "#718096",
  },
  statusBadge: {
    backgroundColor: "#c6f6d5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    color: "#2f855a",
    fontSize: 12,
    fontWeight: "900",
  },
  detailText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 6,
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
    maxHeight: "88%",
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
  detailsLoadingBox: {
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsHeaderCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  detailsRecordTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 10,
  },
  detailsText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 12,
    marginTop: 4,
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
  teethGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  toothCard: {
    width: "31%",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  toothNumber: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },
  toothStatus: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  defaultToothBadge: {
    backgroundColor: "#edf2f7",
    borderColor: "#e2e8f0",
  },
  defaultToothText: {
    color: "#4a5568",
  },
  soundBadge: {
    backgroundColor: "#c6f6d5",
    borderColor: "#9ae6b4",
  },
  soundText: {
    color: "#2f855a",
  },
  cariesBadge: {
    backgroundColor: "#fed7d7",
    borderColor: "#feb2b2",
  },
  cariesText: {
    color: "#c53030",
  },
  filledBadge: {
    backgroundColor: "#e3f2fd",
    borderColor: "#bee3f8",
  },
  filledText: {
    color: "#2b6cb0",
  },
  missingBadge: {
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e0",
  },
  missingText: {
    color: "#2d3748",
  },
  crownBadge: {
    backgroundColor: "#fef3c7",
    borderColor: "#f6e05e",
  },
  crownText: {
    color: "#92400e",
  },
  treatmentCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  treatmentTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 6,
  },
  treatmentText: {
    fontSize: 13,
    color: "#4a5568",
    marginBottom: 4,
  },
  treatmentDescription: {
    fontSize: 13,
    color: "#718096",
    lineHeight: 19,
    marginTop: 4,
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