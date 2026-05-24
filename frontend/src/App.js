import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";

import AdminDashboard from "./pages/AdminDashboard";
import DentistDashboard from "./pages/DentistDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import AssistantDashboard from "./pages/AssistantDashboard";

import AdminUsers from "./pages/AdminUsers";
import AdminClinics from "./pages/AdminClinics";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminReports from "./pages/AdminReports";
import PatientProfile from "./pages/PatientProfile";
import PatientAppointments from "./pages/PatientAppointments";
import PatientDentalRecords from "./pages/PatientDentalRecords";
import PatientDentalRecordDetails from "./pages/PatientDentalRecordDetails";
import PatientXrays from "./pages/PatientXrays";
import DentistProfile from "./pages/DentistProfile";
import DentistAppointments from "./pages/DentistAppointments";
import DentistDentalRecords from "./pages/DentistDentalRecords";
import DentistDentalRecordDetails from "./pages/DentistDentalRecordDetails";
import DentistXrays from "./pages/DentistXrays";
import AssistantProfile from "./pages/AssistantProfile";
import AssistantAppointments from "./pages/AssistantAppointments";
import AssistantDentalRecords from "./pages/AssistantDentalRecords";
import AssistantDentalRecordDetails from "./pages/AssistantDentalRecordDetails";
import AssistantXrays from "./pages/AssistantXrays";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/login" element={<Login />} />

        <Route path="/register" element={<Register />} />
        <Route path="/auth/register" element={<Register />} />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDashboard />
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
          path="/dentist/xrays"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistXrays />
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
          path="/patient/xrays"
          element={
            <ProtectedRoute allowedRoles={["Patient"]}>
              <PatientXrays />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/profile"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/appointments"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantAppointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/records"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantDentalRecords />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/records/:record_id"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantDentalRecordDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assistant/xrays"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
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
