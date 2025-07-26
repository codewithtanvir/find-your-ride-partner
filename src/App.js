import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthForm from "./components/Auth/AuthForm";
import ProfileSetup from "./components/Profile/ProfileSetup";
import PostRide from "./components/Ride/PostRide";
import RideList from "./components/Ride/RideList";
import MyPosts from "./components/Ride/MyPosts";
import AdminDashboard from "./components/Admin/AdminDashboard";
import Navbar from "./components/Navigation/Navbar";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleRedirect = (path) => {
    navigate(path, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/find" replace /> : <AuthForm />}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfileSetup onDone={() => handleRedirect("/find")} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post"
            element={
              <ProtectedRoute>
                <PostRide onPosted={() => handleRedirect("/find")} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/find"
            element={
              <ProtectedRoute>
                <RideList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/myposts"
            element={
              <ProtectedRoute>
                <MyPosts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={<Navigate to={user ? "/find" : "/login"} replace />}
          />
          <Route
            path="*"
            element={<Navigate to={user ? "/find" : "/login"} replace />}
          />
        </Routes>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
