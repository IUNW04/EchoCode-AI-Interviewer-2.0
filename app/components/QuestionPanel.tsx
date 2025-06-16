import React from 'react';

interface QuestionPanelProps {
  question: any;
  onNewQuestion: () => void;
}

export default function QuestionPanel({ question, onNewQuestion }: QuestionPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Current Question</h2>
        <button
          onClick={onNewQuestion}
          className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600"
        >
          New Question
        </button>
      </div>

      <div className="space-y-4">
        {question && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">{question.title}</h3>
            <p className="text-gray-700">{question.description}</p>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Example:</h4>
              <pre className="bg-gray-100 p-3 rounded-lg">
                {JSON.stringify(question.example, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
