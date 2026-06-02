/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import PontoTerminal from "./components/PontoTerminal";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  const [view, setView] = useState<'terminal' | 'login' | 'dashboard'>('terminal');

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-200">
      {view === 'terminal' && (
        <PontoTerminal 
          onAdminAccess={() => setView('login')} 
        />
      )}

      {view === 'login' && (
        <AdminLogin 
          onLoginSuccess={() => setView('dashboard')} 
          onBackToTerminal={() => setView('terminal')} 
        />
      )}

      {view === 'dashboard' && (
        <AdminDashboard 
          onLogout={() => setView('terminal')} 
        />
      )}
    </div>
  );
}
