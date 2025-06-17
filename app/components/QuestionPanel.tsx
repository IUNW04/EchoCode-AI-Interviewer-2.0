import React from 'react';

interface Example {
  input?: string | object;
  output?: string | object;
}

export interface Question {
  title: string;
  description: string;
  example?: Example;
}

interface QuestionPanelProps {
  question: Question | null;
  onNewQuestion: () => void;
}

export default function QuestionPanel({ question, onNewQuestion }: QuestionPanelProps) {
  // Default question data to match the design
  const defaultQuestion: Question = {
    title: 'Reverse String',
    description: 'Write a function that reverses a string. The input string is given as an array of characters.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.',
    example: {
      input: "['h','e','l','l','o']",
      output: "['o','l','l','e','h']"
    }
  };

  // Ensure we have a valid question object with all required properties
  const safeQuestion = question?.title ? question : defaultQuestion;

  const renderExample = (example: Example) => {
    if (!example) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">Example</h3>
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
          {example.input !== undefined && (
            <div>
              <span className="text-xs text-gray-500">Input:</span>
              <pre className="mt-1 text-sm bg-gray-900/50 p-2 rounded overflow-x-auto">
                {typeof example.input === 'string' 
                  ? example.input 
                  : JSON.stringify(example.input, null, 2)}
              </pre>
            </div>
          )}
          {example.output !== undefined && (
            <div>
              <span className="text-xs text-gray-500">Output:</span>
              <pre className="mt-1 text-sm bg-gray-900/50 p-2 rounded text-green-400 overflow-x-auto">
                {typeof example.output === 'string' 
                  ? example.output 
                  : JSON.stringify(example.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-card h-full flex flex-col overflow-hidden">
      <div className="p-5 border-b border-white/10">
        <h2 className="text-xl font-semibold mb-2 flex items-center">
          <span className="w-2 h-5 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full mr-2"></span>
          {safeQuestion.title}
        </h2>
      </div>
      
      <div className="flex-1 p-5 overflow-y-auto">
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Problem Statement</h3>
            <p className="text-gray-300 leading-relaxed whitespace-pre-line">
              {safeQuestion.description}
            </p>
          </div>
          
          {safeQuestion.example && renderExample(safeQuestion.example)}
        </div>
      </div>
      
      <div className="p-4 border-t border-white/10">
        <button 
          onClick={onNewQuestion}
          className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 00-1 13.9V18a1 1 0 102 0v-1.007a7.001 7.001 0 000-13.786V3a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>New Question</span>
        </button>
      </div>
    </div>
  );
}
