import React, { useState } from 'react';
import { useCare } from '../../context/CareContext.js';
import { registerMember, signInMember, signOutMember } from '../../features/auth/authService.js';
import { AuthModal } from './AuthModal.js';

/** Inline Firebase account controls; offline mode never submits credentials. */
export function AuthBanner(): React.JSX.Element {
  const { user, isDemo, isLiveConnected, profiles, activeProfile, switchProfile, loading, dataError, refreshProfiles, currentMember } = useCare();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'register' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setFeedback('');
    try {
      if (mode === 'register') {
        await registerMember(email, password, name);
        await signOutMember();
        setFeedback('Account created. Check your inbox to verify your email, then sign in.');
        setMode('signin');
      } else { await signInMember(email, password); setFeedback('Signed in.'); setMode(null); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not complete sign-in. Please retry.'); }
    finally { setPassword(''); setBusy(false); }
  };
  const signOut = async () => {
    setBusy(true); setError('');
    try { await signOutMember(); setFeedback('Signed out.'); }
    catch { setError('Could not sign out. Please retry.'); }
    finally { setBusy(false); }
  };
  return <section className="account-banner" aria-label="Account and care profile">
    <div className="section-heading">
      <div><strong>{isDemo ? 'Offline demo · no account needed' : isLiveConnected ? `Signed in as ${user?.displayName || user?.email}` : 'Connect your care circle'}</strong><p>{isDemo ? 'Explore care routines and test 1-click member sign-in or create sample profiles.' : 'Use a verified email account to create or join a care profile.'}</p></div>
      <div className="action-row">
        <button type="button" className="btn-taken" onClick={() => setIsAuthModalOpen(true)}>
          {currentMember ? `👤 Switch Member (${currentMember.displayName.split(' ')[0]})` : 'Sign In / Switch Member'}
        </button>
        {!isDemo && (user ? <button className="btn-skip" disabled={busy} onClick={() => void signOut()}>Sign out</button> : <>
          <button className="btn-skip" disabled={busy} aria-pressed={mode === 'signin'} onClick={() => setMode(mode === 'signin' ? null : 'signin')}>Sign in</button>
          <button className="btn-taken" disabled={busy} aria-pressed={mode === 'register'} onClick={() => setMode(mode === 'register' ? null : 'register')}>Register</button>
        </>)}
      </div>
    </div>
    <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    {mode && !isDemo && !isLiveConnected && <form className="care-form auth-form" onSubmit={submit} aria-busy={busy}>
      {mode === 'register' && <label htmlFor="auth-name">Your name<input id="auth-name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>}
      <label htmlFor="auth-email">Email<input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label htmlFor="auth-password">Password<input id="auth-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="send-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}</button>
    </form>}
    {profiles.length > 0 && <label className="profile-picker" htmlFor="profile-select">Care profile<select id="profile-select" value={activeProfile.id} disabled={loading} onChange={(e) => void switchProfile(e.target.value)}>
      {!activeProfile.id && <option value="">Select a profile</option>}{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.elderName}</option>)}
    </select></label>}
    {!isDemo && isLiveConnected && !profiles.length && !loading && <p>Open Care Circle to create your first profile or join with a role passcode.</p>}
    <p role="status">{loading ? 'Loading care profile…' : feedback}</p>
    {(error || dataError) && <div className="error-message" role="alert">{error || dataError}{dataError && <button className="btn-skip" disabled={loading} onClick={() => void refreshProfiles()}>Retry loading profiles</button>}</div>}
  </section>;
}
