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
      month: "long",
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
          <Text style={styles.title}>AR Braces</Text>

          <Text style={styles.subtitle}>
            View your saved AR braces simulation previews and review status.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Saved Preview Mode</Text>
          <Text style={styles.infoText}>
            The mobile app currently displays saved AR braces previews from
            DentoGraph. A full live camera filter can be developed later using
            face landmark tracking.
          </Text>
        </View>

        {simulations.length === 0 ? (
          <View style={styles.emptyCard}>
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
                      <Text style={styles.noImageIcon}>AR</Text>
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
                    >
                      {simulation.review_status || "Pending Review"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.detailText}>
                  Record: #{simulation.record_id || "N/A"}
                </Text>

                {simulation.dentist_name ? (
                  <Text style={styles.detailText}>
                    Dentist: {simulation.dentist_name}
                  </Text>
                ) : null}

                {simulation.clinic_name ? (
                  <Text style={styles.detailText}>
                    Clinic: {simulation.clinic_name}
                  </Text>
                ) : null}

                <Text style={styles.detailText}>
                  Created: {formatDateTime(simulation.created_at)}
                </Text>

                {simulation.notes ? (
                  <Text style={styles.notesText}>{simulation.notes}</Text>
                ) : null}

                <Pressable
                  style={styles.viewButton}
                  onPress={() => openPreviewModal(simulation)}
                >
                  <Text style={styles.viewButtonText}>Open Preview</Text>
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
              <Text style={styles.modalTitle}>
                Preview #{selectedSimulation?.simulation_id}
              </Text>

              {selectedImageUrl ? (
                <Image
                  source={{ uri: selectedImageUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalNoImageBox}>
                  <Text style={styles.noImageIcon}>AR</Text>
                  <Text style={styles.noImageText}>No preview available</Text>
                </View>
              )}

              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoText}>
                  Style: {formatBraceStyle(selectedSimulation?.brace_style)}
                </Text>

                <Text style={styles.modalInfoText}>
                  Status: {selectedSimulation?.review_status || "Pending Review"}
                </Text>

                <Text style={styles.modalInfoText}>
                  Record: #{selectedSimulation?.record_id || "N/A"}
                </Text>

                {selectedSimulation?.dentist_name ? (
                  <Text style={styles.modalInfoText}>
                    Dentist: {selectedSimulation.dentist_name}
                  </Text>
                ) : null}

                {selectedSimulation?.clinic_name ? (
                  <Text style={styles.modalInfoText}>
                    Clinic: {selectedSimulation.clinic_name}
                  </Text>
                ) : null}

                <Text style={styles.modalInfoText}>
                  Created: {formatDateTime(selectedSimulation?.created_at)}
                </Text>

                {selectedSimulation?.notes ? (
                  <Text style={styles.modalNotes}>
                    {selectedSimulation.notes}
                  </Text>
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
    marginBottom: 18,
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
  infoCard: {
    backgroundColor: "#ebf8ff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bee3f8",
    marginBottom: 18,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: "#2c5282",
    lineHeight: 20,
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
  previewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  previewImageBox: {
    height: 210,
    borderRadius: 18,
    backgroundColor: "#edf2f7",
    overflow: "hidden",
    marginBottom: 14,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  noImageBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageIcon: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2b6cb0",
    marginBottom: 6,
  },
  noImageText: {
    fontSize: 14,
    color: "#718096",
    fontWeight: "700",
  },
  previewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  previewTitleBlock: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  detailText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 5,
  },
  notesText: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 14,
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
  modalImage: {
    width: "100%",
    height: 360,
    backgroundColor: "#edf2f7",
    borderRadius: 18,
    marginBottom: 14,
  },
  modalNoImageBox: {
    height: 260,
    backgroundColor: "#edf2f7",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  modalInfoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalInfoText: {
    fontSize: 14,
    color: "#4a5568",
    marginBottom: 6,
  },
  modalNotes: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 20,
    marginTop: 6,
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