#!/bin/bash

echo "🚀 Starting Employee Onboarding Application..."

# Check if PostgreSQL is running
echo "📊 Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5434 -U postgres -d lastdb > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running or not accessible on port 5434"
    echo "Please ensure PostgreSQL is running and accessible with:"
    echo "  - Host: localhost"
    echo "  - Port: 5434"
    echo "  - Database: lastdb"
    echo "  - User: postgres"
    echo "  - Password: Stali"
    exit 1
fi
echo "✅ PostgreSQL connection successful"

# Start backend
echo "🔧 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend application..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "✅ Both services are starting..."
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"
echo "📊 Health Check: http://localhost:5000/health"
echo ""
echo "🔐 Default Admin Login:"
echo "  Email: admin@company.com"
echo "  Password: admin123"
echo ""
echo "Press Ctrl+C to stop both services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
