import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResendVerification from "./pages/ResendVerification";

import ClinicOwnerDashboard from "./pages/ClinicOwnerDashboard";
import ClinicRegister from "./pages/ClinicRegister";
import ClinicOwnerStaff from "./pages/ClinicOwnerStaff";
import ClinicOwnerProfile from "./pages/ClinicOwnerProfile";
import ClinicOwnerSubscription from "./pages/ClinicOwnerSubscription";
import ClinicOwnerPaymentSuccess from "./pages/ClinicOwnerPaymentSuccess";
import ClinicOwnerPayments from "./pages/ClinicOwnerPayments";
import ClinicOwnerPaymentCancel from "./pages/ClinicOwnerPaymentCancel";

import AdminDashboard from "./pages/AdminDashboard";
import AdminProfile from "./pages/AdminProfile";
import DentistDashboard from "./pages/DentistDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import AssistantDashboard from "./pages/AssistantDashboard";

import AdminUsers from "./pages/AdminUsers";
import AdminClinics from "./pages/AdminClinics";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminReports from "./pages/AdminReports";
import AdminDentalRecords from "./pages/AdminDentalRecords";
import AdminDentalRecordDetails from "./pages/AdminDentalRecordDetails";
import AdminDental3DViewer from "./pages/AdminDental3DViewer";
import AdminXrayAnnotationView from "./pages/AdminXrayAnnotationView";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import AdminPayments from "./pages/AdminPayments";

import PatientProfile from "./pages/PatientProfile";
import PatientAppointments from "./pages/PatientAppointments";
import PatientDentalRecords from "./pages/PatientDentalRecords";
import PatientDentalRecordDetails from "./pages/PatientDentalRecordDetails";
import PatientXrays from "./pages/PatientXrays";
import PatientDental3DViewer from "./pages/PatientDental3DViewer";
import PatientXrayAnnotationView from "./pages/PatientXrayAnnotationView";
import PatientClinicDiscovery from "./pages/PatientClinicDiscovery";
import PatientARBracesSimulation from "./pages/PatientARBracesSimulation";

import DentistProfile from "./pages/DentistProfile";
import DentistAppointments from "./pages/DentistAppointments";
import DentistDentalRecords from "./pages/DentistDentalRecords";
import DentistDentalRecordDetails from "./pages/DentistDentalRecordDetails";
import DentistXrays from "./pages/DentistXrays";
import DentistXrayAnnotation from "./pages/DentistXrayAnnotation";
import DentistDental3DViewer from "./pages/DentistDental3DViewer";
import DentistARSimulations from "./pages/DentistARSimulations";

import AssistantProfile from "./pages/AssistantProfile";
import AssistantAppointments from "./pages/AssistantAppointments";
import AssistantDentalRecords from "./pages/AssistantDentalRecords";
import AssistantDentalRecordDetails from "./pages/AssistantDentalRecordDetails";
import AssistantDental3DViewer from "./pages/AssistantDental3DViewer";
import AssistantXrays from "./pages/AssistantXrays";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("dentograph-theme") || "light";
  });

  useEffect(() => {
    document.body.classList.remove("light-mode", "dark-mode");
    document.body.classList.add(theme === "dark" ? "dark-mode" : "light-mode");
    localStorage.setItem("dentograph-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem("dentograph-theme") || "light");
    };

    window.addEventListener("dentograph-theme-change", handleThemeChange);

    return () => {
      window.removeEventListener("dentograph-theme-change", handleThemeChange);
    };
  }, []);

  const assistantRoles = ["Assistant", "Dental Assistant"];

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<Navigate to="/auth/login" />} />
        <Route path="/auth/login" element={<Login />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />

        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/auth/reset-password/:token" element={<ResetPassword />} />

        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/auth/verify-email/:token" element={<VerifyEmail />} />

        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route
          path="/auth/resend-verification"
          element={<ResendVerification />}
        />

        <Route path="/register" element={<Register />} />
        <Route path="/auth/register" element={<Register />} />

        <Route path="/clinic/register" element={<ClinicRegister />} />
        <Route path="/auth/clinic-register" element={<ClinicRegister />} />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/clinics"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminClinics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/subscriptions"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminSubscriptions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dental-records"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDentalRecords />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dental-records/:record_id/3d-view"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDental3DViewer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dental-records/:record_id"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDentalRecordDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/xrays/:xray_id/annotations"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminXrayAnnotationView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminAuditLogs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/payments"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminPayments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/staff"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerStaff />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/profile"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/subscription"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerSubscription />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/payment-success"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerPaymentSuccess />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/payments"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerPayments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clinic-owner/payment-cancel"
          element={
            <ProtectedRoute allowedRoles={["Clinic Owner"]}>
              <ClinicOwnerPaymentCancel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/profile"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/appointments"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistAppointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/dental-records"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistDentalRecords />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/dental-records/:record_id"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistDentalRecordDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/dental-records/:record_id/3d-view"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistDental3DViewer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/dental-records/:recordId/ar-simulations"
          element={
            <ProtectedRoute allowedRoles={["Dentist", "dentist"]}>
              <DentistARSimulations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/xrays"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistXrays />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dentist/xrays/:xray_id/annotate"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistXrayAnnotation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/appointments"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientAppointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/records"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientDentalRecords />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/records/:record_id"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientDentalRecordDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/records/:record_id/3d-view"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientDental3DViewer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/xrays"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientXrays />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/xrays/:xray_id/annotations"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientXrayAnnotationView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/clinics"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientClinicDiscovery />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/ar-braces"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientARBracesSimulation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/dashboard"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/profile"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/appointments"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantAppointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/dental-records"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantDentalRecords />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/dental-records/:record_id"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantDentalRecordDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/dental-records/:record_id/3d-view"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantDental3DViewer />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/records"
          element={<Navigate to="/assistant/dental-records" />}
        />

        <Route
          path="/assistant/records/:record_id"
          element={
            <Navigate
              to={(location) =>
                `/assistant/dental-records/${
                  location.pathname.split("/").filter(Boolean)[2]
                }`
              }
            />
          }
        />

        <Route
          path="/assistant/xrays"
          element={
            <ProtectedRoute allowedRoles={assistantRoles}>
              <AssistantXrays />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
