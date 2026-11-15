/** Only an unambiguous answer to a named dose can mutate a medication record. */
export function doseAnswer(text: string): 'taken' | 'later' | null {
  const normalized = text.normalize('NFC').toLowerCase().replace(/[.!?,।]/g, '').trim().replace(/\s+/g, ' ');
  if (/^(yes|yes i took it|i took it|taken|haan|हाँ|हां|जी हाँ|जी हां|हां जी|हाँ ले ली|ले ली|ले लिया|दवा ले ली|दवाई ले ली|दवा ली है|मैंने दवा ले ली है)$/.test(normalized)) return 'taken';
  if (/^(no|not yet|not taken|later|nahi|नहीं|अभी नहीं|बाद में|नहीं ली|नहीं अभी नहीं)$/.test(normalized)) return 'later';
  return null;
}
