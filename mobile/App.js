import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  clearPatientSession,
  loadPatientSession,
  savePatientSession,
  updateStoredPatientUser,
} from "./src/services/sessionService";
import { setSessionExpiredHandler } from "./src/services/apiClient";
import NetworkStatusBanner from "./src/components/NetworkStatusBanner";
import AppErrorBoundary from "./src/components/AppErrorBoundary";

import LoginScreen from "./src/screens/LoginScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import RegisterPatientScreen from "./src/screens/RegisterPatientScreen";

import PatientDashboardScreen from "./src/screens/PatientDashboardScreen";
import PatientAppointmentsScreen from "./src/screens/PatientAppointmentsScreen";
import BookAppointmentScreen from "./src/screens/BookAppointmentScreen";
import PatientDentalRecordsScreen from "./src/screens/PatientDentalRecordsScreen";
import PatientDentalRecordDetailsScreen from "./src/screens/PatientDentalRecordDetailsScreen";
import PatientDental3DViewerScreen from "./src/screens/PatientDental3DViewerScreen";
import PatientXraysScreen from "./src/screens/PatientXraysScreen";
import PatientXrayDetailsScreen from "./src/screens/PatientXrayDetailsScreen";
import PatientARBracesScreen from "./src/screens/PatientARBracesScreen";
import PatientClinicDiscoveryScreen from "./src/screens/PatientClinicDiscoveryScreen";
import PatientProfileScreen from "./src/screens/PatientProfileScreen";
import PatientTransfersScreen from "./src/screens/PatientTransfersScreen";
import PatientHistoricalRecordsScreen from "./src/screens/PatientHistoricalRecordsScreen";
import BottomNav from "./src/components/BottomNav";
import PatientMoreMenu from "./src/components/PatientMoreMenu";

function DentoGraphApp() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);

  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [authScreen, setAuthScreen] = useState("login");
  const [prefilledEmail, setPrefilledEmail] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [selectedDentalRecordId, setSelectedDentalRecordId] = useState(null);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [selectedXrayId, setSelectedXrayId] = useState(null);

  useEffect(() => {
    checkSavedSession();

    setSessionExpiredHandler(({ message }) => {
      setToken(null);
      setCurrentUser(null);
      setCurrentScreen("dashboard");
      setAuthScreen("login");
      setSessionMessage(message || "Session expired. Please log in again.");
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  const checkSavedSession = async () => {
    try {
      const session = await loadPatientSession();

      if (session?.token && session?.user) {
        setToken(session.token);
        setCurrentUser(session.user);
        setCurrentScreen("dashboard");
      }
    } catch (error) {
      setSessionMessage(
        "The saved session could not be restored. Please log in again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = async ({ token, user }) => {
    const session = await savePatientSession({ token, user });

    setToken(session.token);
    setCurrentUser(session.user);
    setCurrentScreen("dashboard");
    setAuthScreen("login");
    setSessionMessage("");
  };

  const handleLogout = async () => {
    setMoreMenuVisible(false);
    await clearPatientSession();

    setToken(null);
    setCurrentUser(null);
    setCurrentScreen("dashboard");
    setAuthScreen("login");
    setPrefilledEmail("");
    setSessionMessage("");
  };

  const handleOpenForgotPassword = (email = "") => {
    setPrefilledEmail(email || "");
    setAuthScreen("forgotPassword");
  };

  const handleOpenRegister = () => {
    setAuthScreen("register");
  };

  const handleBackToLogin = () => {
    setAuthScreen("login");
  };

  const handleProfileUpdated = async (updatedProfile) => {
    const updatedUser = {
      ...currentUser,
      name: updatedProfile.name,
      email: updatedProfile.email,
    };

    const updatedSession = await updateStoredPatientUser(updatedUser);
    setCurrentUser(updatedSession?.user || updatedUser);
  };

  const renderAuthScreen = () => {
    if (authScreen === "forgotPassword") {
      return (
        <ForgotPasswordScreen
          initialEmail={prefilledEmail}
          onBackToLogin={handleBackToLogin}
        />
      );
    }

    if (authScreen === "register") {
      return <RegisterPatientScreen onBackToLogin={handleBackToLogin} />;
    }

    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onForgotPasswordPress={handleOpenForgotPassword}
        onRegisterPress={handleOpenRegister}
        sessionMessage={sessionMessage}
      />
    );
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

    if (currentScreen === "dental3DViewer") {
      return (
        <PatientDental3DViewerScreen
          token={token}
          user={currentUser}
          recordId={selectedDentalRecordId}
          onBack={() => setCurrentScreen("dentalRecordDetails")}
        />
      );
    }

    if (currentScreen === "dentalRecordDetails") {
      return (
        <PatientDentalRecordDetailsScreen
          token={token}
          recordId={selectedDentalRecordId}
          onBack={() => setCurrentScreen("dentalRecords")}
          onOpen3D={() => setCurrentScreen("dental3DViewer")}
        />
      );
    }

    if (currentScreen === "dentalRecords") {
      return (
        <PatientDentalRecordsScreen
          token={token}
          onOpenRecord={(record) => {
            setSelectedDentalRecordId(record.record_id);
            setCurrentScreen("dentalRecordDetails");
          }}
        />
      );
    }

    if (currentScreen === "xrayDetails") {
      return (
        <PatientXrayDetailsScreen
          token={token}
          xrayId={selectedXrayId}
          onBack={() => setCurrentScreen("xrays")}
        />
      );
    }

    if (currentScreen === "xrays") {
      return (
        <PatientXraysScreen
          token={token}
          onOpenXray={(xray) => {
            setSelectedXrayId(xray.xray_id);
            setCurrentScreen("xrayDetails");
          }}
        />
      );
    }

    if (currentScreen === "arBraces") {
      return (
        <PatientARBracesScreen
          token={token}
          user={currentUser}
        />
      );
    }

    if (currentScreen === "clinicDiscovery") {
      return <PatientClinicDiscoveryScreen token={token} />;
    }

    if (currentScreen === "transfers") {
      return <PatientTransfersScreen token={token} />;
    }

    if (currentScreen === "historicalRecords") {
      return (
        <PatientHistoricalRecordsScreen
          token={token}
          onOpenRecord={(record) => {
            setSelectedDentalRecordId(record.record_id);
            setCurrentScreen("dentalRecordDetails");
          }}
          onOpenXray={(xray) => {
            setSelectedXrayId(xray.xray_id);
            setCurrentScreen("xrayDetails");
          }}
        />
      );
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
        token={token}
        user={currentUser}
        onOpenAppointments={() => setCurrentScreen("appointments")}
        onOpenBookAppointment={() => setCurrentScreen("bookAppointment")}
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
          <NetworkStatusBanner />
          {renderAuthScreen()}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const shouldShowBottomNav = !["bookAppointment", "dentalRecordDetails", "dental3DViewer", "xrayDetails"].includes(currentScreen);

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.appContainer}
        edges={["top", "left", "right"]}
      >
        <NetworkStatusBanner />
        <View style={styles.mainContainer}>{renderAuthenticatedScreen()}</View>

        {shouldShowBottomNav ? (
          <BottomNav
            currentScreen={currentScreen}
            onNavigate={(screen) => {
              setMoreMenuVisible(false);
              setCurrentScreen(screen);
            }}
            onOpenMenu={() => setMoreMenuVisible(true)}
          />
        ) : null}

        <PatientMoreMenu
          visible={moreMenuVisible}
          currentScreen={currentScreen}
          currentUser={currentUser}
          onClose={() => setMoreMenuVisible(false)}
          onNavigate={setCurrentScreen}
          onLogout={handleLogout}
        />
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

export default function App() {
  return (
    <AppErrorBoundary>
      <DentoGraphApp />
    </AppErrorBoundary>
  );
}