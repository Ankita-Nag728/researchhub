import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { BookOpen, FileText, FlaskConical, LayoutDashboard, Users } from "lucide-react";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingSpinner from "./components/LoadingSpinner";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Explore from "./pages/Explore";
import ProjectDetails from "./pages/ProjectDetails";
import ApplyPage from "./pages/ApplyPage";
import Papers from "./pages/Papers";
import { About, Contact, Privacy, Terms } from "./pages/StaticPages";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Overview from "./pages/dashboard/Overview";
import MyApplications from "./pages/dashboard/MyApplications";
import Saved from "./pages/dashboard/Saved";
import Profile from "./pages/dashboard/Profile";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminProjectForm from "./pages/admin/AdminProjectForm";
import AdminPapers from "./pages/admin/AdminPapers";
import AdminPaperForm from "./pages/admin/AdminPaperForm";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminUsers from "./pages/admin/AdminUsers";

// The style guide is loaded only in development and never ships to production.
const DesignSystem = import.meta.env.DEV ? lazy(() => import("./pages/DesignSystem")) : null;

const ADMIN_ITEMS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/projects", label: "Projects", icon: FlaskConical },
  { to: "/admin/papers", label: "Papers", icon: BookOpen },
  { to: "/admin/applications", label: "Applications", icon: FileText },
  { to: "/admin/users", label: "Users", icon: Users },
];

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="explore" element={<Explore />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="papers" element={<Papers />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          {DesignSystem && <Route path="design-system" element={<DesignSystem />} />}

          {/* Applying needs a login; the visitor is sent back here afterwards. */}
          <Route element={<ProtectedRoute />}>
            <Route path="projects/:id/apply" element={<ApplyPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Student / researcher area (the backend re-checks every request). */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardLayout label="Dashboard" />}>
            <Route index element={<Overview />} />
            <Route path="applications" element={<MyApplications />} />
            <Route path="saved" element={<Saved />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Administrator area. */}
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="admin" element={<DashboardLayout items={ADMIN_ITEMS} label="Admin" />}>
            <Route index element={<AdminOverview />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="projects/new" element={<AdminProjectForm />} />
            <Route path="projects/:id/edit" element={<AdminProjectForm />} />
            <Route path="papers" element={<AdminPapers />} />
            <Route path="papers/new" element={<AdminPaperForm />} />
            <Route path="papers/:id/edit" element={<AdminPaperForm />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
