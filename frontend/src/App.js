import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import HRDashboard from "./pages/HRDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeFormsManager from "./pages/EmployeeFormsManager";
import MasterEmployeeTable from "./pages/MasterEmployeeTable";
import MyProfile from "./pages/MyProfile";
import Layout from "./components/Layout";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// App Routes Component
const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute allowedRoles={["admin", "hr", "employee"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            user?.role === "admin" ? (
              <AdminDashboard />
            ) : user?.role === "hr" ? (
              <HRDashboard />
            ) : (
              <EmployeeDashboard />
            )
          }
        />

        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="hr"
          element={
            <ProtectedRoute allowedRoles={["hr", "admin"]}>
              <HRDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="hr/forms"
          element={
            <ProtectedRoute allowedRoles={["hr", "admin"]}>
              <EmployeeFormsManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="master"
          element={
            <ProtectedRoute allowedRoles={["hr", "admin"]}>
              <MasterEmployeeTable />
            </ProtectedRoute>
          }
        />

        <Route
          path="form"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <MyProfile />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
