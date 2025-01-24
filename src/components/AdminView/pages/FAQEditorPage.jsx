import React from 'react';
import FAQEditor from '../FAQEditor';
import Header from '../../SharedComponents/Layout/Header';
import AppSidebar from '../../SharedComponents/Layout/AppSidebar';
import { SidebarProvider } from "../../ui/sidebar";

const FAQEditorPage = () => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <FAQEditor />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FAQEditorPage; 