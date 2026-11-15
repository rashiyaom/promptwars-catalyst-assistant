import React, { useRef, useState } from 'react';
import type { MedicationInput } from '@sanjeevani/shared/schemas/medication';
import { useLanguage } from '../../i18n/LanguageContext.js';
import { useCare } from '../../context/CareContext.js';
import { parsePrescriptionFromImage, parsePrescriptionFromText } from '../../features/prescription/prescriptionService.js';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

interface Props {
  readonly onClose: () => void;
  readonly onAdded?: (med: MedicationInput) => void;
  readonly initialMode?: 'photo' | 'voice';
}

export function PrescriptionIntakeModal({ onClose, onAdded, initialMode = 'photo' }: Props): React.JSX.Element {
  const { t, locale, language } = useLanguage();
  const { addMedication, canManageMedication } = useCare();

  const [mode, setMode] = useState<'photo' | 'voice'>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo mode state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Voice mode state
  const [speechText, setSpeechText] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);

  // Extracted results
  const [extractedMeds, setExtractedMeds] = useState<MedicationInput[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleScanImage = async () => {
    if (!selectedFile && !imagePreview) {
      setError(t('Please select or capture a prescription photo first.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await parsePrescriptionFromImage(selectedFile || imagePreview!);
      if (!result.success || result.medications.length === 0) {
        setError(result.error || t('Could not read medications from this image. Please ensure good lighting.'));
      } else {
        setExtractedMeds(result.medications);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to process image.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.abort();
      setListening(false);
      return;
    }

    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setError(t('Voice recognition is not supported in this browser. Please type your prescription below.'));
      return;
    }

    setError(null);
    const instance = new Constructor();
    recognitionRef.current = instance;
    instance.lang = locale;
    instance.continuous = true;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let full = '';
      for (let i = 0; i < 20; i++) {
        const item = event.results[i]?.[0]?.transcript;
        if (item) full += (full ? ' ' : '') + item;
      }
      if (full) setSpeechText(full);
    };

    instance.onerror = (e) => {
      if (e.error !== 'aborted') {
        setError(t('Microphone could not hear you. Please try again or type.'));
        setListening(false);
      }
    };

    instance.onend = () => setListening(false);

    try {
      instance.start();
      setListening(true);
    } catch {
      setError(t('Could not access microphone.'));
      setListening(false);
    }
  };

  const handleParseSpeech = async () => {
    if (!speechText.trim()) {
      setError(t('Please dictate or type your prescription text first.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await parsePrescriptionFromText(speechText);
      if (!result.success || result.medications.length === 0) {
        setError(result.error || t('No medication could be extracted. Please check the spelling.'));
      } else {
        setExtractedMeds(result.medications);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to parse prescription text.'));
    } finally {
      setBusy(false);
    }
  };

  const handleAddMed = async (med: MedicationInput) => {
    if (!canManageMedication) {
      setError(t('You need caregiver or elder permissions to add medications.'));
      return;
    }
    try {
      await addMedication(med);
      setAddedNames((prev) => new Set([...prev, med.name]));
      onAdded?.(med);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not add medication.'));
    }
  };

  const handleAddAll = async () => {
    for (const med of extractedMeds) {
      if (!addedNames.has(med.name)) {
        await handleAddMed(med);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card prescription-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('AI PRESCRIPTION DIGITIZATION')}</p>
            <h2 id="intake-title">{t('Add Prescription with AI')}</h2>
            <p className="card-subtitle">{t('Upload a photo or dictate doctor instructions in English or Hindi.')}</p>
          </div>
          <button className="btn-skip" onClick={onClose} aria-label={t('Close')}>✕</button>
        </div>

        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'photo'}
            className={`tab-button ${mode === 'photo' ? 'active' : ''}`}
            onClick={() => { setMode('photo'); setError(null); }}
          >
            📷 {t('Scan Photo')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'voice'}
            className={`tab-button ${mode === 'voice' ? 'active' : ''}`}
            onClick={() => { setMode('voice'); setError(null); }}
          >
            🎙️ {t('Speak Prescription')}
          </button>
        </div>

        {error && <div className="pill-status-box error-box" role="alert"><p>{error}</p></div>}

        {mode === 'photo' && (
          <div className="intake-section">
            <p>{t('Take a clear photo of your doctor’s prescription slip or bottle label.')}</p>
            <div className="upload-box">
              <input
                type="file"
                id="rx-photo-upload"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileChange}
                aria-label={t('Upload prescription photo')}
              />
              {imagePreview && (
                <div className="preview-container">
                  <img src={imagePreview} alt={t('Prescription preview')} className="rx-preview-img" />
                </div>
              )}
            </div>
            <div className="action-row">
              <button
                type="button"
                className="send-button"
                disabled={busy || (!selectedFile && !imagePreview)}
                onClick={handleScanImage}
              >
                {busy ? t('Analyzing with AI…') : t('Extract Medicines from Photo')}
              </button>
              <button type="button" className="btn-skip" onClick={onClose}>{t('Cancel')}</button>
            </div>
          </div>
        )}

        {mode === 'voice' && (
          <div className="intake-section">
            <p>{t('Speak your prescription naturally (e.g. "Take Paracetamol 650mg twice a day at 9am and 9pm after food for 5 days").')}</p>
            <div className="voice-controls">
              <button
                type="button"
                className={`voice-mic-button ${listening ? 'listening' : ''}`}
                onClick={toggleListening}
                aria-pressed={listening}
              >
                {listening ? `⏹ ${t('Stop listening')}` : `🎙️ ${t('Start speaking')}`}
              </button>
            </div>
            <textarea
              className="chat-input"
              rows={3}
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder={language === 'hi' ? 'यहाँ बोलें या लिखें (जैसे: मेटफ़ॉर्मिन 500 मिलीग्राम दिन में दो बार खाना खाने के बाद)...' : 'Speak or type here (e.g. Metformin 500mg twice a day after meals)...'}
              aria-label={t('Prescription text')}
            />
            <div className="action-row">
              <button
                type="button"
                className="send-button"
                disabled={busy || !speechText.trim()}
                onClick={handleParseSpeech}
              >
                {busy ? t('Extracting with AI…') : t('Extract Medicines from Text')}
              </button>
              <button type="button" className="btn-skip" onClick={onClose}>{t('Cancel')}</button>
            </div>
          </div>
        )}

        {extractedMeds.length > 0 && (
          <div className="extracted-results">
            <h3>{t('Extracted Medications ({0})', String(extractedMeds.length))}</h3>
            <div className="med-review-list">
              {extractedMeds.map((med, index) => {
                const added = addedNames.has(med.name);
                return (
                  <div key={`${med.name}-${index}`} className="med-review-card">
                    <div>
                      <h4>{med.name} · {med.dosage}</h4>
                      <p className="times-badge">⏰ {med.times.join(', ')} · {med.frequency.type}</p>
                      <p className="notes-text">📝 {med.notes}</p>
                    </div>
                    <button
                      type="button"
                      className={added ? 'btn-taken' : 'send-button'}
                      disabled={added || !canManageMedication}
                      onClick={() => void handleAddMed(med)}
                    >
                      {added ? `✓ ${t('Added')}` : `+ ${t('Add to Schedule')}`}
                    </button>
                  </div>
                );
              })}
            </div>
            {extractedMeds.length > 1 && (
              <div className="action-row">
                <button type="button" className="send-button" onClick={handleAddAll} disabled={!canManageMedication}>
                  {t('Add All to Schedule')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
