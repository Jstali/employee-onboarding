import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import HRDashboard from "./pages/HRDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeFormsManager from "./pages/EmployeeFormsManager";
import MasterEmployeeTable from "./pages/MasterEmployeeTable";
import MyProfile from "./pages/MyProfile";
import EmployeeAttendance from "./pages/EmployeeAttendance";
import HRAttendanceDashboard from "./pages/HRAttendanceDashboard";
import PasswordChange from "./pages/PasswordChange";
import AwaitingApproval from "./pages/AwaitingApproval";
import OnboardedEmployees from "./pages/OnboardedEmployees";
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

  if (!allowedRoles.includes(user?.role)) {
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
          <ProtectedRoute allowedRoles={["hr", "employee"]}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={(() => {
            if (user?.role === "hr") {
              return <HRDashboard />;
            } else {
              return <EmployeeDashboard />;
            }
          })()}
        />

        <Route
          path="hr"
          element={(() => {
            return (
              <ProtectedRoute allowedRoles={["hr"]}>
                <HRDashboard />
              </ProtectedRoute>
            );
          })()}
        />

        <Route
          path="hr/forms"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <EmployeeFormsManager />
            </ProtectedRoute>
          }
        />

        <Route
          path="hr/attendance"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <HRAttendanceDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="onboarded-employees"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <OnboardedEmployees />
            </ProtectedRoute>
          }
        />

        <Route
          path="master"
          element={
            <ProtectedRoute allowedRoles={["hr"]}>
              <MasterEmployeeTable />
            </ProtectedRoute>
          }
        />

        <Route
          path="form"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              {(() => {
                // If user state is not loaded yet, show loading
                if (!user) {
                  return (
                    <div className="flex items-center justify-center min-h-screen">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Loading...</p>
                    </div>
                  );
                }

                // If user is onboarded AND hr_approved, redirect to attendance (they should never see form again)
                if (user.onboarded && user.hr_approved) {
                  return <Navigate to="/attendance" replace />;
                }

                // If form not submitted, show form (this is the main fix)
                if (!user.form_submitted) {
                  return <EmployeeForm />;
                }

                // If form submitted but not hr_approved, redirect to awaiting approval
                if (user.form_submitted && !user.hr_approved) {
                  return <Navigate to="/awaiting-approval" replace />;
                }

                // If form submitted and hr_approved but not onboarded, show awaiting approval
                return <Navigate to="/awaiting-approval" replace />;
              })()}
            </ProtectedRoute>
          }
        />

        <Route
          path="awaiting-approval"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              {(() => {
                // If user state is not loaded yet, show loading
                if (!user) {
                  return (
                    <div className="flex items-center justify-center min-h-screen">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Checking your status...</p>
                    </div>
                  );
                }

                // If user is onboarded AND hr_approved, redirect to attendance
                if (user.onboarded && user.hr_approved) {
                  return <Navigate to="/attendance" replace />;
                }

                // If form not submitted, redirect to form (they must fill form first)
                if (!user.form_submitted) {
                  return <Navigate to="/form" replace />;
                }

                // If form submitted but not hr_approved, show awaiting approval
                if (user.form_submitted && !user.hr_approved) {
                  return <AwaitingApproval />;
                }

                // If form submitted and hr_approved but not onboarded, show awaiting approval
                return <AwaitingApproval />;
              })()}
            </ProtectedRoute>
          }
        />

        <Route
          path="attendance"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              {(() => {
                // If user state is not loaded yet, show loading
                if (!user) {
                  return (
                    <div className="flex items-center justify-center min-h-screen">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Loading...</p>
                    </div>
                  );
                }

                // Only allow access if user is onboarded AND hr_approved (this is the key fix)
                if (user.onboarded && user.hr_approved) {
                  return <EmployeeAttendance />;
                }

                // If form not submitted, redirect to form (they must fill form first)
                if (!user.form_submitted) {
                  return <Navigate to="/form" replace />;
                }

                // If form submitted but not hr_approved, redirect to awaiting approval
                if (user.form_submitted && !user.hr_approved) {
                  return <Navigate to="/awaiting-approval" replace />;
                }

                // If form submitted and hr_approved but not onboarded, redirect to awaiting approval
                return <Navigate to="/awaiting-approval" replace />;
              })()}
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

      {/* Password Change Route (for first login) */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowedRoles={["employee"]}>
            <PasswordChange />
          </ProtectedRoute>
        }
      />

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
