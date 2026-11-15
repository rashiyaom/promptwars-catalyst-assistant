import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';

export type CareSection = 'assistant' | 'medications' | 'appointments' | 'pill-check';
interface HomePageProps {
  readonly onOpen: (section: CareSection) => void;
  readonly onCircle: () => void;
}

/** Lightweight editorial homepage: real profile summaries and CSS artwork, no remote media. */
export function HomePage({ onOpen, onCircle }: HomePageProps): React.JSX.Element {
  const { t } = useLanguage();
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow"><span className="tiny-cross" aria-hidden="true" />{t('A little support. A lot of care.')}</p>
          <h1 id="hero-title">{t('CARE THAT')}<br />{t('FEELS LIKE')}<br /><span>{t('FAMILY.')}</span></h1>
          <p className="hero-description">{t('Medicines, appointments, and the people who matter. Bring everyday care together in one calm, simple place.')}</p>
          <div className="hero-actions"><button className="button-dark" onClick={() => onOpen('assistant')}>{t('Get started with Taus')} <span aria-hidden="true">↗</span></button><a className="button-outline" href="#how-it-works">{t('See how it works')} <span aria-hidden="true">↓</span></a></div>
          <p className="hero-note"><span aria-hidden="true">◉</span> {t('Made for elders. Shared with loved ones.')}</p>
        </div>
        <div className="hero-visual">
          <div className="care-motif" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</div>
          <article className="today-preview" aria-labelledby="preview-title">
            <div className="preview-heading"><span className="eyebrow">{t('A DAY, WELL CARED FOR')}</span><span className="preview-dot" aria-hidden="true" /></div>
            <h2 id="preview-title">{t('Your daily rhythm')}</h2>
            <p className="preview-name">{t('Your care starts here')}</p>
            <ol className="care-form"><li>{t('Create and verify your account')}</li><li>{t('Add yourself or an elder you care for')}</li><li>{t('Add your medicines and appointments')}</li></ol>
            <button className="preview-link" onClick={() => onOpen('assistant')}>{t('Create account')} ↗</button>
          </article>
          <div className="visual-caption"><span aria-hidden="true">✳</span> {t('Small routines. More peace of mind.')}</div>
        </div>
      </div>
    </section>
    <section className="care-strip" aria-label={t('Care at a glance')}>
      <p>{t('A little more connected.')}<br /><strong>{t('A little less to worry about.')}</strong></p>
      <div><strong>01</strong><span>{t('Create account')}</span></div><div><strong>02</strong><span>{t('Add an elder profile')}</span></div><div><strong>03</strong><span>{t('Connect your care circle')}</span></div>
    </section>
    <section className="home-section" id="how-it-works" aria-labelledby="how-title">
      <div className="section-intro"><p className="eyebrow">{t('TOGETHER, EVERY DAY')}</p><h2 id="how-title">{t('Care is a shared journey.')}<br /><span>{t('Let’s make it simpler.')}</span></h2><p>{t('Stay on top of the little things, so you can spend more time on what matters. Start with a routine, prepare for a visit, or bring your family closer.')}</p></div>
      <div className="feature-grid">
        <article className="feature-card feature-lime"><span className="feature-top"><span className="feature-mark" aria-hidden="true">✚</span><span>01 /</span></span><h3>{t('A rhythm for every day.')}</h3><p>{t('A clear medicine timeline, gentle voice support, and a simple way to keep track.')}</p><button className="feature-action" onClick={() => onOpen('medications')}>{t('Explore medicines')} <span aria-hidden="true">↗</span></button></article>
        <article className="feature-card feature-lilac"><span className="feature-top"><span className="feature-mark" aria-hidden="true">▦</span><span>02 /</span></span><h3>{t('Feel ready for your visit.')}</h3><p>{t('Keep doctor visits, preparation notes, and directions together. One less thing to remember.')}</p><button className="feature-action" onClick={() => onOpen('appointments')}>{t('Plan a visit')} <span aria-hidden="true">↗</span></button></article>
        <article className="feature-card feature-blue"><span className="feature-top"><span className="feature-mark" aria-hidden="true">✳</span><span>03 /</span></span><h3>{t('Your people, by your side.')}</h3><p>{t('Connect elders, caregivers, and family in a shared space with the right access for each person.')}</p><button className="feature-action" onClick={onCircle}>{t('Meet your care circle')} <span aria-hidden="true">↗</span></button></article>
      </div>
    </section>
    <section className="home-section onboarding-overview"><p className="eyebrow">{t('OUR GOAL: INDEPENDENCE WITH SUPPORT')}</p><h2>{t('A simple path to connected care')}</h2><ol className="setup-steps"><li>{t('Create and verify your account')}</li><li>{t('Add yourself or an elder you care for')}</li><li>{t('Connect a trusted caregiver and doctor')}</li><li>{t('Talk to Taus about your daily routine')}</li></ol><p>{t('You stay in control. Trusted caregivers manage reminders; Taus records only what you confirm.')}</p></section><section className="home-cta"><div><p className="eyebrow">{t('A HELPING HAND, WHEN YOU NEED IT')}</p><h2>{t('Just talk. Taus is listening.')}</h2><p>{t('Taus knows the active elder’s schedule, asks about each dose, and keeps the trusted care circle informed.')}</p></div><button className="button-dark" onClick={() => onOpen('assistant')}>{t('Talk to your assistant')} <span aria-hidden="true">↗</span></button></section>
  </>;
}
