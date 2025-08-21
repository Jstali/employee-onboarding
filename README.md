# Employee Onboarding Application

A comprehensive full-stack employee onboarding solution with role-based access control, dynamic forms, and automated workflows.

## 🚀 Features

### Roles & Permissions

- **Admin**: Full system access, HR user management, system monitoring
- **HR**: Employee management, approvals, manager assignment, email notifications
- **Employee**: Form completion, profile management, status tracking

### Employee Types

- **Intern**: Basic personal, bank, identity, and education information
- **Contract**: All intern fields + work experience and contract period
- **Full-time**: All intern fields + join date and passport number

### Core Functionality

- Opaque token-based authentication
- Dynamic form generation based on employee type
- Email notifications for employee credentials
- Manager assignment system
- Real-time form progress tracking
- Comprehensive audit logging
- Role-based dashboard interfaces

## 🛠️ Technology Stack

### Backend

- **Node.js** with Express.js
- **PostgreSQL** database
- **Opaque token** authentication
- **Nodemailer** for email services
- **Bcrypt.js** for password hashing
- **Rate limiting** and security middleware

### Frontend

- **React.js** with JavaScript
- **Tailwind CSS** for styling
- **React Router DOM** for routing
- **Axios** for API communication
- **Heroicons** for UI icons
- **Responsive design** for all devices

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd employee-onboarding
```

### 2. Database Setup

1. Create a PostgreSQL database named `lastdb`
2. Update the database connection in `backend/config.env`:

```env
DB_HOST=localhost
DB_PORT=5434
DB_NAME=lastdb
DB_USER=postgres
DB_PASSWORD=Stali
```

### 3. Backend Setup

```bash
cd backend
npm install
```

Update `config.env` with your email settings:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 4. Frontend Setup

```bash
cd ../frontend
npm install
```

### 5. Environment Variables

Create `.env` file in frontend directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 🏃‍♂️ Running the Application

### Start Backend

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm start
```

Frontend will run on `http://localhost:3000`

## 🔐 Default Credentials

### Admin Account

- **Email**: admin@company.com
- **Password**: admin123

### HR & Employee Accounts

- Create via Admin Panel (HR users)
- HR creates employee accounts with auto-generated passwords

## 📚 API Documentation

### Backend Routes

```
/api/auth          - Authentication (login, logout, profile)
/api/admin         - Admin operations (HR management, statistics)
/api/hr            - HR operations (employee management)
/api/employee      - Employee operations (form submission)
```

### Frontend Pages

- **Login**: Authentication for all users
- **Admin Dashboard**: HR user management, system statistics
- **HR Dashboard**: Employee creation, approval, management
- **Employee Dashboard**: Profile view, form progress
- **Onboarding Form**: Dynamic form based on employee type

## 🗄️ Database Schema

### Users Table

- Basic user information (id, name, email, password_hash)
- Role-based access control (admin, hr, employee)
- Employee type classification (intern, contract, fulltime)
- Status tracking (pending, approved, rejected)
- Manager relationships

### Employee Details Table

- Comprehensive employee information
- JSONB fields for flexible data storage
- Type-specific required fields

### Audit Logs Table

- Complete action tracking
- User activity monitoring
- Security and compliance support

## 📧 Email Configuration

### Email Service

Configure SMTP settings in `backend/config.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## 🔒 Security Features

### Security Settings

- Rate limiting: 100 requests per 15 minutes
- Token expiry: 24 hours
- Password hashing with bcrypt
- CORS protection
- Input validation and sanitization

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/change-password` - Change password

### Admin Operations

- `GET /api/admin/statistics` - System statistics
- `GET /api/admin/audit-logs` - Audit logs
- `POST /api/admin/hr-users` - Create HR user
- `GET /api/admin/hr-users` - List HR users
- `PUT /api/admin/hr-users/:id` - Update HR user
- `DELETE /api/admin/hr-users/:id` - Delete HR user

### HR Operations

- `POST /api/hr/employees` - Create employee
- `GET /api/hr/employees` - List employees
- `PUT /api/hr/employees/:id` - Update employee
- `PATCH /api/hr/employees/:id/status` - Approve/reject employee
- `PATCH /api/hr/employees/:id/manager` - Assign manager
- `GET /api/hr/managers` - List available managers

### Employee Operations

- `POST /api/employee/onboarding-form` - Submit form
- `GET /api/employee/onboarding-form` - Get form data
- `PATCH /api/employee/onboarding-form` - Update form
- `GET /api/employee/form-status` - Check completion status
- `GET /api/employee/profile` - Get profile information

## 🎨 UI/UX Features

### Design System

- **Colors**: Primary blue theme with semantic status colors
- **Typography**: Inter font family for modern readability
- **Components**: Reusable UI components with consistent styling
- **Status Indicators**: Visual feedback for all system states

### Status Indicators

- **Pending**: Yellow warning indicators
- **Approved**: Green success indicators
- **Rejected**: Red error indicators
- **Progress Bars**: Visual completion tracking

## 🧪 Testing

### Backend Testing

```bash
cd backend
npm test
```

### Frontend Testing

```bash
cd frontend
npm test
```

## 🚀 Production Deployment

### Production Build

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm start
```

### Environment Variables

Update production environment variables:

- Database connection strings
- Email service credentials
- API URLs and endpoints
- Security settings

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Verify PostgreSQL is running
   - Check database credentials in `config.env`
   - Ensure database `lastdb` exists

2. **Email Not Sending**

   - Verify SMTP credentials
   - Check email service configuration
   - Ensure network connectivity

3. **Frontend API Errors**

   - Verify backend is running on port 5000
   - Check CORS configuration
   - Validate API endpoint URLs

## 🤝 Contributing

For support and questions:

- Create an issue in the repository
- Contact the development team

## 📄 License

This project is licensed under the ISC License.

---

**Built with ❤️ for modern employee onboarding workflows**
