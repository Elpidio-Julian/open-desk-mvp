import React from 'react';
import AdminView from '../components/AdminView/AdminView';
import AgentView from '../components/AgentView/AgentView';
import CustomerView from '../components/CustomerView/CustomerView';

const Dashboard = () => {
  // TODO: Get user role from context
  const userRole = 'customer'; // This will be dynamic

  const renderDashboard = () => {
    switch (userRole) {
      case 'admin':
        return <AdminView />;
      case 'agent':
        return <AgentView />;
      case 'customer':
        return <CustomerView />;
      default:
        return <div>Access Denied</div>;
    }
  };

  return (
    <div className="dashboard">
      {renderDashboard()}
    </div>
  );
};

export default Dashboard; 