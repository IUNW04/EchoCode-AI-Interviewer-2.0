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
  return text.slice(0, 1000); // Limit input length
}

export async function POST(request: Request) {
  console.log('Analyze request received');
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimit = checkRateLimit(ip);
  
  if (rateLimit.isRateLimited) {
    console.log(`Rate limit hit. Remaining: ${rateLimit.remaining}, Reset in: ${rateLimit.reset}s`);
    return NextResponse.json(
      { 
        feedback: `Rate limit exceeded. Please wait ${rateLimit.reset} seconds before trying again.`,
        isFallback: true,
        error: 'rate_limit_exceeded',
        resetIn: rateLimit.reset
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.reset.toString(),
          'Retry-After': rateLimit.reset.toString()
        }
      }
    );
  }

  try {
    const requestBody = await request.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { question, code, language, conversation, currentMessage, isChat } = requestBody;
    
    // Validate language input
    if (!language || typeof language !== 'string') {
      return NextResponse.json({
        feedback: "Please specify a programming language for the code analysis.",
        isFallback: true
      }, { status: 400 });
    }
    const sanitizedCode = code ? sanitizeInput(code) : '';
    
    // For chat messages, we don't require code
    if (!isChat && (!sanitizedCode || sanitizedCode.trim().length < 10)) {
      return NextResponse.json({
        feedback: "Please provide more code (at least 10 characters) for meaningful feedback.",
        isFallback: true
      }, { status: 400 });
    }

    try {
      console.log('Sending request to OpenRouter...');
      let response;
      let timeout: NodeJS.Timeout | undefined;
      
      try {
        // Make the API call with a timeout
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        response = await openai.chat.completions.create({
          model: 'deepseek/deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI coding interviewer whose sole purpose is to probe, challenge, and guide candidates through deep, technical questions about their code, design, and architecture. Follow these rules on every turn:

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
${question || 'General technical discussion'}

Candidate's Code (${language}):
${sanitizedCode ? sanitizedCode : 'No code provided'}

Conversation History:
${conversation || 'No conversation history yet.'}`
            },
            ...(isChat && currentMessage ? [
              {
                role: 'user' as const,
                content: currentMessage
              },
              {
                role: 'system' as const,
                content: 'The user has provided the above message. Continue the interview naturally based on the current context, code, and conversation history.'
              }
            ] : [
              {
                role: 'user' as const,
                content: `Question: ${JSON.stringify(question || 'General code review')}
\nCode (${language}):\n${sanitizedCode}\n\nPlease analyze this ${language} code and provide feedback.`
              }
            ])
          ],
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
          response_format: { type: 'text' }
        }, { signal: controller.signal });
        
        clearTimeout(timeout);
        console.log('OpenRouter API call successful');

        let feedback = '';
        const message = response.choices?.[0]?.message;
        
        if (!message) {
          console.error('No message in response, falling back to local analyzer');
          throw new Error('No message in response');
        }
        
        // Extract feedback from the most appropriate field
        if (message.content) {
          feedback = String(message.content).trim();
        } else if ((message as any)?.reasoning) {
          feedback = String((message as any).reasoning).trim();
        } else {
          console.error('Unexpected response format, falling back to local analyzer');
          throw new Error('Unexpected response format');
        }
        
        // Clean up the feedback
        feedback = feedback
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[`*_~]/g, '')
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .replace(/^\s*[0-9]+\.?\s*|^\s*[\-•*]\s*/, '')
          .trim();

        // Post-processing: Ensure feedback ends with a question
        if (!/[?？]\s*$/.test(feedback)) {
          // Try to generate a context-aware question
          let fallbackQuestion = '';
          if (sanitizedCode && sanitizedCode.length > 0) {
            // Try to extract a function or variable name from the code
            const funcMatch = sanitizedCode.match(/def\s+([a-zA-Z0-9_]+)/) || sanitizedCode.match(/function\s+([a-zA-Z0-9_]+)/);
            if (funcMatch && funcMatch[1]) {
              fallbackQuestion = `Can you explain why you chose to implement the function '${funcMatch[1]}' in this way, and what trade-offs or alternatives you considered?`;
            } else {
              fallbackQuestion = 'What is a possible optimization or alternative approach you could try for this problem?';
            }
          } else if (question && question.title) {
            fallbackQuestion = `What would you change in your approach if the problem statement for '${question.title}' was modified to include additional constraints?`;
          } else {
            fallbackQuestion = 'What is a possible optimization or alternative approach you could try for this problem?';
          }
          feedback = feedback.replace(/[.?!]*$/, ''); // Remove trailing punctuation
          feedback += ' ' + fallbackQuestion;
        }

        // If we still don't have good feedback, use the fallback analyzer
        if (!feedback || feedback.length < 10) {
          throw new Error('No valid feedback could be generated');
        }
        
        // Always return the full cleaned feedback
        return NextResponse.json({
          feedback: feedback,
          isFallback: false
        });
        
      } catch (error: any) {
        if (timeout !== undefined) clearTimeout(timeout);
        console.error('Error calling OpenRouter API:', error);
        
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after 30 seconds`);
        } else if (error.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.code === 'invalid_api_key') {
          throw new Error('Invalid API key. Please check your configuration.');
        } else {
          throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
        }
      }
      
    } catch (error) {
      console.error('Error in analyze API:', error);
      console.log('Falling back to local analyzer');
        
        // Provide more specific error messages based on the error type
        let errorMessage = 'An error occurred while analyzing your code';
        let errorMsg = '';
        if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
          errorMsg = (error as any).message;
        }
        if (errorMsg.includes('timed out')) {
          errorMessage = 'The analysis took too long to complete';
        } else if (errorMsg.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again in a moment.';
        } else if (errorMsg.includes('API key')) {
          errorMessage = 'Configuration issue with the analysis service';
        }
        
        console.log(`Error details: ${errorMsg}`);
        
        try {
          const fallbackFeedback = FallbackAnalyzer.analyze(sanitizedCode);
          return NextResponse.json({ 
            feedback: fallbackFeedback || `I've reviewed your code. (${errorMessage})`,
            isFallback: true,
            error: errorMsg
          });
        } catch (fallbackError) {
          console.error('Fallback analyzer failed:', fallbackError);
          return NextResponse.json({
            feedback: `I've reviewed your code. (${errorMessage})`,
            isFallback: true,
            error: errorMsg
          });
        }
      }
      
    } catch (error) {
      console.error('Error in analyze route:', error);
      // Final fallback in case of unexpected errors
      let errorMsg = '';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        errorMsg = (error as any).message;
      } else {
        errorMsg = 'Unknown error';
      }
      return NextResponse.json({
        feedback: "I'm having trouble analyzing your code right now. Please try again in a moment or ask me a specific question about your implementation.",
        isFallback: true,
        error: errorMsg
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
