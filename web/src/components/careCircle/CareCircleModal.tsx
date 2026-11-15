import React, { useRef, useState } from 'react';
import type { MemberRole } from '@sanjeevani/shared/types/profile';
import { profileSchema, joinSchema, generateRoleCodes, type RoleCodes } from '../../features/profiles/profileInput.js';
import { Modal } from '../common/Modal.js';
import { useCare } from '../../context/CareContext.js';
import { createCareProfile, joinCareProfile } from '../../features/auth/authService.js';

/** Directory, verified profile joining, and one-time role code handoff. */
export function CareCircleModal({ isOpen, onClose }: { readonly isOpen: boolean; readonly onClose: () => void }): React.JSX.Element {
  const { activeProfile, careMembers, role, user, isDemo, isLiveConnected, createDemoProfile, refreshProfiles, switchProfile, setRole } = useCare();
  const [view, setView] = useState<'members' | 'join' | 'create'>('members');
  const [elderName, setElderName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [profileId, setProfileId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [created, setCreated] = useState<{ profileId: string; codes: RoleCodes } | null>(null);
  const demoCodes = useRef(new Map<string, RoleCodes>());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const close = () => { setCreated(null); setPasscode(''); setError(''); setFeedback(''); onClose(); };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setFeedback('');
    const parsed = profileSchema.safeParse({ elderName, displayName: displayName || user?.displayName || elderName, timezone });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check profile details.'); return; }
    setBusy(true);
    try {
      const codes = generateRoleCodes();
      const result = isDemo ? { profileId: createDemoProfile(parsed.data.elderName, parsed.data.timezone, parsed.data.displayName).id }
        : await createCareProfile({ ...parsed.data, elderPasscode: codes.elder, caretakerPasscode: codes.caretaker, familyPasscode: codes.family });
      if (isDemo) demoCodes.current.set(result.profileId, codes);
      setCreated({ profileId: result.profileId, codes });
      setFeedback(isDemo ? 'Sample profile created for this session.' : 'Care profile created. Save the codes before closing.');
      if (!isDemo) await refreshProfiles(result.profileId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the profile.'); }
    finally { setBusy(false); }
  };
  const join = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setFeedback('');
    const parsed = joinSchema.safeParse({ profileId, displayName, passcode });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check profile ID and passcode.'); return; }
    setBusy(true);
    try {
      if (isDemo) {
        const codes = demoCodes.current.get(parsed.data.profileId);
        const matched = codes && (Object.keys(codes) as MemberRole[]).find((candidate) => codes[candidate] === parsed.data.passcode);
        if (!matched) throw new Error('Use a profile ID and role code created during this demo session.');
        await switchProfile(parsed.data.profileId); setRole(matched);
        setFeedback(`Demo role switched to ${matched}. No account membership was created.`);
      } else {
        const result = await joinCareProfile(parsed.data);
        await refreshProfiles(parsed.data.profileId);
        setFeedback(`Joined as ${result.role}.`);
      }
      setPasscode('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not join the care circle.'); }
    finally { setBusy(false); }
  };
  return <Modal isOpen={isOpen} onClose={close} title="Care Circle & Profiles" dismissible={!busy}>
    <div className="action-row modal-tabs" role="group" aria-label="Care circle views">{(['members', 'join', 'create'] as const).map((tab) =>
      <button key={tab} type="button" className={`tab-button ${view === tab ? 'active' : ''}`} disabled={busy} aria-pressed={view === tab} onClick={() => { setView(tab); setError(''); setFeedback(''); }}>{tab === 'members' ? 'Members' : tab === 'join' ? 'Join with passcode' : 'Create Care Profile'}</button>)}</div>
    {feedback && <p className="feedback" role="status">{feedback}</p>}{error && <p className="error-message" role="alert">{error}</p>}
    {view === 'members' && <><p><strong>{activeProfile.elderName}</strong> · {activeProfile.timezone}</p><p>Your role: <strong>{role}</strong></p>
      {!careMembers.length && <p>Create or join a care profile to see its members.</p>}
      <ul className="member-list">{careMembers.map((member) => <li key={member.uid}><div><strong>{member.displayName}</strong><p>{member.email}</p></div><span className="role-badge">{member.role}</span></li>)}</ul></>}
    {view !== 'members' && !isDemo && !isLiveConnected && <p className="error-message">Sign in with a verified email account before creating or joining a profile.</p>}
    {view === 'create' && (created ? <section className="created-profile" aria-label="Created profile access codes">
      <h3>Save your role codes</h3><p>Share only the relevant code with each trusted person. These codes disappear from this view when you close it.</p>
      <p>Profile ID: <code>{created.profileId}</code></p><dl>{(Object.keys(created.codes) as MemberRole[]).map((key) => <React.Fragment key={key}><dt>{key}</dt><dd><code>{created.codes[key]}</code></dd></React.Fragment>)}</dl>
      <p>{isDemo ? 'Demo codes stay in memory for this session only.' : 'Only hashed role codes are stored on the server.'}</p>
      <button className="send-button" onClick={() => { setCreated(null); setView('members'); }}>I have saved the codes</button>
    </section> : <form className="care-form" onSubmit={create} aria-busy={busy}>
      <label htmlFor="profile-elder">Elder name<input id="profile-elder" maxLength={100} required value={elderName} onChange={(e) => setElderName(e.target.value)} /></label>
      <label htmlFor="profile-name">Your display name<input id="profile-name" maxLength={100} required value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label htmlFor="profile-timezone">Timezone<input id="profile-timezone" list="timezones" maxLength={64} required value={timezone} onChange={(e) => setTimezone(e.target.value)} /><datalist id="timezones"><option value="Asia/Kolkata" /><option value="Europe/London" /><option value="America/New_York" /><option value="UTC" /></datalist></label>
      <p>Creates the profile with you in the elder role and generates a distinct 10-digit code for each role.</p>
      <button className="send-button" disabled={busy || (!isDemo && !isLiveConnected)}>{busy ? 'Creating…' : isDemo ? 'Create demo profile & codes' : 'Create profile & codes'}</button>
    </form>)}
    {view === 'join' && <form className="care-form" onSubmit={join} aria-busy={busy}>
      <p>{isDemo ? 'Try a role code from a profile created in this demo session, or use the demo role selector.' : 'Ask the care coordinator for the profile ID and your role’s passcode.'}</p>
      <label htmlFor="join-profile">Profile ID<input id="join-profile" required value={profileId} onChange={(e) => setProfileId(e.target.value.trim())} /></label>
      <label htmlFor="join-name">Your name<input id="join-name" required maxLength={100} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label htmlFor="join-passcode">Role passcode<input id="join-passcode" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" required minLength={6} maxLength={12} value={passcode} onChange={(e) => setPasscode(e.target.value)} /></label>
      <button className="send-button" disabled={busy || (!isDemo && !isLiveConnected)}>{busy ? 'Verifying…' : isDemo ? 'Try demo role' : 'Verify & join'}</button>
    </form>}
  </Modal>;
}
