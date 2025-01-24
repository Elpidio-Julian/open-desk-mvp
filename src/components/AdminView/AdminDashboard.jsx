import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import TeamManagement from './TeamManagement';
import AdminAnalytics from './AdminAnalytics';
import RoutingSettings from './RoutingSettings';

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
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teams">Team Management</TabsTrigger>
            <TabsTrigger value="routing">Routing Rules</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="space-y-4">
            <TeamManagement />
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <RoutingSettings />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-4">Team Performance</h3>
                <AdminAnalytics />
              </div>
            </Card>
          </TabsContent>
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