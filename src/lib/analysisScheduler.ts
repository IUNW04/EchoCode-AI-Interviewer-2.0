interface PendingAnalysis {
  timeoutId: NodeJS.Timeout;
  timestamp: number;
}

export class AnalysisScheduler {
  private pendingAnalyses: Map<string, PendingAnalysis> = new Map();
  private readonly DEFAULT_DEBOUNCE = 3000; // 3 seconds

  scheduleAnalysis(
    sessionId: string,
    code: string,
    callback: (code: string) => void,
    debounceMs: number = this.DEFAULT_DEBOUNCE
  ) {
    // Cancel any pending analysis for this session
    this.cancelPendingAnalysis(sessionId);

    const timeoutId = setTimeout(() => {
      callback(code);
      this.pendingAnalyses.delete(sessionId);
    }, debounceMs);

    this.pendingAnalyses.set(sessionId, {
      timeoutId,
      timestamp: Date.now(),
    });
  }

  cancelPendingAnalysis(sessionId: string) {
    const pending = this.pendingAnalyses.get(sessionId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingAnalyses.delete(sessionId);
    }
  }

  cleanupOldSessions(maxAgeMs: number = 5 * 60 * 1000) {
    // Clean up old sessions to prevent memory leaks
    const now = Date.now();
    for (const [sessionId, { timestamp }] of this.pendingAnalyses.entries()) {
      if (now - timestamp > maxAgeMs) {
        this.cancelPendingAnalysis(sessionId);
      }
    }
  }
}
