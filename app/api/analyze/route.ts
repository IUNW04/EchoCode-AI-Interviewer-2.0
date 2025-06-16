import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import rateLimit from '@/lib/rateLimit';
import FallbackAnalyzer from '@/lib/fallbackAnalyzer';

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
  timeout: 10000, // 10 second timeout
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
    
    const { question, code, language } = requestBody;
    
    // Validate language input
    if (!language || typeof language !== 'string') {
      return NextResponse.json({
        feedback: "Please specify a programming language for the code analysis.",
        isFallback: true
      }, { status: 400 });
    }
    const sanitizedCode = sanitizeInput(code);
    
    // Validate input
    if (!sanitizedCode || sanitizedCode.trim().length < 10) {
      return NextResponse.json({
        feedback: "Please provide more code (at least 10 characters) for meaningful feedback.",
        isFallback: true
      }, { status: 400 });
    }

    try {
      console.log('Sending request to OpenRouter...');
      const response = await openai.chat.completions.create({
        model: "deepseek/deepseek-r1:free",
        messages: [
          {
            role: 'system',
            content: `You are a senior software engineer at a top-tier tech company (e.g., Google, Meta, Amazon) conducting a technical coding interview.

You are evaluating a candidate's problem-solving skills, code quality, communication, and technical understanding. Respond as if you're speaking directly to the candidate. Keep responses natural, spoken, and clear.

### Your Responsibilities:
1. **Observe the candidate's code** and assess:
   - Whether the logic is correct
   - Which approach they are using (e.g., brute force, recursion, DP)
   - If it's optimal
   - If edge cases are handled

2. **Ask follow-up questions** based on their code.
3. **Push for improvement** - request better time/space complexity, ask for alternate approaches.
4. **Stay silent when the candidate is coding**, only interrupt if:
   - They've paused for several seconds
   - They've made a significant mistake
   - They're stuck or ask for help
5. **Encourage clear communication** - ask them to explain their thought process.

### Guidelines:
- Be supportive but challenging — simulate a professional, experienced engineer.
- Stay focused on technical content; no small talk unless prompted.
- Ask one question at a time.
- Base your comments/questions on the candidate's code and behavior.
- Be concise, clear, and confident.
- Never solve the full problem for the candidate - guide them to discover the solution.

### Types of Questions to Ask:
- Approach: "Can you walk me through your approach?"
- Alternatives: "Can you think of another way to solve this?"
- Optimization: "How would you improve the time/space complexity?"
- Edge Cases: "How would you handle [edge case]?"
- Code Quality: "Could you make this more readable/maintainable?"

Keep responses to 1-2 sentences maximum. Be direct and to the point.`
          },
          {
            role: 'user',
            content: `Question: ${JSON.stringify(question || 'General code review')}\n\nCode (${language}):\n\`\`\`${language}\n${sanitizedCode}\n\`\`\`\n\nPlease analyze this ${language} code and provide feedback.`
          }
        ],
        temperature: 0.5,
        max_tokens: 200,
        stream: false,
        response_format: { type: 'text' }
      });

      console.log('OpenRouter response:', JSON.stringify(response, null, 2));
      
      let feedback = '';
      const message = response.choices?.[0]?.message as any; // Using 'any' to handle custom response format
      
      // Extract feedback from the most appropriate field
      if (message?.content) {
        feedback = message.content.trim();
      } else if (message?.reasoning) {
        // Some models (like DeepSeek) return analysis in the reasoning field
        feedback = message.reasoning.trim();
      } else {
        console.error('Unexpected response format:', JSON.stringify(response, null, 2));
        throw new Error('Could not extract feedback from AI response');
      }
      
      // If no content in the main response, try to extract a clean response from reasoning
      if ((!feedback || feedback.length < 10) && message?.reasoning) {
        // Look for the final response in the reasoning (after any internal notes)
        const reasoning = message.reasoning;
        // Try to find the final response after any internal notes
        const finalResponseMatch = reasoning.match(/final response:[\s\n]*(.*?)(?:\n\n|$)/i);
        if (finalResponseMatch && finalResponseMatch[1]) {
          feedback = finalResponseMatch[1].trim();
        } else {
          // If no final response marker, extract the last complete sentence
          const lines = reasoning.split('\n').filter((line: string) => line.trim().length > 0);
          feedback = (lines[lines.length - 1] || '').replace(/^\s*[\-•*]\s*/, '').trim();
        }
      }
      
      // Clean up the feedback
      feedback = feedback
        // Remove any markdown code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove any remaining backticks or markdown formatting
        .replace(/[`*_~]/g, '')
        // Remove any HTML tags
        .replace(/<[^>]*>/g, '')
        // Replace multiple newlines or spaces with a single space
        .replace(/\s+/g, ' ')
        // Remove any leading numbers or bullet points
        .replace(/^\s*[0-9]+\.?\s*|^\s*[\-•*]\s*/, '')
        // Trim whitespace
        .trim();

      // If we still don't have good feedback, use the fallback analyzer
      if (!feedback || feedback.length < 10) {
        throw new Error('No valid feedback could be generated');
      }
      
      // Ensure the feedback is a complete thought
      const sentences = (feedback.match(/[^.!?]+[.!?]+/g) || [])
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      if (sentences.length > 0) {
        // Take the first complete sentence that has some substance
        feedback = sentences[0];
        
        // If it's too short, try to include the next sentence
        if (feedback.length < 20 && sentences.length > 1) {
          feedback = `${feedback} ${sentences[1]}`.trim();
        }
      } else {
        // If no complete sentences, take the first 100 characters and add an ellipsis
        feedback = feedback.length > 100 
          ? `${feedback.substring(0, 100).trim()}...` 
          : feedback;
      }

      return NextResponse.json({
        feedback: feedback,
        isFallback: false
      });
      
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);
      // Use fallback analyzer when AI fails
      try {
        const fallbackFeedback = FallbackAnalyzer.analyze(sanitizedCode);
        return NextResponse.json({
          feedback: fallbackFeedback || 
            `I noticed some code that could use improvement. ${question ? `Make sure your solution addresses the question: ${typeof question === 'string' ? question : question.title || ''}` : ''}`,
          isFallback: true
        });
      } catch (fallbackError) {
        console.error('Fallback analyzer failed:', fallbackError);
        // Provide a helpful default message
        return NextResponse.json({
          feedback: "Looking good so far! Make sure your solution is complete and handles all edge cases.",
          isFallback: true
        });
      }
    }  
  } catch (error) {
    console.error('Error in analyze route:', error);
    return NextResponse.json(
      { 
        feedback: "I'm having trouble analyzing the code right now. Please try again in a moment.",
        isFallback: true,
        error: 'analysis_failed'
      },
      { status: 500 }
    );
  }
}

// Add GET handler for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Use POST /api/analyze with { code: string, question?: string, language?: string }'
  });
}
