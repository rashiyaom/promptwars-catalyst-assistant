/** Input accepted by an assistant response tool. */
export interface ToolInput {
  readonly intent: string;
  readonly message: string;
}

/** Interface implemented by offline and future connected response tools. */
export interface AssistantTool {
  /** Generate a response without taking a treatment decision. */
  respond(input: ToolInput): Promise<string>;
}
