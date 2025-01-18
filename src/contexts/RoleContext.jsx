import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const RoleContext = createContext();

export const RoleProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId) => {
    if (!userId) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setUserRole(data?.role || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserRole(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    userRole,
    setUserRole,
    loading,
    fetchUserRole
  };

  if (loading) {
    return <div>Loading role...</div>;
  }

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};

export default RoleContext; 