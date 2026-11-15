import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';
export function ReminderSettings(): React.JSX.Element {
 const {language}=useLanguage();
 return <section className="card"><h2>{language==='hi'?'मुफ़्त योजना में रिमाइंडर':'Free-plan reminders'}</h2><p>{language==='hi'?'ताऊस पेज खुला रहने पर याद दिला सकता है। अपने फ़ोन में अलार्म भी लगाएँ। अपने-आप ईमेल भेजना और बैकग्राउंड रिमाइंडर अभी उपलब्ध नहीं हैं।':'Taus can remind you while the page is open. Also set an alarm on your phone. Automatic email delivery and background reminders are unavailable on this plan.'}</p></section>;
}
