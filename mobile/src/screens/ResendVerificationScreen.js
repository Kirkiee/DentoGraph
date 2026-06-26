import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { resendVerificationEmail } from "../services/authService";

export default function ResendVerificationScreen({
  initialEmail = "",
  onBackToLogin,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  const handleResendVerification = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      await resendVerificationEmail({
        email: email.trim(),
      });

      Alert.alert(
        "Verification Email Sent",
        "Please check your email and click the verification link.",
        [
          {
            text: "OK",
            onPress: onBackToLogin,
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Request Failed",
        error.message || "Unable to resend verification email."
      );
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
              <Ionicons name="mail-unread-outline" size={38} color="#ffffff" />
            </View>

            <Text style={styles.appName}>Verify Email</Text>
            <Text style={styles.tagline}>Resend your verification link</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Resend Verification</Text>

            <Text style={styles.subtitle}>
              Enter your registered email address and we will send another
              email verification link.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email Address</Text>

              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#718096" />

                <TextInput
                  style={styles.input}
                  placeholder="patient@email.com"
                  placeholderTextColor="#a0aec0"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleResendVerification}
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                loading && styles.disabledButton,
              ]}
              onPress={handleResendVerification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Resend Email</Text>
                  <Ionicons
                    name="send-outline"
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
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: "#2b6cb0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#2b6cb0",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
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
    marginBottom: 24,
    lineHeight: 20,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 18,
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