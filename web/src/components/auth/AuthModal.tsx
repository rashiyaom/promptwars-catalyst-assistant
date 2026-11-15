import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';
import { registerMember, signInMember } from '../../features/auth/authService.js';
import type { CareMember, MemberRole } from '@sanjeevani/shared/types/profile';

export interface AuthModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/** Comprehensive, dynamic Authentication modal supporting 1-click member switching and email sign-in/registration. */
export function AuthModal({ isOpen, onClose }: AuthModalProps): React.JSX.Element {
  const { currentMember, careMembers, signInAsMember, signOutCurrentMember, isLiveConnected } = useCare();
  const [tab, setTab] = useState<'quick' | 'signin' | 'register'>('quick');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<MemberRole>('caretaker');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuickSignIn = (member: CareMember) => {
    signInAsMember(member);
    setFeedback(`Signed in as ${member.displayName} (${member.role}). Permissions updated!`);
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 600);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      if (isLiveConnected) {
        await signInMember(email, password);
        setFeedback('Successfully signed in with Firebase.');
      } else {
        // Dynamic demo sign-in
        const matchedMember = careMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
        const signedMember: CareMember = matchedMember ?? {
          uid: `demo-user-${Date.now()}`,
          displayName: email.split('@')[0] || 'Care Member',
          email,
          role: 'caretaker',
          joinedAt: new Date().toISOString(),
        };
        signInAsMember(signedMember);
        setFeedback(`Demo login successful as ${signedMember.displayName}.`);
      }
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please verify your credentials.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      if (isLiveConnected) {
        await registerMember(email, password, displayName);
        setFeedback('Account created. Check your email for verification link before logging in.');
        setTab('signin');
      } else {
        // Dynamic demo registration
        const newMember: CareMember = {
          uid: `demo-${Date.now()}`,
          displayName: displayName.trim(),
          email: email.trim(),
          role,
          joinedAt: new Date().toISOString(),
        };
        signInAsMember(newMember);
        setFeedback(`Account registered and logged in as ${newMember.displayName} (${newMember.role})!`);
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 700);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register account.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Care Circle Sign In">
      {/* Active User Status Bar */}
      <div
        style={{
          background: currentMember ? '#eef7f4' : '#f8fafc',
          border: '1px solid',
          borderColor: currentMember ? '#bad9d0' : '#e2e8f0',
          borderRadius: '14px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <span style={{ fontSize: '13px', color: '#55726c', display: 'block' }}>Active Session:</span>
          <strong style={{ fontSize: '15px', color: '#16463e' }}>
            {currentMember ? `👤 ${currentMember.displayName} (${currentMember.role})` : '⚠️ Browsing as Guest (Not signed in)'}
          </strong>
        </div>
        {currentMember && (
          <button
            type="button"
            className="btn-skip"
            style={{ color: '#991b1b', fontSize: '13px', padding: '6px 12px' }}
            onClick={() => {
              void signOutCurrentMember();
              setFeedback('Signed out.');
            }}
          >
            Sign Out
          </button>
        )}
      </div>

      {feedback && (
        <div style={{ background: '#eaf6f1', color: '#11645b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontWeight: 650, fontSize: '14px' }} role="status">
          {feedback}
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontWeight: 650, fontSize: '14px' }} role="alert">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e1ebe6', paddingBottom: '10px', marginBottom: '16px' }}>
        <button
          type="button"
          className={`tab-button ${tab === 'quick' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '14px' }}
          onClick={() => setTab('quick')}
        >
          ⚡ 1-Click Member Sign-In
        </button>
        <button
          type="button"
          className={`tab-button ${tab === 'signin' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '14px' }}
          onClick={() => setTab('signin')}
        >
          Email Sign In
        </button>
        <button
          type="button"
          className={`tab-button ${tab === 'register' ? 'active' : ''}`}
          style={{ padding: '6px 14px', fontSize: '14px' }}
          onClick={() => setTab('register')}
        >
          Create Account
        </button>
      </div>

      {/* 1-Click Member Sign In */}
      {tab === 'quick' && (
        <div>
          <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#44665f' }}>
            Instant sign-in for testing different permission tiers (Elder, Caregiver, Family):
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {careMembers.map((member) => {
              const isCurrent = currentMember?.uid === member.uid;
              return (
                <button
                  key={member.uid}
                  type="button"
                  onClick={() => handleQuickSignIn(member)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: isCurrent ? '2px solid #11645b' : '1px solid #e2e8f0',
                    background: isCurrent ? '#f0f9f6' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#16463e' }}>
                      {member.role === 'elder' ? '👴' : member.role === 'caretaker' ? '👩‍⚕️' : '👦'} {member.displayName}
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#667a75' }}>
                      {member.email} • {member.role === 'elder' ? 'Full care view & voice guidance' : member.role === 'caretaker' ? 'Full schedule management permissions' : 'Adherence viewer'}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: member.role === 'elder' ? '#d6eee4' : member.role === 'caretaker' ? '#e0f2fe' : '#fef3c7',
                      color: member.role === 'elder' ? '#11645b' : member.role === 'caretaker' ? '#0369a1' : '#b45309',
                    }}
                  >
                    {isCurrent ? '✓ Active' : `Sign in as ${member.role}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Email Sign In */}
      {tab === 'signin' && (
        <form onSubmit={handleEmailSignIn} className="care-form" aria-busy={busy}>
          <label htmlFor="modal-auth-email">
            Email Address
            <input
              id="modal-auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya.care@example.com"
            />
          </label>
          <label htmlFor="modal-auth-password">
            Password
            <input
              id="modal-auth-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <button type="submit" className="send-button" disabled={busy || !email.trim() || !password.trim()}>
            {busy ? 'Signing in...' : 'Sign In to Care Circle'}
          </button>
        </form>
      )}

      {/* Register Account */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="care-form" aria-busy={busy}>
          <label htmlFor="modal-reg-name">
            Your Full Name
            <input
              id="modal-reg-name"
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Sharma"
            />
          </label>
          <label htmlFor="modal-reg-email">
            Email Address
            <input
              id="modal-reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rajesh@hospital.com"
            />
          </label>
          <label htmlFor="modal-reg-password">
            Password (minimum 6 characters)
            <input
              id="modal-reg-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>
          <label htmlFor="modal-reg-role">
            Care Circle Role
            <select
              id="modal-reg-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
            >
              <option value="caretaker">Caretaker (Manage schedules & doses)</option>
              <option value="family">Family (View schedule & check-in)</option>
              <option value="elder">Elder (Patient view & voice reader)</option>
            </select>
          </label>
          <button type="submit" className="send-button" disabled={busy || !email.trim() || !password.trim() || !displayName.trim()}>
            {busy ? 'Creating Account...' : 'Register & Connect to Circle'}
          </button>
        </form>
      )}
    </Modal>
  );
}
