import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";

const EmployeeDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      // Check if user needs to change password
      const passwordResponse = await api.get("/employee/check-password-status");

      if (passwordResponse.data.needsPasswordChange) {
        window.location.href = "/change-password";
        return;
      }

      // Check onboarding status using new endpoint
      const onboardingResponse = await api.get("/employee/onboarding-status");
      setUserStatus(onboardingResponse.data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to check user status:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Checking your status...</p>
        </div>
      </div>
    );
  }

  // If user is onboarded, redirect to attendance portal
  if (userStatus?.onboarded) {
    return <Navigate to="/attendance" />;
  }

  // If form not submitted, redirect to form (this is the key fix)
  if (!userStatus?.formSubmitted) {
    return <Navigate to="/form" />;
  }

  // If form submitted but not onboarded, redirect to awaiting approval
  if (userStatus?.formSubmitted && !userStatus?.onboarded) {
    return <Navigate to="/awaiting-approval" />;
  }

  // If form submitted but not onboarded, show pending message
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
              <svg
                className="h-8 w-8 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Onboarding Form Submitted
          </h1>

          <p className="text-gray-600 mb-6">
            Thank you for submitting your onboarding form. Your information is
            currently under review by the HR team.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Status: Pending Approval
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You will receive an email notification once your form has
                    been reviewed and approved. After approval, you will have
                    access to the attendance portal.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <p>If you have any questions, please contact the HR department.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
