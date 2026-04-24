import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User, ShieldCheck, Sun, Moon, Monitor } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useThemeStore from '../stores/themeStore';
import toast from 'react-hot-toast';
import api from '@/config/api';
import NotificationPreferencesCard from '@/components/settings/NotificationPreferencesCard';

const AVATARS = [
  '/avatar.png',
  '/avatar2.png',
  '/avatar3.png',
  '/avatar4.png',
  '/avatar5.png',
  '/avatar6.png',
];

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const setUser = useAuthStore((s) => s.setUser);
  const setCurrentWorkspace = useAuthStore((s) => s.setCurrentWorkspace);
  
  const [name, setName] = useState(user?.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || AVATARS[0]);
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingNotifications, setIsSavingNotifications] = useState(false)

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.avatar) setSelectedAvatar(user.avatar);
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setIsSavingProfile(true)
    try {
      const { data } = await api.patch('/auth/me', {
        name,
        avatar: selectedAvatar,
      })
      setUser(data.user)
      setCurrentWorkspace(data.currentWorkspace || null)
      toast.success('Settings updated successfully!')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not save your profile settings.')
    } finally {
      setIsSavingProfile(false)
    }
  };

  const handleSaveNotifications = async (notificationPreferences) => {
    setIsSavingNotifications(true)
    try {
      const { data } = await api.patch('/auth/me', {
        notificationPreferences,
      })
      setUser(data.user)
      setCurrentWorkspace(data.currentWorkspace || null)
      toast.success('Notification preferences updated.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not save notification preferences.')
    } finally {
      setIsSavingNotifications(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and personal information.
        </p>
      </div>

      <div className="grid gap-8 bg-card border border-border rounded-xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Profile Avatar</h2>
          <div className="flex flex-wrap gap-5 perspective-1000">
            {AVATARS.map((avatar, index) => (
              <motion.button
                key={index}
                type="button"
                onClick={() => setSelectedAvatar(avatar)}
                whileHover={{ scale: 1.1, rotateY: 15, rotateX: 5 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative h-[4.5rem] w-[4.5rem] rounded-full flex items-center justify-center outline-none transition-shadow ${
                  selectedAvatar === avatar 
                    ? 'ring-4 ring-primary ring-offset-2 ring-offset-card shadow-lg shadow-primary/20' 
                    : 'bg-muted shadow-sm hover:shadow-md'
                }`}
              >
                <img 
                  src={avatar} 
                  alt={`Avatar option ${index + 1}`} 
                  className="w-full h-full object-cover rounded-full drop-shadow-md"
                />
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Plan & Mode</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/35 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Personal Plan</div>
              <div className="mt-2 text-xl font-semibold capitalize">{user?.plan || 'free'}</div>
            </div>
            <div className="rounded-xl border border-border bg-background/35 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Default Mode</div>
              <div className="mt-2 text-xl font-semibold capitalize">{user?.defaultEntryMode || 'individual'}</div>
            </div>
            <div className="rounded-xl border border-border bg-background/35 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Workspace</div>
              <div className="mt-2 text-xl font-semibold">{currentWorkspace?.name || 'None yet'}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Appearance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                theme === 'light' ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-card' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="p-3 rounded-full bg-background shadow-sm"><Sun className="w-6 h-6 text-yellow-500" /></div>
              <span className="font-medium">Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('modern-dark')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                theme === 'modern-dark' ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-card' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="p-3 rounded-full bg-background shadow-sm"><Moon className="w-6 h-6 text-purple-500" /></div>
              <span className="font-medium">Modern Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('vscode-dark')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${
                theme === 'vscode-dark' ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-card' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <div className="p-3 rounded-full bg-background shadow-sm"><Monitor className="w-6 h-6 text-blue-500" /></div>
              <span className="font-medium">VS Code Dark</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Personal Information</h2>
          
          <div className="space-y-4 max-w-md">
            <div className="space-y-2 relative">
              <label htmlFor="name" className="text-sm font-medium">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="Your Name"
                />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label htmlFor="email" className="text-sm font-medium">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={user?.email || 'user@example.com'}
                  disabled
                  className="w-full bg-muted border border-border rounded-lg py-2.5 pl-10 pr-4 outline-none text-muted-foreground cursor-not-allowed opacity-70"
                  placeholder="you@example.com"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Email address cannot be updated directly. It will be updated through OTP verification in mail.
              </p>
            </div>
          </div>

          <motion.button 
            type="button"
            onClick={handleSave}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors mt-6 shadow-sm flex items-center gap-2"
            disabled={isSavingProfile}
          >
            <ShieldCheck className="h-4 w-4" />
            {isSavingProfile ? 'Saving...' : 'Save Changes'}
          </motion.button>
        </div>

        <NotificationPreferencesCard
          title="Personal Notifications"
          description="Keep delivery-plan changes, comments, approvals, and assignments visible in the app and optionally in email."
          value={user?.notificationPreferences}
          onSave={handleSaveNotifications}
          isSaving={isSavingNotifications}
        />
      </div>
    </div>
  );
}
