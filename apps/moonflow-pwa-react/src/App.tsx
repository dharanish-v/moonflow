import { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router/router';
import { StateProvider } from './state/store';

// #phone-frame/#app-content are static chrome, unrelated to routing.
// RouterProvider renders the route tree starting at the root route — see
// router/router.tsx's RootLayout for what actually sits "inside" here
// (AppGate deciding splash/lock/onboarding vs. the real screens + TabBar).
function App() {
  const [router] = useState(() => createAppRouter());

  return (
    <StateProvider>
      <div id="phone-frame">
        <main id="app-content">
          <RouterProvider router={router} />
        </main>
      </div>
    </StateProvider>
  );
}

export default App;
