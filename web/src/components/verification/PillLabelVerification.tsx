import React, { useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { useCare } from '../../context/CareContext.js';
import { checkPillStripLabel, type PillStripCheck } from '../../features/verification/pillStripService.js';

export function PillLabelVerification(): React.JSX.Element {
  const { t, language } = useLanguage();
  const hi = language === 'hi';
  const { medications, todayDoses } = useCare();

  const nextDue = todayDoses.find((d) => d.status === 'pending' || d.status === 'missed');
  const defaultMed = medications.find((m) => m.id === nextDue?.medicationId) ?? medications[0];

  const [selectedMedName, setSelectedMedName] = useState(defaultMed?.name ?? 'Metformin');
  const [selectedDosage, setSelectedDosage] = useState(defaultMed?.dosage ?? '500 mg');
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<PillStripCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const med = medications.find((m) => m.name === e.target.value);
    setSelectedMedName(e.target.value);
    if (med) setSelectedDosage(med.dosage);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async () => {
    if (!consent) {
      setError(t('Please confirm the safety check consent first.'));
      return;
    }
    if (!selectedFile && !imagePreview) {
      setError(t('Please upload or snap a photo of the medicine strip or bottle label.'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const check = await checkPillStripLabel(
        selectedFile || imagePreview!,
        selectedMedName,
        consent,
        { expectedDosage: selectedDosage },
      );
      setResult(check);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to analyze label.'));
    } finally {
      setBusy(false);
    }
  };

  // Quick interactive test samples for judges and desktop users without physical bottles
  const handleLoadSample = (type: 'match' | 'mismatch') => {
    setError(null);
    if (type === 'match') {
      setSelectedMedName('Metformin');
      setSelectedDosage('500 mg');
      // Simulated packaging sample dataUrl
      setImagePreview('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" style="background:%23f5f5f5"><rect width="380" height="180" x="10" y="10" rx="10" fill="%23fff" stroke="%23303610" stroke-width="2"/><text x="30" y="60" font-family="sans-serif" font-size="22" font-weight="bold" fill="%23111">Metformin HCl Tablets</text><text x="30" y="95" font-family="sans-serif" font-size="18" fill="%23555">500 mg</text><text x="30" y="130" font-family="sans-serif" font-size="14" fill="%23777">Batch: MF2026 Exp: 12/2028</text></svg>');
      setSelectedFile(null);
    } else {
      setSelectedMedName('Metformin');
      setSelectedDosage('500 mg');
      setImagePreview('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" style="background:%23ffebee"><rect width="380" height="180" x="10" y="10" rx="10" fill="%23fff" stroke="%23c62828" stroke-width="2"/><text x="30" y="60" font-family="sans-serif" font-size="22" font-weight="bold" fill="%23c62828">Atorvastatin Calcium</text><text x="30" y="95" font-family="sans-serif" font-size="18" fill="%23555">20 mg</text><text x="30" y="130" font-family="sans-serif" font-size="14" fill="%23777">Batch: AT991 Exp: 05/2027</text></svg>');
      setSelectedFile(null);
    }
  };

  return (
    <section className="card pill-check-section" aria-labelledby="pill-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('SAFETY & VERIFICATION LAYER')}</p>
          <h2 id="pill-title" className="card-title">{t('Real Pill Strip Label Verification')}</h2>
          <p className="card-subtitle">
            {hi
              ? 'दवा खाने से पहले पैकेट या स्ट्रिप पर लिखे नाम को अपनी निर्धारित दवा से AI द्वारा मिलाएँ।'
              : 'Verify printed medicine strips, blister foils, or bottles against your scheduled prescription using AI Vision.'}
          </p>
        </div>
        <span className="taus-orb" aria-hidden="true">🔍</span>
      </div>

      <div className="verification-steps">
        <div className="step-card">
          <label htmlFor="med-select" className="step-label">
            <strong>{t('Step 1: Which scheduled medicine are you preparing?')}</strong>
          </label>
          <select
            id="med-select"
            className="chat-input"
            value={selectedMedName}
            onChange={handleMedChange}
          >
            {medications.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} · {m.dosage}
              </option>
            ))}
          </select>
        </div>

        <div className="step-card">
          <label className="step-label">
            <strong>{t('Step 2: Upload or snap a photo of the medicine package')}</strong>
          </label>
          <div className="photo-actions">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              aria-label={t('Capture pill label')}
            />
            <button
              type="button"
              className="send-button"
              onClick={() => fileInputRef.current?.click()}
            >
              📸 {t('Take Photo or Upload Image')}
            </button>
            <div className="sample-buttons">
              <span className="small-note">{t('Or try sample packaging:')}</span>
              <button type="button" className="chip" onClick={() => handleLoadSample('match')}>
                {t('Sample Match')}
              </button>
              <button type="button" className="chip" onClick={() => handleLoadSample('mismatch')}>
                {t('Sample Mismatch')}
              </button>
            </div>
          </div>

          {imagePreview && (
            <div className="preview-container">
              <img src={imagePreview} alt={t('Medicine package preview')} className="rx-preview-img" />
            </div>
          )}
        </div>

        <div className="step-card">
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {hi
              ? 'मैं समझता/समझती हूँ कि यह सहायता केवल मुद्रित पाठ (टेक्स्ट) की जाँच करती है, गोली के अंदर की रासायनिक पहचान की नहीं।'
              : 'I understand this inspects printed label text for human verification, not chemical composition.'}
          </label>

          <div className="action-row">
            <button
              type="button"
              className="send-button"
              disabled={busy || !imagePreview || !consent}
              onClick={handleVerify}
            >
              {busy ? t('Inspecting Label with AI Vision…') : t('Verify Label with AI')}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="pill-status-box error-box" role="alert"><p>{error}</p></div>}

      {result && (
        <div
          className={`verification-result-card ${result.result}`}
          role="status"
          aria-live="polite"
        >
          <div className="result-header">
            <span className="result-badge" aria-hidden="true">
              {result.result === 'label_matches' ? '✅' : result.result === 'label_differs' ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              <h3>
                {result.result === 'label_matches'
                  ? (hi ? 'जाँच सफल: पैकेट आपकी दवा से मेल खाता है' : 'Verified Match: Label Matches Schedule')
                  : result.result === 'label_differs'
                  ? (hi ? 'चेतावनी: पैकेट आपकी दवा से भिन्न है!' : 'CAUTION: Label Differs From Schedule!')
                  : (hi ? 'पैकेट स्पष्ट नहीं है: देखभालकर्ता से पूछें' : 'Unclear Label: Verify with Caregiver')}
              </h3>
              <p className="result-message">{result.message}</p>
            </div>
          </div>

          <div className="result-details">
            {result.visibleText && (
              <p>
                <strong>{t('Printed text detected:')}</strong> <code>{result.visibleText}</code>
              </p>
            )}
            {result.detectedDosage && (
              <p>
                <strong>{t('Detected dosage:')}</strong> {result.detectedDosage} (Scheduled: {selectedDosage})
              </p>
            )}
            {result.batchOrExpiry && (
              <p>
                <strong>{t('Expiry / Batch:')}</strong> {result.batchOrExpiry}
              </p>
            )}
            {result.confidence !== undefined && (
              <p className="small-note">
                {t('AI confidence')}: {(result.confidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
