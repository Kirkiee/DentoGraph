import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen from "./src/screens/LoginScreen";
import PatientDashboardScreen from "./src/screens/PatientDashboardScreen";
import PatientAppointmentsScreen from "./src/screens/PatientAppointmentsScreen";
import BookAppointmentScreen from "./src/screens/BookAppointmentScreen";
import PatientDentalRecordsScreen from "./src/screens/PatientDentalRecordsScreen";
import PatientXraysScreen from "./src/screens/PatientXraysScreen";
import PatientARBracesScreen from "./src/screens/PatientARBracesScreen";
import PatientClinicDiscoveryScreen from "./src/screens/PatientClinicDiscoveryScreen";
import PatientProfileScreen from "./src/screens/PatientProfileScreen";
import BottomNav from "./src/components/BottomNav";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("dashboard");

  useEffect(() => {
    checkSavedSession();
  }, []);

  const checkSavedSession = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("dentograph_token");
      const savedUser = await AsyncStorage.getItem("dentograph_user");

      if (savedToken && savedUser) {
        setToken(savedToken);
        setCurrentUser(JSON.parse(savedUser));
        setCurrentScreen("dashboard");
      }
    } catch (error) {
      console.log("Session load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async ({ token, user }) => {
    await AsyncStorage.setItem("dentograph_token", token);
    await AsyncStorage.setItem("dentograph_user", JSON.stringify(user));

    setToken(token);
    setCurrentUser(user);
    setCurrentScreen("dashboard");
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("dentograph_token");
    await AsyncStorage.removeItem("dentograph_user");

    setToken(null);
    setCurrentUser(null);
    setCurrentScreen("dashboard");
  };

  const handleProfileUpdated = async (updatedProfile) => {
    const updatedUser = {
      ...currentUser,
      name: updatedProfile.name,
      email: updatedProfile.email,
    };

    await AsyncStorage.setItem("dentograph_user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  const renderAuthenticatedScreen = () => {
    if (currentScreen === "bookAppointment") {
      return (
        <BookAppointmentScreen
          token={token}
          onBack={() => setCurrentScreen("appointments")}
          onBooked={() => setCurrentScreen("appointments")}
        />
      );
    }

    if (currentScreen === "appointments") {
      return (
        <PatientAppointmentsScreen
          token={token}
          onOpenBookAppointment={() => setCurrentScreen("bookAppointment")}
        />
      );
    }

    if (currentScreen === "dentalRecords") {
      return <PatientDentalRecordsScreen token={token} />;
    }

    if (currentScreen === "xrays") {
      return <PatientXraysScreen token={token} />;
    }

    if (currentScreen === "arBraces") {
      return <PatientARBracesScreen token={token} />;
    }

    if (currentScreen === "clinicDiscovery") {
      return <PatientClinicDiscoveryScreen token={token} />;
    }

    if (currentScreen === "profile") {
      return (
        <PatientProfileScreen
          token={token}
          user={currentUser}
          onProfileUpdated={handleProfileUpdated}
        />
      );
    }

    return (
      <PatientDashboardScreen
        user={currentUser}
        onLogout={handleLogout}
        onOpenAppointments={() => setCurrentScreen("appointments")}
        onOpenDentalRecords={() => setCurrentScreen("dentalRecords")}
        onOpenXrays={() => setCurrentScreen("xrays")}
        onOpenARBraces={() => setCurrentScreen("arBraces")}
        onOpenClinicDiscovery={() => setCurrentScreen("clinicDiscovery")}
        onOpenProfile={() => setCurrentScreen("profile")}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.loadingContainer}
          edges={["top", "left", "right"]}
        >
          <ActivityIndicator size="large" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!token || !currentUser) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.appContainer}
          edges={["top", "left", "right"]}
        >
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const shouldShowBottomNav = currentScreen !== "bookAppointment";

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.appContainer}
        edges={["top", "left", "right"]}
      >
        <View style={styles.mainContainer}>{renderAuthenticatedScreen()}</View>

        {shouldShowBottomNav ? (
          <BottomNav
            currentScreen={currentScreen}
            onNavigate={(screen) => setCurrentScreen(screen)}
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  mainContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
});