import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  buildARSimulationImageUrl,
  getMyARPreviews,
} from "../services/arSimulationService";

export default function PatientARBracesScreen({ token }) {
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSimulation, setSelectedSimulation] = useState(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  useEffect(() => {
    loadARPreviews();
  }, []);

  const normalizeSimulations = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.simulations)) return data.simulations;
    if (Array.isArray(data.previews)) return data.previews;
    if (Array.isArray(data.data)) return data.data;
    return [];
  };

  const loadARPreviews = async () => {
    try {
      setLoading(true);
      const data = await getMyARPreviews(token);
      setSimulations(normalizeSimulations(data));
    } catch (error) {
      Alert.alert(
        "AR Braces Error",
        error.message || "Unable to load AR braces previews."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await getMyARPreviews(token);
      setSimulations(normalizeSimulations(data));
    } catch (error) {
      Alert.alert(
        "AR Braces Error",
        error.message || "Unable to refresh AR braces previews."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const openPreviewModal = (simulation) => {
    setSelectedSimulation(simulation);
    setPreviewModalVisible(true);
  };

  const closePreviewModal = () => {
    setPreviewModalVisible(false);
    setSelectedSimulation(null);
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

  const formatBraceStyle = (style) => {
    const value = String(style || "metal").toLowerCase();

    if (value === "metal") return "Metal Braces";
    if (value === "ceramic") return "Ceramic Braces";
    if (value === "blue") return "Blue Braces";
    if (value === "pink") return "Pink Braces";
    if (value === "green") return "Green Braces";
    if (value === "purple") return "Purple Braces";
    if (value === "colored") return "Colored Braces";

    return "Metal Braces";
  };

  const getStatusBadgeStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized.includes("approved")) return styles.approvedBadge;
    if (normalized.includes("reject")) return styles.rejectedBadge;
    if (normalized.includes("review")) return styles.pendingBadge;

    return styles.pendingBadge;
  };

  const getStatusTextStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized.includes("approved")) return styles.approvedText;
    if (normalized.includes("reject")) return styles.rejectedText;
    if (normalized.includes("review")) return styles.pendingText;

    return styles.pendingText;
  };

  const selectedImageUrl = selectedSimulation
    ? buildARSimulationImageUrl(selectedSimulation.image_path)
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading AR braces previews...</Text>
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
              <Ionicons name="happy-outline" size={27} color="#2b6cb0" />
            </View>

            <View style={styles.headerTextBlock}>
              <Text style={styles.title}>AR Braces</Text>
              <Text style={styles.subtitle}>
                View your saved braces simulation previews.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="sparkles-outline" size={22} color="#2b6cb0" />
          </View>

          <View style={styles.summaryTextBlock}>
            <Text style={styles.summaryTitle}>Saved Preview Gallery</Text>
            <Text style={styles.summaryText}>
              {simulations.length} preview
              {simulations.length === 1 ? "" : "s"} available
            </Text>
          </View>
        </View>

        {simulations.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="images-outline" size={30} color="#2b6cb0" />
            </View>

            <Text style={styles.emptyTitle}>No AR previews found</Text>
            <Text style={styles.emptyText}>
              Your saved braces simulation previews will appear here after one
              is created from DentoGraph.
            </Text>
          </View>
        ) : (
          simulations.map((simulation, index) => {
            const imageUrl = buildARSimulationImageUrl(simulation.image_path);

            return (
              <View
                key={simulation.simulation_id || index}
                style={styles.previewCard}
              >
                <View style={styles.previewImageBox}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.noImageBox}>
                      <Ionicons name="image-outline" size={38} color="#2b6cb0" />
                      <Text style={styles.noImageText}>
                        No preview available
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.previewTopRow}>
                  <View style={styles.previewTitleBlock}>
                    <Text style={styles.previewTitle}>
                      Preview #{simulation.simulation_id}
                    </Text>

                    <Text style={styles.previewSubtitle}>
                      {formatBraceStyle(simulation.brace_style)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      getStatusBadgeStyle(simulation.review_status),
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        getStatusTextStyle(simulation.review_status),
                      ]}
                      numberOfLines={1}
                    >
                      {simulation.review_status || "Pending Review"}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoList}>
                  <InfoRow
                    icon="document-text-outline"
                    label="Record"
                    value={`#${simulation.record_id || "N/A"}`}
                  />

                  <InfoRow
                    icon="color-palette-outline"
                    label="Style"
                    value={formatBraceStyle(simulation.brace_style)}
                  />

                  {simulation.dentist_name ? (
                    <InfoRow
                      icon="person-outline"
                      label="Dentist"
                      value={simulation.dentist_name}
                    />
                  ) : null}

                  {simulation.clinic_name ? (
                    <InfoRow
                      icon="business-outline"
                      label="Clinic"
                      value={simulation.clinic_name}
                    />
                  ) : null}

                  <InfoRow
                    icon="time-outline"
                    label="Created"
                    value={formatDateTime(simulation.created_at)}
                  />
                </View>

                {simulation.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{simulation.notes}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={styles.viewButton}
                  onPress={() => openPreviewModal(simulation)}
                >
                  <Text style={styles.viewButtonText}>Open Preview</Text>
                  <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreviewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="happy-outline" size={24} color="#2b6cb0" />
                </View>

                <View style={styles.modalHeaderTextBlock}>
                  <Text style={styles.modalTitle}>
                    Preview #{selectedSimulation?.simulation_id}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    Saved AR braces simulation
                  </Text>
                </View>
              </View>

              {selectedImageUrl ? (
                <Image
                  source={{ uri: selectedImageUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalNoImageBox}>
                  <Ionicons name="image-outline" size={42} color="#2b6cb0" />
                  <Text style={styles.noImageText}>No preview available</Text>
                </View>
              )}

              <View style={styles.modalInfoCard}>
                <DetailRow
                  label="Style"
                  value={formatBraceStyle(selectedSimulation?.brace_style)}
                />

                <DetailRow
                  label="Status"
                  value={selectedSimulation?.review_status || "Pending Review"}
                />

                <DetailRow
                  label="Record"
                  value={`#${selectedSimulation?.record_id || "N/A"}`}
                />

                {selectedSimulation?.dentist_name ? (
                  <DetailRow
                    label="Dentist"
                    value={selectedSimulation.dentist_name}
                  />
                ) : null}

                {selectedSimulation?.clinic_name ? (
                  <DetailRow
                    label="Clinic"
                    value={selectedSimulation.clinic_name}
                  />
                ) : null}

                <DetailRow
                  label="Created"
                  value={formatDateTime(selectedSimulation?.created_at)}
                />

                {selectedSimulation?.notes ? (
                  <View style={styles.modalNotesBox}>
                    <Text style={styles.modalNotesLabel}>Notes</Text>
                    <Text style={styles.modalNotes}>
                      {selectedSimulation.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <Pressable style={styles.closeButton} onPress={closePreviewModal}>
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
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTextBlock: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 13,
    color: "#2b6cb0",
    fontWeight: "900",
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
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  previewImageBox: {
    height: 220,
    borderRadius: 20,
    backgroundColor: "#edf2f7",
    overflow: "hidden",
    marginBottom: 15,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  noImageBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  noImageText: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "800",
  },
  previewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  previewTitleBlock: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  previewSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 125,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
  },
  pendingText: {
    color: "#92400e",
  },
  approvedBadge: {
    backgroundColor: "#c6f6d5",
  },
  approvedText: {
    color: "#2f855a",
  },
  rejectedBadge: {
    backgroundColor: "#fed7d7",
  },
  rejectedText: {
    color: "#c53030",
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
  notesBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 15,
    padding: 12,
    marginBottom: 14,
  },
  notesText: {
    fontSize: 13,
    color: "#718096",
    lineHeight: 19,
    fontWeight: "600",
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
  modalImage: {
    width: "100%",
    height: 365,
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    marginBottom: 14,
  },
  modalNoImageBox: {
    height: 280,
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
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
  modalNotesBox: {
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
    paddingTop: 10,
    marginTop: 10,
  },
  modalNotesLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "900",
    marginBottom: 4,
  },
  modalNotes: {
    fontSize: 14,
    color: "#4a5568",
    lineHeight: 20,
    fontWeight: "600",
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