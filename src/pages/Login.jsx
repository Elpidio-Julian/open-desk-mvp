import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useRole } from '../contexts/RoleContext';

const ADMIN_CODE = 'ADMIN123'; // Hardcoded for now, should be env variable

const Login = () => {
  const navigate = useNavigate();
  const { setUserRole } = useRole();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    isAdmin: false,
    adminCode: ''
  });

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setAlert(null);

      // Verify passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Verify password meets requirements (at least 6 characters)
      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Verify admin code if signing up as admin
      if (formData.isAdmin && formData.adminCode !== ADMIN_CODE) {
        throw new Error('Invalid admin code');
      }

      // Sign up with email and password
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            app_role: formData.isAdmin ? 'admin' : 'customer',
            email: formData.email
          }
        }
      });

      if (signUpError) throw signUpError;

      setAlert({
        variant: 'default',
        message: 'Check your email for the confirmation link!'
      });
      
    } catch (error) {
      setAlert({
        variant: 'destructive',
        message: 'Failed to sign up: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      setAlert(null);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) throw signInError;

      // Fetch user role after successful sign in
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', (await supabase.auth.getUser()).data.user.id)
        .single();

      if (roleError) throw roleError;
      setUserRole(userData.role);
      navigate('/dashboard');

    } catch (error) {
      setAlert({
        variant: 'destructive',
        message: 'Failed to login: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Welcome to Support Desk</h1>
        
        {alert && (
          <Alert variant={alert.variant}>
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <Button
              onClick={handleLogin}
              disabled={loading || !formData.email || !formData.password}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password (min. 6 characters)"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isAdmin"
                checked={formData.isAdmin}
                onChange={(e) => setFormData(prev => ({ ...prev, isAdmin: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isAdmin">Sign up as Admin</Label>
            </div>

            {formData.isAdmin && (
              <div className="space-y-2">
                <Label>Admin Code</Label>
                <Input
                  type="password"
                  placeholder="Enter admin code"
                  value={formData.adminCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, adminCode: e.target.value }))}
                />
              </div>
            )}

            <Button
              onClick={handleSignUp}
              disabled={loading || !formData.email || !formData.fullName || !formData.password || !formData.confirmPassword || (formData.isAdmin && !formData.adminCode)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Login; 