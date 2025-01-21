import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminPage from './components/AdminView/pages/AdminPage';
import SupportQueuePage from './components/SharedComponents/pages/SupportQueuePage';
import MyTicketsPage from './components/SharedComponents/pages/MyTicketsPage';
import { AuthProvider } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { useAuth } from './contexts/AuthContext';
import { useRole } from './contexts/RoleContext';

// Protected route wrapper with role check
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  const { userRole } = useRole();
  
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && userRole !== requiredRole) return <Navigate to="/dashboard" />;
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-tickets"
        element={
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support-queue"
        element={
          <ProtectedRoute>
            <SupportQueuePage />
          </ProtectedRoute>
        }
      />

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <AppRoutes />
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
