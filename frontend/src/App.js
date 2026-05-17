import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/login" element={<Login />} />

        <Route path="/register" element={<Register />} />
        <Route path="/auth/register" element={<Register />} />

        <Route path="/admin/dashboard" element={<h1>Admin Dashboard</h1>} />
        <Route path="/dentist/dashboard" element={<h1>Dentist Dashboard</h1>} />
        <Route path="/patient/dashboard" element={<h1>Patient Dashboard</h1>} />
        <Route
          path="/assistant/dashboard"
          element={<h1>Dental Assistant Dashboard</h1>}
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
