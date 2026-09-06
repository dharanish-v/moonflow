import { HashRouter } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { AppGate } from './router/AppGate';
import { AppRoutes } from './router/routes';
import { StateProvider } from './state/store';

// AppGate decides lock/onboarding vs. real routes; TabBar decides its own
// visibility per-route (see its SCREENS_WITH_TAB_BAR allow-list).
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
