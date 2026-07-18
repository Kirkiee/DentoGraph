import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MENU_ITEMS = [
  {
    screen: "xrays",
    label: "X-rays",
    description: "View dental X-rays and available findings.",
    icon: "image-outline",
  },
  {
    screen: "arBraces",
    label: "AR Braces",
    description: "Open saved braces simulations and previews.",
    icon: "happy-outline",
  },
  {
    screen: "profile",
    label: "My Profile",
    description: "Review and update your Patient account information.",
    icon: "person-outline",
  },
  {
    screen: "transfers",
    label: "Clinic Transfer",
    description: "Request and track a transfer to another clinic.",
    icon: "swap-horizontal-outline",
  },
  {
    screen: "historicalRecords",
    label: "Historical Records",
    description: "View previous clinics, care episodes, records, and X-rays.",
    icon: "time-outline",
  },
];

const MenuItem = ({ item, active, onPress }) => (
  <Pressable
    accessibilityRole="button"
    style={({ pressed }) => [
      styles.menuItem,
      active && styles.menuItemActive,
      pressed && styles.menuItemPressed,
    ]}
    onPress={onPress}
  >
    <View style={[styles.menuIcon, active && styles.menuIconActive]}>
      <Ionicons
        name={item.icon}
        size={23}
        color={active ? "#1d4ed8" : "#475569"}
      />
    </View>
    <View style={styles.menuItemText}>
      <Text style={styles.menuItemLabel}>{item.label}</Text>
      <Text style={styles.menuItemDescription}>{item.description}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
  </Pressable>
);

export default function PatientMoreMenu({
  visible,
  currentScreen,
  currentUser,
  onClose,
  onNavigate,
  onLogout,
}) {
  const insets = useSafeAreaInsets();

  const navigateTo = (screen) => {
    onClose();
    onNavigate(screen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close menu"
        />
        <View
          style={[
            styles.drawer,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 18),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={23} color="#1d4ed8" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Patient Menu</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {currentUser?.name || "DentoGraph Patient"}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {currentUser?.email || ""}
              </Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close Patient menu"
            >
              <Ionicons name="close" size={22} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>More Features</Text>

            {MENU_ITEMS.map((item) => (
              <MenuItem
                key={item.screen}
                item={item}
                active={currentScreen === item.screen}
                onPress={() => navigateTo(item.screen)}
              />
            ))}

          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.logoutButton} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={21} color="#b91c1c" />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.52)",
  },
  drawer: {
    width: "86%",
    maxWidth: 390,
    height: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: "#000000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 18,
    paddingBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  profileIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
    borderRadius: 23,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: "#0f172a", fontSize: 17, fontWeight: "900" },
  userName: {
    marginTop: 3,
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  userEmail: { marginTop: 2, color: "#64748b", fontSize: 11 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 19,
  },
  menuScroll: { flex: 1 },
  menuContent: { padding: 18, paddingBottom: 28 },
  sectionLabel: {
    marginBottom: 10,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  menuItem: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
  },
  menuItemActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  menuItemPressed: { opacity: 0.72 },
  menuIcon: {
    width: 43,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 13,
  },
  menuIconActive: { backgroundColor: "#dbeafe" },
  menuItemText: { flex: 1, minWidth: 0 },
  menuItemLabel: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  menuItemDescription: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
  },
  comingSoonCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
    padding: 13,
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 13,
  },
  comingSoonText: { flex: 1 },
  comingSoonTitle: {
    color: "#5b21b6",
    fontSize: 12,
    fontWeight: "800",
  },
  comingSoonDescription: {
    marginTop: 4,
    color: "#6d28d9",
    fontSize: 10.5,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  logoutButton: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
  },
  logoutButtonText: { color: "#b91c1c", fontWeight: "900" },
});