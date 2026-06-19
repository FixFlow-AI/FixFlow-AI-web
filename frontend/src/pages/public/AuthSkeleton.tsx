import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Key, Mail, UserCheck } from 'lucide-react';
import useApp from '../../store/index.js';
import Button from '../../components/ui/Button.js';
import Card from '../../components/ui/Card.js';

interface AuthSkeletonProps {
  mode: 'login' | 'signup' | 'waitlist';
}

export const AuthSkeleton: React.FC<AuthSkeletonProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { login } = useApp();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<'FREE' | 'SOLO' | 'PRO' | 'AGENCY'>('FREE');
  const [role, setRole] = useState<'USER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN'>('USER');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (mode === 'login') {
      login(email, 'SOLO', email.includes('admin') ? 'SUPER_ADMIN' : 'USER');
      navigate('/app/dashboard');
    } else if (mode === 'signup') {
      login(email, plan, role);
      navigate('/app/dashboard');
    } else if (mode === 'waitlist') {
      setSuccessMsg(`Thank you! ${email} has been registered to the waitlist.`);
      setEmail('');
    }
  };

  const getTitle = () => {
    if (mode === 'login') return 'Welcome Back to FixFlow';
    if (mode === 'signup') return 'Create Your Secure Workspace';
    return 'Join the FixFlow Waitlist';
  };

  return (
    <div className="max-w-md mx-auto my-16 px-4">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex p-3 bg-blue-900/10 border border-blue-900/30 rounded-full text-blue-500 mb-2">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold font-outfit text-white">{getTitle()}</h1>
        <p className="text-sm text-slate-400">
          {mode === 'login' 
            ? 'Sign in to access your trust control center' 
            : mode === 'signup'
            ? 'Access transparent escrows, verified credentials, and AI tools'
            : 'Be the first to know when public release goes live'}
        </p>
      </div>

      <Card className="p-6">
        {successMsg ? (
          <div className="text-center space-y-4 py-4">
            <div className="inline-flex p-2.5 bg-emerald-900/25 border border-emerald-800 rounded-full text-emerald-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-200">{successMsg}</p>
            <Link to="/" className="inline-block">
              <Button variant="secondary" size="sm">Back to Home</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dev@fixflowai.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {mode !== 'waitlist' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 w-4.5 h-4.5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Subscription</label>
                  <select
                    value={plan}
                    onChange={(e: any) => setPlan(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="FREE">Free Tier (10% platform fee)</option>
                    <option value="SOLO">Solo Developer (5% platform fee)</option>
                    <option value="PRO">Agency Pro (3% platform fee)</option>
                    <option value="AGENCY">Agency Enterprise (2% platform fee)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">User Account Role</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="USER">Freelancer</option>
                    <option value="MANAGER">Client Manager</option>
                    <option value="ADMIN">Governance Admin</option>
                    <option value="SUPER_ADMIN">System Super Admin</option>
                  </select>
                </div>
              </>
            )}

            <Button variant="primary" fullWidth type="submit" className="mt-2">
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Register Email'}
            </Button>
          </form>
        )}
      </Card>

      <div className="text-center mt-6 text-xs text-slate-500 space-x-1">
        {mode === 'login' ? (
          <>
            <span>New to FixFlow?</span>
            <Link to="/signup" className="text-blue-500 hover:underline">Create an account</Link>
          </>
        ) : mode === 'signup' ? (
          <>
            <span>Already have an account?</span>
            <Link to="/login" className="text-blue-500 hover:underline">Sign in</Link>
          </>
        ) : (
          <>
            <span>Want immediate testing access?</span>
            <Link to="/signup" className="text-blue-500 hover:underline">Register developer account</Link>
          </>
        )}
      </div>
    </div>
  );
};
export default AuthSkeleton;
