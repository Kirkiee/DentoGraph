import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  confirmProfileVerification,
  getPatientProfile,
  requestProfileVerification,
  updatePatientProfile,
} from "../services/patientService";

const MEDICAL_OPTIONS = [
  "Hypertension",
  "Diabetes",
  "Asthma",
  "Heart condition",
  "Bleeding disorder",
  "Pregnancy",
  "None declared",
];

const safeParse = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseAddress = (value) => {
  const parsed = safeParse(value, null);

  if (parsed && typeof parsed === "object") {
    return {
      line1: parsed.line1 || "",
      barangay: parsed.barangay || "",
      city: parsed.city || "",
      province: parsed.province || "",
      postal_code: parsed.postal_code || "",
    };
  }

  return {
    line1: typeof value === "string" ? value : "",
    barangay: "",
    city: "",
    province: "",
    postal_code: "",
  };
};

const parseMedicalHistory = (value) => {
  const parsed = safeParse(value, null);

  if (parsed && typeof parsed === "object") {
    return {
      conditions: Array.isArray(parsed.conditions)
        ? parsed.conditions
        : [],
      allergies: parsed.allergies || "",
      medications: parsed.medications || "",
      notes: parsed.notes || "",
    };
  }

  return {
    conditions: [],
    allergies: "",
    medications: "",
    notes: typeof value === "string" ? value : "",
  };
};

const formatAddress = (value) => {
  const address = parseAddress(value);

  return [
    address.line1,
    address.barangay,
    address.city,
    address.province,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(", ") || "Not provided";
};

const formatMedicalHistory = (value) => {
  const history = parseMedicalHistory(value);
  const details = [];

  if (history.conditions.length) {
    details.push(history.conditions.join(", "));
  }

  if (history.allergies) {
    details.push(`Allergies: ${history.allergies}`);
  }

  if (history.medications) {
    details.push(`Medications: ${history.medications}`);
  }

  if (history.notes) {
    details.push(history.notes);
  }

  return details.join("\n") || "No medical history provided";
};

const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
  multiline = false,
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.multilineInput]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
    />
  </View>
);

const InfoRow = ({ icon, label, value, actionLabel, onAction }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={18} color="#2563eb" />
    </View>

    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "Not provided"}</Text>
    </View>

    {actionLabel ? (
      <Pressable style={styles.inlineAction} onPress={onAction}>
        <Text style={styles.inlineActionText}>{actionLabel}</Text>
      </Pressable>
    ) : null}
  </View>
);

export default function PatientProfileScreen({
  token,
  onProfileUpdated,
}) {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState(parseAddress(""));
  const [medicalHistory, setMedicalHistory] = useState(
    parseMedicalHistory(""),
  );

  const [verification, setVerification] = useState({
    visible: false,
    type: "email",
    value: "",
    code: "",
    stage: "request",
  });
  const [verificationBusy, setVerificationBusy] = useState(false);

  const initials = useMemo(
    () => String(profile?.name || "P").trim().charAt(0).toUpperCase(),
    [profile?.name],
  );

  useEffect(() => {
    loadProfile();
  }, []);

  const fillProfile = (patient) => {
    setProfile(patient);
    setName(patient?.name || "");
    setAddress(parseAddress(patient?.address));
    setMedicalHistory(parseMedicalHistory(patient?.medical_history));
  };

  const loadProfile = async ({ refresh = false } = {}) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const data = await getPatientProfile(token);
      fillProfile(data.patient);
    } catch (error) {
      Alert.alert(
        "Profile Error",
        error.message || "Unable to load patient profile.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateAddressField = (field, value) => {
    setAddress((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateMedicalField = (field, value) => {
    setMedicalHistory((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleCondition = (condition) => {
    setMedicalHistory((current) => {
      const exists = current.conditions.includes(condition);

      let conditions = exists
        ? current.conditions.filter((item) => item !== condition)
        : [...current.conditions, condition];

      if (condition === "None declared" && !exists) {
        conditions = ["None declared"];
      } else if (condition !== "None declared") {
        conditions = conditions.filter(
          (item) => item !== "None declared",
        );
      }

      return {
        ...current,
        conditions,
      };
    });
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Name is required.");
      return;
    }

    if (!address.city.trim() || !address.province.trim()) {
      Alert.alert(
        "Incomplete Address",
        "City or municipality and province are required.",
      );
      return;
    }

    try {
      setSaving(true);

      const data = await updatePatientProfile({
        token,
        profile: {
          name: name.trim(),
          address,
          medical_history: medicalHistory,
        },
      });

      fillProfile(data.patient);
      onProfileUpdated?.(data.patient);
      setEditing(false);

      Alert.alert("Profile Updated", data.message);
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error.message || "Unable to update patient profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openVerification = (type) => {
    setVerification({
      visible: true,
      type,
      value:
        type === "email"
          ? profile?.email || ""
          : profile?.contact_number || "",
      code: "",
      stage: "request",
    });
  };

  const closeVerification = () => {
    if (verificationBusy) return;

    setVerification((current) => ({
      ...current,
      visible: false,
    }));
  };

  const sendVerification = async () => {
    try {
      setVerificationBusy(true);

      const data = await requestProfileVerification({
        token,
        type: verification.type,
        value: verification.value,
      });

      setVerification((current) => ({
        ...current,
        stage: "confirm",
        code: "",
      }));

      Alert.alert("Code Sent", data.message);
      await loadProfile();
    } catch (error) {
      Alert.alert(
        "Verification Error",
        error.message || "Unable to send the verification code.",
      );
    } finally {
      setVerificationBusy(false);
    }
  };

  const confirmVerification = async () => {
    if (!/^\d{6}$/.test(verification.code)) {
      Alert.alert(
        "Invalid Code",
        "Enter the six-digit verification code.",
      );
      return;
    }

    try {
      setVerificationBusy(true);

      const data = await confirmProfileVerification({
        token,
        type: verification.type,
        code: verification.code,
      });

      fillProfile(data.patient);
      onProfileUpdated?.(data.patient);
      closeVerification();

      Alert.alert(
        "Verified",
        data.requires_relogin
          ? `${data.message} Sign in again later using the new email address.`
          : data.message,
      );
    } catch (error) {
      Alert.alert(
        "Verification Failed",
        error.message || "Unable to verify the requested change.",
      );
    } finally {
      setVerificationBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProfile({ refresh: true })}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.name}>{profile?.name}</Text>
              <Text style={styles.clinic}>
                {profile?.clinic_name || "No assigned clinic"}
              </Text>

              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={13} color="#1e40af" />
                <Text style={styles.lockBadgeText}>
                  {profile?.dentition_type || "Adult"} dentition
                </Text>
              </View>
            </View>
          </View>

          {!editing ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Profile Details</Text>
                  <Text style={styles.cardSubtitle}>
                    Sensitive contact changes require verification.
                  </Text>
                </View>

                <Pressable
                  style={styles.editButton}
                  onPress={() => setEditing(true)}
                >
                  <Ionicons name="create-outline" size={17} color="#2563eb" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <InfoRow
                icon="mail-outline"
                label="Verified Email"
                value={profile?.email}
                actionLabel="Change"
                onAction={() => openVerification("email")}
              />

              <InfoRow
                icon="call-outline"
                label="Verified Contact Number"
                value={profile?.contact_number}
                actionLabel="Change"
                onAction={() => openVerification("contact_number")}
              />

              <InfoRow
                icon="location-outline"
                label="Address"
                value={formatAddress(profile?.address)}
              />

              <InfoRow
                icon="medkit-outline"
                label="Medical History"
                value={formatMedicalHistory(profile?.medical_history)}
              />

              <View style={styles.readOnlyNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#1d4ed8"
                />
                <Text style={styles.readOnlyNoticeText}>
                  Dentition type is a clinical classification and cannot be
                  changed from the Patient profile.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Edit Profile</Text>
              <Text style={styles.cardSubtitle}>
                Date of birth, gender, dentition, email, and contact number
                are not directly editable here.
              </Text>

              <FormInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
              />

              <Text style={styles.sectionTitle}>Structured Address</Text>

              <FormInput
                label="House, Unit, Building, and Street"
                value={address.line1}
                onChangeText={(value) =>
                  updateAddressField("line1", value)
                }
                placeholder="Example: Unit 4, 25 Rizal Street"
              />

              <FormInput
                label="Barangay"
                value={address.barangay}
                onChangeText={(value) =>
                  updateAddressField("barangay", value)
                }
                placeholder="Barangay"
              />

              <View style={styles.twoColumnRow}>
                <View style={styles.flexField}>
                  <FormInput
                    label="City / Municipality"
                    value={address.city}
                    onChangeText={(value) =>
                      updateAddressField("city", value)
                    }
                    placeholder="City"
                  />
                </View>

                <View style={styles.flexField}>
                  <FormInput
                    label="Postal Code"
                    value={address.postal_code}
                    onChangeText={(value) =>
                      updateAddressField("postal_code", value)
                    }
                    placeholder="Postal"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <FormInput
                label="Province"
                value={address.province}
                onChangeText={(value) =>
                  updateAddressField("province", value)
                }
                placeholder="Province"
              />

              <Text style={styles.sectionTitle}>
                Medical History Checklist
              </Text>

              <View style={styles.chipWrap}>
                {MEDICAL_OPTIONS.map((condition) => {
                  const active =
                    medicalHistory.conditions.includes(condition);

                  return (
                    <Pressable
                      key={condition}
                      style={[
                        styles.conditionChip,
                        active && styles.conditionChipActive,
                      ]}
                      onPress={() => toggleCondition(condition)}
                    >
                      <Ionicons
                        name={
                          active
                            ? "checkbox-outline"
                            : "square-outline"
                        }
                        size={17}
                        color={active ? "#ffffff" : "#475569"}
                      />
                      <Text
                        style={[
                          styles.conditionChipText,
                          active && styles.conditionChipTextActive,
                        ]}
                      >
                        {condition}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <FormInput
                label="Allergies"
                value={medicalHistory.allergies}
                onChangeText={(value) =>
                  updateMedicalField("allergies", value)
                }
                placeholder="Medicines, food, latex, or none"
                multiline
              />

              <FormInput
                label="Current Medications"
                value={medicalHistory.medications}
                onChangeText={(value) =>
                  updateMedicalField("medications", value)
                }
                placeholder="List medicines and dosage, or none"
                multiline
              />

              <FormInput
                label="Other Medical Notes"
                value={medicalHistory.notes}
                onChangeText={(value) =>
                  updateMedicalField("notes", value)
                }
                placeholder="Previous surgery, hospitalization, or other notes"
                multiline
              />

              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    fillProfile(profile);
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.saveButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Profile</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={verification.visible}
        transparent
        animationType="slide"
        onRequestClose={closeVerification}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Verify New{" "}
                  {verification.type === "email"
                    ? "Email"
                    : "Contact Number"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  The existing value remains active until verification succeeds.
                </Text>
              </View>

              <Pressable onPress={closeVerification}>
                <Ionicons name="close" size={23} color="#475569" />
              </Pressable>
            </View>

            {verification.stage === "request" ? (
              <>
                <FormInput
                  label={
                    verification.type === "email"
                      ? "New Email Address"
                      : "New Philippine Mobile Number"
                  }
                  value={verification.value}
                  onChangeText={(value) =>
                    setVerification((current) => ({
                      ...current,
                      value,
                    }))
                  }
                  placeholder={
                    verification.type === "email"
                      ? "name@example.com"
                      : "09XXXXXXXXX"
                  }
                  keyboardType={
                    verification.type === "email"
                      ? "email-address"
                      : "phone-pad"
                  }
                  autoCapitalize="none"
                />

                <Pressable
                  style={[
                    styles.fullButton,
                    verificationBusy && styles.disabledButton,
                  ]}
                  onPress={sendVerification}
                  disabled={verificationBusy}
                >
                  {verificationBusy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      Send Verification Code
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <FormInput
                  label="Six-Digit Code"
                  value={verification.code}
                  onChangeText={(value) =>
                    setVerification((current) => ({
                      ...current,
                      code: value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                  placeholder="000000"
                  keyboardType="number-pad"
                />

                <Pressable
                  style={[
                    styles.fullButton,
                    verificationBusy && styles.disabledButton,
                  ]}
                  onPress={confirmVerification}
                  disabled={verificationBusy}
                >
                  {verificationBusy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      Confirm and Update
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.resendButton}
                  onPress={sendVerification}
                  disabled={verificationBusy}
                >
                  <Text style={styles.resendText}>
                    Send a new code
                  </Text>
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
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 18, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 10, color: "#64748b" },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
    marginBottom: 14,
    backgroundColor: "#2563eb",
    borderRadius: 19,
  },
  avatar: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 33,
  },
  avatarText: {
    color: "#2563eb",
    fontSize: 28,
    fontWeight: "900",
  },
  headerText: { flex: 1 },
  name: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  clinic: { marginTop: 3, color: "#dbeafe", fontSize: 11 },
  lockBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
  },
  lockBadgeText: {
    color: "#1e40af",
    fontSize: 10,
    fontWeight: "900",
  },
  card: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 17,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: { color: "#0f172a", fontSize: 18, fontWeight: "900" },
  cardSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 17,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: "#eff6ff",
    borderRadius: 999,
  },
  editButtonText: { color: "#2563eb", fontSize: 11, fontWeight: "900" },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 9,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  infoIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 11,
  },
  infoText: { flex: 1 },
  infoLabel: { color: "#64748b", fontSize: 10, fontWeight: "900" },
  infoValue: {
    marginTop: 3,
    color: "#1e293b",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  inlineAction: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    backgroundColor: "#dbeafe",
    borderRadius: 9,
  },
  inlineActionText: { color: "#1d4ed8", fontSize: 10, fontWeight: "900" },
  readOnlyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
    padding: 11,
    backgroundColor: "#eff6ff",
    borderRadius: 11,
  },
  readOnlyNoticeText: {
    flex: 1,
    color: "#1e40af",
    fontSize: 10,
    lineHeight: 16,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 11,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
  inputGroup: { marginBottom: 12 },
  inputLabel: {
    marginBottom: 6,
    color: "#475569",
    fontSize: 11,
    fontWeight: "900",
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 11,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  twoColumnRow: { flexDirection: "row", gap: 10 },
  flexField: { flex: 1 },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 13,
  },
  conditionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  conditionChipActive: { backgroundColor: "#2563eb" },
  conditionChipText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "800",
  },
  conditionChipTextActive: { color: "#ffffff" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 5 },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
  },
  cancelButtonText: { color: "#334155", fontWeight: "900" },
  saveButton: {
    flex: 1.3,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: "#2563eb",
    borderRadius: 12,
  },
  saveButtonText: { color: "#ffffff", fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  modalSheet: {
    padding: 18,
    paddingBottom: 30,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 15,
  },
  modalTitle: { color: "#0f172a", fontSize: 18, fontWeight: "900" },
  modalSubtitle: {
    maxWidth: 290,
    marginTop: 4,
    color: "#64748b",
    fontSize: 10,
    lineHeight: 15,
  },
  fullButton: {
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: 13,
  },
  resendText: { color: "#2563eb", fontSize: 11, fontWeight: "900" },
});