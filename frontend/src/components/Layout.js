import React, { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  UserGroupIcon,
  DocumentTextIcon,
  TableCellsIcon,
  UserCircleIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ClockIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

// Feature configuration
const features = {
  HRManagementTable: {
    showEmployeeForms: true,
    removeActionColumn: true,
  },
  Sidebar: {
    removeEmployeeFormOption: true,
  },
  EmployeeLoginAndFormSubmission: {
    allowLoginWithoutHRApproval: true,
    submittedDataFlow: "HRManagementTable",
  },
  OnboardingProcess: {
    afterApprovalMoveTo: "OnboardedEmployee",
    assignFields: ["EmployeeID", "CompanyEmail", "Manager"],
  },
  EmployeeMasterTable: {
    afterOnboardingMoveTo: "EmployeeMasterTable",
  },
};

const Layout = () => {
  const { user, logout, forceRefreshUserState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      logout();
      navigate("/login");
    }
  };

  const handleRefreshStatus = async () => {
    if (user?.role === "employee") {
      console.log("🔄 Manual refresh status initiated...");
      console.log("🔍 Current user state:", user);

      setRefreshing(true);
      try {
        // Use the new forceRefreshUserState function for complete state refresh
        const result = await forceRefreshUserState();
        console.log("🔍 Force refresh result:", result);

        if (result.success) {
          console.log("🔍 New user state:", result.user);

          // Check if status changed
          if (result.user.onboarded && !user.onboarded) {
            console.log("🎉 Status changed: Employee now onboarded!");
            setToast({
              type: "success",
              message:
                "🎉 Your onboarding has been approved! Redirecting to Attendance Portal...",
            });
            // Redirect after showing toast
            setTimeout(() => {
              console.log("🚀 Redirecting to /attendance...");
              window.location.href = "/attendance";
            }, 3000);
          } else if (result.user.form_submitted && !user.form_submitted) {
            console.log("📝 Status changed: Form now submitted!");
            setToast({
              type: "info",
              message:
                "📝 Your form has been submitted! Awaiting HR approval...",
            });
          } else {
            console.log("ℹ️ Status unchanged");
            setToast({
              type: "info",
              message: "Status refreshed successfully!",
            });
          }

          // Clear toast after 5 seconds
          setTimeout(() => setToast(null), 5000);
        }
      } catch (error) {
        console.error("❌ Failed to refresh status:", error);
        setToast({
          type: "error",
          message: "Failed to refresh status. Please try again.",
        });
        setTimeout(() => setToast(null), 5000);
      } finally {
        setRefreshing(false);
      }
    }
  };

  const navigation = [
    {
      name: "HR Management",
      href: "/hr",
      icon: UserGroupIcon,
      roles: ["hr"],
    },

    {
      name: "Onboarded Employees",
      href: "/onboarded-employees",
      icon: UserPlusIcon,
      roles: ["hr"],
    },
    // Only show Employee Forms if feature is enabled
    ...(features?.Sidebar?.removeEmployeeFormOption
      ? []
      : [
          {
            name: "Employee Forms",
            href: "/hr/forms",
            icon: DocumentTextIcon,
            roles: ["hr"],
          },
        ]),
    {
      name: "Attendance Dashboard",
      href: "/hr/attendance",
      icon: ChartBarIcon,
      roles: ["hr"],
    },
    {
      name: "Master Employee Table",
      href: "/master",
      icon: TableCellsIcon,
      roles: ["hr"],
    },
    // Only show Onboarding Form if feature is enabled
    ...(features?.Sidebar?.removeEmployeeFormOption
      ? []
      : [
          {
            name: "Onboarding Form",
            href: "/form",
            icon: DocumentTextIcon,
            roles: ["employee"],
            show: () => !user?.form_submitted,
          },
        ]),
    {
      name: "Awaiting Approval",
      href: "/awaiting-approval",
      icon: ClockIcon,
      roles: ["employee"],
      show: () => user?.form_submitted && !user?.onboarded,
    },
    {
      name: "Attendance Portal",
      href: "/attendance",
      icon: CalendarIcon,
      roles: ["employee"],
      show: () => user?.onboarded,
    },
    {
      name: "My Profile",
      href: "/profile",
      icon: UserCircleIcon,
      roles: ["employee"],
    },
  ];

  const filteredNavigation = navigation.filter((item) => {
    // Check if user has the required role
    if (!item.roles.includes(user?.role)) {
      return false;
    }

    // If item has a show function, check if it should be displayed
    if (item.show && typeof item.show === "function") {
      return item.show();
    }

    // Default to showing the item
    return true;
  });

  const isActive = (href) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="fixed inset-0 z-50">
          {sidebarOpen && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
          )}
          <div
            className={`fixed inset-y-0 left-0 flex w-64 flex-col bg-gray-800 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <h1 className="text-xl font-semibold text-white">
                HR Management System
              </h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-300 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive(item.href)
                      ? "bg-gray-900 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-6 w-6 flex-shrink-0 ${
                      isActive(item.href)
                        ? "text-white"
                        : "text-gray-400 group-hover:text-gray-300"
                    }`}
                  />
                  {item.name}
                </Link>
              ))}
            </nav>
            <div className="border-t border-gray-700 p-4">
              <div className="flex items-center px-2 py-2 text-sm font-medium text-gray-300">
                <UserCircleIcon className="mr-3 h-6 w-6 text-gray-400" />
                {user?.name}
              </div>

              {/* Refresh Status Button for Employees */}
              {user?.role === "employee" && (
                <button
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  className="mt-2 w-full flex items-center px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-md disabled:opacity-50"
                >
                  <svg
                    className={`mr-3 h-6 w-6 text-gray-400 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {refreshing ? "Refreshing..." : "Refresh Status"}
                </button>
              )}

              <button
                onClick={handleLogout}
                className="mt-2 w-full flex items-center px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-md"
              >
                <ArrowRightOnRectangleIcon className="mr-3 h-6 w-6 text-gray-400" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-gray-800 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-xl font-semibold text-white">
              Employee Portal
            </h1>
          </div>
          <nav className="mt-8 flex-1 space-y-1 px-2">
            {filteredNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive(item.href)
                    ? "bg-gray-900 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <item.icon
                  className={`mr-3 h-6 w-6 flex-shrink-0 ${
                    isActive(item.href)
                      ? "text-white"
                      : "text-gray-400 group-hover:text-gray-300"
                  }`}
                />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center px-2 py-2 text-sm font-medium text-gray-300">
              <UserCircleIcon className="mr-3 h-6 w-6 text-gray-400" />
              {user?.name}
            </div>

            {/* Refresh Status Button for Employees */}
            {user?.role === "employee" && (
              <button
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="mt-2 w-full flex items-center px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-md disabled:opacity-50"
              >
                <svg
                  className={`mr-3 h-6 w-6 text-gray-400 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {refreshing ? "Refreshing..." : "Refresh Status"}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="mt-2 w-full flex items-center px-2 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white rounded-md"
            >
              <ArrowRightOnRectangleIcon className="mr-3 h-6 w-6 text-gray-400" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />
              <div className="flex items-center gap-x-4">
                <div className="text-sm text-gray-700">
                  Welcome, <span className="font-medium">{user?.name}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Role:{" "}
                  <span className="font-medium capitalize">{user?.role}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${
              toast.type === "success"
                ? "ring-green-500"
                : toast.type === "error"
                ? "ring-red-500"
                : "ring-blue-500"
            }`}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === "success" ? (
                    <svg
                      className="h-6 w-6 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : toast.type === "error" ? (
                    <svg
                      className="h-6 w-6 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
                <div className="ml-3 w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => setToast(null)}
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
