import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  EyeIcon,
  PencilIcon,
  UserMinusIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

const MasterEmployeeTable = () => {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [filters, setFilters] = useState({
    employeeType: "",
    role: "",
    department: "",
    status: "",
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    if (!authLoading && user) {
      fetchEmployees();
      fetchDepartments();
    }
  }, [authLoading, user, filters, pagination.page]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.employeeType && { employeeType: filters.employeeType }),
        ...(filters.role && { role: filters.role }),
        ...(filters.department && { department: filters.department }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await api.get(`/master?${params}`);
      setEmployees(response.data.employees);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/master/departments/list");
      setDepartments(response.data.departments);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    }
  };

  const handleViewEmployee = async (employeeId) => {
    try {
      const response = await api.get(`/master/${employeeId}`);
      setSelectedEmployee(response.data.employee);
      setShowViewModal(true);
    } catch (err) {
      alert(
        "Failed to fetch employee details: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (employeeId, employeeData) => {
    try {
      await api.put(`/master/${employeeId}`, employeeData);
      alert("Employee updated successfully!");
      setShowEditModal(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (err) {
      alert(
        "Failed to update employee: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleDeactivateEmployee = async (employeeId) => {
    if (
      !window.confirm(
        "Are you sure you want to deactivate this employee? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/master/${employeeId}`);
      alert("Employee deactivated successfully!");
      fetchEmployees();
    } catch (err) {
      alert(
        "Failed to deactivate employee: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleCreateEmployee = async (employeeData) => {
    try {
      await api.post("/master", employeeData);
      alert("Employee created successfully!");
      setShowCreateModal(false);
      fetchEmployees();
    } catch (err) {
      alert(
        "Failed to create employee: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEmployees();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return "✓";
      case "inactive":
        return "✗";
      case "pending":
        return "⏳";
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
              Master Employee Table
            </h1>
            <p className="text-gray-600">
              Comprehensive employee management and tracking
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <UserPlusIcon className="h-5 w-5 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 md:grid-cols-6 gap-4"
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
          <div>
            <label className="form-label">Role</label>
            <select
              className="input-field"
              value={filters.role}
              onChange={(e) => handleFilterChange("role", e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Department</label>
            <select
              className="input-field"
              value={filters.department}
              onChange={(e) => handleFilterChange("department", e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select
              className="input-field"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
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

      {/* Employees Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Master Employee List ({pagination.total} total)
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
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {employee.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {employee.employee_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {employee.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.department || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.manager_name || "Not Assigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.join_date
                      ? new Date(employee.join_date).toLocaleDateString()
                      : "N/A"}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleViewEmployee(employee.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Profile"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditEmployee(employee)}
                      className="text-green-600 hover:text-green-900"
                      title="Edit Employee"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {employee.status === "active" && (
                      <button
                        onClick={() => handleDeactivateEmployee(employee.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Deactivate Employee"
                      >
                        <UserMinusIcon className="h-4 w-4" />
                      </button>
                    )}
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

      {/* View Employee Modal */}
      {showViewModal && selectedEmployee && (
        <ViewEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowViewModal(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          departments={departments}
          onClose={() => {
            setShowEditModal(false);
            setEditingEmployee(null);
          }}
          onUpdate={handleUpdateEmployee}
        />
      )}

      {/* Create Employee Modal */}
      {showCreateModal && (
        <CreateEmployeeModal
          departments={departments}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateEmployee}
        />
      )}
    </div>
  );
};

// View Employee Modal Component
const ViewEmployeeModal = ({ employee, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Employee Profile
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

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label font-medium">Name</label>
              <p className="text-gray-900">{employee.name}</p>
            </div>
            <div>
              <label className="form-label font-medium">Email</label>
              <p className="text-gray-900">{employee.email}</p>
            </div>
            <div>
              <label className="form-label font-medium">Employee Type</label>
              <p className="text-gray-900 capitalize">
                {employee.employee_type}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Role</label>
              <p className="text-gray-900 capitalize">{employee.role}</p>
            </div>
            <div>
              <label className="form-label font-medium">Department</label>
              <p className="text-gray-900">{employee.department || "N/A"}</p>
            </div>
            <div>
              <label className="form-label font-medium">Manager</label>
              <p className="text-gray-900">
                {employee.manager_name || "Not Assigned"}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Join Date</label>
              <p className="text-gray-900">
                {employee.join_date
                  ? new Date(employee.join_date).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Status</label>
              <p className="text-gray-900 capitalize">{employee.status}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Employee Modal Component
const EditEmployeeModal = ({ employee, departments, onClose, onUpdate }) => {
  const [formData, setFormData] = useState(employee);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate(employee.id, formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Employee</h3>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name</label>
              <input
                type="text"
                className="input-field"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="input-field"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="form-label">Employee Type</label>
              <select
                className="input-field"
                value={formData.employee_type || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    employee_type: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select Type</option>
                <option value="intern">Intern</option>
                <option value="contract">Contract</option>
                <option value="fulltime">Full Time</option>
              </select>
            </div>
            <div>
              <label className="form-label">Role</label>
              <select
                className="input-field"
                value={formData.role || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, role: e.target.value }))
                }
                required
              >
                <option value="">Select Role</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="form-label">Department</label>
              <select
                className="input-field"
                value={formData.department || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Join Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.join_date || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    join_date: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="input-field"
                value={formData.status || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Employee Modal Component
const CreateEmployeeModal = ({ departments, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    employeeType: "",
    role: "",
    department: "",
    joinDate: "",
    managerId: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Add New Employee
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="input-field"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="form-label">Employee Type *</label>
              <select
                className="input-field"
                value={formData.employeeType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    employeeType: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select Type</option>
                <option value="intern">Intern</option>
                <option value="contract">Contract</option>
                <option value="fulltime">Full Time</option>
              </select>
            </div>
            <div>
              <label className="form-label">Role *</label>
              <select
                className="input-field"
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, role: e.target.value }))
                }
                required
              >
                <option value="">Select Role</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="form-label">Department *</label>
              <select
                className="input-field"
                value={formData.department}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Join Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.joinDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, joinDate: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MasterEmployeeTable;
