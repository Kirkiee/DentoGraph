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
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
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
    </View>
  );
}

function NavItem({ label, icon, activeIcon, active, onPress }) {
  return (
    <Pressable
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
          size={active ? 21 : 20}
          color={active ? "#2b6cb0" : "#718096"}
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
    paddingHorizontal: 5,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 18,
  },
  activeNavItem: {
    backgroundColor: "#e3f2fd",
  },
  pressedNavItem: {
    opacity: 0.75,
  },
  iconCircle: {
    width: 30,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  activeIconCircle: {
    backgroundColor: "#d7ecff",
  },
  navText: {
    fontSize: 9.5,
    color: "#718096",
    fontWeight: "800",
    textAlign: "center",
  },
  activeNavText: {
    color: "#2b6cb0",
    fontWeight: "900",
  },
});