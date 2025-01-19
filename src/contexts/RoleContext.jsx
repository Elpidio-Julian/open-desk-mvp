import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const RoleContext = createContext({});

export const RoleProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserRole(data?.role || 'customer'); // Default to customer if no role is set
      } catch (error) {
        console.error('Error fetching user role:', error.message);
        setUserRole('customer'); // Default to customer on error
      }
    };

    fetchUserRole();
  }, [user]);

  const value = {
    userRole,
    setUserRole, // Expose setUserRole for admin functionality
  };

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