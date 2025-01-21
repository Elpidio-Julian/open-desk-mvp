import React from 'react';
import SupportQueue from '../../AgentView/SupportQueue';
import Header from '../Layout/Header';
import AppSidebar from '../Layout/AppSidebar';
import { SidebarProvider } from "../../ui/sidebar";

const SupportQueuePage = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <SupportQueue />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default SupportQueuePage; 