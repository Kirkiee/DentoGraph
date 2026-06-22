import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  getPatientProfile,
  updatePatientProfile,
} from "../services/patientService";

export default function PatientProfileScreen({
  token,
  user,
  onProfileUpdated,
}) {
  const [profile, setProfile] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    contact_number: "",
    date_of_birth: "",
    address: "",
    gender: "",
    medical_history: "",
    dentition_type: "Adult",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const fillForm = (patient) => {
    setProfile(patient);

    setForm({
      name: patient?.name || "",
      email: patient?.email || "",
      contact_number: patient?.contact_number || "",
      date_of_birth: patient?.date_of_birth || "",
      address: patient?.address || "",
      gender: patient?.gender || "",
      medical_history: patient?.medical_history || "",
      dentition_type: patient?.dentition_type || "Adult",
    });
  };

  const loadProfile = async () => {
    try {
      setLoading(true);

      const data = await getPatientProfile(token);
      fillForm(data.patient);
    } catch (error) {
      Alert.alert(
        "Profile Error",
        error.message || "Unable to load patient profile."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      const data = await getPatientProfile(token);
      fillForm(data.patient);
    } catch (error) {
      Alert.alert(
        "Profile Error",
        error.message || "Unable to refresh patient profile."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();

    if (profile) {
      fillForm(profile);
    }

    setEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!form.name.trim()) {
      Alert.alert("Missing Name", "Name is required.");
      return;
    }

    if (!form.email.trim()) {
      Alert.alert("Missing Email", "Email is required.");
      return;
    }

    if (form.dentition_type !== "Adult" && form.dentition_type !== "Child") {
      Alert.alert("Invalid Dentition", "Dentition type must be Adult or Child.");
      return;
    }

    try {
      Keyboard.dismiss();
      setSaving(true);

      const data = await updatePatientProfile({
        token,
        profile: {
          name: form.name.trim(),
          email: form.email.trim(),
          contact_number: form.contact_number.trim() || null,
          date_of_birth: form.date_of_birth.trim() || null,
          address: form.address.trim() || null,
          gender: form.gender.trim() || null,
          medical_history: form.medical_history.trim() || null,
          dentition_type: form.dentition_type,
        },
      });

      fillForm(data.patient);

      if (onProfileUpdated) {
        onProfileUpdated(data.patient);
      }

      setEditing(false);

      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      Alert.alert(
        "Update Failed",
        error.message || "Unable to update patient profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const displayValue = (value) => {
    if (!value) return "Not set";
    return value;
  };

  const getInitial = () => {
    return (form.name || user?.name || "P").charAt(0).toUpperCase();
  };

  const renderInput = ({
    label,
    field,
    placeholder,
    icon,
    multiline = false,
    keyboardType = "default",
    autoCapitalize = "sentences",
  }) => {
    return (
      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <Ionicons name={icon} size={15} color="#718096" />
          <Text style={styles.inputLabel}>{label}</Text>
        </View>

        <TextInput
          style={[styles.input, multiline && styles.multilineInput]}
          placeholder={placeholder}
          placeholderTextColor="#a0aec0"
          value={form[field]}
          onChangeText={(value) => updateField(field, value)}
          editable={editing && !saving}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textAlignVertical={multiline ? "top" : "center"}
        />
      </View>
    );
  };

  function InfoRow({ icon, label, value }) {
    return (
      <View style={styles.infoRow}>
        <View style={styles.infoIconCircle}>
          <Ionicons name={icon} size={16} color="#2b6cb0" />
        </View>

        <View style={styles.infoTextBlock}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{displayValue(value)}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerIconCircle}>
                <Ionicons name="person-outline" size={27} color="#2b6cb0" />
              </View>

              <View style={styles.headerTextBlock}>
                <Text style={styles.title}>Profile</Text>
                <Text style={styles.subtitle}>
                  View and update your patient account information.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitial()}</Text>
            </View>

            <View style={styles.profileTextBlock}>
              <Text style={styles.profileName} numberOfLines={2}>
                {form.name || user?.name || "Patient"}
              </Text>

              <Text style={styles.profileEmail} numberOfLines={1}>
                {form.email || user?.email || "No email"}
              </Text>

              <View style={styles.profileMetaRow}>
                <View style={styles.accountStatusBadge}>
                  <Text style={styles.accountStatusText}>
                    {profile?.account_status || "Active"}
                  </Text>
                </View>

                <View style={styles.dentitionBadge}>
                  <Text style={styles.dentitionBadgeText}>
                    {form.dentition_type || "Adult"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {!editing ? (
            <View style={styles.infoCard}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>Patient Information</Text>
                  <Text style={styles.cardSubtitle}>
                    Your current personal and dental details
                  </Text>
                </View>

                <Pressable
                  style={styles.editButton}
                  onPress={() => setEditing(true)}
                >
                  <Ionicons name="create-outline" size={16} color="#2b6cb0" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              <View style={styles.infoList}>
                <InfoRow
                  icon="person-outline"
                  label="Name"
                  value={profile?.name}
                />

                <InfoRow
                  icon="mail-outline"
                  label="Email"
                  value={profile?.email}
                />

                <InfoRow
                  icon="call-outline"
                  label="Contact Number"
                  value={profile?.contact_number}
                />

                <InfoRow
                  icon="calendar-outline"
                  label="Date of Birth"
                  value={profile?.date_of_birth}
                />

                <InfoRow
                  icon="male-female-outline"
                  label="Gender"
                  value={profile?.gender}
                />

                <InfoRow
                  icon="medical-outline"
                  label="Dentition Type"
                  value={profile?.dentition_type}
                />

                <InfoRow
                  icon="location-outline"
                  label="Address"
                  value={profile?.address}
                />

                <InfoRow
                  icon="heart-outline"
                  label="Medical History"
                  value={profile?.medical_history}
                />
              </View>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.editHeader}>
                <Text style={styles.cardTitle}>Edit Patient Information</Text>
                <Text style={styles.cardSubtitle}>
                  Update your details then tap Save Changes
                </Text>
              </View>

              {renderInput({
                label: "Name",
                field: "name",
                placeholder: "Enter your full name",
                icon: "person-outline",
              })}

              {renderInput({
                label: "Email",
                field: "email",
                placeholder: "Enter your email",
                icon: "mail-outline",
                keyboardType: "email-address",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Contact Number",
                field: "contact_number",
                placeholder: "Enter your contact number",
                icon: "call-outline",
                keyboardType: "phone-pad",
              })}

              {renderInput({
                label: "Date of Birth",
                field: "date_of_birth",
                placeholder: "YYYY-MM-DD",
                icon: "calendar-outline",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Gender",
                field: "gender",
                placeholder: "Enter your gender",
                icon: "male-female-outline",
              })}

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Ionicons name="medical-outline" size={15} color="#718096" />
                  <Text style={styles.inputLabel}>Dentition Type</Text>
                </View>

                <View style={styles.toggleRow}>
                  <Pressable
                    style={[
                      styles.toggleButton,
                      form.dentition_type === "Adult" &&
                        styles.activeToggleButton,
                    ]}
                    onPress={() => updateField("dentition_type", "Adult")}
                    disabled={saving}
                  >
                    <Ionicons
                      name="person-outline"
                      size={17}
                      color={
                        form.dentition_type === "Adult" ? "#2b6cb0" : "#718096"
                      }
                    />

                    <Text
                      style={[
                        styles.toggleText,
                        form.dentition_type === "Adult" &&
                          styles.activeToggleText,
                      ]}
                    >
                      Adult
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.toggleButton,
                      form.dentition_type === "Child" &&
                        styles.activeToggleButton,
                    ]}
                    onPress={() => updateField("dentition_type", "Child")}
                    disabled={saving}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={17}
                      color={
                        form.dentition_type === "Child" ? "#2b6cb0" : "#718096"
                      }
                    />

                    <Text
                      style={[
                        styles.toggleText,
                        form.dentition_type === "Child" &&
                          styles.activeToggleText,
                      ]}
                    >
                      Child
                    </Text>
                  </Pressable>
                </View>
              </View>

              {renderInput({
                label: "Address",
                field: "address",
                placeholder: "Enter your address",
                icon: "location-outline",
                multiline: true,
              })}

              {renderInput({
                label: "Medical History",
                field: "medical_history",
                placeholder: "Enter medical history, allergies, or notes",
                icon: "heart-outline",
                multiline: true,
              })}

              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCancelEdit}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#ffffff"
                      />
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
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
  profileCard: {
    backgroundColor: "#2b6cb0",
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    shadowColor: "#2b6cb0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#2b6cb0",
    fontSize: 32,
    fontWeight: "900",
  },
  profileTextBlock: {
    flex: 1,
  },
  profileName: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 4,
  },
  profileEmail: {
    color: "#e3f2fd",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  profileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accountStatusBadge: {
    backgroundColor: "#c6f6d5",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  accountStatusText: {
    color: "#2f855a",
    fontSize: 11,
    fontWeight: "900",
  },
  dentitionBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dentitionBadgeText: {
    color: "#2b6cb0",
    fontSize: 11,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "700",
    lineHeight: 18,
  },
  editButton: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  editButtonText: {
    color: "#2b6cb0",
    fontSize: 12,
    fontWeight: "900",
  },
  infoList: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#edf2f7",
  },
  infoIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "900",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    color: "#1a202c",
    fontWeight: "700",
    lineHeight: 20,
  },
  editHeader: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 7,
  },
  inputLabel: {
    fontSize: 13,
    color: "#4a5568",
    fontWeight: "900",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1a202c",
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 92,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    gap: 7,
  },
  activeToggleButton: {
    backgroundColor: "#e3f2fd",
    borderColor: "#2b6cb0",
  },
  toggleText: {
    color: "#718096",
    fontSize: 14,
    fontWeight: "900",
  },
  activeToggleText: {
    color: "#2b6cb0",
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#2b6cb0",
    fontSize: 14,
    fontWeight: "900",
  },
  saveButton: {
    flex: 1.25,
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.7,
  },
});