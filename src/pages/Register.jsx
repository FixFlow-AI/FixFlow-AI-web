import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import useAuthStore from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((s) => s.register);

  const [entryMode, setEntryMode] = useState(searchParams.get('mode') === 'team' ? 'team' : 'individual');
  const [plan, setPlan] = useState(searchParams.get('plan') || 'free');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.name || form.name.length < 2) errs.name = 'Name must be at least 2 characters';
    if (!form.email) errs.email = 'Email is required';
    if (!form.password || form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter';
    else if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
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
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        plan,
        defaultEntryMode: entryMode,
        teamPlanPreference: entryMode === 'team' ? plan : 'free',
      });
      toast.success('Account created!');
      navigate(entryMode === 'team' ? '/workspace' : '/dashboard');
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
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
            <span className="text-xl font-bold text-foreground">FixFlowAI</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-1">Start building smarter proposals</p>
        </div>

        {/* Form */}
        <div className="glass-card rounded-2xl p-6">
          <div className="mb-5 flex rounded-full border border-border bg-background/35 p-1">
            {['individual', 'team'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEntryMode(mode)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  entryMode === mode ? 'bg-primary text-[#03131d]' : 'text-muted-foreground'
                }`}
              >
                {mode === 'individual' ? 'Individual' : 'Team'}
              </button>
            ))}
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              { value: 'free', label: 'Free', price: '$0' },
              { value: 'standard', label: 'Standard', price: '$10' },
              { value: 'pro', label: 'Pro', price: '$25' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPlan(option.value)}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  plan === option.value ? 'border-primary bg-primary/10' : 'border-border bg-background/30'
                }`}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <div className="mt-2 text-2xl font-semibold">{option.price}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>

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
                  autoComplete="new-password"
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
              <p className="text-xs text-muted-foreground mt-1">
                Min 8 characters, 1 uppercase, 1 number
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to={`/login?mode=${entryMode}`} className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
