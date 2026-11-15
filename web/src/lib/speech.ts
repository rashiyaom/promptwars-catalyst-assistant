/** One cancellable speech channel, shared by Taus and schedule read-outs. */
let version = 0;
let activeAudio: HTMLAudioElement | undefined;
let controller: AbortController | undefined;
let speaking = false;

export function stopSpeech(): void {
  version += 1;
  controller?.abort(); controller = undefined;
  activeAudio?.pause(); activeAudio = undefined;
  window.speechSynthesis?.cancel();
  speaking = false;
}
export function isSpeaking(): boolean { return speaking; }

export async function speak(text: string, locale: string, onEnd?: () => void, onError?: () => void): Promise<void> {
  stopSpeech();
  const current = version;
  speaking = true;
  const finish = (failed = false) => {
    if (current !== version) return;
    speaking = false;
    if (failed) onError?.(); else onEnd?.();
  };
  // Static Firebase Hosting has no secret backend. Device speech remains free there.
  if (import.meta.env.DEV) {
    controller = new AbortController();
    try {
      const response = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: locale === 'hi-IN' ? 'hi-IN' : 'en-IN' }), signal: controller.signal,
      });
      if (!response.ok) throw new Error('Speech unavailable');
      const data = await response.json() as { audio: string };
      if (current !== version) return;
      activeAudio = new Audio(`data:audio/wav;base64,${data.audio}`);
      activeAudio.onended = () => finish();
      activeAudio.onerror = () => finish(true);
      await activeAudio.play();
      return;
    } catch { if (current !== version) return; }
  }
  if (!window.speechSynthesis) { finish(true); return; }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale; utterance.rate = 0.9;
  utterance.onend = () => finish();
  utterance.onerror = () => finish(true);
  window.speechSynthesis.speak(utterance);
}
