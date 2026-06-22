import React, { useRef, useState } from "react";
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

import { loginUser } from "../services/authService";

export default function LoginScreen({ onLoginSuccess }) {
  const scrollViewRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const scrollToForm = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 250);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }

    try {
      Keyboard.dismiss();
      setLoading(true);

      const data = await loginUser({
        email: email.trim(),
        password,
      });

      const user = data.user;
      const token = data.token;

      if (!token || !user) {
        Alert.alert(
          "Login Error",
          "The server response is missing the token or user data."
        );
        return;
      }

      if (String(user.role).toLowerCase() !== "patient") {
        Alert.alert(
          "Access Restricted",
          "The mobile app is currently for patients only."
        );
        return;
      }

      onLoginSuccess({
        token,
        user,
      });
    } catch (error) {
      Alert.alert("Login Failed", error.message || "Something went wrong.");
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
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="medical-outline" size={38} color="#ffffff" />
            </View>

            <Text style={styles.appName}>DentoGraph</Text>
            <Text style={styles.tagline}>Mobile Patient Portal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>

            <Text style={styles.subtitle}>
              Login to view your appointments, dental records, X-rays, AR
              previews, nearby clinics, and profile.
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
                  returnKeyType="next"
                  onFocus={scrollToForm}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#718096" />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#a0aec0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={scrollToForm}
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
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                loading && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Login</Text>
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={21}
                    color="#ffffff"
                  />
                </>
              )}
            </Pressable>

            <View style={styles.patientOnlyCard}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#2b6cb0"
              />

              <Text style={styles.patientOnlyText}>
                This mobile app is currently available for patient accounts.
              </Text>
            </View>
          </View>

          <Text style={styles.footerText}>
            DentoGraph © Patient Mobile Access
          </Text>
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
    fontSize: 32,
    fontWeight: "900",
    color: "#1a202c",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    color: "#718096",
    fontWeight: "700",
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
    fontSize: 25,
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
  loginButton: {
    backgroundColor: "#2b6cb0",
    paddingVertical: 15,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
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
  loginButtonPressed: {
    backgroundColor: "#255f9e",
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.75,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  patientOnlyCard: {
    backgroundColor: "#e3f2fd",
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  patientOnlyText: {
    flex: 1,
    color: "#2c5282",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },
  footerText: {
    textAlign: "center",
    color: "#718096",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 20,
  },
});