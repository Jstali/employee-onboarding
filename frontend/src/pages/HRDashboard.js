import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserPlusIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

const HRDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: "",
    email: "",
    employeeType: "intern",
    managerId: "",
  });

  useEffect(() => {
    // Only fetch data when user is fully loaded and authenticated
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [employeesRes, managersRes] = await Promise.all([
        api.get("/hr/employees"),
        api.get("/hr/managers"),
      ]);

      setEmployees(employeesRes.data.employees);
      setManagers(managersRes.data.managers);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      setCreatingEmployee(true);
      setErrorMessage(""); // Clear any previous error
      const response = await api.post("/hr/employees", createFormData);
      setEmployees([response.data.employee, ...employees]);
      setShowCreateForm(false);
      setCreateFormData({
        name: "",
        email: "",
        employeeType: "intern",
        managerId: "",
      });
      setSuccessMessage(
        `Employee created successfully! Credentials sent to ${createFormData.email}`
      );
      setTimeout(() => setSuccessMessage(""), 5000); // Clear message after 5 seconds
    } catch (err) {
      setSuccessMessage(""); // Clear any previous success message
      setErrorMessage(
        "Failed to create employee: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000); // Clear message after 5 seconds
    } finally {
      setCreatingEmployee(false);
    }
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setSuccessMessage("");
    setErrorMessage("");
    setCreateFormData({
      name: "",
      email: "",
      employeeType: "intern",
      managerId: "",
    });
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    try {
      await api.patch(`/hr/employees/${employeeId}/status`, {
        status: newStatus,
      });
      setEmployees(
        employees.map((emp) =>
          emp.id === employeeId ? { ...emp, status: newStatus } : emp
        )
      );
      alert(`Employee status updated to ${newStatus}`);
    } catch (err) {
      alert(
        "Failed to update employee status: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleManagerAssignment = async (employeeId, managerId) => {
    try {
      await api.patch(`/hr/employees/${employeeId}/manager`, { managerId });
      setEmployees(
        employees.map((emp) =>
          emp.id === employeeId ? { ...emp, manager_id: managerId } : emp
        )
      );
      alert("Manager assigned successfully");
    } catch (err) {
      alert(
        "Failed to assign manager: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this employee? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/hr/employees/${employeeId}`);
      setEmployees(employees.filter((emp) => emp.id !== employeeId));
      alert("Employee deleted successfully");
    } catch (err) {
      alert(
        "Failed to delete employee: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "pending":
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
            <p className="text-gray-600">
              Manage employees, approvals, and onboarding
            </p>
          </div>
          <div className="flex space-x-3">
            <a href="/hr/forms" className="btn-secondary flex items-center">
              <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
              Manage Forms
            </a>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center"
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Create Employee
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
            <p className="text-green-800 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800 font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Employee
              </h3>
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div>
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    required
                    className="input-field"
                    value={createFormData.email}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Employee Type</label>
                  <select
                    className="input-field"
                    value={createFormData.employeeType}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        employeeType: e.target.value,
                      })
                    }
                  >
                    <option value="intern">Intern</option>
                    <option value="contract">Contract</option>
                    <option value="fulltime">Full Time</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Manager (Optional)</label>
                  <select
                    className="input-field"
                    value={createFormData.managerId}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        managerId: e.target.value,
                      })
                    }
                  >
                    <option value="">No Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creatingEmployee}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingEmployee ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Employee"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeCreateForm}
                    disabled={creatingEmployee}
                    className="btn-secondary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UsersIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Employees
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {employees.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Pending Approval
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {employees.filter((emp) => emp.status === "pending").length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Approved
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {employees.filter((emp) => emp.status === "approved").length}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Employee Management
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {employee.employee_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        employee.status
                      )}`}
                    >
                      {getStatusIcon(employee.status)}
                      <span className="ml-1">{employee.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.manager_name || "Not Assigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {employee.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            handleStatusChange(employee.id, "approved")
                          }
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            handleStatusChange(employee.id, "rejected")
                          }
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <select
                      className="text-sm border rounded px-2 py-1"
                      value={employee.manager_id || ""}
                      onChange={(e) =>
                        handleManagerAssignment(employee.id, e.target.value)
                      }
                    >
                      <option value="">No Manager</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                    {employee.status !== "approved" && (
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
                        className="text-red-600 hover:text-red-900 ml-2"
                        title="Delete Employee"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
