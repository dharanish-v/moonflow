// src/router/routes.tsx — replaces the hand-rolled router.js. Same
// GitHub-Pages-safe hash approach (a pretty path 404s on a static host with
// no rewrite rule; a hash never reaches the server), via HashRouter in
// App.tsx. pin-lock and onboarding are deliberately not routes here — see
// AppGate, which doesn't mount this tree at all while either gate is active.

import { Navigate, Route, Routes } from 'react-router-dom';
import { CalendarScreen } from '../screens/Calendar';
import { HomeScreen } from '../screens/Home';
import { InsightsScreen } from '../screens/Insights';
import { LogEntryScreen } from '../screens/LogEntry';
import { PinSetupScreen } from '../screens/PinSetup';
import { SettingsScreen } from '../screens/Settings';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/calendar" element={<CalendarScreen />} />
      <Route path="/insights" element={<InsightsScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/settings/pin-setup" element={<PinSetupScreen />} />
      <Route path="/log" element={<LogEntryScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
