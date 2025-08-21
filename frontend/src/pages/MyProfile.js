import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const MyProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");

      // Get profile from master_employees table
      const response = await api.get(`/master/profile`);
      setProfile(response.data.profile);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile information");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">View your employee profile information</p>
      </div>

      {/* Profile Information */}
      {profile ? (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label font-medium">Name</label>
              <p className="text-gray-900 text-lg">{profile.name}</p>
            </div>
            <div>
              <label className="form-label font-medium">Email</label>
              <p className="text-gray-900 text-lg">{profile.email}</p>
            </div>
            <div>
              <label className="form-label font-medium">Employee Type</label>
              <p className="text-gray-900 text-lg capitalize">
                {profile.employee_type}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Role</label>
              <p className="text-gray-900 text-lg capitalize">{profile.role}</p>
            </div>
            <div>
              <label className="form-label font-medium">Department</label>
              <p className="text-gray-900 text-lg">
                {profile.department || "Not Assigned"}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Manager</label>
              <p className="text-gray-900 text-lg">
                {profile.manager_name || "Not Assigned"}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Join Date</label>
              <p className="text-gray-900 text-lg">
                {profile.join_date
                  ? new Date(profile.join_date).toLocaleDateString()
                  : "Not Set"}
              </p>
            </div>
            <div>
              <label className="form-label font-medium">Status</label>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  profile.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {profile.status === "active" ? "✓ Active" : "✗ Inactive"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Profile information not found. Please contact HR to set up your
            profile.
          </p>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
