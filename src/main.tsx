import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { SettingsProvider, useSettings } from './hooks/useSettings';
import './styles/globals.css';

function AppWithErrorBoundary() {
  const { resetSettings } = useSettings();
  return (
    <ErrorBoundary onReset={resetSettings}>
      <App />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <AppWithErrorBoundary />
    </SettingsProvider>
  </React.StrictMode>
);
