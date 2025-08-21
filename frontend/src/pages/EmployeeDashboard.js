import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

const EmployeeDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [formStatus, setFormStatus] = useState(null);
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Only fetch data when user is fully loaded and authenticated
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      
      const [profileRes, formStatusRes, managerRes] = await Promise.all([
        api.get("/employee/profile"),
        api.get("/employee/form-status"),
        api.get("/employee/manager"),
      ]);

      setProfile(profileRes.data.employee);
      setFormStatus(formStatusRes.data);
      setManager(managerRes.data.manager);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
      setError("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case "rejected":
        return <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;
      case "pending":
        return <ClockIcon className="h-8 w-8 text-yellow-500" />;
      default:
        return <ClockIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "text-green-800 bg-green-100";
      case "rejected":
        return "text-red-800 bg-red-100";
      case "pending":
        return "text-yellow-800 bg-yellow-100";
      default:
        return "text-gray-800 bg-gray-100";
    }
  };

  const getProgressColor = (progress) => {
    if (progress >= 80) return "text-green-600";
    if (progress >= 60) return "text-yellow-600";
    if (progress >= 40) return "text-orange-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
        <div className="mt-6">
          <button onClick={fetchDashboardData} className="btn-primary">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Employee Dashboard
            </h1>
            <p className="text-gray-600">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                user?.status
              )}`}
            >
              {getStatusIcon(user?.status)}
              <span className="ml-2">{user?.status}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Profile Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Full Name</label>
            <p className="text-gray-900">{profile?.name || user?.name}</p>
          </div>
          <div>
            <label className="form-label">Email</label>
            <p className="text-gray-900">{profile?.email || user?.email}</p>
          </div>
          <div>
            <label className="form-label">Employee Type</label>
            <p className="text-gray-900 capitalize">
              {profile?.employee_type || user?.employee_type}
            </p>
          </div>
          <div>
            <label className="form-label">Manager</label>
            <p className="text-gray-900">{manager?.name || "Not Assigned"}</p>
          </div>
        </div>
      </div>

      {/* Form Progress */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Onboarding Form Progress
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Completion Status
            </span>
            <span
              className={`text-lg font-bold ${getProgressColor(
                formStatus?.progress || 0
              )}`}
            >
              {formStatus?.progress || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${formStatus?.progress || 0}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600">
            {formStatus?.message || "Form not started"}
          </p>

          {formStatus?.missingFields && formStatus.missingFields.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Missing Fields:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {formStatus.missingFields.map((field, index) => (
                  <li key={index}>{field}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate("/form")}
            className="btn-primary flex items-center gap-2"
          >
            <DocumentTextIcon className="h-5 w-5" />
            {formStatus?.completed ? "Update Form" : "Complete Form"}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Onboarding Form
              </h3>
              <p className="text-sm text-gray-500">
                Complete or update your onboarding information
              </p>
              <div className="mt-3">
                <button
                  onClick={() => navigate("/form")}
                  className="btn-primary"
                >
                  {formStatus?.completed ? "Update Form" : "Start Form"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <h3 className="text-lg font-medium text-gray-900">Profile</h3>
              <p className="text-sm text-gray-500">
                View and manage your profile information
              </p>
              <div className="mt-3">
                <button
                  onClick={() => navigate("/employee")}
                  className="btn-secondary"
                >
                  View Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Information */}
      {user?.status === "pending" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <ClockIcon className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Account Pending Approval
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Your account is currently pending approval from HR. You can
                still complete your onboarding form while waiting.
              </p>
            </div>
          </div>
        </div>
      )}

      {user?.status === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Account Rejected
              </h3>
              <p className="text-sm text-red-700 mt-1">
                Your account has been rejected. Please contact HR for more
                information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
