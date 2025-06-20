import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import rateLimit from '@/lib/rateLimit';
import FallbackAnalyzer from '@/src/lib/fallbackAnalyzer';

// Debug logging
console.log('Analyze route loaded - imports successful');

const { checkRateLimit } = rateLimit;

// Initialize OpenAI client with OpenRouter configuration
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://codeecho-ai.vercel.app",
    "X-Title": "CodeEcho AI"
  },
  timeout: 25000, // 10 second timeout
  maxRetries: 1
});

function sanitizeInput(text: string): string {
  if (!text) return '';
  return text.slice(0, 2000); // Limit input length
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitResult = checkRateLimit(ip);
  
  if (rateLimitResult.isRateLimited) {
    return NextResponse.json({
        feedback: `Rate limit exceeded. Please wait ${rateLimitResult.reset} seconds.`,
        isFallback: true
      }, { status: 429 }
    );
  }

  try {
    const { question, code, language, conversation, currentMessage, isChat } = await request.json();
    const sanitizedCode = code ? sanitizeInput(code) : '';

    if (!isChat && (!sanitizedCode || sanitizedCode.trim().length < 10)) {
      return NextResponse.json({
        feedback: "Please provide more code (at least 10 characters) for meaningful feedback.",
      }, { status: 400 });
    }
    
    const systemPrompt = `You are an expert AI coding interviewer whose sole purpose is to probe, challenge, and guide candidates through deep, technical questions about their code, design, and architecture. Follow these rules on every turn:

Adopt a Conversational, Friendly Tone
• Speak as if you're sitting beside the candidate—no robotic preambles ("As an AI...").
• Use clear, precise language without markdown headings or generic phrases.
Deliver In-Depth Analysis
• Highlight both strengths and weaknesses in the candidate's solution.
• Offer concrete observations about algorithm choices, data structures, scalability, edge cases, real‑world trade‑offs, and system implications.
• Teach one nuanced lesson or pitfall each time.
Always End with a Specific, Challenging Follow‑Up Question
• Your last sentence must be a question that forces deeper thought on the candidate's code or approach.
• Examples:
– "I see you used @transaction.atomic around multiple updates—can you explain exactly what guarantees it provides and why you chose it here?"
– "You've indexed on (user_id, created_at)—how would you modify your schema or query if you needed to sort by popularity instead?"
• Never close without a question.
Maintain Interview Flow
• Do not reveal your internal reasoning.
• Keep responses to at least five sentences, weaving critique with teaching.
• Avoid bullet‑point fluff; blend observations into paragraphs.
Adapt to Context
• If the candidate asks about a specific line (e.g., "i see you used transaction atomic. can u explain what it does and why u chpse"), respond with a clear definition, the problem it solves, any pitfalls, and then pose a follow‑up question about alternative strategies or edge cases.

Current Question:
${question?.title || 'General technical discussion'}

Candidate's Code (${language}):
${sanitizedCode ? sanitizedCode : 'No code provided'}

Conversation History:
${conversation || 'No conversation history yet.'}`;

    let userContent = `Question: ${question?.title || 'General code review'}\nCode (${language}):\n${sanitizedCode}\n\nPlease analyze this ${language} code and provide feedback.`;
    if (isChat && currentMessage) {
      userContent = currentMessage;
    }

    const response = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: false,
    });

    let feedback = response.choices?.[0]?.message?.content?.trim() || '';

    if (!feedback) {
      throw new Error('No feedback generated');
    }

    if (!/[?？]\s*$/.test(feedback)) {
        feedback += ' What are the trade-offs of your approach?';
    }

    return NextResponse.json({ feedback });

  } catch (error: any) {
    console.error('Error in analyze API:', error);
    const fallbackFeedback = FallbackAnalyzer.analyze('');
    return NextResponse.json({ 
        feedback: fallbackFeedback || `I've encountered an issue. (${error.message || 'Unknown error'})`,
        isFallback: true 
    }, { status: 500 });
  }
}

// Add GET handler for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Use POST /api/analyze with { code: string, question?: string, language?: string }'
  });
}
