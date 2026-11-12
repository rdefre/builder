import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { Provider, getDefaultStore } from 'jotai';
import ProjectLoader from './ProjectLoader';
import './styles/globals.css';
import { subscribeBuilderTheme } from './editor/builder-theme';
import { CLOUD_ENABLED } from './shared/cloud-flag';
import { restoreLocalColorMode } from './backend/local-dashboard';

const LocalDashboard = lazy(() => import('./editor/dashboard/LocalDashboard'));
const showLocalDashboard = !CLOUD_ENABLED && /^\/dashboard\/?$/.test(window.location.pathname);
if (!CLOUD_ENABLED) restoreLocalColorMode();

// Restore the saved builder accent BEFORE the first paint (so a non-default
// theme doesn't flash the stock brass on reload) and keep it in sync with both
// the atom and the light/dark switch thereafter.
subscribeBuilderTheme();

// Bind <Provider> to the global default store so non-React code paths
// (e.g. the dev-only `__e2e` hook in ProjectLoader, mutation queue
// callbacks) can read/write the same atoms React subscribes to. Without
// `store=`, <Provider> creates a fresh scoped store and any
// `getDefaultStore()` call lands on a different instance — atom writes
// from one path become invisible to readers on the other.
createRoot(document.getElementById('root')!).render(
  <Provider store={getDefaultStore()}>
    {showLocalDashboard ? <Suspense fallback={null}><LocalDashboard /></Suspense> : <ProjectLoader />}
  </Provider>
);
