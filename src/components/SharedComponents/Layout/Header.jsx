import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { RoleContext } from '../../../contexts/RoleContext';

const Header = () => {
  const { userRole } = useContext(RoleContext);

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-800">
              ZenDesk Clone
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            {userRole === 'customer' && (
              <Link to="/tickets" className="text-gray-600 hover:text-gray-900">
                My Tickets
              </Link>
            )}
            <button className="text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 