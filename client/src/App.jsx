import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/admin/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/LoadingStates';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import HomePage from './pages/HomePage';

const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'));
const CoursePlayerPage = lazy(() => import('./pages/CoursePlayerPage'));
const SubmitResourcePage = lazy(() => import('./pages/SubmitResourcePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const CopyrightPage = lazy(() => import('./pages/CopyrightPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Admin shell — kept out of the public bundle and lazy-loaded like every page.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminResourcesPage = lazy(() => import('./pages/admin/AdminResourcesPage'));
const AdminResourceFormPage = lazy(() => import('./pages/admin/AdminResourceFormPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminAlternativesPage = lazy(() => import('./pages/admin/AdminAlternativesPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminLinkCheckerPage = lazy(() => import('./pages/admin/AdminLinkCheckerPage'));
const AdminImportExportPage = lazy(() => import('./pages/admin/AdminImportExportPage'));
const AdminAiSettingsPage = lazy(() => import('./pages/admin/AdminAiSettingsPage'));
const AdminSiteSettingsPage = lazy(() => import('./pages/admin/AdminSiteSettingsPage'));
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage'));

function withSuspense(element) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SiteSettingsProvider>
              <ToastProvider>
                <Routes>
                {/*
                  The admin panel lives outside the public <Layout /> on purpose:
                  it has its own sidebar/top bar and no marketing header, footer
                  or floating assistant. AdminRoute re-checks the ID token claim
                  before the shell is allowed to render.
                */}
                <Route
                  path="admin"
                  element={withSuspense(
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  )}
                >
                  <Route index element={withSuspense(<AdminDashboardPage />)} />
                  <Route path="resources" element={withSuspense(<AdminResourcesPage />)} />
                  <Route path="resources/new" element={withSuspense(<AdminResourceFormPage />)} />
                  <Route
                    path="resources/:id/edit"
                    element={withSuspense(<AdminResourceFormPage />)}
                  />
                  <Route path="categories" element={withSuspense(<AdminCategoriesPage />)} />
                  <Route path="alternatives" element={withSuspense(<AdminAlternativesPage />)} />
                  <Route path="users" element={withSuspense(<AdminUsersPage />)} />
                  <Route path="reviews" element={withSuspense(<AdminReviewsPage />)} />
                  <Route path="reports" element={withSuspense(<AdminReportsPage />)} />
                  <Route path="link-checker" element={withSuspense(<AdminLinkCheckerPage />)} />
                  <Route path="import-export" element={withSuspense(<AdminImportExportPage />)} />
                  <Route path="ai-settings" element={withSuspense(<AdminAiSettingsPage />)} />
                  {/* Old bookmarks keep working after the route rename. */}
                  <Route path="ai" element={<Navigate to="/admin/ai-settings" replace />} />
                  <Route path="site-settings" element={withSuspense(<AdminSiteSettingsPage />)} />
                  {/* Old bookmarks keep working after the route rename. */}
                  <Route path="settings" element={<Navigate to="/admin/site-settings" replace />} />
                  <Route path="audit-log" element={withSuspense(<AdminAuditLogPage />)} />
                  {/* Unknown admin URLs fall back to the dashboard, not the public 404. */}
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Route>

                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="explore" element={withSuspense(<ExplorePage />)} />
                  <Route path="courses" element={withSuspense(<ExplorePage fixedType="course" />)} />
                  <Route path="books" element={withSuspense(<ExplorePage fixedType="book" />)} />
                  <Route path="software" element={withSuspense(<ExplorePage fixedType="software" />)} />
                  <Route path="search" element={withSuspense(<SearchPage />)} />
                  <Route path="resource/:id" element={withSuspense(<ResourceDetailPage />)} />
                  <Route path="course/:id" element={withSuspense(<CoursePlayerPage />)} />
                  <Route path="assistant" element={withSuspense(<AssistantPage />)} />
                  <Route path="about" element={withSuspense(<AboutPage />)} />
                  <Route path="contact" element={withSuspense(<ContactPage />)} />
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
                  <Route path="*" element={withSuspense(<NotFoundPage />)} />
                </Route>
                </Routes>
              </ToastProvider>
            </SiteSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
