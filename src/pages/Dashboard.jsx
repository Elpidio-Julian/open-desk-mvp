import React from 'react';
import AdminView from '../components/AdminView/AdminView';
import AgentView from '../components/AgentView/AgentView';
import CustomerView from '../components/CustomerView/CustomerView';
import Header from '../components/SharedComponents/Layout/Header';
import AppSidebar from '../components/SharedComponents/Layout/AppSidebar';
import { SidebarProvider } from "@/components/ui/sidebar";
import { useRole } from '../contexts/RoleContext';

const Dashboard = () => {
  const { userRole } = useRole();

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
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {renderDashboard()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard; 