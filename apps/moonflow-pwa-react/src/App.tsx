import { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router/router';
import { StateProvider } from './state/store';

// #phone-frame is static chrome, unrelated to routing. #app-content lives
// inside RootLayout (router/router.tsx), not here — it has to sit alongside
// TabBar as a sibling, not a parent, or TabBar (fixed, anchored to
// #phone-frame's own transform) would scroll away with #app-content's own
// internal overflow instead of staying pinned. See index.css's #phone-frame
// comment for the full mechanism.
function App() {
  const [router] = useState(() => createAppRouter());

  return (
    <StateProvider>
      <div id="phone-frame">
        <RouterProvider router={router} />
      </div>
    </StateProvider>
  );
}

export default App;
