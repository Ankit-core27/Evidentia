import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AppLayout} from '@/components/layout/AppLayout';
import {MacroLayout} from '@/components/layout/MacroLayout';
import {IntroSplash} from '@/components/layout/IntroSplash';
import {DashboardPage} from '@/routes/DashboardPage';
import {CasesPage} from '@/routes/CasesPage';
import {CaseWorkspacePage} from '@/routes/CaseWorkspacePage';
import {EvidencePage} from '@/routes/EvidencePage';
import {ReportsPage} from '@/routes/ReportsPage';
import {NotFoundPage} from '@/routes/NotFoundPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        element: <MacroLayout />,
        children: [
          {index: true, element: <DashboardPage />},
          {path: 'cases', element: <CasesPage />},
          {path: 'evidence', element: <EvidencePage />},
          {path: 'reports', element: <ReportsPage />},
          {path: '*', element: <NotFoundPage />},
        ],
      },
      {path: 'cases/:caseId/:module?', element: <CaseWorkspacePage />},
    ],
  },
]);

// In `npm run dev:mock` the API is served from memory by src/mocks. The dynamic
// import keeps the mock backend out of normal builds.
async function enableMocks() {
  if (import.meta.env.MODE !== 'mock') return;
  const {installMockBackend} = await import('@/mocks');
  await installMockBackend();
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <IntroSplash />
      </QueryClientProvider>
    </StrictMode>,
  );
});
