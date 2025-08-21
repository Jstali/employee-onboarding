import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  TableCellsIcon,
  UserCircleIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: HomeIcon,
      roles: ["hr", "employee"],
    },
    {
      name: "HR Management",
      href: "/hr",
      icon: UserGroupIcon,
      roles: ["hr"],
    },
    {
      name: "Employee Forms",
      href: "/hr/forms",
      icon: DocumentTextIcon,
      roles: ["hr"],
    },
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
    {
      name: "Onboarding Form",
      href: "/form",
      icon: DocumentTextIcon,
      roles: ["employee"],
    },
    {
      name: "Attendance Portal",
      href: "/attendance",
      icon: CalendarIcon,
      roles: ["employee"],
    },
    {
      name: "My Profile",
      href: "/profile",
      icon: UserCircleIcon,
      roles: ["employee"],
    },
  ];

  const filteredNavigation = navigation.filter((item) =>
    item.roles.includes(user?.role)
  );

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
                Employee Portal
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
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
