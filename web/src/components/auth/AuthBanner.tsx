import React from 'react';
import { useCare } from '../../context/CareContext.js';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { navigate } from '../../app/routes.js';

/** Compact profile controls keep the care workspace separate from the public homepage. */
export function AuthBanner(): React.JSX.Element {
  const { t } = useLanguage();
  const { user, isDemo, profiles, activeProfile, switchProfile, loading, dataError, refreshProfiles, currentMember } = useCare();
  return <section className="account-banner" aria-label={t('Account and care profile')}>
    <div><span className="eyebrow">{t(isDemo ? 'Offline demo · no account needed' : 'Connect your care circle')}</span><p>{currentMember?.displayName ?? user?.displayName ?? user?.email ?? t('Browsing as guest')}</p><button className="text-button" onClick={() => navigate('account')}>{t(isDemo ? 'Switch member' : 'Account')} ↗</button></div>
    {profiles.length > 0 && <label className="profile-picker" htmlFor="profile-select">{t('Care profile')}<select id="profile-select" value={activeProfile.id} disabled={loading} onChange={(e) => void switchProfile(e.target.value)}>
      {!activeProfile.id && <option value="">{t('Select a profile')}</option>}{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.elderName}</option>)}
    </select></label>}
    {!isDemo && user && !profiles.length && !loading && <p>{t('Open Care Circle to create your first profile or join with a role passcode.')}</p>}
    {loading && <p role="status">{t('Loading care profile…')}</p>}
    {dataError && <div className="error-message" role="alert">{t('Something went wrong. Please try again or ask your care coordinator for help.')}<button className="btn-skip" disabled={loading} onClick={() => void refreshProfiles()}>{t('Retry loading profiles')}</button></div>}
  </section>;
}
