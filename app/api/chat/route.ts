import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

export async function POST(request: Request) {
  try {
    const { difficulty = 'medium', topic = 'algorithms' } = await request.json();
    
    // System message for generating coding questions
    const systemMessage = {
      role: 'system' as const,
      content: `You are a LeetCode question generator.
      
### Your Task:
Generate a coding question in the following format:

{
  "title": "Question Title",
  "description": "Detailed description of the problem including examples",
  "difficulty": "easy/medium/hard",
  "topic": "algorithm/data structure/concept",
  "examples": [
    {
      "input": "example input",
      "output": "expected output",
      "explanation": "brief explanation"
    }
  ]
}

### Guidelines:
1. Make the question clear and unambiguous
2. Include 1-2 example inputs/outputs
3. Specify the expected function signature
4. Keep the question challenging but solvable in 30-45 minutes
5. Focus on ${topic} topics
6. Make it ${difficulty} difficulty`
    };

    // Call OpenAI's API to generate a question
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-r1:free',
      messages: [systemMessage],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    // Parse and validate the response
    const response = completion.choices?.[0]?.message?.content;
    if (!response) {
      throw new Error('Failed to generate question');
    }

    const questionData = JSON.parse(response);
    return NextResponse.json(questionData);
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
