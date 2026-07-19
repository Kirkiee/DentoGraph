import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function PermissionStateCard({
  icon,
  title,
  message,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
  busy = false,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={26} color="#b45309" />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        style={[styles.primaryButton, busy && styles.disabledButton]}
        onPress={onAction}
        disabled={busy}
      >
        <Text style={styles.primaryButtonText}>
          {busy ? "Checking..." : actionLabel}
        </Text>
      </Pressable>

      {secondaryLabel && onSecondary ? (
        <Pressable style={styles.secondaryButton} onPress={onSecondary}>
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 16,
  },
  iconCircle: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffedd5",
    borderRadius: 27,
  },
  title: {
    color: "#9a3412",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: "#9a3412",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 45,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 16,
    backgroundColor: "#2563eb",
    borderRadius: 11,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.65,
  },
});