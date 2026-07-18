import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MORE_SCREENS = new Set(["xrays", "arBraces", "profile"]);

const resolveActiveScreen = (currentScreen) => {
  if (currentScreen === "bookAppointment") return "appointments";
  if (currentScreen === "dentalRecordDetails") return "dentalRecords";
  if (MORE_SCREENS.has(currentScreen)) return "more";
  return currentScreen;
};

export default function BottomNav({
  currentScreen,
  onNavigate,
  onOpenMenu,
}) {
  const insets = useSafeAreaInsets();
  const activeScreen = resolveActiveScreen(currentScreen);

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <View style={styles.container}>
        <NavItem
          label="Home"
          icon="home-outline"
          activeIcon="home"
          active={activeScreen === "dashboard"}
          onPress={() => onNavigate("dashboard")}
        />
        <NavItem
          label="Appointments"
          icon="calendar-outline"
          activeIcon="calendar"
          active={activeScreen === "appointments"}
          onPress={() => onNavigate("appointments")}
        />
        <NavItem
          label="Records"
          icon="document-text-outline"
          activeIcon="document-text"
          active={activeScreen === "dentalRecords"}
          onPress={() => onNavigate("dentalRecords")}
        />
        <NavItem
          label="Clinics"
          icon="location-outline"
          activeIcon="location"
          active={activeScreen === "clinicDiscovery"}
          onPress={() => onNavigate("clinicDiscovery")}
        />
        <NavItem
          label="Menu"
          icon="menu-outline"
          activeIcon="menu"
          active={activeScreen === "more"}
          onPress={onOpenMenu}
        />
      </View>
    </View>
  );
}

function NavItem({ label, icon, activeIcon, active, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.navItem,
        active && styles.activeNavItem,
        pressed && styles.pressedNavItem,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, active && styles.activeIconCircle]}>
        <Ionicons
          name={active ? activeIcon : icon}
          size={active ? 22 : 21}
          color={active ? "#1d4ed8" : "#64748b"}
        />
      </View>
      <Text
        style={[styles.navText, active && styles.activeNavText]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 7,
    paddingHorizontal: 7,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navItem: {
    flex: 1,
    minHeight: 55,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: 5,
    borderRadius: 16,
  },
  activeNavItem: {
    backgroundColor: "#eff6ff",
  },
  pressedNavItem: {
    opacity: 0.72,
  },
  iconCircle: {
    width: 34,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderRadius: 15,
  },
  activeIconCircle: {
    backgroundColor: "#dbeafe",
  },
  navText: {
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: "800",
    textAlign: "center",
  },
  activeNavText: {
    color: "#1d4ed8",
    fontWeight: "900",
  },
});