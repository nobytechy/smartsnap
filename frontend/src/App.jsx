import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { loadSettings } from '@/lib/settings';
import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login.jsx';
import Live from '@/pages/Live.jsx';
import AppShell from '@/pages/AppShell.jsx';
import RequireAuth from '@/components/RequireAuth.jsx';

export default function App() {
  const [bootState, setBootState] = useState('loading');

  useEffect(() => {
    loadSettings()
      .then(() => setBootState('ready'))
      .catch((err) => {
        console.error('[boot] failed to load app_settings', err);
        setBootState('ready');
      });
  }, []);

  if (bootState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-ink-950 text-ink-300">
        <div className="text-sm">Loading SmartSnap…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/live" element={<Live />} />
      <Route
        path="/app/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
