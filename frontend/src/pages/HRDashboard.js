import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  UsersIcon,
  UserPlusIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

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

const HRDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employeeForms, setEmployeeForms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [sendingEmployeeMail, setSendingEmployeeMail] = useState(false);
  const [filters, setFilters] = useState({
    employeeType: "",
    showDeleted: false, // Add filter for deleted employees
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("soft"); // "soft" or "hard"
  const [showFormModal, setShowFormModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

  const [createFormData, setCreateFormData] = useState({
    name: "",
    email: "",
    employeeType: "intern",
    department: "IT", // Add default department
    managerId: "",
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Build query parameters for filters
      const queryParams = new URLSearchParams();
      if (filters.employeeType)
        queryParams.append("employeeType", filters.employeeType);
      if (filters.showDeleted) queryParams.append("showDeleted", "true");

      const [employeesRes, managersRes, formsRes] = await Promise.all([
        api.get(`/hr/employees?${queryParams.toString()}`),
        api.get("/hr/managers"),
        api.get("/hr/employee-forms"),
      ]);

      setEmployees(employeesRes.data.employees);
      setManagers(managersRes.data.managers);
      setEmployeeForms(formsRes.data.forms || []);
    } catch (err) {
      console.error("❌ HRDashboard Debug - Dashboard data fetch error:", err);
      console.error(
        "❌ HRDashboard Debug - Error details:",
        err.response?.data
      );
      console.error(
        "❌ HRDashboard Debug - Error status:",
        err.response?.status
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // Only fetch data when user is fully loaded and authenticated
    if (!authLoading && user) {
      fetchDashboardData();
    }
  }, [authLoading, user, fetchDashboardData]);

  // Refetch data when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [filters, fetchDashboardData]);

  const handleSendEmployeeMail = async (e) => {
    e.preventDefault();
    try {
      setSendingEmployeeMail(true);
      setErrorMessage(""); // Clear any previous error
      const response = await api.post("/hr/employees", createFormData);
      setEmployees([response.data.employee, ...employees]);
      setShowCreateForm(false);
      setCreateFormData({
        name: "",
        email: "",
        employeeType: "intern",
        department: "IT", // Add default department
        managerId: "",
      });
      setSuccessMessage(
        `Employee welcome mail sent successfully to ${createFormData.email}! Employee has been created and onboarded. They will appear in the "Onboarded Employees" section for manager assignment.`
      );
      setTimeout(() => setSuccessMessage(""), 5000); // Clear message after 5 seconds
    } catch (err) {
      setSuccessMessage(""); // Clear any previous success message
      setErrorMessage(
        "Failed to send employee welcome mail: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000); // Clear message after 5 seconds
    } finally {
      setSendingEmployeeMail(false);
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
      department: "IT", // Add default department
      managerId: "",
    });
  };

  const handleStatusChange = async (employeeId, newStatus) => {
    try {
      // If approving an employee, implement the onboarding process
      if (
        newStatus === "approved" &&
        features.OnboardingProcess.afterApprovalMoveTo === "OnboardedEmployee"
      ) {
        // Find the employee to get their details
        const employee = employees.find((emp) => emp.id === employeeId);

        // Prepare the onboarding data with required fields
        const onboardingData = {
          status: newStatus,
          onboardingFields: features.OnboardingProcess.assignFields
            .map((field) => {
              switch (field) {
                case "EmployeeID":
                  return { field: "employee_id", value: generateEmployeeID() };
                case "CompanyEmail":
                  return {
                    field: "company_email",
                    value: generateCompanyEmail(employee.email),
                  };
                case "Manager":
                  return {
                    field: "manager_id",
                    value: employee.manager_id || null,
                  };
                default:
                  return null;
              }
            })
            .filter(Boolean),
        };

        await api.patch(`/hr/employees/${employeeId}/status`, onboardingData);

        // Update local state with new fields
        setEmployees(
          employees.map((emp) =>
            emp.id === employeeId
              ? {
                  ...emp,
                  status: newStatus,
                  ...onboardingData.onboardingFields.reduce((acc, field) => {
                    acc[field.field] = field.value;
                    return acc;
                  }, {}),
                }
              : emp
          )
        );

        alert(`Employee approved and onboarding fields assigned successfully!`);

        // Move employee to Employee Master Table after onboarding completion
        if (
          features.EmployeeMasterTable.afterOnboardingMoveTo ===
          "EmployeeMasterTable"
        ) {
          try {
            await api.post(`/hr/employees/${employeeId}/add-to-master`, {
              employee_id: onboardingData.onboardingFields.find(
                (f) => f.field === "employee_id"
              )?.value,
              company_email: onboardingData.onboardingFields.find(
                (f) => f.field === "company_email"
              )?.value,
              manager_id: onboardingData.onboardingFields.find(
                (f) => f.field === "manager_id"
              )?.value,
            });

            setSuccessMessage(
              "Employee successfully moved to Employee Master Table!"
            );
            setTimeout(() => setSuccessMessage(""), 5000);
          } catch (masterError) {
            console.error(
              "Failed to move employee to master table:",
              masterError
            );
            setErrorMessage(
              "Employee approved but failed to move to master table. Please try again."
            );
            setTimeout(() => setErrorMessage(""), 5000);
          }
        }
      } else {
        // Regular status change
        await api.patch(`/hr/employees/${employeeId}/status`, {
          status: newStatus,
        });
        setEmployees(
          employees.map((emp) =>
            emp.id === employeeId ? { ...emp, status: newStatus } : emp
          )
        );
        alert(`Employee status updated to ${newStatus}`);
      }
    } catch (err) {
      alert(
        "Failed to update employee status: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  // Helper function to generate Employee ID
  const generateEmployeeID = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `EMP${timestamp}${random}`;
  };

  // Helper function to generate Company Email
  const generateCompanyEmail = (personalEmail) => {
    const name = personalEmail.split("@")[0];
    return `${name}@nxzen.com`;
  };

  const handleManagerAssignment = async (employeeId, managerId) => {
    try {
      await api.patch(`/hr/employees/${employeeId}/manager`, {
        managerId: managerId || null,
      });
      // Refresh the employees list
      fetchDashboardData();
    } catch (err) {
      alert(
        "Failed to assign manager: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const openDeleteModal = (employee) => {
    setEmployeeToDelete(employee);
    setDeleteType("soft");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
    setDeleteType("soft");
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;

    try {
      let deleteUrl;
      if (deleteType === "hard") {
        // Hard delete - permanently remove from database
        deleteUrl = `/hr/employees/${employeeToDelete.id}/permanent`;
        console.log("🔍 Frontend Debug - Hard delete URL:", deleteUrl);
        console.log("🔍 Frontend Debug - API base URL:", api.defaults.baseURL);
        console.log(
          "🔍 Frontend Debug - Full delete URL:",
          `${api.defaults.baseURL}${deleteUrl}`
        );
        await api.delete(deleteUrl);
        setSuccessMessage("Employee permanently deleted successfully!");
      } else {
        // Soft delete - mark as deleted but keep data
        deleteUrl = `/hr/employees/${employeeToDelete.id}`;
        console.log("🔍 Frontend Debug - Soft delete URL:", deleteUrl);
        console.log("🔍 Frontend Debug - API base URL:", api.defaults.baseURL);
        console.log(
          "🔍 Frontend Debug - Full delete URL:",
          `${api.defaults.baseURL}${deleteUrl}`
        );
        await api.delete(deleteUrl);
        setSuccessMessage("Employee deleted successfully!");
      }

      // Remove from local state
      setEmployees(employees.filter((emp) => emp.id !== employeeToDelete.id));

      // Close modal
      closeDeleteModal();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      console.error("❌ Frontend Debug - Delete error:", err);
      console.error("❌ Frontend Debug - Error response:", err.response);
      console.error("❌ Frontend Debug - Error status:", err.response?.status);
      console.error("❌ Frontend Debug - Error data:", err.response?.data);
      setErrorMessage(
        "Failed to delete employee: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  const handleRestoreEmployee = async (employeeId) => {
    try {
      await api.patch(`/hr/employees/${employeeId}/restore`);
      setSuccessMessage("Employee restored successfully!");

      // Refresh the employees list
      fetchDashboardData();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setErrorMessage(
        "Failed to restore employee: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Form approval functionality has been removed

  // View form details
  const viewFormDetails = async (formId) => {
    try {
      const response = await api.get(`/hr/employee-forms/${formId}`);
      const formData = response.data.form;
      setSelectedForm(formData);
      setShowFormModal(true);
    } catch (err) {
      setErrorMessage(
        "Failed to load form details: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Edit form
  const editForm = async (formId) => {
    try {
      const response = await api.get(`/hr/employee-forms/${formId}`);
      const formData = response.data.form;
      setSelectedForm(formData);
      setShowEditModal(true);
    } catch (err) {
      setErrorMessage(
        "Failed to load form for editing: " +
          (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Delete form
  const deleteForm = async (formId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this form? This action cannot be undone."
      )
    ) {
      try {
        await api.delete(`/hr/employee-forms/${formId}`);
        setSuccessMessage("Form deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 5000);
        // Refresh the forms list
        fetchDashboardData();
      } catch (err) {
        setErrorMessage(
          "Failed to delete form: " + (err.response?.data?.error || err.message)
        );
        setTimeout(() => setErrorMessage(""), 5000);
      }
    }
  };

  // Handle edit form submission
  const handleEditForm = async (e) => {
    e.preventDefault();
    try {
      const formId = selectedForm.id;
      const updateData = {
        employee: selectedForm.employee,
        personalInfo: selectedForm.personalInfo,
        aadharNumber: selectedForm.aadharNumber,
        panNumber: selectedForm.panNumber,
        passportNumber: selectedForm.passportNumber,
      };

      await api.put(`/hr/employee-forms/${formId}`, updateData);

      setSuccessMessage("Form updated successfully!");
      setTimeout(() => setSuccessMessage(""), 5000);

      // Close the edit modal
      setShowEditModal(false);

      // Refresh the dashboard data
      fetchDashboardData();
    } catch (err) {
      setErrorMessage(
        "Failed to update form: " + (err.response?.data?.error || err.message)
      );
      setTimeout(() => setErrorMessage(""), 5000);
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
            <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
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
              Send Employee Mail
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
      {/* Send Employee Welcome Mail Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Send Employee Welcome Mail
              </h3>
              <form onSubmit={handleSendEmployeeMail} className="space-y-4">
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
                  <label className="form-label">Department</label>
                  <select
                    className="input-field"
                    value={createFormData.department}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
                        department: e.target.value,
                      })
                    }
                  >
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
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
                    disabled={sendingEmployeeMail}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingEmployeeMail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      "Send Mail"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeCreateForm}
                    disabled={sendingEmployeeMail}
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
              <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Forms Submitted
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {employeeForms.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Forms Section */}
      {features.HRManagementTable.showEmployeeForms && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Employee Forms Submitted
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve employee onboarding forms
            </p>
          </div>

          <div className="overflow-x-auto">
            {employeeForms.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeeForms.map((form) => (
                    <tr key={form.form_id || form.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {form.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {form.email || "N/A"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {form.form_created_at
                          ? new Date(form.form_created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() =>
                            viewFormDetails(form.form_id || form.id)
                          }
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded text-xs font-medium"
                          title="View Details"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => editForm(form.form_id || form.id)}
                          className="text-orange-600 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded text-xs font-medium"
                          title="Edit Form"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteForm(form.form_id || form.id)}
                          className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-xs font-medium"
                          title="Delete Form"
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No forms submitted
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Employee forms will appear here once they are submitted.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Employee Management
          </h2>
        </div>

        {/* Filters Section */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee Type
              </label>
              <select
                className="input-field"
                value={filters.employeeType}
                onChange={(e) =>
                  setFilters({ ...filters, employeeType: e.target.value })
                }
              >
                <option value="">All Types</option>
                <option value="intern">Intern</option>
                <option value="contract">Contract</option>
                <option value="fulltime">Full Time</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showDeleted}
                  onChange={(e) =>
                    setFilters({ ...filters, showDeleted: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Show Deleted Employees
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee Nxzen Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                {!features.HRManagementTable.removeActionColumn && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.employee_id || "N/A"}
                  </td>
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
                    <div className="flex items-center space-x-2">
                      {/* Delete Button - Show for all employees */}
                      <button
                        onClick={() => openDeleteModal(employee)}
                        className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-xs font-medium"
                        title="Delete Employee"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.manager_name || "Not Assigned"}
                  </td>
                  {!features.HRManagementTable.removeActionColumn && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {/* Manager Assignment and Other Actions */}
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

                      {/* Delete Button - Show for all employees */}
                      <button
                        onClick={() => openDeleteModal(employee)}
                        className="text-red-600 hover:text-red-900 ml-2 p-1 rounded hover:bg-red-50"
                        title="Delete Employee"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>

                      {/* Restore Button - Show for deleted employees */}
                      {employee.status === "deleted" && (
                        <button
                          onClick={() => handleRestoreEmployee(employee.id)}
                          className="text-green-600 hover:text-green-900 ml-2 p-1 rounded hover:bg-green-50"
                          title="Restore Employee"
                        >
                          <svg
                            className="h-4 w-4"
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
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <TrashIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">
                Delete Employee
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {employeeToDelete.name}
                  </span>
                  ?
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Email: {employeeToDelete.email}
                </p>

                {/* Delete Type Selection */}
                <div className="mt-4 text-left">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Delete Type:
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deleteType"
                        value="soft"
                        checked={deleteType === "soft"}
                        onChange={(e) => setDeleteType(e.target.value)}
                        className="mr-2 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">
                        Soft Delete (Mark as deleted, keep data)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="deleteType"
                        value="hard"
                        checked={deleteType === "hard"}
                        onChange={(e) => setDeleteType(e.target.value)}
                        className="mr-2 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">
                        Hard Delete (Permanently remove all data)
                      </span>
                    </label>
                  </div>

                  {deleteType === "hard" && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-xs text-red-700">
                        ⚠️ <strong>Warning:</strong> Hard delete will
                        permanently remove all employee data including forms,
                        documents, and attendance records. This action cannot be
                        undone.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-center space-x-3 mt-4">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className={`px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 ${
                    deleteType === "hard"
                      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                      : "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
                  }`}
                >
                  {deleteType === "hard"
                    ? "Delete Permanently"
                    : "Delete Employee"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Form Details Modal */}
      {showFormModal && selectedForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Employee Onboarding Form Details
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Employee Basic Info */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h4 className="text-lg font-semibold text-blue-900 mb-3">
                Employee Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Name
                  </label>
                  <p className="text-blue-900">{selectedForm.employee.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Email
                  </label>
                  <p className="text-blue-900">{selectedForm.employee.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Type
                  </label>
                  <p className="text-blue-900">
                    {selectedForm.employee.employeeType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Department
                  </label>
                  <p className="text-blue-900">
                    {selectedForm.employee.department}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Status
                  </label>
                  <p className="text-blue-900">
                    {selectedForm.employee.status}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-blue-700">
                    Submitted
                  </label>
                  <p className="text-blue-900">
                    {new Date(selectedForm.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            {selectedForm.personalInfo &&
              Object.keys(selectedForm.personalInfo).length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg mb-6">
                  <h4 className="text-lg font-semibold text-green-900 mb-3">
                    Personal Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedForm.personalInfo).map(
                      ([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-green-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <p className="text-green-900">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Bank Information */}
            {selectedForm.bankInfo &&
              Object.keys(selectedForm.bankInfo).length > 0 && (
                <div className="bg-purple-50 p-4 rounded-lg mb-6">
                  <h4 className="text-lg font-semibold text-purple-900 mb-3">
                    Bank Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedForm.bankInfo).map(
                      ([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-purple-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <p className="text-purple-900">{String(value)}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Identity Documents */}
            <div className="bg-yellow-50 p-4 rounded-lg mb-6">
              <h4 className="text-lg font-semibold text-yellow-900 mb-3">
                Identity Documents
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-yellow-700">
                    Aadhar Number
                  </label>
                  <p className="text-yellow-900">
                    {selectedForm.aadharNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-yellow-700">
                    PAN Number
                  </label>
                  <p className="text-yellow-900">
                    {selectedForm.panNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-yellow-700">
                    Passport Number
                  </label>
                  <p className="text-yellow-900">
                    {selectedForm.passportNumber || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Education Information */}
            {selectedForm.educationInfo &&
              Object.keys(selectedForm.educationInfo).length > 0 && (
                <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                  <h4 className="text-lg font-semibold text-indigo-900 mb-3">
                    Education Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedForm.educationInfo).map(
                      ([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-indigo-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <p className="text-indigo-900">{String(value)}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Work Experience */}
            {selectedForm.workExperience &&
              Object.keys(selectedForm.workExperience).length > 0 && (
                <div className="bg-orange-50 p-4 rounded-lg mb-6">
                  <h4 className="text-lg font-semibold text-orange-900 mb-3">
                    Work Experience
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedForm.workExperience).map(
                      ([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-orange-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <p className="text-orange-900">
                            {Array.isArray(value)
                              ? value.join(", ")
                              : String(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Contract Period */}
            {selectedForm.contractPeriod &&
              Object.keys(selectedForm.contractPeriod).length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg mb-6">
                  <h4 className="text-lg font-semibold text-red-900 mb-3">
                    Contract Period
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedForm.contractPeriod).map(
                      ([key, value]) => (
                        <div key={key}>
                          <label className="text-sm font-medium text-red-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </label>
                          <p className="text-red-900">{String(value)}</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Documents */}
            {selectedForm.documents && selectedForm.documents.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">
                  Uploaded Documents
                </h4>
                <div className="space-y-2">
                  {selectedForm.documents.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-white rounded border"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {doc.documentType}
                        </p>
                        <p className="text-sm text-gray-600">{doc.fileName}</p>
                        <p className="text-xs text-gray-500">
                          {doc.mimeType} • {(doc.fileSize / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          window.open(`/api${doc.downloadUrl}`, "_blank")
                        }
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo */}
            {selectedForm.photoUrl && (
              <div className="bg-pink-50 p-4 rounded-lg mb-6">
                <h4 className="text-lg font-semibold text-pink-900 mb-3">
                  Profile Photo
                </h4>
                <div className="flex items-center space-x-4">
                  <img
                    src={selectedForm.photoUrl}
                    alt="Profile"
                    className="w-24 h-24 object-cover rounded-lg border"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "block";
                    }}
                  />
                  <span className="text-pink-700 hidden">
                    Photo not available
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowFormModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditModal && selectedForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Edit Employee Form
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditForm} className="space-y-6">
              {/* Employee Basic Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-blue-900 mb-3">
                  Employee Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-blue-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={selectedForm.employee.name}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          employee: {
                            ...selectedForm.employee,
                            name: e.target.value,
                          },
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={selectedForm.employee.email}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          employee: {
                            ...selectedForm.employee,
                            email: e.target.value,
                          },
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700">
                      Type
                    </label>
                    <select
                      value={selectedForm.employee.employeeType}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          employee: {
                            ...selectedForm.employee,
                            employeeType: e.target.value,
                          },
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="intern">Intern</option>
                      <option value="full-time">Full Time</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700">
                      Department
                    </label>
                    <select
                      value={selectedForm.employee.department}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          employee: {
                            ...selectedForm.employee,
                            department: e.target.value,
                          },
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="IT">IT</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              {selectedForm.personalInfo &&
                Object.keys(selectedForm.personalInfo).length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-lg font-semibold text-green-900 mb-3">
                      Personal Information
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(selectedForm.personalInfo).map(
                        ([key, value]) => (
                          <div key={key}>
                            <label className="text-sm font-medium text-green-700 capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </label>
                            <input
                              type="text"
                              value={
                                typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)
                              }
                              onChange={(e) => {
                                const newPersonalInfo = {
                                  ...selectedForm.personalInfo,
                                };
                                newPersonalInfo[key] = e.target.value;
                                setSelectedForm({
                                  ...selectedForm,
                                  personalInfo: newPersonalInfo,
                                });
                              }}
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Identity Documents */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-yellow-900 mb-3">
                  Identity Documents
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-yellow-700">
                      Aadhar Number
                    </label>
                    <input
                      type="text"
                      value={selectedForm.aadharNumber || ""}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          aadharNumber: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-yellow-700">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={selectedForm.panNumber || ""}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          panNumber: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-yellow-700">
                      Passport Number
                    </label>
                    <input
                      type="text"
                      value={selectedForm.passportNumber || ""}
                      onChange={(e) =>
                        setSelectedForm({
                          ...selectedForm,
                          passportNumber: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRDashboard;
