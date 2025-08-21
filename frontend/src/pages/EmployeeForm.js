import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import {
  UserIcon,
  BanknotesIcon,
  AcademicCapIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";

const EmployeeForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    personalInfo: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phone: "",
      address: "",
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
      },
    },
    bankInfo: {
      accountNumber: "",
      bankName: "",
      ifscCode: "",
      branch: "",
    },
    aadharNumber: "",
    panNumber: "",
    passportNumber: "",
    educationInfo: {
      highestQualification: "",
      institution: "",
      yearOfCompletion: "",
      percentage: "",
    },
    techCertificates: [],
    photoUrl: "",
    workExperience: {
      yearsOfExperience: "",
      previousCompany: "",
      designation: "",
      skills: [],
    },
    contractPeriod: {
      startDate: "",
      endDate: "",
      terms: "",
    },
    joinDate: "",
  });
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      setLoading(true);
      const [formRes, requirementsRes] = await Promise.all([
        api.get("/employee/onboarding-form"),
        api.get("/employee/form-requirements"),
      ]);

      if (formRes.data.form) {
        // Merge API response with default structure to ensure all fields exist
        setFormData((prevData) => ({
          ...prevData,
          ...formRes.data.form,
          // Ensure nested objects are properly merged
          personalInfo: {
            ...prevData.personalInfo,
            ...formRes.data.form.personalInfo,
            emergencyContact: {
              ...prevData.personalInfo.emergencyContact,
              ...(formRes.data.form.personalInfo?.emergencyContact || {}),
            },
          },
          bankInfo: {
            ...prevData.bankInfo,
            ...formRes.data.form.bankInfo,
          },
          educationInfo: {
            ...prevData.educationInfo,
            ...formRes.data.form.educationInfo,
          },
          workExperience: {
            ...prevData.workExperience,
            ...formRes.data.form.workExperience,
          },
          contractPeriod: {
            ...prevData.contractPeriod,
            ...formRes.data.form.contractPeriod,
          },
        }));
      }
      setRequirements(requirementsRes.data);
    } catch (err) {
      setError("Failed to fetch form data");
      console.error("Form data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleNestedInputChange = (section, nestedSection, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [nestedSection]: {
          ...prev[section][nestedSection],
          [field]: value,
        },
      },
    }));
  };

  const handleArrayInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item),
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSaving(true);
      console.log("Sending API request to /employee/onboarding-form");
      const response = await api.post("/employee/onboarding-form", formData);
      console.log("Form submitted successfully:", response);
      setSuccess("Form submitted successfully!");
    } catch (err) {
      console.error("Form submission failed:", err);
      setError(
        "Form submission failed: " + (err.response?.data?.error || err.message)
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Safety check to ensure formData has the required structure
  if (
    !formData ||
    !formData.personalInfo ||
    !formData.bankInfo ||
    !formData.educationInfo
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form structure...</p>
        </div>
      </div>
    );
  }

  // Additional safety check for contract-specific fields
  if (
    user?.employee_type === "contract" &&
    (!formData.workExperience || !formData.contractPeriod)
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading contract form structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success Banner */}
      {success && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl">
          <div className="bg-green-500 border border-green-600 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-white mr-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-white font-semibold text-lg">
                    Form Submitted Successfully!
                  </p>
                  <p className="text-green-100 text-sm">{success}</p>
                </div>
              </div>
              <button
                onClick={() => setSuccess("")}
                className="text-white hover:text-green-200 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
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
      )}

      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Employee Onboarding Form
        </h1>
        <p className="text-gray-600">
          Complete your onboarding information for {user?.employee_type}{" "}
          position
        </p>
        {requirements && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              {requirements.requirements.description}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
            <button
              onClick={() => setSuccess("")}
              className="text-green-400 hover:text-green-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <UserIcon className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">
              Personal Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">First Name *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.personalInfo?.firstName || ""}
                onChange={(e) =>
                  handleInputChange("personalInfo", "firstName", e.target.value)
                }
              />
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.personalInfo?.lastName || ""}
                onChange={(e) =>
                  handleInputChange("personalInfo", "lastName", e.target.value)
                }
              />
            </div>
            <div>
              <label className="form-label">Date of Birth *</label>
              <input
                type="date"
                required
                className="input-field"
                value={formData.personalInfo?.dateOfBirth || ""}
                onChange={(e) =>
                  handleInputChange(
                    "personalInfo",
                    "dateOfBirth",
                    e.target.value
                  )
                }
              />
            </div>
            <div>
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                required
                className="input-field"
                value={formData.personalInfo?.phone || ""}
                onChange={(e) =>
                  handleInputChange("personalInfo", "phone", e.target.value)
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Address *</label>
              <textarea
                required
                rows={3}
                className="input-field"
                value={formData.personalInfo?.address || ""}
                onChange={(e) =>
                  handleInputChange("personalInfo", "address", e.target.value)
                }
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-medium text-gray-900 mb-4">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.personalInfo?.emergencyContact?.name || ""}
                  onChange={(e) =>
                    handleNestedInputChange(
                      "personalInfo",
                      "emergencyContact",
                      "name",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Relationship *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={
                    formData.personalInfo?.emergencyContact?.relationship || ""
                  }
                  onChange={(e) =>
                    handleNestedInputChange(
                      "personalInfo",
                      "emergencyContact",
                      "relationship",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Phone *</label>
                <input
                  type="tel"
                  required
                  className="input-field"
                  value={formData.personalInfo?.emergencyContact?.phone || ""}
                  onChange={(e) =>
                    handleNestedInputChange(
                      "personalInfo",
                      "emergencyContact",
                      "phone",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <BanknotesIcon className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">
              Bank Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Account Number *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.bankInfo?.accountNumber || ""}
                onChange={(e) =>
                  handleInputChange("bankInfo", "accountNumber", e.target.value)
                }
              />
            </div>
            <div>
              <label className="form-label">Bank Name *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.bankInfo?.bankName || ""}
                onChange={(e) =>
                  handleInputChange("bankInfo", "bankName", e.target.value)
                }
              />
            </div>
            <div>
              <label className="form-label">IFSC Code *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.bankInfo?.ifscCode || ""}
                onChange={(e) =>
                  handleInputChange("bankInfo", "ifscCode", e.target.value)
                }
              />
            </div>
            <div>
              <label className="form-label">Branch *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.bankInfo?.branch || ""}
                onChange={(e) =>
                  handleInputChange("bankInfo", "branch", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Identity Documents */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <UserIcon className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">
              Additional Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Aadhar Number *</label>
              <input
                type="text"
                required
                maxLength={12}
                className="input-field"
                value={formData.aadharNumber || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    aadharNumber: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="form-label">PAN Number *</label>
              <input
                type="text"
                required
                maxLength={10}
                className="input-field"
                value={formData.panNumber || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    panNumber: e.target.value,
                  }))
                }
              />
            </div>
            {user?.employee_type === "fulltime" && (
              <div>
                <label className="form-label">Passport Number *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.passportNumber || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      passportNumber: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Education Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <AcademicCapIcon className="h-6 w-6 text-primary-600 mr-3" />
            <h2 className="text-lg font-medium text-gray-900">
              Education Information
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Highest Qualification *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.educationInfo?.highestQualification || ""}
                onChange={(e) =>
                  handleInputChange(
                    "educationInfo",
                    "highestQualification",
                    e.target.value
                  )
                }
              />
            </div>
            <div>
              <label className="form-label">Institution *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.educationInfo?.institution || ""}
                onChange={(e) =>
                  handleInputChange(
                    "educationInfo",
                    "institution",
                    e.target.value
                  )
                }
              />
            </div>
            <div>
              <label className="form-label">Year of Completion *</label>
              <input
                type="number"
                required
                min="1950"
                max="2030"
                className="input-field"
                value={formData.educationInfo?.yearOfCompletion || ""}
                onChange={(e) =>
                  handleInputChange(
                    "educationInfo",
                    "yearOfCompletion",
                    e.target.value
                  )
                }
              />
            </div>
            <div>
              <label className="form-label">Percentage/CGPA *</label>
              <input
                type="text"
                required
                className="input-field"
                value={formData.educationInfo?.percentage || ""}
                onChange={(e) =>
                  handleInputChange(
                    "educationInfo",
                    "percentage",
                    e.target.value
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* Contract-specific fields */}
        {user?.employee_type === "contract" && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-6">
              <BriefcaseIcon className="h-6 w-6 text-primary-600 mr-3" />
              <h2 className="text-lg font-medium text-gray-900">
                Work Experience & Contract Details
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Years of Experience *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.5"
                  className="input-field"
                  value={formData.workExperience?.yearsOfExperience || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "workExperience",
                      "yearsOfExperience",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Previous Company</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.workExperience?.previousCompany || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "workExperience",
                      "previousCompany",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Previous Designation</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.workExperience?.designation || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "workExperience",
                      "designation",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <label className="form-label">Skills (comma-separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.workExperience?.skills?.join(", ") || ""}
                  onChange={(e) =>
                    handleArrayInputChange(
                      "workExperience",
                      "skills",
                      e.target.value
                    )
                  }
                  placeholder="e.g., JavaScript, React, Node.js"
                />
              </div>
            </div>

            {/* Contract Period (for Contract employees) */}
            {user?.employee_type === "contract" && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-md font-medium text-gray-900 mb-4">
                  Contract Period
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={formData.contractPeriod?.startDate || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "contractPeriod",
                          "startDate",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      required
                      className="input-field"
                      value={formData.contractPeriod?.endDate || ""}
                      onChange={(e) =>
                        handleInputChange(
                          "contractPeriod",
                          "endDate",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="form-label">Contract Terms *</label>
                  <textarea
                    required
                    rows={3}
                    className="input-field"
                    value={formData.contractPeriod?.terms || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "contractPeriod",
                        "terms",
                        e.target.value
                      )
                    }
                    placeholder="Describe the contract terms and conditions"
                  />
                </div>
              </div>
            )}

            {/* Join Date (for Full Time employees) */}
            {user?.employee_type === "fulltime" && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-md font-medium text-gray-900 mb-4">
                  Employment Details
                </h3>
                <div>
                  <label className="form-label">Join Date *</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={formData.joinDate || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        joinDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {/* Technical Certificates */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                Technical Certificates
              </h3>
              <div>
                <label className="form-label">Certificates</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.techCertificates?.join(", ") || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      techCertificates: e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter((item) => item),
                    }))
                  }
                  placeholder="e.g., AWS Certified, Google Cloud, Microsoft Azure"
                />
              </div>
            </div>

            {/* Profile Photo */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                Profile Photo
              </h3>
              <div>
                <label className="form-label">Profile Photo URL</label>
                <input
                  type="url"
                  className="input-field"
                  value={formData.photoUrl || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      photoUrl: e.target.value,
                    }))
                  }
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-8 py-3 text-lg"
          >
            {saving ? "Saving..." : "Submit Form"}
          </button>
        </div>

        {/* Inline Success Message */}
        {success && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-green-800 font-medium">
                Form submitted successfully! Your information has been saved.
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default EmployeeForm;
