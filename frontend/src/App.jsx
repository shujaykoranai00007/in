import DashboardView from "./components/DashboardView";
import LoginView from "./components/LoginView";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { isAuthenticated, login, logout, user, instagramStatus } = useAuth();

  if (!isAuthenticated) {
    return <LoginView onLogin={login} />;
  }

  return <DashboardView user={user} onLogout={logout} instagramStatus={instagramStatus} />;
}

export default App;
