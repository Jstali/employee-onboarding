import React, { useState, useEffect, useCallback } from "react";
import {
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";

const AwaitingApproval = () => {
  const { user, refreshOnboardingStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [message, setMessage] = useState(null);

  const checkApprovalStatus = useCallback(async () => {
    try {
      setChecking(true);
      setMessage(null);

      console.log("🔍 Checking approval status...");
      console.log("🔍 Current user state:", user);

      // Use the new refreshOnboardingStatus function
      const result = await refreshOnboardingStatus();

      if (result.success) {
        console.log("🔍 Backend onboarding status refreshed:", result.user);

        // If approved, show success message and redirect
        if (result.user.onboarded) {
          console.log("🎉 Employee is approved! Redirecting to attendance...");
          setMessage({
            type: "success",
            text: "🎉 Congratulations! Your onboarding has been approved! Redirecting to Attendance Portal...",
          });

          // Redirect after 2 seconds to show the success message
          setTimeout(() => {
            console.log("🚀 Redirecting to /attendance...");
            window.location.href = "/attendance";
          }, 2000);
          return;
        }

        console.log("⏳ Employee still pending approval");
        setLastChecked(new Date());
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("❌ Failed to check approval status:", error);
      setMessage({
        type: "error",
        text: "Failed to check approval status. Please try again.",
      });
    } finally {
      setChecking(false);
    }
  }, [user, refreshOnboardingStatus]);

  // Check status every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkApprovalStatus, 30000);
    return () => clearInterval(interval);
  }, [checkApprovalStatus]);

  const handleManualRefresh = () => {
    checkApprovalStatus();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-yellow-100">
            <ClockIcon className="h-12 w-12 text-yellow-600" />
          </div>

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Awaiting HR Approval
          </h2>

          <p className="mt-4 text-lg text-gray-600">
            Your onboarding form has been submitted successfully.
          </p>

          <p className="mt-2 text-gray-500">
            Please wait while HR reviews and approves your details.
          </p>
        </div>

        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-gray-900">
              Form Status: Submitted
            </span>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Employee Name:</span>
              <span className="font-medium">{user?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="font-medium">{user?.email || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Department:</span>
              <span className="font-medium">{user?.department || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-medium text-yellow-600">
                Pending Approval
              </span>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`mt-6 p-4 rounded-md ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {message.type === "success" ? (
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Refresh Section */}
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <button
              onClick={handleManualRefresh}
              disabled={checking}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? (
                <>
                  <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Checking...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="-ml-1 mr-2 h-4 w-4" />
                  Check Approval Status
                </>
              )}
            </button>

            {/* Debug Button - Force Redirect to Attendance */}
            <button
              onClick={() => {
                console.log("🚀 Debug: Force redirect to attendance");
                window.location.href = "/attendance";
              }}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              🧪 Debug: Force Go to Attendance
            </button>

            {lastChecked && (
              <p className="mt-2 text-xs text-gray-500">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}

            <p className="mt-3 text-xs text-gray-500">
              Status is automatically checked every 30 seconds.
              <br />
              You can also manually check using the button above.
            </p>
          </div>
        </div>

        {/* Debug Section */}
        <div className="mt-6 bg-gray-100 border border-gray-300 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">
            🔍 Debug Information
          </h4>
          <div className="text-sm text-gray-600 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>User ID:</strong> {user?.id || "N/A"}
              </div>
              <div>
                <strong>Email:</strong> {user?.email || "N/A"}
              </div>
              <div>
                <strong>Form Submitted:</strong>{" "}
                {user?.form_submitted ? "✅ Yes" : "❌ No"}
              </div>
              <div>
                <strong>Onboarded:</strong>{" "}
                {user?.onboarded ? "✅ Yes" : "❌ No"}
              </div>
              <div>
                <strong>Status:</strong> {user?.status || "N/A"}
              </div>
              <div>
                <strong>Role:</strong> {user?.role || "N/A"}
              </div>
            </div>
            <div className="mt-3 p-2 bg-white rounded border">
              <strong>Full User Object:</strong>
              <pre className="text-xs mt-1 overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            You will receive an email notification once your onboarding is
            approved.
            <br />
            After approval, you'll have access to the Attendance Portal.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AwaitingApproval;
