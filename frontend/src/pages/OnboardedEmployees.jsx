import React, { useState, useEffect } from "react";
import api from "../services/api";
import {
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const OnboardedEmployees = () => {
  const [onboardedEmployees, setOnboardedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [assigningManager, setAssigningManager] = useState(null);
  const [employeeIdErrors, setEmployeeIdErrors] = useState({});
  const [validatingEmployeeIds, setValidatingEmployeeIds] = useState({});
  const [nxzenEmailErrors, setNxzenEmailErrors] = useState({});
  const [validatingNxzenEmails, setValidatingNxzenEmails] = useState({});

  // Manager list - will be populated from backend
  const [predefinedManagers, setPredefinedManagers] = useState([]);

  // Suggest next available Employee ID
  const suggestNextEmployeeId = () => {
    // Start with 100001 and find the next available
    let suggestedId = 100001;
    const usedIds = onboardedEmployees
      .map((emp) => emp.employee_id)
      .filter((id) => id && /^\d{6}$/.test(id))
      .map((id) => parseInt(id))
      .sort((a, b) => a - b);

    for (let id of usedIds) {
      if (id === suggestedId) {
        suggestedId++;
      } else if (id > suggestedId) {
        break;
      }
    }

    return suggestedId.toString().padStart(6, "0");
  };

  // Fetch managers from backend
  const fetchManagers = async () => {
    try {
      const managersRes = await api.get("/hr/managers");
      setPredefinedManagers(managersRes.data.managers);
    } catch (err) {
      console.error("Failed to fetch managers:", err);
      // Fallback to empty array if managers fetch fails
      setPredefinedManagers([]);
    }
  };

  // Fetch onboarded employees
  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch both managers and onboarded employees
      await Promise.all([
        fetchManagers(),
        api.get("/hr/onboarded-employees").then((res) => {
          setOnboardedEmployees(res.data.onboardedEmployees);
        }),
      ]);
    } catch (err) {
      console.error("Failed to fetch data:", err);

      // Handle authentication errors
      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again to continue.");
        // Clear invalid token and redirect to login after a short delay
        setTimeout(() => {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }, 2000);
        return;
      }

      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  // Validate NXZEN Email
  const validateNxzenEmail = async (email, currentEmployeeId = null) => {
    console.log("🔍 Validating NXZEN Email:", email);

    if (!email) {
      console.log("❌ NXZEN Email is required");
      return "NXZEN Email is required";
    }

    if (!email.includes("@nxzen.com")) {
      console.log("❌ NXZEN Email must be @nxzen.com domain");
      return "NXZEN Email must be @nxzen.com domain";
    }

    // Check for duplicates in the current list, excluding the current employee being edited
    console.log("🔍 Checking for NXZEN Email duplicates:");
    console.log("  - Email to check:", email);
    console.log("  - Current employee ID:", currentEmployeeId);
    console.log(
      "  - All onboarded employees:",
      onboardedEmployees.map((emp) => ({
        id: emp.id,
        nxzen_email: emp.nxzen_email,
      }))
    );

    // If the email is the same as the current employee's email, it's not a duplicate
    const currentEmployee = onboardedEmployees.find(
      (emp) => emp.id === currentEmployeeId
    );
    if (currentEmployee && currentEmployee.nxzen_email === email) {
      console.log("✅ Same email as current employee - not a duplicate");
      return null;
    }

    const existingEmployee = onboardedEmployees.find(
      (emp) => emp.nxzen_email === email && emp.id !== currentEmployeeId
    );

    if (existingEmployee) {
      console.log(
        "❌ NXZEN Email already exists in this list for employee:",
        existingEmployee.id
      );
      return "NXZEN Email already exists in this list";
    }

    // Check if NXZEN Email already exists in the entire system via backend
    try {
      console.log("🔍 Checking NXZEN Email in backend...");
      const response = await api.get(
        `/hr/check-nxzen-email/${encodeURIComponent(email)}`
      );

      if (response.data.exists) {
        console.log("❌ NXZEN Email already exists in the system");
        return "NXZEN Email already exists in the system";
      }

      console.log("✅ NXZEN Email is available");
      return null;
    } catch (err) {
      console.error("❌ Error checking NXZEN Email:", err);
      return "Error validating NXZEN Email";
    }
  };

  // Validate 6-digit Employee ID
  const validateEmployeeId = async (employeeId, currentEmployeeId = null) => {
    console.log("🔍 Validating Employee ID:", employeeId);

    if (!employeeId) {
      console.log("❌ Employee ID is required");
      return "Employee ID is required";
    }

    if (!/^\d{6}$/.test(employeeId)) {
      console.log("❌ Employee ID must be exactly 6 digits");
      return "Employee ID must be exactly 6 digits";
    }

    // Check locally for duplicates, but exclude the current employee being edited
    console.log(
      "🔍 Checking for duplicates - Employee ID:",
      employeeId,
      "Current Employee ID:",
      currentEmployeeId
    );
    console.log(
      "🔍 Current onboardedEmployees state:",
      onboardedEmployees.map((emp) => ({
        id: emp.id,
        employee_id: emp.employee_id,
      }))
    );

    const existingEmployee = onboardedEmployees.find(
      (emp) => emp.employee_id === employeeId && emp.id !== currentEmployeeId
    );
    if (existingEmployee) {
      console.log("❌ Employee ID already exists in this list");
      return "Employee ID already exists in this list";
    }

    try {
      console.log("🔍 Checking Employee ID in backend...");
      // Check if Employee ID already exists in the entire system via backend
      const response = await api.get(`/hr/check-employee-id/${employeeId}`);
      console.log("✅ Backend response:", response.data);

      if (response.data.exists) {
        console.log("❌ Employee ID already exists in the system");
        return "Employee ID already exists in the system";
      }

      console.log("✅ Employee ID is available");
      return null;
    } catch (err) {
      console.error("❌ Error checking Employee ID:", err);
      // If backend check fails, we'll let the backend handle the final validation
      // during the assignment process
      return null;
    }
  };

  // Handle NXZEN Email input change
  const handleNxzenEmailChange = async (employeeId, emailValue) => {
    // Get the current employee's existing NXZEN email before updating
    const currentEmployee = onboardedEmployees.find(
      (emp) => emp.id === employeeId
    );
    const currentNxzenEmail = currentEmployee?.nxzen_email;

    // Update the employee's nxzen_email field immediately for better UX
    setOnboardedEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId ? { ...emp, nxzen_email: emailValue } : emp
      )
    );

    // Clear previous error if email changed
    if (emailValue !== currentNxzenEmail) {
      setNxzenEmailErrors((prev) => ({
        ...prev,
        [employeeId]: null,
      }));
    }

    // If email is the same as current, clear errors and don't validate
    if (emailValue === currentNxzenEmail) {
      setNxzenEmailErrors((prev) => ({
        ...prev,
        [employeeId]: null,
      }));
      return;
    }

    // Validate NXZEN Email asynchronously
    if (emailValue) {
      try {
        // Set loading state
        setValidatingNxzenEmails((prev) => ({
          ...prev,
          [employeeId]: true,
        }));

        const error = await validateNxzenEmail(emailValue, employeeId);

        // Ensure we only set string errors or null
        const errorMessage = typeof error === "string" ? error : null;

        console.log(
          `NXZEN Email validation for ${emailValue}:`,
          error,
          "Type:",
          typeof error,
          "Setting errorMessage:",
          errorMessage
        );

        setNxzenEmailErrors((prev) => {
          const newState = {
            ...prev,
            [employeeId]: errorMessage,
          };
          console.log("New nxzenEmailErrors state:", newState);
          return newState;
        });
      } catch (err) {
        console.error("Validation error:", err);

        // Handle authentication errors
        if (err.response?.status === 401) {
          setError("Authentication failed. Please log in again.");
          // Clear invalid token and redirect to login
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }

        // Set a generic error message if validation fails
        setNxzenEmailErrors((prev) => ({
          ...prev,
          [employeeId]: "Validation failed",
        }));
      } finally {
        // Clear loading state
        setValidatingNxzenEmails((prev) => ({
          ...prev,
          [employeeId]: false,
        }));
      }
    }
  };

  // Handle Employee ID input change
  const handleEmployeeIdChange = async (employeeId, employeeIdValue) => {
    // Update the employee's employee_id field immediately for better UX
    setOnboardedEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId ? { ...emp, employee_id: employeeIdValue } : emp
      )
    );

    // Clear previous error
    setEmployeeIdErrors((prev) => ({
      ...prev,
      [employeeId]: null,
    }));

    // Validate Employee ID asynchronously
    if (employeeIdValue) {
      try {
        // Set loading state
        setValidatingEmployeeIds((prev) => ({
          ...prev,
          [employeeId]: true,
        }));

        const error = await validateEmployeeId(employeeIdValue, employeeId);

        // Ensure we only set string errors or null
        const errorMessage = typeof error === "string" ? error : null;

        console.log(
          `Employee ID validation for ${employeeId}:`,
          error,
          "Type:",
          typeof error,
          "Setting errorMessage:",
          errorMessage
        );

        setEmployeeIdErrors((prev) => {
          const newState = {
            ...prev,
            [employeeId]: errorMessage,
          };
          console.log("New employeeIdErrors state:", newState);
          return newState;
        });
      } catch (err) {
        console.error("Validation error:", err);

        // Handle authentication errors
        if (err.response?.status === 401) {
          setError("Authentication failed. Please log in again.");
          // Clear invalid token and redirect to login
          localStorage.removeItem("token");
          window.location.href = "/login";
          return;
        }

        // Set a generic error message if validation fails
        setEmployeeIdErrors((prev) => ({
          ...prev,
          [employeeId]: "Validation failed",
        }));
      } finally {
        // Clear loading state
        setValidatingEmployeeIds((prev) => ({
          ...prev,
          [employeeId]: false,
        }));
      }
    }
  };

  // Handle Manager selection
  const handleManagerChange = (employeeId, managerName) => {
    setOnboardedEmployees((prev) =>
      prev.map((emp) =>
        emp.id === employeeId ? { ...emp, selectedManager: managerName } : emp
      )
    );
  };

  // Assign manager and Employee ID to employee
  const handleAssignManagerAndId = async (employeeId) => {
    try {
      const employee = onboardedEmployees.find((emp) => emp.id === employeeId);

      if (!employee) {
        throw new Error("Employee not found");
      }

      // Validate Employee ID
      const employeeIdError = await validateEmployeeId(
        employee.employee_id,
        employee.id
      );
      if (employeeIdError) {
        // Ensure we only set string errors
        const errorMessage =
          typeof employeeIdError === "string"
            ? employeeIdError
            : "Invalid Employee ID";
        setError(errorMessage);
        setTimeout(() => setError(""), 5000);
        return;
      }

      // Validate NXZEN Email
      if (!employee.nxzen_email) {
        setError("Please enter a NXZEN Email");
        setTimeout(() => setError(""), 5000);
        return;
      }

      const nxzenEmailError = await validateNxzenEmail(
        employee.nxzen_email,
        employee.id
      );
      if (nxzenEmailError) {
        setError(nxzenEmailError);
        setTimeout(() => setError(""), 5000);
        return;
      }

      // Validate Manager selection
      if (!employee.selectedManager) {
        setError("Please select a manager");
        setTimeout(() => setError(""), 5000);
        return;
      }

      setAssigningManager(employeeId);

      // Find the manager object
      const manager = predefinedManagers.find(
        (m) => m.name === employee.selectedManager
      );
      if (!manager) {
        throw new Error("Invalid manager selected");
      }

      // Call backend API to assign manager, Employee ID, NXZEN Email, and add to master table
      await api.post(`/hr/employees/${employeeId}/add-to-master`, {
        managerId: manager.id,
        employeeId: employee.employee_id,
        nxzenEmail: employee.nxzen_email,
      });

      // Remove employee from onboarded list
      setOnboardedEmployees((prev) =>
        prev.filter((emp) => emp.id !== employeeId)
      );

      const successMsg = `Employee ID ${employee.employee_id}, NXZEN Email ${employee.nxzen_email}, and Manager ${employee.selectedManager} assigned successfully! Employee moved to master table.`;
      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      console.error("Failed to assign manager and Employee ID:", err);

      // Handle authentication errors
      if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again to continue.");
        // Clear invalid token and redirect to login after a short delay
        setTimeout(() => {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }, 2000);
        return;
      }

      const errorMessage = `Failed to assign manager and Employee ID: ${
        err.response?.data?.error || err.message || "Unknown error"
      }`;
      setError(errorMessage);
      setTimeout(() => setError(""), 5000);
    } finally {
      setAssigningManager(null);
    }
  };

  // Filter employees based on search term
  const filteredEmployees = onboardedEmployees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.employee_id && employee.employee_id.includes(searchTerm))
  );

  useEffect(() => {
    fetchData();
  }, []);

  // Debug logging for error state
  useEffect(() => {
    if (error) {
      console.log("Error state updated:", error, "Type:", typeof error);
    }
  }, [error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              🚀 Onboarded Employees
            </h1>
            <p className="text-gray-600 mt-2">
              Manage employees who are onboarded but need Employee ID
              assignment, NXZEN Email assignment, and Manager assignment before
              joining the master table
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <UserIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            <div className="text-sm text-gray-500">
              {filteredEmployees.length} of {onboardedEmployees.length}{" "}
              employees
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && typeof successMessage === "string" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-green-800 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && typeof error === "string" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Onboarded Employees Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Employees Pending Employee ID & Manager Assignment
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            These employees are onboarded and ready to be assigned a 6-digit
            Employee ID, NXZEN Email, and Manager before moving to the master
            table
          </p>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {searchTerm ? (
              <div>
                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No employees found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  No employees match your search criteria.
                </p>
              </div>
            ) : (
              <div>
                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  All caught up!
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  All onboarded employees have been assigned Employee IDs, NXZEN
                  Emails, and Managers and moved to the master table.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Employee ID *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    NXZEN Email *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Role/Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Manager Assignment *
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-blue-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative">
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="100001"
                              value={employee.employee_id || ""}
                              onChange={(e) =>
                                handleEmployeeIdChange(
                                  employee.id,
                                  e.target.value
                                )
                              }
                              className={`w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono ${
                                employeeIdErrors[employee.id]
                                  ? "border-red-300 focus:ring-red-500"
                                  : "border-gray-300"
                              }`}
                              maxLength={6}
                            />
                            {validatingEmployeeIds[employee.id] && (
                              <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const suggestedId = suggestNextEmployeeId();
                              handleEmployeeIdChange(employee.id, suggestedId);
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Suggest next available Employee ID"
                          >
                            💡
                          </button>
                        </div>
                        {employeeIdErrors[employee.id] &&
                          typeof employeeIdErrors[employee.id] === "string" &&
                          !(
                            employeeIdErrors[employee.id] instanceof Promise
                          ) && (
                            <div className="absolute top-full left-0 mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 z-10">
                              {String(employeeIdErrors[employee.id])}
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="employee@nxzen.com"
                          value={employee.nxzen_email || ""}
                          onChange={(e) =>
                            handleNxzenEmailChange(employee.id, e.target.value)
                          }
                          className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        {nxzenEmailErrors[employee.id] && (
                          <div className="absolute top-full left-0 mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 z-10">
                            {nxzenEmailErrors[employee.id]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {employee.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {employee.employee_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Onboarded - Pending Assignment
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        onChange={(e) =>
                          handleManagerChange(employee.id, e.target.value)
                        }
                        value={employee.selectedManager || ""}
                      >
                        <option value="">Select Manager</option>
                        {predefinedManagers.map((manager) => (
                          <option key={manager.id} value={manager.name}>
                            {manager.name} ({manager.department})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleAssignManagerAndId(employee.id)}
                        disabled={
                          !employee.employee_id ||
                          !employee.nxzen_email ||
                          !employee.selectedManager ||
                          (employeeIdErrors[employee.id] &&
                            typeof employeeIdErrors[employee.id] === "string" &&
                            !(
                              employeeIdErrors[employee.id] instanceof Promise
                            )) ||
                          (nxzenEmailErrors[employee.id] &&
                            typeof nxzenEmailErrors[employee.id] === "string" &&
                            !(
                              nxzenEmailErrors[employee.id] instanceof Promise
                            )) ||
                          assigningManager === employee.id
                        }
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          employee.employee_id &&
                          employee.nxzen_email &&
                          employee.selectedManager &&
                          (!employeeIdErrors[employee.id] ||
                            typeof employeeIdErrors[employee.id] !== "string" ||
                            employeeIdErrors[employee.id] instanceof Promise) &&
                          (!nxzenEmailErrors[employee.id] ||
                            typeof nxzenEmailErrors[employee.id] !== "string" ||
                            nxzenEmailErrors[employee.id] instanceof Promise) &&
                          assigningManager !== employee.id
                            ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {assigningManager === employee.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Assigning...
                          </>
                        ) : (
                          "Confirm Assignment"
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">
          📋 Assignment Instructions
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            <strong>Employee ID:</strong> Must be exactly 6 digits (e.g.,
            100001, 245678). Each ID must be unique.
          </p>
          <p>
            <strong>NXZEN Email:</strong> Must be a valid email with @nxzen.com
            domain (e.g., employee@nxzen.com). Each email must be unique.
          </p>
          <p>
            <strong>Manager Assignment:</strong> Select from the predefined
            list: Pradeep, Vamshi, Vinod, Rakesh.
          </p>
          <p>
            <strong>Workflow:</strong> Employee ID, NXZEN Email, and Manager
            must be assigned before the employee can be moved to the Master
            Employee Table.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardedEmployees;
