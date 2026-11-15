import React, { useEffect, useRef, useState } from 'react';
import { CareProvider, useCare } from '../context/CareContext.js';
import { MedicationModal } from '../components/medications/MedicationModal.js';
import { AppointmentModal } from '../components/appointments/AppointmentModal.js';
import { MedicationTimeline } from '../components/medications/MedicationTimeline.js';
import { AppointmentCard } from '../components/appointments/AppointmentCard.js';
import { AuthBanner } from '../components/auth/AuthBanner.js';
import { AuthPage } from '../components/auth/AuthPage.js';
import { AccountPage, ConnectAccountPage } from '../components/account/AccountPage.js';
import { TavusConversation } from '../components/taus/TavusConversation.js';
import { TausAgent } from '../components/taus/TausAgent.js';
import { useRoute, navigate, rememberInvitation, pendingInvitation } from './routes.js';
import { EmergencyDrawer } from '../components/emergency/EmergencyDrawer.js';
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext.js';
import { HomePage, type CareSection } from '../components/home/HomePage.js';
import type { Medication } from '@sanjeevani/shared/types/medication';
import type { MemberRole } from '@sanjeevani/shared/types/profile';

/** Inner application component accessing CareContext. */
function SanjeevaniApp(): React.JSX.Element {
  const { t, language, setLanguage, locale } = useLanguage();
  const {
    activeProfile,
    role,
    setRole,
    isElderMode,
    toggleElderMode,
    speakText,
    medications,
    appointments,
    adherenceScore,
    todayDoses,
    isDemo,
    isLiveConnected,
    canManageMedication,
    canEdit,
    demoActive,
    authReady,
    loading,
  } = useCare();

  const activeTab = useRoute();
  const setActiveTab = navigate;
  const authenticated = isDemo ? demoActive : isLiveConnected;
  useEffect(() => { if (activeTab === 'connect') rememberInvitation(); if (activeTab === 'login' && authenticated) navigate(pendingInvitation() ? 'connect' : 'account'); }, [activeTab, authenticated]);
  const [showSosAlert, setShowSosAlert] = useState(false);

  // Modals state
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | undefined>();
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);

  // Pill strip OCR simulator state
  const [pillConsent, setPillConsent] = useState(false);
  const [pillCheckStatus, setPillCheckStatus] = useState<string | null>(null);

  useEffect(() => { setIsMedModalOpen(false); setIsApptModalOpen(false); setShowSosAlert(false); }, [activeProfile.id]);

  const handleReadScheduleAloud = () => {
    const pendingDoses = todayDoses.filter((dose) => dose.status === 'pending');
    if (!pendingDoses.length) {
      speakText(t(todayDoses.length ? 'No pending doses remain in today’s schedule.' : 'No doses are scheduled for today.'));
      return;
    }
    speakText(t('Today’s pending medicines are: {0}.', pendingDoses.map((dose) => {
      const med = medications.find((item) => item.id === dose.medicationId);
      const time = new Intl.DateTimeFormat(locale, { timeZone: activeProfile.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(dose.scheduledFor));
      return t('{0}, {1}, scheduled at {2}', med?.name ?? '', med?.dosage ?? '', time);
    }).join('. ')));
  };

  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pillTimer.current) clearTimeout(pillTimer.current); }, []);
  const handleSimulatePillCheck = () => {
    if (!pillConsent) { setPillCheckStatus('Please confirm the demo consent first.'); return; }
    setPillCheckStatus('Reading sample label…');
    pillTimer.current = setTimeout(() => setPillCheckStatus('Sample label: Amlodipine 5 mg. This is not a real verification. Confirm any medicine with your caregiver or pharmacist.'), 600);
  };
  const openSection = (section: CareSection) => {
    setActiveTab(section);
    window.requestAnimationFrame(() => document.getElementById('workspace')?.focus());
  };
  const sections: readonly [CareSection, string][] = [['assistant', 'Talk to Taus'], ['medications', 'Medication Schedule'], ['appointments', 'Appointments'], ['pill-check', 'Label Verification']];

  return <div className={isElderMode ? 'elder-mode-root' : ''}>
    <a className="skip-link" href="#main">{t('Skip to care content')}</a>
    <div className="announcement"><span>{t('Everyday care, closer to home.')}</span><span>{t(isDemo ? 'Offline Demo' : isLiveConnected ? 'Firebase connected' : 'Sign-in required')} <i className="connection-dot" aria-hidden="true" /></span></div>
    <header className="site-header">
      <a className="brand" href="#main" onClick={() => setActiveTab('home')} aria-label={t('Sanjeevani Elder Care Home')}><span className="brand-mark" aria-hidden="true">✚</span><span>{t('Sanjeevani')}</span></a>
      <nav className="site-nav" aria-label={t('Home')}><a href="#main" aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => setActiveTab('home')}>{t('Home')}</a><a href="#how-it-works" onClick={() => setActiveTab('home')}>{t('How it works')}</a><button onClick={() => openSection('assistant')}>{t('My care space')}</button></nav>
      <div className="header-controls"><div className="language-switch" role="group" aria-label="Language / भाषा"><button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button lang="hi" aria-pressed={language === 'hi'} onClick={() => setLanguage('hi')}>हिन्दी</button></div><button className="header-account" onClick={() => navigate(authenticated ? 'account' : 'login')}>{authenticated ? t('Account') : t('Sign in')} <span aria-hidden="true">↗</span></button><button className="sos-button" onClick={() => setShowSosAlert(true)}>{t('SOS · Emergency help')}</button></div>
    </header>
    <main id="main" tabIndex={-1}>
      {activeTab === 'home' ? <HomePage onOpen={openSection} onCircle={() => navigate('account')} /> : !authReady ? <p role="status" className="page-shell">{t('Loading care profile…')}</p> : !authenticated || activeTab === 'login' ? <AuthPage /> : activeTab === 'connect' ? <ConnectAccountPage /> : activeTab === 'account' || (!activeProfile.id && !loading) ? <AccountPage /> : !activeProfile.id ? <p role="status" className="page-shell">{t('Loading care profile…')}</p> : <div className="page-shell" id="workspace" tabIndex={-1}>
        <div className="workspace-heading"><div><p className="eyebrow">{t('Simple routines. Shared peace of mind.')}</p><h1>{t('Your care space')}</h1></div><div className="action-row"><button className="chip" onClick={toggleElderMode} aria-pressed={isElderMode}>{t(isElderMode ? 'Large text on' : 'Large text')}</button><button className="chip" onClick={() => navigate('account')}>{t('Care Circle')} ↗</button><label className="role-badge" htmlFor="role-select">{t(isDemo ? 'Demo role:' : 'Role:')}<select id="role-select" value={role} disabled={!isDemo} onChange={(e) => setRole(e.target.value as MemberRole)}>{(['elder', 'caretaker', 'family', 'doctor'] as const).map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label></div></div>
        <AuthBanner />
        <nav className="nav-tabs" aria-label={t('Care Sections')}>{sections.map(([section, label]) => <button key={section} className={`tab-button ${activeTab === section ? 'active' : ''}`} onClick={() => setActiveTab(section)} aria-pressed={activeTab === section}>{t(label)}{section === 'medications' && ` (${adherenceScore.taken}/${adherenceScore.total})`}{section === 'appointments' && ` (${appointments.length})`}</button>)}</nav>
        {activeTab === 'assistant' && <><TavusConversation key={activeProfile.id} /><TausAgent key={`${activeProfile.id}:${role}`} onEmergency={() => setShowSosAlert(true)} /></>}
        {activeTab === 'medications' && <section className="card" aria-labelledby="med-title"><div className="section-heading"><div><h2 id="med-title" className="card-title">{t('Daily Medication Routine')}</h2><p className="card-subtitle">{t('Today’s adherence')}: <strong>{adherenceScore.percentage}%</strong> · {adherenceScore.taken}/{adherenceScore.total} {t('doses taken')}</p></div><div className="action-row"><button className="chip" onClick={handleReadScheduleAloud}>{t('Listen Aloud')}</button>{canManageMedication && <button className="send-button" onClick={() => { setEditingMedication(undefined); setIsMedModalOpen(true); }}>+ {t('Add Medication')}</button>}</div></div><MedicationTimeline key={activeProfile.id} onEdit={(med) => { setEditingMedication(med); setIsMedModalOpen(true); }} /></section>}
        {activeTab === 'appointments' && <section className="card" aria-labelledby="appt-title"><div className="section-heading"><div><h2 id="appt-title" className="card-title">{t('Upcoming Appointments')}</h2><p className="card-subtitle">{t('Care-circle appointments and specialist clinic checkups.')}</p></div><button className="send-button" disabled={!canEdit} onClick={() => setIsApptModalOpen(true)}>+ {t('Schedule Appointment')}</button></div>{!appointments.length && <p className="empty-state">{t('No appointments yet. Schedule a visit to start preparing.')}</p>}{appointments.map((item) => <AppointmentCard key={`${activeProfile.id}:${item.id}`} appointment={item} />)}</section>}
        {activeTab === 'pill-check' && <section className="card" aria-labelledby="pill-title"><h2 id="pill-title" className="card-title">{t('Pill Strip Label Verification')}</h2><p className="card-subtitle">{t('Try a sample label check. This is a demonstration, not a medicine identification service.')}</p><div className="pill-check-box"><span className="feature-mark" aria-hidden="true">✚</span><h3>{t('Read the label, with a little help.')}</h3><p>{t('A sample result shows how printed label text can be compared with your schedule. No photo is uploaded in this demo.')}</p><label className="consent-row" htmlFor="pill-consent"><input type="checkbox" id="pill-consent" checked={pillConsent} onChange={(e) => setPillConsent(e.target.checked)} />{t('I understand this is a sample demonstration.')}</label><button className="send-button" onClick={handleSimulatePillCheck} disabled={pillCheckStatus === 'Reading sample label…'}>{t('Scan sample label')}</button>{pillCheckStatus && <p className="feedback" role="status">{t(pillCheckStatus)}</p>}</div></section>}
      </div>}
    </main>
    <footer className="site-footer"><div className="footer-top"><a className="brand" href="#main" onClick={() => setActiveTab('home')}><span className="brand-mark" aria-hidden="true">✚</span>{t('Sanjeevani')}</a><p>{t('Care, with people at its heart.')}</p><button className="text-button" onClick={() => navigate('account')}>{t('Care Circle')} ↗</button></div><p className="privacy-note"><strong>{t('Safety Notice:')}</strong> {t('Sanjeevani supports care coordination. It does not diagnose, prescribe, or replace professional medical advice. In an emergency, contact your local emergency services (112 / 911).')}</p><div className="footer-bottom"><span>{t('Built with care. Designed to be simple.')}</span><span>English / हिन्दी</span></div></footer>
    {isMedModalOpen && <MedicationModal medication={editingMedication} onClose={() => setIsMedModalOpen(false)} />}
    {isApptModalOpen && <AppointmentModal isOpen onClose={() => setIsApptModalOpen(false)} />}
    {showSosAlert && <EmergencyDrawer onClose={() => setShowSosAlert(false)} />}
  </div>;
}

/** Root providers preserve the care session when switching languages. */
export function App(): React.JSX.Element {
  return <LanguageProvider><CareProvider><SanjeevaniApp /></CareProvider></LanguageProvider>;
}
