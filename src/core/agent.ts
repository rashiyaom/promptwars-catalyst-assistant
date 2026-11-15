import { loadConfig } from '../config.js';
import { validateInput } from '../guardrails/input_validator.js';
import { redactPersonalInformation } from '../guardrails/output_filter.js';
import { decide } from './decision_engine.js';
import { SessionMemory } from './memory.js';
import { MockAssistantTool } from '../tools/mock_tools.js';
import { agentRequestSchema, type AgentRequest } from '../models/schemas.js';

/** Structured result returned by one agent turn. */
export interface AgentResponse {
  readonly success: boolean;
  readonly message: string;
  readonly intent?: string;
  readonly urgency?: 'urgent' | 'routine';
  readonly error?: { readonly code: string; readonly message: string };
}

const memory = new SessionMemory();
const mockTool = new MockAssistantTool();

/** Run validation, deterministic decision-making, offline response, and redaction. */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const parsed = agentRequestSchema.safeParse(request);
  if (!parsed.success) return { success: false, message: 'Please rephrase your message and try again.', error: { code: 'INPUT_REJECTED', message: 'Invalid session or message.' } };
  const validation = validateInput(parsed.data.message);
  if (!validation.accepted) {
    return {
      success: false,
      message: 'Please rephrase your message and try again.',
      error: { code: 'INPUT_REJECTED', message: validation.reason ?? 'Input was rejected.' },
    };
  }

  try {
    const decision = decide(validation.sanitized);
    memory.add(request.sessionId, validation.sanitized, loadConfig().maxSessionMessages);
    const response = await mockTool.respond({ intent: decision.intent, message: validation.sanitized });
    return {
      success: true,
      message: redactPersonalInformation(response),
      intent: decision.intent,
      urgency: decision.urgency,
    };
  } catch {
    return {
      success: false,
      message: 'Sanjeevani could not process that request. Please try again or contact your care circle.',
      error: { code: 'AGENT_FAILURE', message: 'The assistant encountered an unexpected error.' },
    };
  }
}
