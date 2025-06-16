interface AnalysisRule {
  pattern: RegExp;
  feedback: string;
  priority: number;
}

export class FallbackAnalyzer {
  private static instance: FallbackAnalyzer;
  
  public static getInstance(): FallbackAnalyzer {
    if (!FallbackAnalyzer.instance) {
      FallbackAnalyzer.instance = new FallbackAnalyzer();
    }
    return FallbackAnalyzer.instance;
  }
  
  private constructor() {}
  private static readonly RULES: AnalysisRule[] = [
    {
      pattern: /for\s*\(/,
      feedback: "I see you're using a loop. Have you considered the termination condition?",
      priority: 1,
    },
    {
      pattern: /if\s*\(/,
      feedback: "Good use of conditional logic! Have you considered all possible cases?",
      priority: 1,
    },
    {
      pattern: /function\s+\w+\(/,
      feedback: "Nice function definition! Does it have a clear single responsibility?",
      priority: 2,
    },
    {
      pattern: /const\s+\w+\s*=\s*\(\)\s*=>/,
      feedback: "I see an arrow function. Have you considered error handling for this?",
      priority: 2,
    },
    {
      pattern: /console\.log/,
      feedback: "Using console.log for debugging? That's a good start! Would you like to learn about more advanced debugging techniques?",
      priority: 3,
    },
  ];

  static analyze(code: string): string | null {
    if (!code || code.trim().length < 10) {
      return "Keep going! I'll provide feedback once you've written more code.";
    }

    // Sort rules by priority (highest first)
    const sortedRules = [...this.RULES].sort((a, b) => b.priority - a.priority);

    // Check each rule against the code
    for (const rule of sortedRules) {
      if (rule.pattern.test(code)) {
        return rule.feedback;
      }
    }

    // Default fallback responses
    const defaultResponses = [
      "Looking good so far! Keep going!",
      "I see you're making progress. Would you like a hint?",
      "Nice work! Have you considered edge cases?",
      "Keep it up! Would you like me to review your approach?",
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }
}

export default FallbackAnalyzer;
