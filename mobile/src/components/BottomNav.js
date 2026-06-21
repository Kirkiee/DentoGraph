import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomNav({ currentScreen, onNavigate }) {
  const insets = useSafeAreaInsets();

  const getActiveScreen = () => {
    if (currentScreen === "bookAppointment") return "appointments";
    return currentScreen;
  };

  const activeScreen = getActiveScreen();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <NavItem
        label="Home"
        icon="home-outline"
        activeIcon="home"
        active={activeScreen === "dashboard"}
        onPress={() => onNavigate("dashboard")}
      />

      <NavItem
        label="Appts"
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
        label="X-rays"
        icon="image-outline"
        activeIcon="image"
        active={activeScreen === "xrays"}
        onPress={() => onNavigate("xrays")}
      />

      <NavItem
        label="Clinics"
        icon="location-outline"
        activeIcon="location"
        active={activeScreen === "clinicDiscovery"}
        onPress={() => onNavigate("clinicDiscovery")}
      />

      <NavItem
        label="AR"
        icon="happy-outline"
        activeIcon="happy"
        active={activeScreen === "arBraces"}
        onPress={() => onNavigate("arBraces")}
      />

      <NavItem
        label="Me"
        icon="person-outline"
        activeIcon="person"
        active={activeScreen === "profile"}
        onPress={() => onNavigate("profile")}
      />
    </View>
  );
}

function NavItem({ label, icon, activeIcon, active, onPress }) {
  return (
    <Pressable
      style={[styles.navItem, active && styles.activeNavItem]}
      onPress={onPress}
    >
      <Ionicons
        name={active ? activeIcon : icon}
        size={18}
        color={active ? "#2b6cb0" : "#718096"}
        style={styles.icon}
      />

      <Text style={[styles.navText, active && styles.activeNavText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 12,
  },
  activeNavItem: {
    backgroundColor: "#e3f2fd",
  },
  icon: {
    marginBottom: 2,
  },
  navText: {
    fontSize: 9,
    color: "#718096",
    fontWeight: "800",
  },
  activeNavText: {
    color: "#2b6cb0",
    fontWeight: "900",
  },
});