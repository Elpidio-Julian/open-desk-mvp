import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useRole } from '../contexts/RoleContext';

const Login = () => {
  const navigate = useNavigate();
  const { setUserRole } = useRole();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              app_role: 'customer',
              email: formData.email
            }
          }
        });

        if (signUpError) throw signUpError;
        setError('Please check your email for the confirmation link.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
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
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="auth-container">
        <h1>Welcome to Zendesk Clone</h1>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              isSignUp ? 'Signing up...' : 'Signing in...'
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="auth-switch"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login; 