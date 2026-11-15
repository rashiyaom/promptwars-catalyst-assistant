import { z } from 'zod';

/** Validated input for a single Sanjeevani assistant turn. */
export const agentRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  message: z.string().trim().min(1).max(2_000),
  userId: z.string().trim().min(1).max(128).optional(),
});

/** Type inferred from the request validation schema. */
export type AgentRequest = z.infer<typeof agentRequestSchema>;
