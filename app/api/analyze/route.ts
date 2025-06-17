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
      const response = await openai.chat.completions.create({
        model: "deepseek/deepseek-r1:free",
        messages: [
          {
            role: 'system',
            content: isChat 
          ? `You are a senior software engineer at a top-tier tech company conducting a technical coding interview. The candidate just said: "${currentMessage || 'No specific message provided'}"

The candidate has been working on the following problem:

### Current Question:
${question || 'General coding interview'}

### Conversation Context:
${conversation || 'No prior conversation'}

### Current Code:
${sanitizedCode ? '```' + language + '\n' + sanitizedCode + '\n```' : 'No code written yet'}

### Your Responsibilities:
1. **Review the conversation history** to understand the current context
2. **Analyze the provided code** (if any) for:
   - Correctness of logic
   - Approach and algorithm choice
   - Time/space complexity
   - Edge case handling
   - Code style and readability
3. **Respond naturally** to the candidate's latest message
4. **Guide the interview** by asking relevant follow-up questions
5. **Provide hints** if the candidate is stuck, but don't give away the solution

### Guidelines for Responses:
- Be concise and professional
- Reference specific parts of their code when providing feedback
- Ask one question at a time
- Encourage clear communication
- Keep responses to 2-3 sentences maximum unless more detail is needed
- If the candidate is stuck, provide a small hint rather than the full solution
- If the code looks good, suggest potential optimizations or ask about edge cases`
          : `You are a senior software engineer at a top-tier tech company (e.g., Google, Meta, Amazon) conducting a technical coding interview.

### Current Question:
${question || 'General code review'}

### Candidate's Code (${language}):
${sanitizedCode ? '```' + language + '\n' + sanitizedCode + '\n```' : 'No code provided'}

### Your Role:
You are evaluating a candidate's problem-solving skills, code quality, and technical understanding. Your goal is to help them improve while assessing their abilities.

### Assessment Criteria:
1. **Problem Understanding**
   - Did they understand the requirements?
   - Did they ask clarifying questions?

2. **Approach & Algorithm**
   - Is their approach optimal?
   - Have they considered edge cases?
   - What's the time/space complexity?

3. **Code Quality**
   - Is the code clean and readable?
   - Are variables well-named?
   - Is there any redundant code?

4. **Communication**
   - Can they explain their thought process clearly?
   - Do they consider feedback?

### Response Guidelines:
- DO NOT INCLUDE YOUR INTERNAL REASONING INTO YOUR FINAL OUTPUT/RESPONSE
- ONLY THE QUESTIONS OR/AND FEEDBACK SHOULD BE IN YOUR FINAL OUTPUT/RESPONSE
- Based on all the context, the code the leetcode style question and conversation, its up to you to be creative and ask challenging questions to the candidate to evaluate their skills and understanding
- Start with positive feedback if suitable
- Point out 1-2 key areas for improvement if suitable
- Ask open-ended questions to guide their thinking
- Ask about their code logic and approach (e.g., "I see you have used 'transaction.atomic' can you explain to me what it does and why you chose to use it?")
- Be supportive but challenging
- Keep responses concise (2-3 sentences)
- End with a question to keep the conversation flowing
- Based on all the context, the code the leetcode style question and conversation, its up to you to be creative and ask challenging questions to the candidate to evaluate their skills and understanding`
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
              content: `Question: ${JSON.stringify(question || 'General code review')}\n\nCode (${language}):\n\`\`\`${language}\n${sanitizedCode}\n\`\`\`\n\nPlease analyze this ${language} code and provide feedback.`
            }
          ])
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
