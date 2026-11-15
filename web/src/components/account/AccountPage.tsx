import React, { useEffect, useState } from 'react';
import { elderProfileInputSchema, invitationInputSchema, type ElderProfileInput } from '@sanjeevani/shared/schemas/profile';
import { MEMBER_ROLES } from '@sanjeevani/shared/types/access';
import type { CareInvitation, MemberRole } from '@sanjeevani/shared/types/profile';
import { useCare } from '../../context/CareContext.js';
import { useLanguage } from '../../i18n/LanguageContext.js';
import * as service from '../../features/profiles/accountService.js';
import { navigate, pendingInvitation, parseInvitation } from '../../app/routes.js';
import { ReminderSettings } from './ReminderSettings.js';

/** Account dashboard and first-run setup share the same real profile relationships. */
export function AccountPage(): React.JSX.Element {
  const { t, language } = useLanguage();
  const { user, isDemo, currentMember, profiles, activeProfile, careMembers, role, loading, dataError, refreshProfiles, switchProfile, createDemoProfile, signOutCurrentMember } = useCare();
  const [name, setName] = useState(''); const [timezone, setTimezone] = useState('Asia/Kolkata'); const [relationship, setRelationship] = useState<ElderProfileInput['relationship']>('self');
  const [email, setEmail] = useState(''); const [inviteRole, setInviteRole] = useState<MemberRole>('caretaker');
  const [invites, setInvites] = useState<CareInvitation[]>([]); const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [feedback, setFeedback] = useState('');
  const owner = activeProfile.ownerUid === (isDemo ? currentMember?.uid : user?.uid);
  useEffect(() => {
    setLink(''); setInvites([]); setError(''); setFeedback('');
    let cancelled = false;
    if (owner && !isDemo && activeProfile.id) void service.listInvitations(activeProfile.id).then((result) => { if (!cancelled) setInvites(result); }).catch(() => { if (!cancelled) setError(t('Could not load invitations.')); });
    return () => { cancelled = true; };
  }, [activeProfile.id, owner, isDemo]);
  const perform = async (action: () => Promise<void>) => { setBusy(true); setError(''); setFeedback(''); try { await action(); } catch (err) { setError(language === 'en' && err instanceof Error ? err.message : t('Please check the entered details and try again.')); } finally { setBusy(false); } };
  const create = (event: React.FormEvent) => { event.preventDefault(); void perform(async () => {
    const input = elderProfileInputSchema.parse({ elderName: name, timezone, relationship });
    if (isDemo) createDemoProfile(input); else await refreshProfiles((await service.createCareProfile(input)).profileId);
    setName(''); setFeedback(t('Elder profile added. Connect trusted people below.'));
  }); };
  const invite = (event: React.FormEvent) => { event.preventDefault(); void perform(async () => {
    const input = invitationInputSchema.parse({ profileId: activeProfile.id, email: email.trim(), role: inviteRole });
    const result = await service.createCareInvitation(input);
    const params = new URLSearchParams({ profileId: result.profileId, invitationId: result.invitationId, token: result.token });
    setLink(`${window.location.origin}${window.location.pathname}#/connect?${params}`);
    setInvites(await service.listInvitations(activeProfile.id));
    setFeedback(t('Invitation created. Share this link privately with the specified person. It expires in 48 hours.'));
  }); };
  return <section className="page-shell account-page"><div className="workspace-heading"><div><p className="eyebrow">{t('ACCOUNT → ELDER → CARE CIRCLE')}</p><h1>{t('Your care, connected.')}</h1><p>{currentMember?.displayName ?? user?.displayName ?? user?.email}</p></div><button className="btn-skip" disabled={busy} onClick={() => void perform(async () => { await signOutCurrentMember(); navigate('home'); })}>{t('Sign out')}</button></div>
    {(error || dataError) && <p className="error-message" role="alert">{error || (language === 'en' ? dataError : t('Something went wrong. Please try again or ask your care coordinator for help.'))}<button className="text-button" disabled={busy || loading} onClick={() => void refreshProfiles()}>{t('Retry loading profiles')}</button></p>}
    {feedback && <p role="status">{feedback}</p>}{loading && <p role="status">{t('Loading care profile…')}</p>}
    <div className="account-grid"><section className="card"><h2>{t('1. Your elder profiles')}</h2><p>{t('An elder profile holds care information. It is separate from a person’s login account.')}</p>
      <div className="profile-list">{profiles.map((profile) => <button className="member-choice" key={profile.id} disabled={loading || busy} aria-pressed={activeProfile.id === profile.id} onClick={() => void switchProfile(profile.id)}><strong>{profile.elderName}</strong><span>{profile.timezone}</span></button>)}</div>
      {activeProfile.id && <button className="send-button" disabled={loading || busy} onClick={() => navigate(role === 'elder' ? 'assistant' : 'medications')}>{t('Open my care space')} ↗</button>}
      <details open={profiles.length === 0}><summary>{t('Add an elder profile')}</summary><form className="care-form" onSubmit={create}>
        <label>{t('Who is this profile for?')}<select value={relationship} onChange={(e) => setRelationship(e.target.value as ElderProfileInput['relationship'])}><option value="self">{t('Myself')}</option><option value="parent">{t('My parent')}</option><option value="relative">{t('A relative')}</option><option value="other">{t('Someone I care for')}</option></select></label>
        <label>{t('Elder name')}<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label><label>{t('Timezone')}<input required value={timezone} onChange={(e) => setTimezone(e.target.value)} /></label>
        <button className="send-button" disabled={busy || loading}>{t(busy ? 'Creating…' : 'Add elder')}</button>
      </form></details><button className="text-button" onClick={() => navigate('connect')}>{t('Have an invitation? Connect an account')} ↗</button>
    </section>
    <section className="card"><h2>{t('2. Connect your care circle')}</h2>{activeProfile.id ? <><p><strong>{activeProfile.elderName}</strong> · {t(role)}{owner && ` · ${t('Profile owner')}`}</p><ul className="member-list">{careMembers.map((member) => <li key={member.uid}><div><strong>{member.displayName}</strong><p>{t(member.role)}</p></div>{owner && member.uid !== (isDemo ? currentMember?.uid : user?.uid) && !isDemo && <button className="btn-skip danger-text" disabled={busy} onClick={() => { if (window.confirm(t('Remove this person’s access to this elder?'))) void perform(async () => { await service.removeCareMember(activeProfile.id, member.uid); await refreshProfiles(activeProfile.id); }); }}>{t('Remove')}</button>}</li>)}</ul>
      {owner && !isDemo ? <form className="care-form" onSubmit={invite}><label>{t('Invite by email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>{t('Access role')}<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)}>{MEMBER_ROLES.map((value) => <option value={value} key={value}>{t(value)}</option>)}</select></label><p className="small-note">{t('Only invite people you trust. A doctor role does not verify professional credentials.')} {role === 'elder' && t('Your first accepted caretaker will manage access and reminder contacts. Earlier unused invitations will expire.')}</p><button className="send-button" disabled={busy}>{t('Create private invitation')}</button></form> : <p>{t(isDemo ? 'Sample accounts are already connected in this demo. Real invitations require Firebase mode.' : 'Only the profile owner can invite or remove members.')}</p>}
      {link && <div className="care-form"><label>{t('Private invitation link')}<textarea readOnly value={link} onFocus={(e) => e.target.select()} /></label><button className="btn-skip" onClick={() => void Promise.resolve().then(() => navigator.clipboard.writeText(link)).then(() => setFeedback(t('Link copied.'))).catch(() => setFeedback(t('Select and copy the link above.')))}>{t('Copy link')}</button></div>}
      {invites.length > 0 && <ul className="member-list">{invites.map((invitation) => <li key={invitation.id}><div>{invitation.email}<p>{t(invitation.role)} · {t(Date.parse(invitation.expiresAt) < Date.now() && invitation.status === 'pending' ? 'Expired' : invitation.status)}</p></div>{invitation.status === 'pending' && <button className="btn-skip" disabled={busy} onClick={() => void perform(async () => { await service.revokeCareInvitation(activeProfile.id, invitation.id); setInvites(await service.listInvitations(activeProfile.id)); })}>{t('Revoke')}</button>}</li>)}</ul>}
    </> : <p>{t('Add an elder or accept an invitation to continue.')}</p>}</section></div>
    {activeProfile.id && <ReminderSettings key={`${activeProfile.id}:${role}`} />}
  </section>;
}

/** A recipient must explicitly accept while signed into the invited, verified email account. */
export function ConnectAccountPage(): React.JSX.Element {
  const { t, language } = useLanguage(); const { user, isDemo, refreshProfiles } = useCare();
  const [input, setInput] = useState(() => pendingInvitation()); const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const accept = async () => {
    if (!input) return; setBusy(true); setError('');
    try { const result = await service.acceptCareInvitation(input); try { sessionStorage.removeItem('sanjeevani:invitation'); } catch { /* No persistent token remains. */ } await refreshProfiles(result.profileId); window.history.replaceState(null, '', '#/account'); window.dispatchEvent(new HashChangeEvent('hashchange')); }
    catch (err) { setError(language === 'en' && err instanceof Error ? err.message : t('Could not join the care circle.')); }
    finally { setBusy(false); }
  };
  return <section className="page-shell"><div className="card care-form"><h1>{t('Connect an account')}</h1><p>{t('Accept with the exact email address the profile owner invited. Your role comes from their invitation.')} {user?.email}</p>{error && <p role="alert" className="error-message">{error}</p>}
    {!input && <form className="care-form" onSubmit={(e) => { e.preventDefault(); const parsed = parseInvitation(url.includes('#') ? url.slice(url.indexOf('#')) : url); if (parsed) setInput(parsed); else setError(t('Use the complete invitation link.')); }}><label>{t('Paste your invitation link')}<textarea required value={url} onChange={(e) => setUrl(e.target.value)} /></label><button className="btn-skip">{t('Check invitation')}</button></form>}
    {isDemo && <p>{t('Sample accounts are already connected in this demo. Real invitations require Firebase mode.')}</p>}
    {input && <button className="send-button" disabled={busy || isDemo} onClick={() => void accept()}>{t(busy ? 'Please wait…' : 'Accept invitation')}</button>}<button className="text-button" onClick={() => navigate('account')}>{t('Back to account')}</button>
  </div></section>;
}
