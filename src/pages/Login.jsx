import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Github, LogIn, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import useAuthStore from '@/stores/authStore';
import toast from 'react-hot-toast';
import api from '@/config/api';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const startGithubLogin = useAuthStore((s) => s.startGithubLogin);

  const [form, setForm] = useState({ email: '', password: '' });
  const [forgotForm, setForgotForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isOtpRequested, setIsOtpRequested] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function handleForgotChange(e) {
    const { name, value } = e.target;
    setForgotForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.email) errs.email = 'Email is required';
    if (!form.password) errs.password = 'Password is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      await login(form);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed. Please try again.';
      if (/invalid email or password/i.test(message)) {
        setErrors({ email: 'Email not found or password is incorrect', password: ' ' });
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGithubLogin() {
    try {
      await startGithubLogin();
    } catch (err) {
      toast.error(err.message || 'Unable to start GitHub login.');
    }
  }

  async function handleRequestOtp() {
    setIsForgotLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/request', { email: forgotForm.email });
      setIsOtpRequested(true);
      toast.success(data.message || 'OTP sent successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to send OTP.');
    } finally {
      setIsForgotLoading(false);
    }
  }

  async function handleResetPassword() {
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setIsForgotLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/verify', {
        email: forgotForm.email,
        otp: forgotForm.otp,
        newPassword: forgotForm.newPassword,
      });
      toast.success(data.message || 'Password updated');
      setShowForgotPassword(false);
      setIsOtpRequested(false);
      setForgotForm({ email: '', otp: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'OTP verification failed.');
    } finally {
      setIsForgotLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">Proplytics</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleGithubLogin}>
            <Github className="h-4 w-4" />
            Continue with GitHub
          </Button>

          <button
            type="button"
            onClick={() => setShowForgotPassword((prev) => !prev)}
            className="mt-4 text-sm text-primary hover:underline font-medium"
          >
            Forgot password?
          </button>

          {showForgotPassword && (
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotForm.email}
                  onChange={handleForgotChange}
                />
              </div>

              {!isOtpRequested ? (
                <Button type="button" className="w-full" onClick={handleRequestOtp} isLoading={isForgotLoading}>
                  Send OTP
                </Button>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">OTP</label>
                    <Input
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter OTP"
                      value={forgotForm.otp}
                      onChange={handleForgotChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                    <div className="relative">
                      <Input
                        name="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={forgotForm.newPassword}
                        onChange={handleForgotChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                    <Input
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={forgotForm.confirmPassword}
                      onChange={handleForgotChange}
                    />
                    {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
                  </div>

                  <Button type="button" className="w-full" onClick={handleResetPassword} isLoading={isForgotLoading}>
                    Reset Password
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
