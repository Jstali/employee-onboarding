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

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState({
    profilePhoto: null,
    aadharDocument: null,
    panDocument: null,
    tenthMarksheet: null,
    twelfthMarksheet: null,
    degreeCertificate: null,
  });

  const [fileUploadErrors, setFileUploadErrors] = useState({});
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // File handling functions
  const handleFileChange = (fieldName, file) => {
    if (file) {
      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        setFileUploadErrors((prev) => ({
          ...prev,
          [fieldName]: "Please upload only JPG, PNG, PDF, or DOC files",
        }));
        return;
      }

      if (file.size > maxSize) {
        setFileUploadErrors((prev) => ({
          ...prev,
          [fieldName]: "File size must be less than 5MB",
        }));
        return;
      }

      // Clear error and set file
      setFileUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));
      setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
    }
  };

  const removeFile = (fieldName) => {
    setUploadedFiles((prev) => ({ ...prev, [fieldName]: null }));
    setFileUploadErrors((prev) => ({ ...prev, [fieldName]: "" }));
  };

  const getFileDisplayName = (file) => {
    if (!file) return "";
    return file.name.length > 25
      ? file.name.substring(0, 25) + "..."
      : file.name;
  };

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

    // Validate required documents
    const requiredDocuments = ["profilePhoto", "aadharDocument", "panDocument"];
    const missingDocuments = requiredDocuments.filter(
      (doc) => !uploadedFiles[doc]
    );

    if (missingDocuments.length > 0) {
      const documentNames = {
        profilePhoto: "Profile Photo",
        aadharDocument: "Aadhar Document",
        panDocument: "PAN Document",
      };

      const missingNames = missingDocuments
        .map((doc) => documentNames[doc])
        .join(", ");
      setError(
        `Please upload the following required documents: ${missingNames}`
      );
      return;
    }

    try {
      setSaving(true);
      console.log("Sending API request to /employee/onboarding-form");

      // Create FormData for file uploads
      const formDataToSend = new FormData();

      // Add JSON data as form fields
      formDataToSend.append(
        "personalInfo",
        JSON.stringify(formData.personalInfo)
      );
      formDataToSend.append("bankInfo", JSON.stringify(formData.bankInfo));
      formDataToSend.append(
        "educationInfo",
        JSON.stringify(formData.educationInfo)
      );
      formDataToSend.append(
        "techCertificates",
        JSON.stringify(formData.techCertificates || [])
      );
      formDataToSend.append(
        "workExperience",
        JSON.stringify(formData.workExperience || {})
      );
      formDataToSend.append(
        "contractPeriod",
        JSON.stringify(formData.contractPeriod || {})
      );
      formDataToSend.append("aadharNumber", formData.aadharNumber || "");
      formDataToSend.append("panNumber", formData.panNumber || "");
      formDataToSend.append("passportNumber", formData.passportNumber || "");
      formDataToSend.append("joinDate", formData.joinDate || "");

      // Add uploaded files
      Object.entries(uploadedFiles).forEach(([fieldName, file]) => {
        if (file) {
          formDataToSend.append(fieldName, file);
        }
      });

      // Add profile photo URL if no file uploaded
      if (!uploadedFiles.profilePhoto && formData.photoUrl) {
        formDataToSend.append("profilePhoto", formData.photoUrl);
      }

      const response = await api.post(
        "/employee/onboarding-form",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Form submitted successfully:", response);
      console.log("Setting success message and redirecting...");
      setSuccess(
        "Form submitted successfully! Redirecting to awaiting approval page..."
      );
      console.log("Success message set, will redirect in 3 seconds...");

      // Redirect to awaiting approval page after successful submission
      setTimeout(() => {
        console.log("Redirecting to awaiting approval page...");
        window.location.href = "/awaiting-approval";
      }, 3000); // Increased to 3 seconds to ensure message is visible
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Debug Info */}
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
          <h4 className="font-semibold text-yellow-800">Debug Info:</h4>
          <p className="text-sm text-yellow-700">
            User Type: {user?.employee_type || "Not set"}
            <br />
            Uploaded Files Count:{" "}
            {Object.values(uploadedFiles).filter((f) => f).length}
            <br />
            Form Data Keys: {Object.keys(formData).join(", ")}
          </p>
        </div>

        {/* Loading Overlay */}
        {saving && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">
                Submitting your form...
              </p>
              <p className="text-gray-500 text-sm">
                Please wait while we save your information.
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl">
            <div className="bg-green-500 border border-green-600 rounded-lg p-4 shadow-lg animate-pulse">
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
                      🎉 Form Submitted Successfully!
                    </p>
                    <p className="text-green-100 text-sm font-medium">
                      {success}
                    </p>
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

        {/* Success Message - Prominent Display */}
        {success && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800">
                  🎉 Form Submitted Successfully!
                </h3>
                <p className="text-green-700 mt-1">{success}</p>
                <p className="text-green-600 text-sm mt-2">
                  You will be redirected to the approval page in a few
                  seconds...
                </p>
              </div>
            </div>
          </div>
        )}

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
                <svg
                  className="w-4 h-4"
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
                    handleInputChange(
                      "personalInfo",
                      "firstName",
                      e.target.value
                    )
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
                    handleInputChange(
                      "personalInfo",
                      "lastName",
                      e.target.value
                    )
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
                      formData.personalInfo?.emergencyContact?.relationship ||
                      ""
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
                    handleInputChange(
                      "bankInfo",
                      "accountNumber",
                      e.target.value
                    )
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
            </div>
          )}

          {/* Profile Photo - Always Visible */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-medium text-gray-900 mb-4">
              Profile Photo *
            </h3>
            <div>
              <label className="form-label">Upload Profile Photo</label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFileChange("profilePhoto", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.profilePhoto && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.profilePhoto)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("profilePhoto")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.profilePhoto && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.profilePhoto}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Accepted formats: JPG, PNG. Max size: 5MB
              </p>
            </div>
          </div>

          {/* Document Uploads - Always Visible */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-medium text-gray-900 mb-4">
              Document Uploads
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please upload the required documents. All files should be in PDF,
              DOC, DOCX, JPG, or PNG format with a maximum size of 5MB.
            </p>

            {/* Aadhar Document */}
            <div className="mb-4">
              <label className="form-label">
                Aadhar Document <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    handleFileChange("aadharDocument", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.aadharDocument && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.aadharDocument)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("aadharDocument")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.aadharDocument && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.aadharDocument}
                </p>
              )}
            </div>

            {/* PAN Document */}
            <div className="mb-4">
              <label className="form-label">
                PAN Document <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    handleFileChange("panDocument", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.panDocument && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.panDocument)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("panDocument")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.panDocument && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.panDocument}
                </p>
              )}
            </div>

            {/* 10th Marksheet */}
            <div className="mb-4">
              <label className="form-label">
                10th Marksheet <span className="text-gray-500">(Optional)</span>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    handleFileChange("tenthMarksheet", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.tenthMarksheet && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.tenthMarksheet)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("tenthMarksheet")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.tenthMarksheet && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.tenthMarksheet}
                </p>
              )}
            </div>

            {/* 12th Marksheet */}
            <div className="mb-4">
              <label className="form-label">
                12th Marksheet <span className="text-gray-500">(Optional)</span>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    handleFileChange("twelfthMarksheet", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.twelfthMarksheet && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.twelfthMarksheet)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("twelfthMarksheet")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.twelfthMarksheet && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.twelfthMarksheet}
                </p>
              )}
            </div>

            {/* Degree Certificate */}
            <div className="mb-4">
              <label className="form-label">
                Degree Certificate{" "}
                <span className="text-gray-500">(Optional)</span>
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    handleFileChange("degreeCertificate", e.target.files[0])
                  }
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadedFiles.degreeCertificate && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {getFileDisplayName(uploadedFiles.degreeCertificate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile("degreeCertificate")}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {fileUploadErrors.degreeCertificate && (
                <p className="mt-1 text-sm text-red-600">
                  {fileUploadErrors.degreeCertificate}
                </p>
              )}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Required Documents:</span>{" "}
                Profile Photo, Aadhar Document, PAN Document
                <br />
                <span className="font-semibold">Optional Documents:</span> 10th
                Marksheet, 12th Marksheet, Degree Certificate
                <br />
                <span className="font-semibold">Accepted Formats:</span> PDF,
                DOC, DOCX, JPG, PNG |{" "}
                <span className="font-semibold">Max Size:</span> 5MB per file
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="submit"
              disabled={saving}
              className={`px-8 py-3 text-lg font-medium rounded-lg transition-all duration-200 ${
                saving
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              }`}
            >
              {saving ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                "Submit Form"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
