import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '@/pages/login-page'
import { ProtectedLayout } from '@/components/protected-layout'
import { DashboardHome } from '@/pages/dashboard-home'
import { ZoneConfigPage } from '@/pages/zone-config-page'
import { ZoneDashboard } from '@/pages/zone-dashboard'
import { KioskManagementPage } from '@/pages/kiosk-management-page'
import { TokenManagementPage } from '@/pages/token-management-page'
import { ExportPage } from '@/pages/export-page'
import { MDCrossZoneView } from '@/pages/md-cross-zone-view'
import { MDSectionHeatmap } from '@/pages/md-section-heatmap'
import { MDTrendAnalysis } from '@/pages/md-trend-analysis'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/"              element={<DashboardHome />} />
          <Route path="/zones"         element={<ZoneConfigPage />} />
          <Route path="/zones/:zoneId" element={<ZoneDashboard />} />
          <Route path="/kiosks"        element={<KioskManagementPage />} />
          <Route path="/tokens"        element={<TokenManagementPage />} />
          <Route path="/export"        element={<ExportPage />} />
          <Route path="/md-view"          element={<MDCrossZoneView />} />
          <Route path="/md-view/heatmap" element={<MDSectionHeatmap />} />
          <Route path="/md-view/trends" element={<MDTrendAnalysis />} />
        </Route>
        <Route path="*" element={
          <div className="flex h-screen items-center justify-center text-muted-foreground">
            Page not found.
          </div>
        } />
      </Routes>
    </BrowserRouter>
  )
}
