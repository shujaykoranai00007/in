import { Suspense, lazy } from "react";
import { useAuth } from "./hooks/useAuth";

const DashboardView = lazy(() => import("./components/DashboardView"));
const LoginView = lazy(() => import("./components/LoginView"));

function AppShellLoader() {
  return (
    <div className="min-h-screen bg-grid px-4 py-10 text-slate-200">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-700/80" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-slate-700/60" />
        <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-700/50" />
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated, login, logout, user, instagramStatus } = useAuth();

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AppShellLoader />}>
        <LoginView onLogin={login} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AppShellLoader />}>
      <DashboardView user={user} onLogout={logout} instagramStatus={instagramStatus} />
    </Suspense>
  );
}

export default App;
