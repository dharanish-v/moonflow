import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './register-sw.ts'
import { announceUpdate } from './lib/update-signal.ts'
import { onDatabaseReplaced } from './lib/db.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker(announceUpdate)

// A newer build upgraded the database from another open copy — reload onto it.
onDatabaseReplaced(() => window.location.reload())
