import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import TeamManagement from './TeamManagement';
import AdminAnalytics from './AdminAnalytics';
import RoutingSettings from './RoutingSettings';
import CustomFieldsManager from './CustomFieldsManager';
import AgentManager from './AgentManager';

const AdminDashboard = ({ 
  isWidget = false, 
  maxHeight,
  onClose,
  defaultTab = 'teams',
  hideTabs = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const containerStyle = {
    maxHeight: maxHeight || 'auto',
    overflow: 'auto',
    ...(isWidget && {
      border: '1px solid hsl(var(--border))',
      borderRadius: 'calc(var(--radius) * 1.5)',
    }),
  };

  const content = (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        {isWidget && onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {!hideTabs && (
        <Tabs defaultValue="team" className="w-full">
          <TabsList className="grid w-full grid-cols-5 gap-4">
            <TabsTrigger value="team">Team Management</TabsTrigger>
            <TabsTrigger value="agents">Agent Management</TabsTrigger>
            <TabsTrigger value="routing">Routing Rules</TabsTrigger>
            <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="team">
              <TeamManagement />
            </TabsContent>
            <TabsContent value="agents">
              <AgentManager />
            </TabsContent>
            <TabsContent value="routing">
              <RoutingSettings />
            </TabsContent>
            <TabsContent value="custom-fields">
              <CustomFieldsManager />
            </TabsContent>
            <TabsContent value="analytics">
              <Card>
                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-4">Team Performance</h3>
                  <AdminAnalytics />
                </div>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </>
  );

  if (isWidget) {
    return (
      <div style={containerStyle} className={`p-4 ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {content}
    </div>
  );
};

export default AdminDashboard; 