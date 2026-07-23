import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import UeberzahlungsbearbeitungPage from '@/pages/UeberzahlungsbearbeitungPage';
import UeberzahlungsbearbeitungDetailPage from '@/pages/UeberzahlungsbearbeitungDetailPage';
import ForderungserfassungPage from '@/pages/ForderungserfassungPage';
import ForderungserfassungDetailPage from '@/pages/ForderungserfassungDetailPage';
import DebitorPage from '@/pages/DebitorPage';
import DebitorDetailPage from '@/pages/DebitorDetailPage';
import PublicFormUeberzahlungsbearbeitung from '@/pages/public/PublicForm_Ueberzahlungsbearbeitung';
import PublicFormForderungserfassung from '@/pages/public/PublicForm_Forderungserfassung';
import PublicFormDebitor from '@/pages/public/PublicForm_Debitor';
// <public:imports>
// </public:imports>
// <custom:imports>
const ForderungErfassenPage = lazy(() => import('@/pages/intents/ForderungErfassenPage'));
const UeberzahlungBearbeitenPage = lazy(() => import('@/pages/intents/UeberzahlungBearbeitenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a61dc5ba21f30738c093acf" element={<PublicFormUeberzahlungsbearbeitung />} />
              <Route path="public/6a61dc5ba2d980b0b5e2eba6" element={<PublicFormForderungserfassung />} />
              <Route path="public/6a61dc5ba6b5f055c1d1f5f9" element={<PublicFormDebitor />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="ueberzahlungsbearbeitung" element={<UeberzahlungsbearbeitungPage />} />
                <Route path="ueberzahlungsbearbeitung/:id" element={<UeberzahlungsbearbeitungDetailPage />} />
                <Route path="forderungserfassung" element={<ForderungserfassungPage />} />
                <Route path="forderungserfassung/:id" element={<ForderungserfassungDetailPage />} />
                <Route path="debitor" element={<DebitorPage />} />
                <Route path="debitor/:id" element={<DebitorDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/forderung-erfassen" element={<Suspense fallback={null}><ForderungErfassenPage /></Suspense>} />
                <Route path="intents/ueberzahlung-bearbeiten" element={<Suspense fallback={null}><UeberzahlungBearbeitenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
