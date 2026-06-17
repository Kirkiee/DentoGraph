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

    if (
      form.dentition_type !== "Adult" &&
      form.dentition_type !== "Child"
    ) {
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

  const renderViewRow = (label, value) => {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{displayValue(value)}</Text>
      </View>
    );
  };

  const renderInput = ({
    label,
    field,
    placeholder,
    multiline = false,
    keyboardType = "default",
    autoCapitalize = "sentences",
  }) => {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>

        <TextInput
          style={[styles.input, multiline && styles.multilineInput]}
          placeholder={placeholder}
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
            <Text style={styles.title}>Profile</Text>

            <Text style={styles.subtitle}>
              View and update your patient account information.
            </Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(form.name || user?.name || "P").charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.profileName}>
              {form.name || user?.name || "Patient"}
            </Text>

            <Text style={styles.profileEmail}>
              {form.email || user?.email || "No email"}
            </Text>

            <View style={styles.accountStatusBadge}>
              <Text style={styles.accountStatusText}>
                {profile?.account_status || "Active"}
              </Text>
            </View>
          </View>

          {!editing ? (
            <View style={styles.infoCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>Patient Information</Text>

                <Pressable
                  style={styles.editButton}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              {renderViewRow("Name", profile?.name)}
              {renderViewRow("Email", profile?.email)}
              {renderViewRow("Contact Number", profile?.contact_number)}
              {renderViewRow("Date of Birth", profile?.date_of_birth)}
              {renderViewRow("Gender", profile?.gender)}
              {renderViewRow("Dentition Type", profile?.dentition_type)}
              {renderViewRow("Address", profile?.address)}
              {renderViewRow("Medical History", profile?.medical_history)}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Edit Patient Information</Text>

              {renderInput({
                label: "Name",
                field: "name",
                placeholder: "Enter your full name",
              })}

              {renderInput({
                label: "Email",
                field: "email",
                placeholder: "Enter your email",
                keyboardType: "email-address",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Contact Number",
                field: "contact_number",
                placeholder: "Enter your contact number",
                keyboardType: "phone-pad",
              })}

              {renderInput({
                label: "Date of Birth",
                field: "date_of_birth",
                placeholder: "YYYY-MM-DD",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Gender",
                field: "gender",
                placeholder: "Enter your gender",
              })}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Dentition Type</Text>

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
                multiline: true,
              })}

              {renderInput({
                label: "Medical History",
                field: "medical_history",
                placeholder: "Enter medical history, allergies, or notes",
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
                    <Text style={styles.saveButtonText}>Save</Text>
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
    marginTop: 22,
    marginBottom: 22,
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
  profileCard: {
    backgroundColor: "#2b6cb0",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    marginBottom: 18,
  },
  avatarCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: {
    color: "#2b6cb0",
    fontSize: 34,
    fontWeight: "900",
  },
  profileName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
    textAlign: "center",
  },
  profileEmail: {
    color: "#e3f2fd",
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  accountStatusBadge: {
    backgroundColor: "#c6f6d5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  accountStatusText: {
    color: "#2f855a",
    fontSize: 12,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 14,
  },
  editButton: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  editButtonText: {
    color: "#2b6cb0",
    fontSize: 13,
    fontWeight: "900",
  },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "800",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "700",
    lineHeight: 21,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    color: "#4a5568",
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1a202c",
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 86,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: "#edf2f7",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    borderRadius: 15,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#2b6cb0",
    fontSize: 14,
    fontWeight: "900",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#2b6cb0",
    paddingVertical: 13,
    borderRadius: 15,
    alignItems: "center",
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