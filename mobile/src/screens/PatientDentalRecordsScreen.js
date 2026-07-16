import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  getDentalRecordDetails,
  getPatientDentalRecords,
} from "../services/dentalRecordService";

const RECORD_SOURCE_OPTIONS = [
  {
    value: "NEW_SYSTEM_RECORD",
    label: "New System Record",
  },
  {
    value: "OLD_ENCODED_RECORD",
    label: "Old Encoded Record",
  },
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
  },
];

export default function PatientDentalRecordsScreen({ token, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

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

    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "No date available";

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

  const getRecordStatus = (record) => {
    return record.status || "Active";
  };

  const getRecordSourceLabel = (source) => {
    if (source === "PDA_BASED_RECORD") {
      return "Old / Imported Record";
    }

    const match = RECORD_SOURCE_OPTIONS.find((option) => option.value === source);

    return match?.label || "New System Record";
  };

  const getRecordSourceBadgeStyle = (source) => {
    if (source === "OLD_ENCODED_RECORD") return styles.oldSourceBadge;
    if (source === "SCANNED_OLD_RECORD") return styles.scannedSourceBadge;
    if (source === "PDA_BASED_RECORD") return styles.oldSourceBadge;

    return styles.newSourceBadge;
  };

  const getRecordSourceTextStyle = (source) => {
    if (source === "OLD_ENCODED_RECORD") return styles.oldSourceText;
    if (source === "SCANNED_OLD_RECORD") return styles.scannedSourceText;
    if (source === "PDA_BASED_RECORD") return styles.oldSourceText;

    return styles.newSourceText;
  };

  const getStatusBadgeStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "archived") return styles.archivedStatusBadge;
    if (normalized === "inactive") return styles.inactiveStatusBadge;

    return styles.activeStatusBadge;
  };

  const getStatusTextStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "archived") return styles.archivedStatusText;
    if (normalized === "inactive") return styles.inactiveStatusText;

    return styles.activeStatusText;
  };

  const filteredAndSortedRecords = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    let result = [...records];

    if (statusFilter !== "All") {
      result = result.filter(
        (record) => getRecordStatus(record) === statusFilter
      );
    }

    if (sourceFilter !== "All") {
      result = result.filter((record) => {
        const source = record.record_source || "NEW_SYSTEM_RECORD";

        if (sourceFilter === "OLD_IMPORTED") {
          return (
            source === "OLD_ENCODED_RECORD" ||
            source === "SCANNED_OLD_RECORD" ||
            source === "PDA_BASED_RECORD"
          );
        }

        return source === sourceFilter;
      });
    }

    if (cleanSearch) {
      result = result.filter((record) => {
        const searchableText = [
          record.record_id,
          record.patient_id,
          record.patient_name,
          record.patient_email,
          record.dentition_label,
          record.dentition_type,
          record.dentist_id,
          record.dentist_name,
          record.clinic_name,
          record.status,
          record.record_source,
          getRecordSourceLabel(record.record_source),
          record.source_notes,
          record.date_created,
          record.last_updated,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(cleanSearch);
      });
    }

    result.sort((a, b) => {
      const dentistA = (a.dentist_name || "").toLowerCase();
      const dentistB = (b.dentist_name || "").toLowerCase();

      const clinicA = (a.clinic_name || "").toLowerCase();
      const clinicB = (b.clinic_name || "").toLowerCase();

      const createdA = a.date_created ? new Date(a.date_created).getTime() : 0;
      const createdB = b.date_created ? new Date(b.date_created).getTime() : 0;

      const updatedA = a.last_updated ? new Date(a.last_updated).getTime() : 0;
      const updatedB = b.last_updated ? new Date(b.last_updated).getTime() : 0;

      switch (sortBy) {
        case "oldest":
          return createdA - createdB;
        case "updated":
          return updatedB - updatedA;
        case "dentist-az":
          return dentistA.localeCompare(dentistB);
        case "dentist-za":
          return dentistB.localeCompare(dentistA);
        case "clinic-az":
          return clinicA.localeCompare(clinicB);
        case "clinic-za":
          return clinicB.localeCompare(clinicA);
        case "newest":
        default:
          return createdB - createdA;
      }
    });

    return result;
  }, [records, searchTerm, statusFilter, sourceFilter, sortBy]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
    setSourceFilter("All");
    setSortBy("newest");
  };

  const recordCountText = () => {
    if (records.length === 0) return "No dental records found.";

    if (filteredAndSortedRecords.length === records.length) {
      return `${records.length} dental record${
        records.length === 1 ? "" : "s"
      } found.`;
    }

    return `${filteredAndSortedRecords.length} of ${records.length} dental records shown.`;
  };

  const getToothBadgeStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "sound" ||
      normalized === "normal" ||
      normalized === "healthy"
    ) {
      return styles.soundBadge;
    }

    if (
      normalized === "caries" ||
      normalized === "decayed" ||
      normalized === "cavity" ||
      normalized === "needs treatment"
    ) {
      return styles.cariesBadge;
    }

    if (normalized === "filled" || normalized === "treated") {
      return styles.filledBadge;
    }

    if (
      normalized === "missing" ||
      normalized === "for extraction" ||
      normalized === "extracted"
    ) {
      return styles.missingBadge;
    }

    if (normalized === "crown" || normalized === "crowned") {
      return styles.crownBadge;
    }

    return styles.defaultToothBadge;
  };

  const getToothTextStyle = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "sound" ||
      normalized === "normal" ||
      normalized === "healthy"
    ) {
      return styles.soundText;
    }

    if (
      normalized === "caries" ||
      normalized === "decayed" ||
      normalized === "cavity" ||
      normalized === "needs treatment"
    ) {
      return styles.cariesText;
    }

    if (normalized === "filled" || normalized === "treated") {
      return styles.filledText;
    }

    if (
      normalized === "missing" ||
      normalized === "for extraction" ||
      normalized === "extracted"
    ) {
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
          <View style={styles.headerTopRow}>
            <Pressable style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={20} color="#2b6cb0" />
            </Pressable>

            <View style={styles.headerIconCircle}>
              <Ionicons
                name="document-text-outline"
                size={27}
                color="#2b6cb0"
              />
            </View>

            <View style={styles.headerTextBlock}>
              <Text style={styles.title}>Dental Records</Text>
              <Text style={styles.subtitle}>
                View tooth charts, dental status, and treatment history.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Search and Filter</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search dentist, clinic, record ID, source..."
            placeholderTextColor="#a0aec0"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.chipRow}>
            {["All", "Active", "Inactive", "Archived"].map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.chip,
                  statusFilter === status && styles.chipSelected,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.chipText,
                    statusFilter === status && styles.chipTextSelected,
                  ]}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>Record Source</Text>
          <View style={styles.chipRow}>
            {[
              { value: "All", label: "All" },
              { value: "NEW_SYSTEM_RECORD", label: "New" },
              { value: "OLD_IMPORTED", label: "Old / Imported" },
              { value: "OLD_ENCODED_RECORD", label: "Old Encoded" },
              { value: "SCANNED_OLD_RECORD", label: "Scanned" },
            ].map((source) => (
              <Pressable
                key={source.value}
                style={[
                  styles.chip,
                  sourceFilter === source.value && styles.chipSelected,
                ]}
                onPress={() => setSourceFilter(source.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    sourceFilter === source.value && styles.chipTextSelected,
                  ]}
                >
                  {source.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterLabel}>Sort By</Text>
          <View style={styles.chipRow}>
            {[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "updated", label: "Updated" },
              { value: "dentist-az", label: "Dentist A-Z" },
              { value: "dentist-za", label: "Dentist Z-A" },
              { value: "clinic-az", label: "Clinic A-Z" },
              { value: "clinic-za", label: "Clinic Z-A" },
            ].map((sort) => (
              <Pressable
                key={sort.value}
                style={[
                  styles.chip,
                  sortBy === sort.value && styles.chipSelected,
                ]}
                onPress={() => setSortBy(sort.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    sortBy === sort.value && styles.chipTextSelected,
                  ]}
                >
                  {sort.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear Search / Filters</Text>
          </Pressable>
        </View>

        <Text style={styles.countText}>{recordCountText()}</Text>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="folder-open-outline" size={30} color="#2b6cb0" />
            </View>

            <Text style={styles.emptyTitle}>No dental records found</Text>
            <Text style={styles.emptyText}>
              Your dental records will appear here once your dentist creates
              them.
            </Text>
          </View>
        ) : filteredAndSortedRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={30} color="#2b6cb0" />
            </View>

            <Text style={styles.emptyTitle}>No matching records</Text>
            <Text style={styles.emptyText}>
              Try changing your search, filter, or sorting options.
            </Text>
          </View>
        ) : (
          filteredAndSortedRecords.map((record, index) => (
            <View key={record.record_id || index} style={styles.recordCard}>
              <View style={styles.recordTopRow}>
                <View style={styles.recordIconCircle}>
                  <Ionicons name="clipboard-outline" size={22} color="#2b6cb0" />
                </View>

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

                <View
                  style={[
                    styles.statusBadge,
                    getStatusBadgeStyle(record.status),
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      getStatusTextStyle(record.status),
                    ]}
                  >
                    {record.status || "Active"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoList}>
                <InfoRow
                  icon="person-outline"
                  label="Dentist"
                  value={record.dentist_name || "Not assigned"}
                />

                {record.clinic_name ? (
                  <InfoRow
                    icon="business-outline"
                    label="Clinic"
                    value={record.clinic_name}
                  />
                ) : null}

                <View style={styles.sourceRow}>
                  <Ionicons name="file-tray-outline" size={16} color="#718096" />

                  <View style={styles.sourceContent}>
                    <Text style={styles.detailLabel}>Record Source</Text>

                    <View
                      style={[
                        styles.sourceBadge,
                        getRecordSourceBadgeStyle(record.record_source),
                      ]}
                    >
                      <Text
                        style={[
                          styles.sourceText,
                          getRecordSourceTextStyle(record.record_source),
                        ]}
                      >
                        {getRecordSourceLabel(record.record_source)}
                      </Text>
                    </View>
                  </View>
                </View>

                {record.source_notes ? (
                  <InfoRow
                    icon="reader-outline"
                    label="Source Notes"
                    value={record.source_notes}
                  />
                ) : null}

                <InfoRow
                  icon="calendar-outline"
                  label="Created"
                  value={formatDate(record.date_created)}
                />

                <InfoRow
                  icon="refresh-outline"
                  label="Updated"
                  value={formatDate(record.last_updated)}
                />
              </View>

              <Pressable
                style={styles.viewButton}
                onPress={() => openRecordDetails(record)}
              >
                <Text style={styles.viewButtonText}>View Details</Text>
                <Ionicons name="chevron-forward" size={18} color="#ffffff" />
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
                  <View style={styles.modalHeader}>
                    <View style={styles.modalIconCircle}>
                      <Ionicons
                        name="document-text-outline"
                        size={24}
                        color="#2b6cb0"
                      />
                    </View>

                    <View style={styles.modalHeaderTextBlock}>
                      <Text style={styles.modalTitle}>Record Details</Text>
                      <Text style={styles.modalSubtitle}>
                        Tooth chart and treatment summary
                      </Text>
                    </View>
                  </View>

                  {detailsRecord ? (
                    <View style={styles.detailsHeaderCard}>
                      <View style={styles.detailsTitleRow}>
                        <View style={styles.detailsTitleBlock}>
                          <Text style={styles.detailsRecordTitle}>
                            Record #{detailsRecord.record_id}
                          </Text>

                          <Text style={styles.detailsDentition}>
                            {detailsRecord.dentition_label ||
                              detailsRecord.dentition_type ||
                              "Not specified"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            getStatusBadgeStyle(detailsRecord.status),
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              getStatusTextStyle(detailsRecord.status),
                            ]}
                          >
                            {detailsRecord.status || "Active"}
                          </Text>
                        </View>
                      </View>

                      <DetailRow
                        label="Patient"
                        value={detailsRecord.patient_name || "Patient"}
                      />

                      <DetailRow
                        label="Dentist"
                        value={detailsRecord.dentist_name || "Not assigned"}
                      />

                      {detailsRecord.clinic_name ? (
                        <DetailRow
                          label="Clinic"
                          value={detailsRecord.clinic_name}
                        />
                      ) : null}

                      <DetailRow
                        label="Record Source"
                        value={getRecordSourceLabel(detailsRecord.record_source)}
                      />

                      {detailsRecord.source_notes ? (
                        <DetailRow
                          label="Source Notes"
                          value={detailsRecord.source_notes}
                        />
                      ) : null}

                      <DetailRow
                        label="Created"
                        value={formatDateTime(detailsRecord.date_created)}
                      />

                      <DetailRow
                        label="Updated"
                        value={formatDateTime(detailsRecord.last_updated)}
                      />
                    </View>
                  ) : null}

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Tooth Chart</Text>
                    <Text style={styles.sectionSubtitle}>
                      {teeth.length} recorded tooth
                      {teeth.length === 1 ? "" : " entries"}
                    </Text>
                  </View>

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
                            numberOfLines={2}
                          >
                            {tooth.tooth_status || "Sound"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Treatment History</Text>
                    <Text style={styles.sectionSubtitle}>
                      {treatments.length} treatment
                      {treatments.length === 1 ? "" : "s"} found
                    </Text>
                  </View>

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
                        <View style={styles.treatmentTopRow}>
                          <View style={styles.treatmentIconCircle}>
                            <Ionicons
                              name="medkit-outline"
                              size={18}
                              color="#2b6cb0"
                            />
                          </View>

                          <View style={styles.treatmentTextBlock}>
                            <Text style={styles.treatmentTitle}>
                              {treatment.procedure_type || "Dental Treatment"}
                            </Text>

                            <Text style={styles.treatmentText}>
                              Tooth #{treatment.tooth_number || "N/A"} •{" "}
                              {formatDate(treatment.treatment_date)}
                            </Text>
                          </View>
                        </View>

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
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#edf2f7",
    alignItems: "center",
    justifyContent: "center",
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
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1a202c",
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2d3748",
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: "#edf2f7",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: "#2b6cb0",
    borderColor: "#2b6cb0",
  },
  chipText: {
    color: "#4a5568",
    fontSize: 12,
    fontWeight: "900",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  clearButton: {
    backgroundColor: "#edf2f7",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
  },
  clearButtonText: {
    color: "#2b6cb0",
    fontSize: 13,
    fontWeight: "900",
  },
  countText: {
    color: "#718096",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12,
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
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  recordTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  recordIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  recordTitleBlock: {
    flex: 1,
  },
  recordTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  recordSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  activeStatusBadge: {
    backgroundColor: "#c6f6d5",
  },
  activeStatusText: {
    color: "#2f855a",
  },
  inactiveStatusBadge: {
    backgroundColor: "#fed7d7",
  },
  inactiveStatusText: {
    color: "#c53030",
  },
  archivedStatusBadge: {
    backgroundColor: "#e2e8f0",
  },
  archivedStatusText: {
    color: "#2d3748",
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
  sourceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  sourceContent: {
    flex: 1,
    gap: 6,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: "900",
  },
  newSourceBadge: {
    backgroundColor: "#e3f2fd",
  },
  newSourceText: {
    color: "#2b6cb0",
  },
  oldSourceBadge: {
    backgroundColor: "#fef3c7",
  },
  oldSourceText: {
    color: "#92400e",
  },
  scannedSourceBadge: {
    backgroundColor: "#c6f6d5",
  },
  scannedSourceText: {
    color: "#2f855a",
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
  detailsLoadingBox: {
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsHeaderCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 18,
  },
  detailsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  detailsTitleBlock: {
    flex: 1,
  },
  detailsRecordTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  detailsDentition: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "800",
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
  teethGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  toothCard: {
    width: "31%",
    minHeight: 72,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  toothNumber: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },
  toothStatus: {
    fontSize: 10.5,
    fontWeight: "900",
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
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  treatmentTopRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  treatmentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  treatmentTextBlock: {
    flex: 1,
  },
  treatmentTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  treatmentText: {
    fontSize: 13,
    color: "#4a5568",
    fontWeight: "700",
  },
  treatmentDescription: {
    fontSize: 13,
    color: "#718096",
    lineHeight: 19,
    marginTop: 10,
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