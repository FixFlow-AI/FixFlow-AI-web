import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserState, 
  LeadItem, 
  ProposalItem, 
  WorkspaceItem, 
  EscrowMilestone, 
  EscrowItem 
} from './types.js';
import { 
  INITIAL_LEADS, 
  INITIAL_PROPOSALS, 
  INITIAL_WORKSPACES, 
  INITIAL_ESCROWS 
} from './seeds.js';

export * from './types.js';

interface AppContextType {
  user: UserState | null;
  leads: LeadItem[];
  proposals: ProposalItem[];
  workspaces: WorkspaceItem[];
  escrows: EscrowItem[];
  login: (email: string, plan: UserState['selectedPlan'], role?: UserState['role']) => void;
  logout: () => void;
  setMfaEnabled: (enabled: boolean) => void;
  updateLeadStatus: (id: string, status: LeadItem['status']) => void;
  addProposal: (proposal: ProposalItem) => void;
  addProposalComment: (proposalId: string, text: string) => void;
  addEscrow: (escrow: EscrowItem) => void;
  transitionEscrowMilestone: (
    escrowId: string,
    milestoneId: string,
    toState: EscrowMilestone['state'],
    triggerRole: string,
    mfaToken?: string
  ) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>(INITIAL_LEADS);
  const [proposals, setProposals] = useState<ProposalItem[]>(INITIAL_PROPOSALS);
  const [workspaces] = useState<WorkspaceItem[]>(INITIAL_WORKSPACES);
  const [escrows, setEscrows] = useState<EscrowItem[]>(INITIAL_ESCROWS);

  // Restore session if present
  useEffect(() => {
    const storedUser = localStorage.getItem('ff_session');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (email: string, plan: UserState['selectedPlan'], role: UserState['role'] = 'USER') => {
    const sessionUser: UserState = {
      email,
      role,
      mfaEnabled: false,
      selectedPlan: plan
    };
    setUser(sessionUser);
    localStorage.setItem('ff_session', JSON.stringify(sessionUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ff_session');
  };

  const setMfaEnabled = (enabled: boolean) => {
    if (user) {
      const updated = { ...user, mfaEnabled: enabled };
      setUser(updated);
      localStorage.setItem('ff_session', JSON.stringify(updated));
    }
  };

  const updateLeadStatus = (id: string, status: LeadItem['status']) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l))
    );
  };

  const addProposal = (proposal: ProposalItem) => {
    setProposals((prev) => [proposal, ...prev]);
  };

  const addProposalComment = (proposalId: string, text: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id === proposalId) {
          const newComment = {
            id: `c-${Date.now()}`,
            sender: user ? user.email : 'Anonymous',
            text,
            createdAt: new Date().toISOString()
          };
          return {
            ...p,
            comments: [...p.comments, newComment]
          };
        }
        return p;
      })
    );
  };

  const addEscrow = (escrow: EscrowItem) => {
    setEscrows((prev) => [escrow, ...prev]);
  };

  const transitionEscrowMilestone = (
    escrowId: string,
    milestoneId: string,
    toState: EscrowMilestone['state'],
    triggerRole: string,
    mfaToken?: string
  ) => {
    setEscrows((prev) =>
      prev.map((esc) => {
        if (esc.id === escrowId) {
          const updatedMilestones = esc.milestones.map((ms) => {
            if (ms.id === milestoneId) {
              // Enforce MFA check inside state transitions
              if (toState === 'Approved' || toState === 'Funds_Released') {
                if (!mfaToken) {
                  throw new Error('MFA_REQUIRED');
                }
                if (mfaToken !== '981242') {
                  throw new Error('MFA_INVALID');
                }
              }
              return {
                ...ms,
                state: toState,
                approved: toState === 'Approved' || toState === 'Funds_Released',
                version: ms.version + 1
              };
            }
            return ms;
          });

          // Build a new audit trail block
          const targetMs = esc.milestones.find((ms) => ms.id === milestoneId)!;
          const blockIndex = esc.auditTrail.length + 1;
          const previousHash = esc.auditTrail[esc.auditTrail.length - 1]?.hash || '0'.repeat(64);
          
          const timestamp = new Date().toISOString();
          const metadata = `Milestone state transitioned from ${targetMs.state} to ${toState} ${
            toState === 'Approved' || toState === 'Funds_Released' ? '[MFA Verified]' : ''
          }`;
          
          const hashString = [
            blockIndex.toString(),
            timestamp,
            milestoneId,
            targetMs.state,
            toState,
            user ? user.email : 'system',
            triggerRole,
            metadata,
            previousHash
          ].join('|');
          
          // Simple hash calculation simulation
          let calculatedHash = '';
          for (let i = 0; i < hashString.length; i++) {
            calculatedHash += hashString.charCodeAt(i).toString(16);
          }
          const finalHash = calculatedHash.substring(0, 64);

          const newBlock = {
            index: blockIndex,
            timestamp,
            milestoneId,
            fromState: targetMs.state,
            toState,
            triggerUserId: user ? user.email : 'system',
            triggerUserRole: triggerRole,
            metadata,
            previousHash,
            hash: finalHash
          };

          return {
            ...esc,
            milestones: updatedMilestones,
            auditTrail: [...esc.auditTrail, newBlock]
          };
        }
        return esc;
      })
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        leads,
        proposals,
        workspaces,
        escrows,
        login,
        logout,
        setMfaEnabled,
        updateLeadStatus,
        addProposal,
        addProposalComment,
        addEscrow,
        transitionEscrowMilestone
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
export default useApp;
