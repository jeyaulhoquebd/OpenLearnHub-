import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/LoadingStates';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import HomePage from './pages/HomePage';

const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'));
const SubmitResourcePage = lazy(() => import('./pages/SubmitResourcePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const CopyrightPage = lazy(() => import('./pages/CopyrightPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function withSuspense(element) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="explore" element={withSuspense(<ExplorePage />)} />
                <Route path="courses" element={withSuspense(<ExplorePage fixedType="course" />)} />
                <Route path="books" element={withSuspense(<ExplorePage fixedType="book" />)} />
                <Route path="software" element={withSuspense(<ExplorePage fixedType="software" />)} />
                <Route path="resource/:id" element={withSuspense(<ResourceDetailPage />)} />
                <Route path="assistant" element={withSuspense(<AssistantPage />)} />
                <Route path="about" element={withSuspense(<AboutPage />)} />
                <Route path="login" element={withSuspense(<LoginPage />)} />
                <Route path="signup" element={withSuspense(<SignupPage />)} />
                <Route path="forgot-password" element={withSuspense(<ForgotPasswordPage />)} />
                <Route path="legal" element={<Navigate to="/legal/copyright" replace />} />
                <Route path="legal/copyright" element={withSuspense(<CopyrightPage />)} />
                <Route path="legal/terms" element={withSuspense(<TermsPage />)} />
                <Route path="legal/privacy" element={withSuspense(<PrivacyPage />)} />
                <Route
                  path="submit"
                  element={withSuspense(
                    <ProtectedRoute>
                      <SubmitResourcePage />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="dashboard"
                  element={withSuspense(
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  )}
                />
                <Route
                  path="admin"
                  element={withSuspense(
                    <ProtectedRoute adminOnly>
                      <AdminPage />
                    </ProtectedRoute>
                  )}
                />
                <Route path="*" element={withSuspense(<NotFoundPage />)} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
