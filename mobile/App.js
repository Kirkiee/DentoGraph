import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen from "./src/screens/LoginScreen";
import PatientDashboardScreen from "./src/screens/PatientDashboardScreen";
import PatientAppointmentsScreen from "./src/screens/PatientAppointmentsScreen";
import BookAppointmentScreen from "./src/screens/BookAppointmentScreen";
import PatientDentalRecordsScreen from "./src/screens/PatientDentalRecordsScreen";

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
          onBack={() => setCurrentScreen("dashboard")}
          onOpenBookAppointment={() => setCurrentScreen("bookAppointment")}
        />
      );
    }

    if (currentScreen === "dentalRecords") {
      return (
        <PatientDentalRecordsScreen
          token={token}
          onBack={() => setCurrentScreen("dashboard")}
        />
      );
    }

    return (
      <PatientDashboardScreen
        user={currentUser}
        token={token}
        onLogout={handleLogout}
        onOpenAppointments={() => setCurrentScreen("appointments")}
        onOpenDentalRecords={() => setCurrentScreen("dentalRecords")}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appContainer}>
      <View style={styles.innerContainer}>
        {token && currentUser ? (
          renderAuthenticatedScreen()
        ) : (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  innerContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
});