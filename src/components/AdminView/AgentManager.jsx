import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Loader2, Mail, Search } from 'lucide-react';
import { supabase } from '../../services/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export default function AgentManager() {
  const [newAgent, setNewAgent] = useState({
    email: '',
    fullName: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      setAlert({
        variant: 'destructive',
        message: 'Failed to load users: ' + error.message
      });
    }
  };

  const handleSendInvite = async () => {
    try {
      setLoading(true);
      setAlert(null);

      // Send magic link
      const { data, error: authError } = await supabase.auth.signInWithOtp({
        email: newAgent.email,
        options: {
          data: {
            full_name: newAgent.fullName,
            app_role: 'agent',
            email: newAgent.email
          }
        }
      });

      if (authError) throw authError;

      // Clear form and show success message
      setNewAgent({ email: '', fullName: '' });
      setAlert({
        variant: 'default',
        message: 'Invitation sent successfully! The agent will receive an email with instructions.'
      });
      
      // Reload users list
      await loadUsers();
    } catch (error) {
      setAlert({
        variant: 'destructive',
        message: 'Failed to send invitation: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      setAlert(null);

      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setAlert({
        variant: 'default',
        message: 'Role updated successfully!'
      });
      
      // Reload users list
      await loadUsers();
    } catch (error) {
      setAlert({
        variant: 'destructive',
        message: 'Failed to update role: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'agent':
        return 'default';
      case 'customer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {alert && (
        <Alert variant={alert.variant}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invite New Agent</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              placeholder="Enter agent's full name"
              value={newAgent.fullName}
              onChange={(e) => setNewAgent(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="Enter agent's email"
              value={newAgent.email}
              onChange={(e) => setNewAgent(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <Button
            onClick={handleSendInvite}
            disabled={loading || !newAgent.email || !newAgent.fullName}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Invitation...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Manage Users</h3>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-2 border rounded-lg">
              <div>
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role}
                </Badge>
                <Select
                  value={user.role}
                  onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              No users found matching "{searchQuery}"
            </div>
          )}
        </div>
      </Card>
    </div>
  );
} 