'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('./components/Editor'), { ssr: false });
import Interviewer from './components/Interviewer';
import QuestionPanel from './components/QuestionPanel';
import LanguageSelector from './components/LanguageSelector';

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isRecording, setIsRecording] = useState(false);
  const [interviewerResponse, setInterviewerResponse] = useState('');

  const fetchQuestion = async () => {
    try {
      const response = await fetch('/api/questions');
      const data = await response.json();
      setCurrentQuestion(data.question);
    } catch (error) {
      console.error('Error fetching question:', error);
    }
  };

  // Fetch initial question once on mount
  useEffect(() => {
    fetchQuestion();
  }, []);

  // Handle code changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  // Debounced code analysis
  useEffect(() => {
    // Don't analyze if code is too short or no question is selected
    if (!code.trim() || code.trim().length < 10 || !currentQuestion) {
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        setInterviewerResponse(prev => prev === "Analyzing your code..." ? prev : "Analyzing your code...");
        
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentQuestion,
            code: code,
            language: language
          })
        });
        
        const data = await response.json();
        if (data.feedback) {
          setInterviewerResponse(data.feedback);
        }
      } catch (error) {
        console.error('Analysis error:', error);
        setInterviewerResponse("I'm having trouble analyzing your code. Please try again in a moment.");
      }
    }, 1500); // 1.5 second delay after typing stops

    return () => clearTimeout(delayDebounce);
  }, [code, currentQuestion]);

  // Request code analysis
  const requestCodeAnalysis = async () => {
    if (!code.trim()) {
      setInterviewerResponse("Please write some code before requesting feedback.");
      return;
    }
    setInterviewerResponse("Analyzing your code...");
    await analyzeCode(code);
  };

  // Handle user speech
  const handleUserSpeech = (text: string) => {
    // Handle voice commands
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('new question') || lowerText.includes('next question')) {
      fetchQuestion()
        .then(() => {
          setCode('');
          setInterviewerResponse('');
        });
    } else if (lowerText.includes('analyze') || lowerText.includes('how am i doing') || lowerText.includes('feedback')) {
      requestCodeAnalysis();
    } else if (lowerText.includes('hint') || lowerText.includes('help')) {
      setInterviewerResponse("Try breaking down the problem into smaller steps. Would you like me to analyze your current solution?");
    } else if (lowerText.includes('clear') || lowerText.includes('reset')) {
      setCode('');
      setInterviewerResponse('');
    }
  };

  const analyzeCode = async (codeToAnalyze: string) => {
    if (!currentQuestion) {
      setInterviewerResponse("Please select a question first.");
      return;
    }

    try {
      console.log('Sending analysis request...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentQuestion,
          code: codeToAnalyze,
          language: language
        })
      });

      console.log('Analysis response status:', response.status);
      
      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        const remaining = response.headers.get('X-RateLimit-Remaining');
        console.log(`Rate limited. Remaining: ${remaining}, Reset in: ${resetTime}s`);
        setInterviewerResponse(`Rate limit exceeded. Please wait a moment before trying again.`);
        return;
      }

      const data = await response.json();
      console.log('Analysis response data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze code');
      }

      setInterviewerResponse(data.feedback || 'No feedback provided');
    } catch (error) {
      console.error('Error analyzing code:', error);
      setInterviewerResponse(`Error: ${error.message || 'Failed to analyze code. Please try again.'}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">CodeEcho AI Interview</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Question Panel */}
          <QuestionPanel
            question={currentQuestion}
            onNewQuestion={() => {
              fetchQuestion();
              setCode('');
              setInterviewerResponse('');
            }}
          />

          {/* Code Editor */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="bg-gray-800 text-white px-4 py-2 rounded-t-lg flex justify-between items-center">
              <span className="text-sm font-mono">Code Editor</span>
              <LanguageSelector 
                value={language}
                onChange={setLanguage}
                className="text-gray-800"
              />
            </div>
            <div className="flex-1 border border-gray-200 rounded-b-lg overflow-hidden">
              <Editor
                code={code}
                onCodeChange={handleCodeChange}
                language={language}
                height="100%"
                className="h-full"
              />
            </div>
          </div>

          {/* Interviewer Panel */}
          <Interviewer
            response={interviewerResponse}
            isRecording={isRecording}
            onRecord={() => setIsRecording(!isRecording)}
            onUserSpeech={handleUserSpeech}
          />
        </div>
      </div>
    </main>
  );
}
