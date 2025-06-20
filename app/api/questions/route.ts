export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI with OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "CodeEcho AI"
  }
});

// Simple in-memory question bank as fallback
const fallbackQuestions = [
  {
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    example: {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]"
    }
  },
  {
    title: "Reverse String",
    description: "Write a function that reverses a string. The input string is given as an array of characters.",
    example: {
      input: "['h','e','l','l','o']",
      output: "['o','l','l','e','h']"
    }
  }
];

function extractJson(str: string): string | null {
    const match = str.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}

function sanitizeJsonString(str: string): string {
  // Replace unescaped newlines and carriage returns inside string values with a space
  // This is a simple but effective fix for most AI-generated JSON quirks
  return str.replace(/\r?\n/g, ' ');
}

export async function GET() {
  // First, test the API key is working
  try {
    // Test the API key by making a simple request
    const testResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const testData = await testResponse.json();
    console.log('API Key Test Response:', testData);

    if (!testResponse.ok) {
      throw new Error(`API Error: ${testData.error?.message || 'Unknown error'}`);
    }

    // If API key is valid, try to generate a question
    const completion = await openai.chat.completions.create({
      model: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo",
      messages: [
        {
          role: "system",
          content: "You are a JSON generator. You will be given a task and you will respond with ONLY a valid JSON object that fulfills the task. Do not include any other text, explanations, or markdown."
        },
        {
            "role": "user",
            "content": "Generate a coding problem with a difficulty of 'Hard' on a platform like LeetCode or HackerRank. The problem should require understanding of complex algorithms (e.g., dynamic programming, graph traversal, advanced data structures) and not be a common, introductory-level problem like reversing words or FizzBuzz. The output MUST be a JSON object with three keys: \"title\" (string), \"description\" (string), and \"example\" (an object with \"input\" and \"output\" string keys)."
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const rawContent = completion.choices[0]?.message?.content;
    console.log('Generated Content:', rawContent);

    if (!rawContent) {
        throw new Error('No content received from AI');
    }

    const jsonContent = extractJson(rawContent);

    if (!jsonContent) {
        // Fallback to local questions if no JSON object is found
        const randomQuestion = fallbackQuestions[
          Math.floor(Math.random() * fallbackQuestions.length)
        ];
        return NextResponse.json({ 
          question: randomQuestion,
          error: 'No JSON object found in AI response',
          note: 'Falling back to local questions'
        });
    }

    // Try to parse the response
    try {
      const sanitized = sanitizeJsonString(jsonContent);
      const question = JSON.parse(sanitized);
      // Clean up example fields if they are wrapped in extra quotes
      if (question.example) {
        if (typeof question.example.input === 'string') {
          question.example.input = question.example.input.replace(/^"|"$/g, '');
        }
        if (typeof question.example.output === 'string') {
          question.example.output = question.example.output.replace(/^"|"$/g, '');
        }
      }
      return NextResponse.json({ question });
    } catch (parseError) {
      console.error('Failed to parse extracted JSON:', parseError);
      console.error('Original content was:', rawContent);
      throw new Error('Invalid JSON format from AI');
    }

  } catch (error) {
    console.error('Error in GET /api/questions:', error);
    
    // Fallback to local questions
    const randomQuestion = fallbackQuestions[
      Math.floor(Math.random() * fallbackQuestions.length)
    ];
    
    return NextResponse.json({ 
      question: randomQuestion,
      error: error instanceof Error ? error.message : 'Unknown error',
      note: 'Falling back to local questions'
    });
  }
}
