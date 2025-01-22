import React from 'react';
import AgentPerformanceMetrics from '../AgentPerformanceMetrics';
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from '../../SharedComponents/Layout/AppSidebar';
import Header from '../../SharedComponents/Layout/Header';

const AgentMetricsPage = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
              <AgentPerformanceMetrics />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AgentMetricsPage;
