// Feature configuration for Employee Onboarding System
const features = {
  HRManagementTable: {
    showEmployeeForms: true,
    removeActionColumn: true
  },
  Sidebar: {
    removeEmployeeFormOption: true
  },
  EmployeeLoginAndFormSubmission: {
    allowLoginWithoutHRApproval: true,
    submittedDataFlow: "HRManagementTable"
  },
  OnboardingProcess: {
    afterApprovalMoveTo: "OnboardedEmployee",
    assignFields: [
      "EmployeeID",
      "CompanyEmail",
      "Manager"
    ]
  },
  EmployeeMasterTable: {
    afterOnboardingMoveTo: "EmployeeMasterTable"
  }
};

module.exports = features;
