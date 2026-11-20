import { Navigate, Outlet, Route } from "react-router-dom";
import { G12AuthProvider } from "./auth";
import { G12Layout } from "./G12Layout";
import { G12Protected } from "./G12Protected";
import G12AdminsPage from "./pages/AdminsPage";
import G12AiPage from "./pages/AiPage";
import G12AnnouncementsPage from "./pages/AnnouncementsPage";
import G12AuditPage from "./pages/AuditPage";
import G12ContentPage from "./pages/ContentPage";
import G12DashboardPage from "./pages/DashboardPage";
import G12LoginPage from "./pages/LoginPage";
import G12PaymentsPage from "./pages/PaymentsPage";
import G12PromoPage from "./pages/PromoPage";
import G12ReviewPage from "./pages/ReviewPage";
import G12SettingsPage from "./pages/SettingsPage";
import G12StudentsPage from "./pages/StudentsPage";
import G12SystemPage from "./pages/SystemPage";

function G12Root() {
  return (
    <G12AuthProvider>
      <Outlet />
    </G12AuthProvider>
  );
}

export const g12Routes = (
  <Route path="/12" element={<G12Root />}>
    <Route path="login" element={<G12LoginPage />} />
    <Route element={<G12Protected><G12Layout /></G12Protected>}>
      <Route index element={<G12DashboardPage />} />
      <Route path="students" element={<G12StudentsPage />} />
      <Route path="payments" element={<G12Protected role="admin"><G12PaymentsPage /></G12Protected>} />
      <Route path="settings" element={<G12Protected role="admin"><G12SettingsPage /></G12Protected>} />
      <Route path="promo" element={<G12Protected role="admin"><G12PromoPage /></G12Protected>} />
      <Route path="announcements" element={<G12Protected role="admin"><G12AnnouncementsPage /></G12Protected>} />
      <Route path="ai" element={<G12Protected role="admin"><G12AiPage /></G12Protected>} />
      <Route path="content" element={<G12Protected role="editor"><G12ContentPage /></G12Protected>} />
      <Route path="review" element={<G12Protected role="editor"><G12ReviewPage /></G12Protected>} />
      <Route path="audit" element={<G12Protected role="admin"><G12AuditPage /></G12Protected>} />
      <Route path="system" element={<G12SystemPage />} />
      <Route path="admins" element={<G12Protected role="owner"><G12AdminsPage /></G12Protected>} />
      <Route path="*" element={<Navigate to="/12" replace />} />
    </Route>
  </Route>
);
