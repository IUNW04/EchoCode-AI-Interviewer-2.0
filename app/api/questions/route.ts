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
      model: "deepseek/deepseek-r1:free",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates coding interview questions. Respond with a valid JSON object containing: title, description, and example (with input and output)."
        },
        {
          role: "user",
          content: "Generate a simple coding question. Example response format: {\"title\":\"Question Title\",\"description\":\"Problem description\",\"example\":{\"input\":\"example input\",\"output\":\"example output\"}}"
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    console.log('Generated Content:', content);

    // Try to parse the response
    try {
      const question = JSON.parse(content || '{}');
      return NextResponse.json({ question });
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      throw new Error('Invalid response format from AI');
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
