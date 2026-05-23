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

import PatientProfile from "./pages/PatientProfile";
import PatientAppointments from "./pages/PatientAppointments";
import PatientDentalRecords from "./pages/PatientDentalRecords";
import PatientDentalRecordDetails from "./pages/PatientDentalRecordDetails";
import DentistAppointments from "./pages/DentistAppointments";
import DentistDentalRecords from "./pages/DentistDentalRecords";
import DentistDentalRecordDetails from "./pages/DentistDentalRecordDetails";

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
          path="/dentist/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Dentist"]}>
              <DentistDashboard />
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
          path="/assistant/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Assistant"]}>
              <AssistantDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
