import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarIcon,
  CheckCircleIcon,
  HomeIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const EmployeeAttendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Attendance form state
  const [attendanceForm, setAttendanceForm] = useState({
    status: "",
    reason: "",
  });

  const fetchAttendance = useCallback(async () => {
    try {
      const response = await api.get("/attendance/my-attendance");
      setAttendance(response.data.attendance);
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
      setMessage({
        type: "error",
        text: "Failed to fetch attendance data",
      });
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    try {
      const response = await api.get(
        `/attendance/my-calendar?month=${currentMonth}&year=${currentYear}`
      );
      setCalendar(response.data.calendar);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch calendar:", error);
      setMessage({
        type: "error",
        text: "Failed to fetch calendar data",
      });
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchAttendance();
    fetchCalendar();
  }, [fetchAttendance, fetchCalendar]);

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();

    if (!attendanceForm.status) {
      setMessage({
        type: "error",
        text: "Please select an attendance status",
      });
      return;
    }

    if (attendanceForm.status === "leave" && !attendanceForm.reason.trim()) {
      setMessage({
        type: "error",
        text: "Please provide a reason for leave",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/attendance/mark", attendanceForm);

      setMessage({
        type: "success",
        text: "Attendance marked successfully!",
      });

      // Reset form
      setAttendanceForm({ status: "", reason: "" });

      // Refresh data
      fetchAttendance();
      fetchCalendar();

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    } catch (error) {
      console.error("Failed to mark attendance:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to mark attendance",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "present":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "wfh":
        return <HomeIcon className="h-5 w-5 text-blue-500" />;
      case "leave":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "weekend":
        return <CalendarIcon className="h-5 w-5 text-gray-400" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-200";
      case "wfh":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "leave":
        return "bg-red-100 text-red-800 border-red-200";
      case "weekend":
        return "bg-gray-100 text-gray-600 border-gray-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "present":
        return "Present";
      case "wfh":
        return "Work From Home";
      case "leave":
        return "Leave";
      case "weekend":
        return "Weekend";
      default:
        return "Not Marked";
    }
  };

  const navigateMonth = (direction) => {
    if (direction === "prev") {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const today = new Date().toISOString().split("T")[0];
  const isTodayWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Attendance Portal
        </h1>
        <p className="text-gray-600">
          Welcome back, {user?.name}! Mark your daily attendance and view your
          calendar.
        </p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Mark Today's Attendance
          </h2>

          {isTodayWeekend ? (
            <div className="text-center py-8">
              <CalendarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                Today is a weekend. No attendance marking required.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attendance Status *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value="present"
                      checked={attendanceForm.status === "present"}
                      onChange={(e) =>
                        setAttendanceForm({
                          ...attendanceForm,
                          status: e.target.value,
                        })
                      }
                      className="mr-2"
                    />
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                    Present
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value="wfh"
                      checked={attendanceForm.status === "wfh"}
                      onChange={(e) =>
                        setAttendanceForm({
                          ...attendanceForm,
                          status: e.target.value,
                        })
                      }
                      className="mr-2"
                    />
                    <HomeIcon className="h-5 w-5 text-blue-500 mr-2" />
                    Work From Home
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value="leave"
                      checked={attendanceForm.status === "leave"}
                      onChange={(e) =>
                        setAttendanceForm({
                          ...attendanceForm,
                          status: e.target.value,
                        })
                      }
                      className="mr-2"
                    />
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    Leave
                  </label>
                </div>
              </div>

              {attendanceForm.status === "leave" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Leave *
                  </label>
                  <textarea
                    value={attendanceForm.reason}
                    onChange={(e) =>
                      setAttendanceForm({
                        ...attendanceForm,
                        reason: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Please provide a reason for your leave..."
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Marking Attendance..." : "Mark Attendance"}
              </button>
            </form>
          )}
        </div>

        {/* Recent Attendance */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Attendance
          </h2>
          <div className="space-y-3">
            {attendance.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(
                  record.status
                )}`}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(record.status)}
                  <div>
                    <p className="font-medium">
                      {new Date(record.date).toLocaleDateString()}
                    </p>
                    <p className="text-sm opacity-75">
                      {getStatusText(record.status)}
                    </p>
                  </div>
                </div>
                {record.reason && (
                  <p
                    className="text-sm max-w-xs truncate"
                    title={record.reason}
                  >
                    {record.reason}
                  </p>
                )}
              </div>
            ))}
            {attendance.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No attendance records found
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Attendance Calendar - {monthNames[currentMonth - 1]} {currentYear}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => navigateMonth("prev")}
              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => {
                setCurrentMonth(new Date().getMonth() + 1);
                setCurrentYear(new Date().getFullYear());
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth("next")}
              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendar.map((day, index) => (
              <div
                key={`${day.date}-${index}`}
                className={`p-2 text-center border min-h-[60px] flex flex-col items-center justify-center ${
                  day.isWeekend
                    ? "bg-gray-50 text-gray-400"
                    : day.date === today
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white"
                }`}
              >
                <span className="text-sm font-medium mb-1">
                  {new Date(day.date).getDate()}
                </span>
                <div className="flex flex-col items-center space-y-1">
                  {getStatusIcon(day.status)}
                  {day.status === "leave" && day.reason && (
                    <div
                      className="w-2 h-2 bg-red-500 rounded-full"
                      title={day.reason}
                    ></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span>Present</span>
          </div>
          <div className="flex items-center space-x-2">
            <HomeIcon className="h-4 w-4 text-blue-500" />
            <span>Work From Home</span>
          </div>
          <div className="flex items-center space-x-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            <span>Leave</span>
          </div>
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <span>Weekend</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendance;
