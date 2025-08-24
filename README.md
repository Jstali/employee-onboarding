# 🚀 Employee Onboarding Application

A comprehensive full-stack application for managing employee onboarding processes with role-based access control, dynamic forms, and master employee management.

## ✨ Features

### 🔐 Authentication & Authorization

- **Opaque Token Authentication** (not JWT)
- **Role-Based Access Control** with three roles:
  - **Admin**: Full system access, user management, audit logs
  - **HR**: Employee management, onboarding approval, forms management
  - **Employee**: Self-service onboarding, profile viewing

### 👥 Employee Management

- **Dynamic Onboarding Forms** based on employee type (Intern, Contract, Full-time)
- **Multi-step Form Process** with validation
- **Document Upload Support** (photos, certificates)
- **Manager Assignment** system
- **Status Tracking** (Pending, Approved, Rejected)

### 📊 Master Employee Table (NEW!)

- **Comprehensive Employee Database** with all employee information
- **Advanced Filtering** by type, role, department, status
- **Search Functionality** across name and email
- **Full CRUD Operations** for HR and Admin
- **Bulk Import** of existing employees
- **Department Management**
- **Manager Hierarchy** tracking

### 📧 Communication

- **Automated Email Notifications** using Nodemailer
- **Gmail Integration** with real credentials
- **Employee Credential Delivery**
- **Status Update Notifications**

### 🔍 Audit & Monitoring

- **Comprehensive Audit Logging** for all actions
- **User Activity Tracking**
- **Security Event Monitoring**
- **Admin Dashboard** with system statistics

## 🛠️ Technology Stack

### Backend

- **Node.js** with Express.js framework
- **PostgreSQL** database with JSONB support
- **Bcrypt.js** for password hashing
- **Nodemailer** for email services
- **Custom authentication middleware**

### Frontend

- **React.js** with modern hooks
- **Tailwind CSS** for responsive design
- **React Router** for navigation
- **Axios** for API communication
- **Heroicons** for beautiful icons

## 🗄️ Database Schema

### Core Tables

- `users` - User accounts and authentication
- `employee_details` - Onboarding form data
- `audit_logs` - System activity tracking
- `master_employees` - **NEW!** Comprehensive employee database

### Master Employees Table Structure

```sql
CREATE TABLE master_employees (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  employee_type VARCHAR(20) CHECK (employee_type IN ('intern','contract','fulltime')),
  role VARCHAR(20) CHECK (role IN ('employee','manager','hr','admin')),
  status VARCHAR(20) DEFAULT 'active',
  department VARCHAR(50),
  join_date DATE,
  manager_id INT REFERENCES master_employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- Gmail account for email functionality

### 1. Clone Repository

```bash
git clone https://github.com/Jstali/employee-onboarding.git
cd employee-onboarding
```

### 2. Backend Setup

```bash
cd backend
npm install

# Configure environment variables
cp config.env.example config.env
# Edit config.env with your database and email credentials

# Start backend server
npm start
# Server runs on http://localhost:5047
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API URL

# Start frontend development server
npm start
# Frontend runs on http://localhost:5180
```

### 4. Database Setup

```bash
# The application will automatically create tables on first run
# Ensure PostgreSQL is running and accessible
```

## 🔧 Configuration

### Backend Environment Variables (`backend/config.env`)

```env
PORT=5047
FRONTEND_URL=http://localhost:5180
DB_HOST=localhost
DB_PORT=5434
DB_NAME=lastdb
DB_USER=postgres
DB_PASSWORD=Stali
EMAIL_USER=your-alpha@nxzen.com
EMAIL_PASS=kmjaovdpjpwaggkt 
```

### Frontend Environment Variables (`frontend/.env`)

```env
PORT=5180
REACT_APP_API_URL=http://localhost:5047/api
```

## 📱 User Interface

### Admin Dashboard

- **System Statistics** overview
- **User Management** interface
- **Audit Logs** viewer
- **Employee Import** functionality
- **Master Employee Table** access

### HR Dashboard

- **Employee Creation** and management
- **Onboarding Approval** workflow
- **Forms Management** (view, edit, delete)
- **Manager Assignment** system
- **Master Employee Table** access

### Employee Portal

- **Dynamic Onboarding Forms**
- **Profile Management**
- **Status Tracking**
- **Document Upload**

### Master Employee Table (NEW!)

- **Advanced Filtering** and search
- **Bulk Operations** support
- **Department Management**
- **Manager Hierarchy** visualization
- **Export Capabilities**

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Admin Routes

- `GET /api/admin/statistics` - System statistics
- `GET /api/admin/users` - User management
- `GET /api/admin/audit-logs` - Audit logs
- `POST /api/admin/import-employees` - **NEW!** Import employees

### HR Routes

- `GET /api/hr/employees` - Employee list
- `POST /api/hr/employees` - Create employee
- `PATCH /api/hr/employees/:id/status` - Update status
- `PATCH /api/hr/employees/:id/manager` - Assign manager
- `GET /api/hr/employee-forms` - Forms management
- `GET /api/hr/managers` - Available managers

### Master Employee Routes (NEW!)

- `GET /api/master` - List all employees with filters
- `GET /api/master/:id` - Get employee profile
- `POST /api/master` - Add new employee
- `PUT /api/master/:id` - Update employee
- `DELETE /api/master/:id` - Deactivate employee
- `GET /api/master/departments/list` - Get departments
- `GET /api/master/profile` - Get own profile (employees)

### Employee Routes

- `GET /api/employee/form` - Get onboarding form
- `POST /api/employee/form` - Submit onboarding form
- `PATCH /api/employee/form` - Update onboarding form

## 🔒 Security Features

- **Opaque Token Authentication**
- **Role-Based Access Control**
- **Password Hashing** with bcrypt
- **Input Validation** and sanitization
- **Rate Limiting** on API endpoints
- **Audit Logging** for all actions
- **CORS Protection**

## 📧 Email Integration

### Gmail Setup

1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password in `EMAIL_PASS`

### Email Templates

- **Welcome Emails** with credentials
- **Status Update Notifications**
- **Manager Assignment** notifications
- **System Alerts**

## 🚀 Deployment

### Production Considerations

- Use environment variables for all secrets
- Set up proper CORS origins
- Configure production database
- Set up SSL/TLS certificates
- Configure production email service
- Set up monitoring and logging

### Docker Support (Coming Soon)

- Multi-stage builds
- Environment-specific configurations
- Health checks
- Volume management

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

### API Testing

```bash
# Use tools like Postman or curl
curl -X POST http://localhost:5047/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nxzen.com","password":"admin123"}'
```

## 📊 Monitoring & Analytics

- **Audit Logs** for compliance
- **User Activity** tracking
- **Performance Metrics**
- **Error Logging** and alerting
- **Database Query** optimization

## 🔄 Workflow

### Employee Onboarding Process

1. **HR Creates** employee account
2. **Employee Receives** credentials via email
3. **Employee Completes** onboarding form
4. **HR Reviews** and approves/rejects
5. **System Updates** master employee table
6. **Employee Gains** access to system

### Master Employee Management

1. **HR/Admin Views** master employee table
2. **Filters and Searches** for specific employees
3. **Updates Employee** information
4. **Assigns Managers** and departments
5. **Tracks Changes** in audit logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the code examples

## 🔮 Future Enhancements

- **Mobile App** support
- **Advanced Reporting** and analytics
- **Integration** with HR systems
- **Workflow Automation**
- **Multi-language** support
- **Advanced Search** and filtering
- **Bulk Operations** for data management
- **API Rate Limiting** improvements
- **Real-time Notifications**
- **Advanced Security** features

---

**Built with ❤️ using modern web technologies**
