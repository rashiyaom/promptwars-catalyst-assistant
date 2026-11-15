import React, { useState } from 'react';
import { useCare } from '../../context/CareContext.js';
import { useLanguage } from '../../i18n/LanguageContext.js';
import * as auth from '../../features/auth/authService.js';
import { navigate, pendingInvitation } from '../../app/routes.js';

/** One account per person. Roles are assigned by invitations, never selected during registration. */
export function AuthPage(): React.JSX.Element {
  const { t, language } = useLanguage();
  const { user, isDemo, signOutCurrentMember } = useCare();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(''); const [error, setError] = useState('');
  const done = () => navigate(pendingInvitation() ? 'connect' : 'account');
  const perform = async (action: () => Promise<void>) => { setBusy(true); setError(''); setFeedback(''); try { await action(); } catch (err) { setError(language === 'en' && err instanceof Error ? err.message : t('Could not complete sign-in. Please retry.')); } finally { setBusy(false); setPassword(''); } };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (busy || isDemo) return; void perform(async () => {
    if (mode === 'register') { await auth.registerMember(email, password, name); setFeedback(t('Check your email to verify your account.')); }
    else if (mode === 'reset') { await auth.sendMemberPasswordReset(email); setFeedback(t('If the account exists, a reset link will arrive by email.')); }
    else { await auth.signInMember(email, password); done(); }
  }); };
  return <section className="auth-page"><aside className="auth-story"><svg className="auth-illustration" viewBox="0 0 440 300" aria-hidden="true"><circle cx="220" cy="150" r="140" fill="#e3f66a"/><path d="M90 255V130L220 35l130 95v125" fill="#fff"/><rect x="186" y="180" width="68" height="75" rx="34" fill="#dbe6c3"/><circle cx="165" cy="132" r="30" fill="#b57d57"/><path d="M120 224v-35a45 45 0 0190 0v35" fill="#293719"/><circle cx="280" cy="145" r="25" fill="#d1a17f"/><path d="M242 224v-28a38 38 0 0176 0v28" fill="#a4ba58"/><path d="M143 115q20-45 44 0" fill="#eee9df"/><path d="M205 105h30m-15-15v30" stroke="#536b29" strokeWidth="8" strokeLinecap="round"/></svg><span className="eyebrow">SANJEEVANI × TAUS</span><h1>{t('Your independence. Your care circle.')}</h1><p>{t('One account connects you to the right care profiles. Taus remembers your routine, so you can simply talk.')}</p><ol><li>{t('Create and verify your account')}</li><li>{t('Add yourself or an elder you care for')}</li><li>{t('Connect a trusted caregiver and doctor')}</li></ol></aside>
    <div className="auth-panel">
      <p className="eyebrow">{t('WELCOME TO YOUR CARE SPACE')}</p><h2>{t(user && !user.emailVerified ? 'Verify your email' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in')}</h2>
      {error && <p className="error-message" role="alert">{error}</p>}{feedback && <p role="status">{feedback}</p>}
      {isDemo && <p role="status">{t('Account service is not connected yet. Please try again after setup.')}</p>}
      {user && !user.emailVerified ? <div className="care-form"><p>{t('Check your email to verify your account.')} {user.email}</p><button className="send-button" disabled={busy} onClick={() => void perform(async () => { if (await auth.refreshVerification()) done(); else setFeedback(t('Email not verified yet. Open the verification link first.')); })}>{t('I have verified my email')}</button><button className="btn-skip" disabled={busy} onClick={() => void perform(async () => { await auth.resendVerification(); setFeedback(t('Verification email sent.')); })}>{t('Resend verification')}</button><button className="text-button" disabled={busy} onClick={() => void perform(signOutCurrentMember)}>{t('Use a different account')}</button></div> : <form className="care-form" onSubmit={submit}>
        {mode === 'register' && <label htmlFor="account-name">{t('Your name')}<input id="account-name" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label htmlFor="account-email">{t('Email')}<input id="account-email" required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && <label htmlFor="account-password">{t('Password')}<input id="account-password" required type="password" minLength={6} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        <button className="send-button" disabled={busy || isDemo}>{t(busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in')}</button>
        <div className="action-row"><button type="button" className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{t(mode === 'login' ? 'Create account' : 'Sign in')}</button><button type="button" className="text-button" onClick={() => setMode('reset')}>{t('Forgot password?')}</button></div>
      </form>}
      <p>{t('Start with an empty care space. Add your own profiles, medicines and appointments after signing in.')}</p><p className="small-note">{t('Your access is assigned per elder profile. Choosing a title does not grant medical or caregiver access.')}</p>
    </div>
  </section>;
}
