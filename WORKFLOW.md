# Employee Onboarding & Attendance Management System - Complete Workflow

## 📋 **System Overview**

This system manages the complete lifecycle of employee onboarding, from initial creation by HR to attendance management after approval.

## 🔄 **Complete Workflow Diagram**

```
HR Creates Employee → Employee First Login → Password Change → Form Submission → HR Approval → Attendance Portal
       ↓                      ↓                ↓              ↓              ↓              ↓
   Email Sent          Forced Password    Onboarding    Awaiting HR      Employee      Daily Attendance
   (Credentials)       Change Page        Form Page     Approval        Onboarded     Management
```

## 🎯 **Phase 1: Employee Creation (HR)**

### **Step 1: HR Creates Employee**

- **Location**: HR Dashboard → "Create Employee" button
- **Required Fields**: Name, Email, Department, Employee Type, Join Date
- **What Happens**:
  - Employee record created in `users` table
  - Employee record created in `master_employees` table
  - Temporary password generated
  - Welcome email sent with login credentials
  - Status: `pending`, `form_submitted: false`, `onboarded: false`

### **Step 2: Email Delivery**

- **Recipient**: New employee's email address
- **Content**: Login credentials (email + temporary password)
- **Subject**: "Welcome to Nxzen - Your Login Credentials"

## 🚀 **Phase 2: Employee First Login**

### **Step 1: Initial Login**

- **URL**: `/login`
- **Credentials**: Email + temporary password
- **What Happens**:
  - Authentication successful
  - Token generated and stored
  - Redirected to password change page

### **Step 2: Password Change (Mandatory)**

- **URL**: `/change-password`
- **What Happens**:
  - Employee sets new password
  - `is_first_login` set to `false`
  - Redirected to onboarding form

## 📝 **Phase 3: Onboarding Form Submission**

### **Step 1: Form Display**

- **URL**: `/form`
- **What Happens**:
  - Form loads based on employee type (Intern/Contract/Full-time)
  - **Required fields**: Personal Info, Bank Info, Education Info
  - **Required Documents**: Profile Photo, Aadhar Document, PAN Document
  - **Optional Documents**: 10th Marksheet, 12th Marksheet, Degree Certificate
  - **File Support**: PDF, DOC, DOCX, JPG, PNG formats (max 5MB per file)

### **Step 2: Form Submission**

- **What Happens**:
  - Data saved to `employee_details` table
  - **Files uploaded to server** and stored in `/uploads` directory
  - File metadata saved to `employee_documents` table
  - `form_submitted` set to `true` in both tables
  - Success message displayed
  - Redirected to awaiting approval page

### **Step 3: Awaiting Approval**

- **URL**: `/awaiting-approval`
- **What Happens**:
  - Employee sees "Awaiting HR Approval" message
  - Cannot access attendance portal yet
  - Must wait for HR approval

## ✅ **Phase 4: HR Approval Process**

### **Step 1: HR Reviews Form**

- **Location**: HR Dashboard → "Employee Forms"
- **What HR Sees**:
  - List of all submitted forms
  - Form details (click eye button to view)
  - Employee status and submission date

### **Step 2: HR Approves Onboarding**

- **Location**: HR Dashboard → Employee List → "Approve Onboarding" button
- **What Happens**:
  - `onboarded` set to `true` in both tables
  - `status` set to `approved`
  - Approval email sent to employee
  - Employee can now access attendance portal

### **Step 3: Approval Email**

- **Recipient**: Employee's email
- **Content**: "Onboarding Approved - Welcome to Nxzen!"
- **Instructions**: Employee can now access Attendance Portal

## 🎯 **Phase 5: Employee Post-Approval**

### **Step 1: Next Login After Approval**

- **What Happens**:
  - Employee logs in with credentials
  - System checks `onboarded = true`
  - **Direct redirect to Attendance Portal** (`/attendance`)
  - **No more onboarding form access**

### **Step 2: Attendance Portal Access**

- **URL**: `/attendance`
- **Features**:
  - Mark daily attendance (Present, WFH, Leave)
  - View attendance calendar
  - Submit attendance once per day
  - Weekends auto-marked as holidays

## 🔧 **Technical Implementation Details**

### **Database Tables & Fields**

#### **`users` Table**

```sql
- id (UUID, Primary Key)
- name (VARCHAR)
- email (VARCHAR, Unique)
- password_hash (VARCHAR)
- role (ENUM: 'hr', 'employee')
- employee_type (ENUM: 'intern', 'contract', 'fulltime')
- status (ENUM: 'pending', 'approved', 'rejected')
- form_submitted (BOOLEAN, Default: false)
- onboarded (BOOLEAN, Default: false)
- is_first_login (BOOLEAN, Default: true)
- department (VARCHAR)
- join_date (DATE)
```

#### **`employee_details` Table**

```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users.id)
- personal_info (JSONB)
- bank_info (JSONB)
- education_info (JSONB)
- tech_certificates (JSONB)
- work_experience (JSONB)
- contract_period (JSONB)
- photo_url (TEXT)
- aadhar_number (VARCHAR)
- pan_number (VARCHAR)
- passport_number (VARCHAR)
- join_date (DATE)
```

#### **`master_employees` Table**

```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users.id)
- name (VARCHAR)
- email (VARCHAR)
- employee_type (VARCHAR)
- role (VARCHAR)
- status (VARCHAR)
- department (VARCHAR)
- join_date (DATE)
- manager_id (UUID)
- form_submitted (BOOLEAN, Default: false)
- onboarded (BOOLEAN, Default: false)
```

### **Frontend Routing Logic**

#### **Employee Routes (Status-Based)**

```javascript
// Form Route
/form → Only if !form_submitted
/awaiting-approval → Only if form_submitted && !onboarded
/attendance → Only if onboarded
/profile → Always accessible
```

#### **HR Routes**

```javascript
/hr → HR Dashboard
/hr/forms → Employee Forms Management
/hr/attendance → Attendance Dashboard
/master → Master Employee Table
```

### **Backend API Endpoints**

#### **Authentication**

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

#### **Employee Operations**

- `GET /api/employee/check-password-status` - Check if password change needed
- `POST /api/employee/change-password` - Change password
- `GET /api/employee/onboarding-form` - Get form requirements
- `POST /api/employee/onboarding-form` - Submit form
- `GET /api/employee/onboarding-status` - Get onboarding status

#### **HR Operations**

- `POST /api/hr/employees` - Create new employee
- `GET /api/hr/employees` - Get all employees
- `PUT /api/hr/employees/:id/onboard` - Approve employee onboarding
- `GET /api/hr/employee-forms` - Get submitted forms
- `GET /api/hr/employee-forms/:id` - Get specific form details

#### **Attendance Operations**

- `POST /api/attendance/mark` - Mark daily attendance
- `GET /api/attendance/my-attendance`
