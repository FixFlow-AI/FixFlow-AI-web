---
name: fixflow-react-ui-craftsman
description: >
  Premium frontend engineering skill for FixFlowAI's React 18 + Vite + Tailwind
  + Zustand application. Triggers when the user asks about UI components,
  dashboard panels, glassmorphism design, animations, state management,
  optimistic sync, responsive layouts, or any frontend implementation work.
  Contains design system tokens, component patterns, and store conventions.
---

# FixFlowAI React UI Craftsman Skill

You are a **world-class frontend engineer** building FixFlowAI's premium glassmorphic dashboard. Every component you create must feel premium, responsive, and alive with micro-interactions.

---

## Design System Tokens

### Glassmorphism Foundation
```css
/* Glass card base — the core visual pattern */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Elevated glass variant */
.glass-card-elevated {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
```

### Color Palette (Dark Mode First)
```css
:root {
  /* Background layers */
  --bg-base: #0a0a0f;
  --bg-surface: #12121a;
  --bg-elevated: #1a1a2e;

  /* Brand accent (gradient-capable) */
  --accent-primary: #3b82f6;     /* Blue */
  --accent-secondary: #7c3aed;   /* Purple */
  --accent-success: #10b981;     /* Green */
  --accent-warning: #f59e0b;     /* Amber */
  --accent-danger: #ef4444;      /* Red */

  /* Text hierarchy */
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.6);
  --text-muted: rgba(255, 255, 255, 0.35);

  /* Border & dividers */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);

  /* Gradients */
  --gradient-brand: linear-gradient(135deg, #3b82f6, #7c3aed);
  --gradient-success: linear-gradient(135deg, #10b981, #3b82f6);
  --gradient-warm: linear-gradient(135deg, #f59e0b, #ef4444);
}
```

### Typography
```css
/* Use Inter or system fonts — never browser defaults */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Size scale */
--text-xs: 0.75rem;    /* 12px — labels, badges */
--text-sm: 0.875rem;   /* 14px — secondary text */
--text-base: 1rem;     /* 16px — body text */
--text-lg: 1.125rem;   /* 18px — section headers */
--text-xl: 1.25rem;    /* 20px — card titles */
--text-2xl: 1.5rem;    /* 24px — page headers */
--text-3xl: 1.875rem;  /* 30px — hero headers */
```

### Spacing Scale
```css
/* Use 4px base grid */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

---

## Component Patterns

### Glass Card Component
```jsx
function GlassCard({ children, className = '', elevated = false, ...props }) {
  return (
    <div
      className={`
        rounded-2xl p-6
        ${elevated
          ? 'bg-white/[0.08] backdrop-blur-[24px] border border-white/[0.15] shadow-[0_16px_48px_rgba(0,0,0,0.4)]'
          : 'bg-white/[0.05] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
        }
        transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.15]
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
```

### Animated Score Badge
```jsx
function ScoreBadge({ score, label }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const bgColor = score >= 80 ? 'bg-emerald-400/10' : score >= 60 ? 'bg-amber-400/10' : 'bg-red-400/10';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor}`}>
      <span className={`text-sm font-semibold ${color}`}>{score}%</span>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}
```

### Loading Skeleton (Glassmorphic)
```jsx
function GlassSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-white/[0.06] rounded-lg"
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
}
```

### Status Indicator (Live Dot)
```jsx
function StatusDot({ status }) {
  const styles = {
    active: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    pending: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
    error: 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    idle: 'bg-white/20'
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${styles[status] || styles.idle}
                      ${status === 'active' ? 'animate-pulse' : ''}`} />
  );
}
```

---

## Dashboard Architecture

The dashboard has **9 tab panels** in `frontend/src/sections/`:

```
Sections (Tab Panels):
├── Overview         → Key metrics, recent activity, quick actions
├── Proposals        → Brief parsing, proposal cards, confidence scores
├── Contracts        → Active agreements, milestone timelines
├── Escrow           → Payment status, fund releases, disputes
├── Talent           → Freelancer matching, skill verification
├── Analytics        → Performance charts, earnings trends
├── Reputation       → Trust scores, SBT token status
├── Opportunities    → Lead scraping results, scoring
└── Settings         → Profile, API keys, preferences
```

### Tab Navigation Pattern
```jsx
function DashboardTabs({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'proposals', label: 'Proposals', icon: FileText },
    // ...
  ];

  return (
    <nav className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     transition-all duration-200
                     ${activeTab === tab.id
                       ? 'bg-white/10 text-white shadow-sm'
                       : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

---

## Zustand Store Conventions

### Store File Structure
```javascript
// frontend/src/store/{domain}Store.js
import { create } from 'zustand';

const useDomainStore = create((set, get) => ({
  // ── State ──
  items: [],
  selectedId: null,
  loading: false,
  error: null,

  // ── Actions ──
  setItems: (items) => set({ items }),
  selectItem: (id) => set({ selectedId: id }),

  // ── Async Actions ──
  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/v1/domain');
      const data = await res.json();
      set({ items: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ── Computed (via get()) ──
  getSelectedItem: () => {
    const { items, selectedId } = get();
    return items.find(item => item.id === selectedId) || null;
  },

  // ── Reset ──
  reset: () => set({ items: [], selectedId: null, loading: false, error: null })
}));

export default useDomainStore;
```

### Optimistic Update Pattern
```javascript
// From optimisticSync.js pattern
optimisticUpdate: async (id, updates) => {
  const { items } = get();
  const previous = [...items]; // Snapshot for rollback

  // 1. Apply optimistic update immediately
  set({
    items: items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    )
  });

  // 2. Sync with server
  try {
    await fetch(`/api/v1/domain/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  } catch (err) {
    // 3. Rollback on failure
    set({ items: previous, error: 'Update failed. Changes reverted.' });
  }
}
```

---

## Animation Patterns

### Micro-Interactions (CSS Transitions)
```css
/* Standard hover lift for cards */
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

/* Glow effect on focus */
.input-glow:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

/* Fade-in on mount */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
}
```

### Framer Motion Patterns
```jsx
import { motion, AnimatePresence } from 'framer-motion';

// Card entrance animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  {/* Card content */}
</motion.div>

// Staggered list animation
<motion.ul>
  {items.map((item, i) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.05 }}
    />
  ))}
</motion.ul>
```

---

## Responsive Layout Rules

1. **Mobile-first**: Start with single column, add complexity at breakpoints.
2. **Breakpoints**: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`
3. **Dashboard sidebar**: Fixed on `lg+`, collapsible drawer on `md-`
4. **Cards**: Single column on mobile, 2-col on `md`, 3-col on `xl`
5. **Tables**: Horizontal scroll on mobile, full width on `lg+`

---

## Accessibility Requirements

- All interactive elements must have `aria-label` or visible text labels
- Color is never the sole indicator — always pair with icons or text
- Focus states must be visible (use `ring-2 ring-blue-400/50`)
- Tab order must be logical and follow visual flow
- Minimum touch target: 44×44px for mobile
