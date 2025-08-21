import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

const EmployeeFormsManager = () => {
  const { user, loading: authLoading } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [filters, setFilters] = useState({
    status: "",
    employeeType: "",
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.employeeType && { employeeType: filters.employeeType }),
      });

      const response = await api.get(`/hr/employee-forms?${params}`);
      setForms(response.data.forms);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error("Failed to fetch forms:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.status, filters.employeeType]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchForms();
    }
  }, [authLoading, user, fetchForms]);

  const handleViewForm = async (formId) => {
    try {
      const response = await api.get(`/hr/employee-forms/${formId}`);
      setSelectedForm(response.data.form);
      setShowFormModal(true);
    } catch (err) {
      alert(
        "Failed to fetch form details: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleEditForm = (form) => {
    setEditingForm(form);
    setShowFormModal(true);
  };

  const handleUpdateForm = async (formId, formData) => {
    try {
      await api.patch(`/hr/employee-forms/${formId}`, formData);
      alert("Form updated successfully!");
      setShowFormModal(false);
      setEditingForm(null);
      fetchForms(); // Refresh the list
    } catch (err) {
      alert(
        "Failed to update form: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const handleDeleteForm = async (formId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this form? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/hr/employee-forms/${formId}`);
      alert("Form deleted successfully!");
      fetchForms(); // Refresh the list
    } catch (err) {
      alert(
        "Failed to delete form: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const handleCreateForm = async (employeeId) => {
    try {
      console.log("Initializing form for employee ID:", employeeId);
      console.log("Employee ID type:", typeof employeeId);

      const response = await api.post(
        `/hr/employee-forms/${employeeId}/initialize`
      );
      console.log("Initialize form response:", response.data);

      alert("Form initialized successfully!");
      setShowCreateModal(false);
      fetchForms(); // Refresh the list
    } catch (err) {
      console.error("Failed to initialize form:", err);
      console.error("Error response:", err.response?.data);
      alert(
        "Failed to create form: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchForms();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return "✓";
      case "pending":
        return "⏳";
      case "rejected":
        return "✗";
      default:
        return "?";
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Employee Forms Management
            </h1>
            <p className="text-gray-600">
              View, edit, and manage employee onboarding forms
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Initialize Form
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div>
            <label className="form-label">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or email..."
                className="input-field pl-10"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="form-label">Employee Type</label>
            <select
              className="input-field"
              value={filters.employeeType}
              onChange={(e) =>
                handleFilterChange("employeeType", e.target.value)
              }
            >
              <option value="">All Types</option>
              <option value="intern">Intern</option>
              <option value="contract">Contract</option>
              <option value="fulltime">Full Time</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              <FunnelIcon className="h-5 w-5 mr-2" />
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Forms Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Employee Forms ({pagination.total} total)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Form Status
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
              {forms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {form.name}
                      </div>
                      <div className="text-sm text-gray-500">{form.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {form.employee_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        form.status
                      )}`}
                    >
                      {getStatusIcon(form.status)}
                      <span className="ml-1">{form.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {form.personal_info ? "Submitted" : "Not Started"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {form.manager_name || "Not Assigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewForm(form.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Form"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditForm(form)}
                      className="text-green-600 hover:text-green-900"
                      title="Edit Form"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Form"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form View/Edit Modal */}
      {showFormModal && (selectedForm || editingForm) && (
        <FormModal
          form={editingForm || selectedForm}
          isEditing={!!editingForm}
          onClose={() => {
            setShowFormModal(false);
            setSelectedForm(null);
            setEditingForm(null);
          }}
          onUpdate={handleUpdateForm}
        />
      )}

      {/* Create Form Modal */}
      {showCreateModal && (
        <CreateFormModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateForm}
        />
      )}
    </div>
  );
};

// Form Modal Component
const FormModal = ({ form, isEditing, onClose, onUpdate }) => {
  const [formData, setFormData] = useState(form);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log("FormModal received form data:", form);
    setFormData(form);
  }, [form]);

  // Debug: Show raw form data
  console.log("FormModal current formData:", formData);

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate(form.id, formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? "Edit Employee Form" : "View Employee Form"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">
                Personal Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.personalInfo?.firstName || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "personalInfo",
                        "firstName",
                        e.target.value
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.personalInfo?.lastName || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "personalInfo",
                        "lastName",
                        e.target.value
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="input-field"
                    value={formData.personalInfo?.phone || ""}
                    onChange={(e) =>
                      handleInputChange("personalInfo", "phone", e.target.value)
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <textarea
                    rows={2}
                    className="input-field"
                    value={formData.personalInfo?.address || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "personalInfo",
                        "address",
                        e.target.value
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Bank Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">
                Bank Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.bankInfo?.accountNumber || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "bankInfo",
                        "accountNumber",
                        e.target.value
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.bankInfo?.bankName || ""}
                    onChange={(e) =>
                      handleInputChange("bankInfo", "bankName", e.target.value)
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.bankInfo?.ifscCode || ""}
                    onChange={(e) =>
                      handleInputChange("bankInfo", "ifscCode", e.target.value)
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">Branch</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.bankInfo?.branch || ""}
                    onChange={(e) =>
                      handleInputChange("bankInfo", "branch", e.target.value)
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Additional Fields */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-4">
                Additional Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Aadhar Number</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.aadharNumber || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        aadharNumber: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="form-label">PAN Number</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.panNumber || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        panNumber: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                  />
                </div>
                {form.employee_type === "fulltime" && (
                  <div>
                    <label className="form-label">Passport Number</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.passportNumber || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          passportNumber: e.target.value,
                        }))
                      }
                      disabled={!isEditing}
                    />
                  </div>
                )}
                {form.employee_type === "fulltime" && (
                  <div>
                    <label className="form-label">Join Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.joinDate || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          joinDate: e.target.value,
                        }))
                      }
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contract Specific Fields */}
            {form.employee_type === "contract" && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">
                  Contract Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.contractPeriod?.startDate || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "contractPeriod",
                          "startDate",
                          e.target.value
                        )
                      }
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={formData.contractPeriod?.endDate || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "contractPeriod",
                          "endDate",
                          e.target.value
                        )
                      }
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

// Create Form Modal Component
const CreateFormModal = ({ onClose, onCreate }) => {
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/hr/employees");
      setEmployees(response.data.employees);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId) {
      alert("Please select an employee");
      return;
    }

    setLoading(true);
    try {
      await onCreate(employeeId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Initialize Employee Form
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Select Employee</label>
            <select
              className="input-field"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Choose an employee...</option>
              {employees
                .filter((emp) => emp.role === "employee")
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.employee_type}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !employeeId}
              className="btn-primary"
            >
              {loading ? "Creating..." : "Initialize Form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeFormsManager;
