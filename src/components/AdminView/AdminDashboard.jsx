import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
            <Card>
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-4">Teams</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Input placeholder="Team Name" />
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Focus Area" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="billing">Billing Support</SelectItem>
                        <SelectItem value="general">General Support</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="secondary">Add Team</Button>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Technical Support Team</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Select>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Add Agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent1">John Doe</SelectItem>
                            <SelectItem value="agent2">Jane Smith</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select Skills" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="database">Database</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline">Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="routing" className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-4">Routing Rules</h3>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Rule-Based Assignment</h4>
                    <div className="space-y-2">
                      <Select>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select Property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="priority">Priority</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                          <SelectItem value="language">Language</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Assign To Team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">Technical Support</SelectItem>
                          <SelectItem value="billing">Billing Support</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="secondary">Add Rule</Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Load Balancing</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input type="number" placeholder="Max tickets per agent" />
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Time Zone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="est">EST</SelectItem>
                            <SelectItem value="pst">PST</SelectItem>
                            <SelectItem value="utc">UTC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="secondary">Update Settings</Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-4">Team Performance</h3>
                <div className="text-muted-foreground">Analytics dashboard coming soon...</div>
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