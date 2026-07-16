import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { registerPatient } from "../services/authService";

export default function RegisterPatientScreen({ onBackToLogin }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const clearError = () => {
    setErrorMessage("");
  };

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  };

  const isStrongPassword = (value) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(
      value
    );
  };

  const handleRegister = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanContactNumber = contactNumber.trim();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setErrorMessage(
        "Please fill in your name, email, password, and confirm password."
      );
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!isStrongPassword(password)) {
      setErrorMessage(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);
      setErrorMessage("");

      await registerPatient({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        contactNumber: cleanContactNumber,
        password,
        confirmPassword,
      });

      Alert.alert(
        "Verify Your Email",
        "Your patient account has been created. Please check your email inbox or spam folder and verify your account before logging in.",
        [
          {
            text: "Back to Login",
            onPress: onBackToLogin,
          },
        ]
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <View style={styles.logoCircle}>
              <Image
                source={require("../../assets/dentograph-favicon.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.appName}>Create Account</Text>
            <Text style={styles.tagline}>Patient Mobile Registration</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Patient Registration</Text>

            <Text style={styles.subtitle}>
              Create a patient account to access appointments, dental records,
              X-rays, AR previews, and nearby clinics.
            </Text>

            {errorMessage ? (
              <View style={styles.errorCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#991b1b"
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.infoCard}>
              <Ionicons
                name="mail-unread-outline"
                size={18}
                color="#2b6cb0"
              />
              <Text style={styles.infoText}>
                After registration, verify your email first before logging in.
              </Text>
            </View>

            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={styles.label}>First Name</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#718096" />

                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor="#a0aec0"
                    value={firstName}
                    onChangeText={(value) => {
                      setFirstName(value);
                      clearError();
                    }}
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.nameField}>
                <Text style={styles.label}>Last Name</Text>

                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#718096" />

                  <TextInput
                    style={styles.input}
                    placeholder="Last name"
                    placeholderTextColor="#a0aec0"
                    value={lastName}
                    onChangeText={(value) => {
                      setLastName(value);
                      clearError();
                    }}
                    editable={!loading}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>

              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#718096" />

                <TextInput
                  style={styles.input}
                  placeholder="patient@email.com"
                  placeholderTextColor="#a0aec0"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearError();
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Number</Text>

              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color="#718096" />

                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor="#a0aec0"
                  value={contactNumber}
                  onChangeText={(value) => {
                    setContactNumber(value);
                    clearError();
                  }}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#718096"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Create password"
                  placeholderTextColor="#a0aec0"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearError();
                  }}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />

                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((current) => !current)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#718096"
                  />
                </Pressable>
              </View>

              <Text style={styles.helperText}>
                Minimum 8 characters with uppercase, lowercase, number, and
                special character.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#718096"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#a0aec0"
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    clearError();
                  }}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  onSubmitEditing={handleRegister}
                />

                <Pressable
                  style={styles.eyeButton}
                  onPress={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  disabled={loading}
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? "eye-off-outline" : "eye-outline"
                    }
                    size={20}
                    color="#718096"
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                loading && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    Create Patient Account
                  </Text>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#ffffff"
                  />
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.backButton}
              onPress={onBackToLogin}
              disabled={loading}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#2b6cb0" />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </Pressable>
          </View>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 52,
    justifyContent: "center",
  },
  topSection: {
    alignItems: "center",
    marginBottom: 26,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#2b6cb0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  logoImage: {
    width: 62,
    height: 62,
  },
  appName: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
    textAlign: "center",
  },
  tagline: {
    fontSize: 15,
    color: "#718096",
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1a202c",
    textAlign: "center",
    marginBottom: 7,
  },
  subtitle: {
    fontSize: 14,
    color: "#718096",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#991b1b",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "800",
  },
  infoCard: {
    backgroundColor: "#e3f2fd",
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: "#2c5282",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 15,
  },
  nameField: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4a5568",
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 17,
    paddingHorizontal: 14,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1a202c",
    fontWeight: "600",
    paddingVertical: 13,
  },
  eyeButton: {
    padding: 4,
  },
  helperText: {
    color: "#718096",
    fontSize: 11.5,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 7,
  },
  primaryButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 15,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    shadowColor: "#2b6cb0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 4,
  },
  primaryButtonPressed: {
    backgroundColor: "#255f9e",
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  backButton: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  backButtonText: {
    color: "#2b6cb0",
    fontSize: 14,
    fontWeight: "900",
  },
});