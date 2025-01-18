import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext.jsx';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { supabase } from './services/supabase';
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <RoleProvider>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </RoleProvider>
    </Router>
  );
}

export default App;
