import { HashRouter } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { AppGate } from './router/AppGate';
import { AppRoutes } from './router/routes';
import { StateProvider } from './state/store';

// AppGate decides lock/onboarding vs. real routes, and also mounts
// WorldScene (ADR-035's persistent app-wide 3D scene) — see AppGate.tsx for
// why that lives there, not here, and not per-screen; TabBar decides its
// own visibility per-route (see its SCREENS_WITH_TAB_BAR allow-list).
function AppShell() {
  return (
    <>
      <AppRoutes />
      <TabBar />
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <StateProvider>
        <div id="phone-frame">
          <main id="app-content">
            <AppGate>
              <AppShell />
            </AppGate>
          </main>
        </div>
      </StateProvider>
    </HashRouter>
  );
}

export default App;
