/** A minimal in-memory store for recent session messages. */
export class SessionMemory {
  private readonly sessions = new Map<string, string[]>();

  /** Add a message and retain only the newest configured number of messages. */
  public add(sessionId: string, message: string, maxMessages: number): void {
    const history = this.sessions.get(sessionId) ?? [];
    history.push(message);
    this.sessions.set(sessionId, history.slice(-maxMessages));
  }

  /** Return a copy of a session's recent messages. */
  public get(sessionId: string): readonly string[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  /** Remove a session from memory. */
  public clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
