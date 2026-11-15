import type { AssistantTool, ToolInput } from './base.js';

/** Deterministic response tool for local development and offline evaluation. */
export class MockAssistantTool implements AssistantTool {
  /** Respond with a safe, repeatable message based on the selected intent. */
  public async respond(input: ToolInput): Promise<string> {
    if (input.intent === 'urgent_safety') {
      return 'This may need urgent attention. Please contact local emergency services now and ask someone nearby to stay with you.';
    }
    if (input.intent === 'missed_dose') {
      return 'I cannot advise whether to take or skip a dose. Check the medication instructions and contact your pharmacist or care team for guidance.';
    }
    if (input.intent === 'appointment') {
      return 'I can help organize appointment details. Please check with your care circle if you need to confirm a time or make a change.';
    }
    return 'I can help organize care information. What would you like to keep track of?';
  }
}
