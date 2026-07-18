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
  cancelPatientTransferRequest,
  createPatientTransferRequest,
  getPatientTransferPackage,
  getPatientTransferRequests,
  getTransferDestinationClinics,
} from "../services/patientTransferService";

const DEFAULT_CONSENT =
  "I authorize the transfer of my active clinic assignment to the selected destination clinic. I understand that my previous clinic records will remain preserved as read-only historical records for continuity of care.";

const STATUS_OPTIONS = [
  "All",
  "Pending Source Approval",
  "Pending Destination Approval",
  "Approved",
  "Rejected",
  "Cancelled",
  "Expired",
];

const formatDateTime = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isPending = (status) =>
  ["Pending Source Approval", "Pending Destination Approval"].includes(status);

const FilterChip = ({ label, selected, onPress }) => (
  <Pressable
    style={[styles.filterChip, selected && styles.filterChipSelected]}
    onPress={onPress}
  >
    <Text
      style={[
        styles.filterChipText,
        selected && styles.filterChipTextSelected,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const SelectionToggle = ({ label, value, onToggle }) => (
  <Pressable style={styles.selectionRow} onPress={() => onToggle(!value)}>
    <View
      style={[
        styles.checkbox,
        value && styles.checkboxSelected,
      ]}
    >
      {value ? (
        <Ionicons name="checkmark" size={16} color="#ffffff" />
      ) : null}
    </View>
    <Text style={styles.selectionLabel}>{label}</Text>
  </Pressable>
);

const getStatusStyle = (status) => {
  if (status === "Approved") {
    return {
      container: styles.approvedBadge,
      text: styles.approvedBadgeText,
    };
  }

  if (status === "Rejected" || status === "Cancelled" || status === "Expired") {
    return {
      container: styles.closedBadge,
      text: styles.closedBadgeText,
    };
  }

  return {
    container: styles.pendingBadge,
    text: styles.pendingBadgeText,
  };
};

export default function PatientTransfersScreen({ token }) {
  const [sourceClinic, setSourceClinic] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [requests, setRequests] = useState([]);

  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [clinicSearch, setClinicSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [includeProfile, setIncludeProfile] = useState(true);
  const [includeDentalRecords, setIncludeDentalRecords] = useState(true);
  const [includeXrays, setIncludeXrays] = useState(true);
  const [includeAppointments, setIncludeAppointments] = useState(true);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentStatement, setConsentStatement] = useState(DEFAULT_CONSENT);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [packageVisible, setPackageVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingPackage, setLoadingPackage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);

      const [clinicResponse, requestResponse] = await Promise.all([
        getTransferDestinationClinics(token),
        getPatientTransferRequests(token),
      ]);

      setSourceClinic(clinicResponse.source_clinic || null);
      setClinics(Array.isArray(clinicResponse.clinics) ? clinicResponse.clinics : []);
      setRequests(
        Array.isArray(requestResponse.requests) ? requestResponse.requests : [],
      );
    } catch (error) {
      Alert.alert(
        "Clinic Transfer Error",
        error.message || "Unable to load clinic transfer information.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const selectedClinic = useMemo(
    () =>
      clinics.find(
        (clinic) => Number(clinic.clinic_id) === Number(selectedClinicId),
      ) || null,
    [clinics, selectedClinicId],
  );

  const filteredClinics = useMemo(() => {
    const term = clinicSearch.trim().toLowerCase();

    return clinics
      .filter((clinic) => {
        if (!term) return true;

        return [clinic.clinic_name, clinic.address, clinic.contact_number]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) =>
        String(a.clinic_name || "").localeCompare(String(b.clinic_name || "")),
      );
  }, [clinicSearch, clinics]);

  const filteredRequests = useMemo(() => {
    const term = historySearch.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "All" || request.transfer_status === statusFilter;

      const matchesSearch =
        !term ||
        [
          request.transfer_id,
          request.source_clinic_name,
          request.destination_clinic_name,
          request.transfer_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [historySearch, requests, statusFilter]);

  const hasTransferSelection =
    includeProfile ||
    includeDentalRecords ||
    includeXrays ||
    includeAppointments;

  const submitTransfer = async () => {
    if (!selectedClinicId) {
      Alert.alert(
        "Destination Required",
        "Select a destination clinic before submitting.",
      );
      return;
    }

    if (!hasTransferSelection) {
      Alert.alert(
        "Information Required",
        "Select at least one information category to transfer.",
      );
      return;
    }

    if (!consentConfirmed || !consentStatement.trim()) {
      Alert.alert(
        "Consent Required",
        "Review and confirm the Patient consent statement.",
      );
      return;
    }

    Alert.alert(
      "Submit Clinic Transfer",
      `Transfer your active clinic assignment from ${
        sourceClinic?.clinic_name || "your current clinic"
      } to ${selectedClinic?.clinic_name || "the selected clinic"}?`,
      [
        { text: "Back", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            try {
              setSubmitting(true);

              const response = await createPatientTransferRequest({
                token,
                destination_clinic_id: Number(selectedClinicId),
                include_profile: includeProfile,
                include_dental_records: includeDentalRecords,
                include_xrays: includeXrays,
                include_appointments: includeAppointments,
                consent_confirmed: true,
                consent_statement: consentStatement.trim(),
              });

              setSelectedClinicId(null);
              setConsentConfirmed(false);
              setClinicSearch("");

              Alert.alert(
                "Transfer Request Submitted",
                response.message ||
                  "The transfer request was submitted for clinic approval.",
              );

              await loadData();
            } catch (error) {
              Alert.alert(
                "Submission Failed",
                error.message || "Unable to submit the transfer request.",
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const cancelRequest = (request) => {
    Alert.alert(
      "Cancel Transfer Request",
      `Cancel transfer request #${request.transfer_id}?`,
      [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingId(request.transfer_id);

              const response = await cancelPatientTransferRequest({
                token,
                transfer_id: request.transfer_id,
              });

              Alert.alert(
                "Transfer Cancelled",
                response.message || "The transfer request was cancelled.",
              );

              await loadData();
            } catch (error) {
              Alert.alert(
                "Cancellation Failed",
                error.message || "Unable to cancel the transfer request.",
              );
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ],
    );
  };

  const openPackage = async (request) => {
    try {
      setLoadingPackage(true);
      setPackageVisible(true);
      setSelectedPackage(null);

      const response = await getPatientTransferPackage({
        token,
        transfer_id: request.transfer_id,
      });

      setSelectedPackage(response);
    } catch (error) {
      setPackageVisible(false);
      Alert.alert(
        "Transfer Package Error",
        error.message || "Unable to open the transferred information package.",
      );
    } finally {
      setLoadingPackage(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerStateText}>Loading clinic transfers...</Text>
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
            onRefresh={() => loadData({ refresh: true })}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Transfer to Another Clinic</Text>
          <Text style={styles.subtitle}>
            Move your active clinic assignment after approval from both your
            current clinic and destination clinic.
          </Text>
        </View>

        <View style={styles.processCard}>
          <Text style={styles.processTitle}>Transfer Process</Text>
          <Text style={styles.processStep}>1. Patient submits request</Text>
          <Text style={styles.processStep}>2. Source clinic reviews</Text>
          <Text style={styles.processStep}>3. Destination clinic reviews</Text>
          <Text style={styles.processStep}>
            4. Assignment changes after final approval
          </Text>
        </View>

        <View style={styles.currentClinicCard}>
          <Text style={styles.sectionLabel}>Current Clinic</Text>
          <Text style={styles.currentClinicName}>
            {sourceClinic?.clinic_name || "No active clinic assignment"}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Select Destination Clinic</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={clinicSearch}
              onChangeText={setClinicSearch}
              placeholder="Search clinic, address, or contact"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {filteredClinics.length === 0 ? (
            <Text style={styles.emptyText}>
              No eligible destination clinics were found.
            </Text>
          ) : (
            filteredClinics.map((clinic) => {
              const selected =
                Number(selectedClinicId) === Number(clinic.clinic_id);

              return (
                <Pressable
                  key={clinic.clinic_id}
                  style={[
                    styles.clinicCard,
                    selected && styles.clinicCardSelected,
                  ]}
                  onPress={() => setSelectedClinicId(clinic.clinic_id)}
                >
                  <View style={styles.clinicText}>
                    <Text style={styles.clinicName}>{clinic.clinic_name}</Text>
                    <Text style={styles.clinicDetail}>
                      {clinic.address || "No address provided"}
                    </Text>
                    <Text style={styles.clinicDetail}>
                      {clinic.contact_number || "No contact number"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.radioCircle,
                      selected && styles.radioCircleSelected,
                    ]}
                  >
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Information to Transfer</Text>
          <SelectionToggle
            label="Patient profile"
            value={includeProfile}
            onToggle={setIncludeProfile}
          />
          <SelectionToggle
            label="Dental records"
            value={includeDentalRecords}
            onToggle={setIncludeDentalRecords}
          />
          <SelectionToggle
            label="X-rays"
            value={includeXrays}
            onToggle={setIncludeXrays}
          />
          <SelectionToggle
            label="Appointments"
            value={includeAppointments}
            onToggle={setIncludeAppointments}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Patient Consent</Text>

          <TextInput
            style={styles.consentInput}
            value={consentStatement}
            onChangeText={setConsentStatement}
            multiline
            textAlignVertical="top"
          />

          <SelectionToggle
            label="I have reviewed and agree to this consent statement."
            value={consentConfirmed}
            onToggle={setConsentConfirmed}
          />
        </View>

        <Pressable
          style={[
            styles.submitButton,
            submitting && styles.disabledButton,
          ]}
          onPress={submitTransfer}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="swap-horizontal" size={20} color="#ffffff" />
              <Text style={styles.submitButtonText}>
                Submit Transfer Request
              </Text>
            </>
          )}
        </Pressable>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Transfer History</Text>
          <Text style={styles.historyCount}>{filteredRequests.length}</Text>
        </View>

        <View style={styles.historyFilters}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="Search request or clinic"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {STATUS_OPTIONS.map((status) => (
              <FilterChip
                key={status}
                label={status}
                selected={statusFilter === status}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ScrollView>
        </View>

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No transfer requests match the current filters.
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const badgeStyle = getStatusStyle(request.transfer_status);
            const pending = isPending(request.transfer_status);

            return (
              <View key={request.transfer_id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderText}>
                    <Text style={styles.requestTitle}>
                      Transfer #{request.transfer_id}
                    </Text>
                    <Text style={styles.requestDate}>
                      Submitted {formatDateTime(request.created_at)}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, badgeStyle.container]}>
                    <Text style={[styles.statusBadgeText, badgeStyle.text]}>
                      {request.transfer_status}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeBox}>
                  <Text style={styles.routeClinic}>
                    {request.source_clinic_name}
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color="#64748b"
                  />
                  <Text style={styles.routeClinic}>
                    {request.destination_clinic_name}
                  </Text>
                </View>

                <Text style={styles.requestDetail}>
                  Source reviewed:{" "}
                  {formatDateTime(request.source_reviewed_at)}
                </Text>
                <Text style={styles.requestDetail}>
                  Destination reviewed:{" "}
                  {formatDateTime(request.destination_reviewed_at)}
                </Text>
                <Text style={styles.requestDetail}>
                  Expires: {formatDateTime(request.expires_at)}
                </Text>

                {request.rejection_reason ? (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                    <Text style={styles.rejectionText}>
                      {request.rejection_reason}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.requestActions}>
                  {pending ? (
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => cancelRequest(request)}
                      disabled={updatingId === request.transfer_id}
                    >
                      {updatingId === request.transfer_id ? (
                        <ActivityIndicator color="#b91c1c" />
                      ) : (
                        <Text style={styles.cancelButtonText}>
                          Cancel Request
                        </Text>
                      )}
                    </Pressable>
                  ) : null}

                  {request.transfer_status === "Approved" ? (
                    <Pressable
                      style={styles.packageButton}
                      onPress={() => openPackage(request)}
                    >
                      <Text style={styles.packageButtonText}>
                        View Transfer Package
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={packageVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPackageVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.packageModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  Approved Transfer Package
                </Text>
                <Text style={styles.modalSubtitle}>
                  Read-only summary of the transferred information.
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setPackageVisible(false)}
              >
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>

            {loadingPackage ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.packageContent}>
                <Text style={styles.packageSectionTitle}>Transfer Details</Text>
                <Text style={styles.packageLine}>
                  Status:{" "}
                  {selectedPackage?.transfer?.transfer_status || "Approved"}
                </Text>
                <Text style={styles.packageLine}>
                  From:{" "}
                  {selectedPackage?.transfer?.source_clinic_name ||
                    "Not available"}
                </Text>
                <Text style={styles.packageLine}>
                  To:{" "}
                  {selectedPackage?.transfer?.destination_clinic_name ||
                    "Not available"}
                </Text>

                <Text style={styles.packageSectionTitle}>Included Data</Text>
                <Text style={styles.packageLine}>
                  Profile: {selectedPackage?.profile ? "Included" : "Not included"}
                </Text>
                <Text style={styles.packageLine}>
                  Dental records:{" "}
                  {Array.isArray(selectedPackage?.dental_records)
                    ? selectedPackage.dental_records.length
                    : 0}
                </Text>
                <Text style={styles.packageLine}>
                  X-rays:{" "}
                  {Array.isArray(selectedPackage?.xrays)
                    ? selectedPackage.xrays.length
                    : 0}
                </Text>
                <Text style={styles.packageLine}>
                  Appointments:{" "}
                  {Array.isArray(selectedPackage?.appointments)
                    ? selectedPackage.appointments.length
                    : 0}
                </Text>
              </ScrollView>
            )}
          </View>
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
  processCard: {
    gap: 6,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
  },
  processTitle: { color: "#1e3a8a", fontWeight: "800" },
  processStep: { color: "#1e40af", fontSize: 12 },
  currentClinicCard: {
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 14,
  },
  sectionLabel: { color: "#166534", fontSize: 11, fontWeight: "800" },
  currentClinicName: {
    marginTop: 4,
    color: "#166534",
    fontSize: 17,
    fontWeight: "900",
  },
  sectionCard: {
    gap: 11,
    marginBottom: 14,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  sectionTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  searchBox: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  searchInput: { flex: 1, color: "#0f172a" },
  clinicCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
  },
  clinicCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  clinicText: { flex: 1 },
  clinicName: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
  clinicDetail: { marginTop: 3, color: "#64748b", fontSize: 11 },
  radioCircle: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#94a3b8",
    borderRadius: 11,
  },
  radioCircleSelected: { borderColor: "#2563eb" },
  radioDot: {
    width: 10,
    height: 10,
    backgroundColor: "#2563eb",
    borderRadius: 5,
  },
  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 42,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#94a3b8",
    borderRadius: 6,
  },
  checkboxSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  selectionLabel: {
    flex: 1,
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
  },
  consentInput: {
    minHeight: 125,
    padding: 12,
    color: "#334155",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  submitButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 22,
    backgroundColor: "#2563eb",
    borderRadius: 13,
  },
  submitButtonText: { color: "#ffffff", fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  historyCount: {
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
  historyFilters: {
    gap: 10,
    marginBottom: 14,
  },
  filterRow: { gap: 7 },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
  },
  filterChipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  filterChipText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  filterChipTextSelected: { color: "#ffffff" },
  emptyCard: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  requestCard: {
    gap: 11,
    marginBottom: 13,
    padding: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  requestHeaderText: { flex: 1 },
  requestTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  requestDate: { marginTop: 3, color: "#64748b", fontSize: 10 },
  statusBadge: {
    maxWidth: 150,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "800", textAlign: "center" },
  pendingBadge: { backgroundColor: "#fef3c7" },
  pendingBadgeText: { color: "#92400e" },
  approvedBadge: { backgroundColor: "#dcfce7" },
  approvedBadgeText: { color: "#15803d" },
  closedBadge: { backgroundColor: "#fee2e2" },
  closedBadgeText: { color: "#b91c1c" },
  routeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
  },
  routeClinic: {
    flex: 1,
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  requestDetail: { color: "#64748b", fontSize: 11 },
  rejectionBox: {
    padding: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
  },
  rejectionTitle: { color: "#991b1b", fontSize: 11, fontWeight: "800" },
  rejectionText: { marginTop: 3, color: "#b91c1c", fontSize: 11 },
  requestActions: { flexDirection: "row", gap: 8 },
  cancelButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
  },
  cancelButtonText: { color: "#b91c1c", fontWeight: "800" },
  packageButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
  },
  packageButtonText: { color: "#1d4ed8", fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  packageModal: {
    maxHeight: "88%",
    paddingTop: 18,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: "#0f172a", fontSize: 19, fontWeight: "900" },
  modalSubtitle: { marginTop: 4, color: "#64748b", fontSize: 11 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 19,
  },
  modalLoading: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  packageContent: { padding: 18, paddingBottom: 30 },
  packageSectionTitle: {
    marginTop: 8,
    marginBottom: 8,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  packageLine: {
    marginBottom: 6,
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
});