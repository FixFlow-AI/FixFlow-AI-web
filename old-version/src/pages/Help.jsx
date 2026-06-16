import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: 'How do I use the Dashboard?',
    answer: 'The dashboard gives you a high-level overview of all your recent proposals. You can see their statuses, recent activity, and jump quickly into editing any existing proposal by clicking on it.'
  },
  {
    question: 'What is Agency Brain?',
    answer: 'Agency Brain analyzes your closed proposal history and surfaces reusable calibration insights. When your plan supports it, those insights can be applied before generation so new proposals reflect what has historically worked best for you or your workspace.'
  },
  {
    question: 'What is TriProposal?',
    answer: 'TriProposal generates Lean, Standard, and Premium strategies in parallel from the same brief. You can compare them side by side and share selected strategies together in one portal when your plan includes that capability.'
  },
  {
    question: 'How does Team Workspace work?',
    answer: 'Team Workspace adds a shared proposal area with members, roles, comments, and presence. Owners and editors can generate, export, and share, while viewers stay read-only but can still participate in review through comments.'
  },
  {
    question: 'How can I create a New Proposal?',
    answer: 'Navigate to "New Proposal" from the sidebar. You can paste your client brief or upload a document to get started. Our AI will analyze the requirements and structure a comprehensive proposal based on your input.'
  },
  {
    question: 'Where can I find all my Proposals?',
    answer: 'You can find all your generated proposals by clicking on "Proposals" or "Dashboard" in the sidebar navigation. It will list everything you have worked on previously.'
  },
  {
    question: 'How do I update my name or avatar?',
    answer: 'Go to the "Settings" page from the sidebar. There you can change your display name and choose between different avatar templates. Click "Save Changes" when you are done.'
  },
  {
    question: 'Can I change my email address?',
    answer: 'Changing an email address requires OTP (One Time Password) verification. This feature is maintained through our secure mail verification flow from the settings.'
  }
];

export default function Help() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Help & FAQs</h1>
        <p className="text-muted-foreground">
          Find answers to common questions about using FixFlowAI.
        </p>
      </div>

      <div className="space-y-4">
        {FAQS.map((faq, index) => (
          <div 
            key={index} 
            className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all"
          >
            <button
              onClick={() => setOpenIndex(index === openIndex ? -1 : index)}
              className="w-full flex items-center justify-between p-5 text-left font-medium outline-none hover:bg-muted/50 transition-colors"
            >
              <span className="text-[1.05rem]">{faq.question}</span>
              <ChevronDown 
                className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
                  index === openIndex ? 'rotate-180' : ''
                }`} 
              />
            </button>
            <AnimatePresence>
              {index === openIndex && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-5 pt-0 text-muted-foreground leading-relaxed">
                    <div className="w-full h-px bg-border mb-5"></div>
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
