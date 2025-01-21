import React from 'react';
import SupportQueue from '../components/AgentView/SupportQueue';
import Header from '../components/SharedComponents/Layout/Header';
import AppSidebar from '../components/SharedComponents/Layout/AppSidebar';
import { SidebarProvider } from "@/components/ui/sidebar";

const MyTickets = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <SupportQueue 
              isWidget={false}
              defaultView="my_tickets"
              hideViewSelector={true}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MyTickets; 