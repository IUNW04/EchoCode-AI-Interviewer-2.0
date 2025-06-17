'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import Editor from './components/Editor';
import Interviewer from './components/InterviewerWithElevenLabs';
import QuestionPanel, { Question } from './components/QuestionPanel';
import LanguageSelector from './components/LanguageSelector';

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isRecording, setIsRecording] = useState(false);
  const [interviewerResponse, setInterviewerResponse] = useState('');

  const fetchQuestion = async () => {
    try {
      // Show loading state
      setInterviewerResponse('Loading a new question...');
      
      const response = await fetch('/api/questions');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure we have a properly formatted question object
      const questionData: Question = {
        title: data.question?.title || 'Coding Challenge',
        description: data.question?.description || 'No question available',
        example: data.question?.example || undefined
      };
      
      setCurrentQuestion(questionData);
      setCode(''); // Clear previous code
      
      // If we have a response, speak it
      if (questionData.description) {
        // Small delay to allow state to update
        setTimeout(() => {
          setInterviewerResponse(questionData.description);
        }, 100);
      }
      
      return data.question;
    } catch (error) {
      console.error('Error fetching question:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load question';
      setInterviewerResponse(`Error: ${errorMessage}. Please try again.`);
      return null;
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
      } catch (error: unknown) {
        console.error('Analysis error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setInterviewerResponse(`I'm having trouble analyzing your code: ${errorMessage}. Please try again in a moment.`);
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

  // State to maintain conversation history
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);

  // Handle user speech
  const handleUserSpeech = async (text: string) => {
    // Add user message to conversation history
    const userMessage = { role: 'user' as const, content: text };
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);
    
    // Handle voice commands
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('new question') || lowerText.includes('next question')) {
      fetchQuestion()
        .then(() => {
          setCode('');
          setInterviewerResponse('');
          setConversationHistory([]);
        });
      return;
    } else if (lowerText.includes('clear') || lowerText.includes('reset')) {
      setCode('');
      setInterviewerResponse('');
      setConversationHistory([]);
      return;
    }

    // For regular conversation and code analysis
    try {
      setInterviewerResponse("Thinking...");
      
      // Format the conversation history for the API
      const conversationContext = updatedHistory
        .map(msg => `${msg.role === 'user' ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
        .join('\n');
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion?.description || 'General coding interview',
          code: code,
          language: language,
          conversation: conversationContext,
          currentMessage: text, // Include the current transcribed message
          isChat: true // Flag to indicate this is a chat message, not code analysis
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response from AI');
      }

      const data = await response.json();
      const assistantResponse = data.feedback || 'I apologize, but I could not generate a response.';
      
      setInterviewerResponse(assistantResponse);
      
      // Add AI response to conversation history
      setConversationHistory(prev => [
        ...prev, 
        { role: 'assistant' as const, content: assistantResponse }
      ]);
      
    } catch (error) {
      console.error('Error processing chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setInterviewerResponse(`Error: ${errorMessage}. Please try again.`);
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
    } catch (error: unknown) {
      console.error('Error analyzing code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze code. Please try again.';
      setInterviewerResponse(`Error: ${errorMessage}`);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6 overflow-hidden">
      {/* Floating Particles Background */}
      <div className="fixed inset-0 z-0">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white/5 rounded-full"
            style={{
              width: Math.random() * 10 + 5,
              height: Math.random() * 10 + 5,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${Math.random() * 10 + 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="glass-card mb-6 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">CE</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">CodeEcho AI</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={fetchQuestion}
            className="btn-primary flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            disabled={isRecording}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v2.101a7.002 7.002 0 00-1 13.9V18a1 1 0 102 0v-1.007a7.001 7.001 0 000-13.786V3a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>New Question</span>
          </button>
          <div className="flex items-center space-x-2 glass-card px-4 py-2 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm">AI Interviewer</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4" style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
        {/* Question Panel */}
        <div className="lg:w-1/4 flex-shrink-0 flex flex-col h-full overflow-hidden">
          <div className="glass-card h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex-shrink-0">
              <h2 className="font-medium">Question</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <QuestionPanel question={currentQuestion} onNewQuestion={fetchQuestion} />
            </div>
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="glass-card flex flex-col h-full">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-medium flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span>Code Editor</span>
              </h2>
              <LanguageSelector 
                value={language}
                onChange={setLanguage}
              />
            </div>
            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0">
                <Editor 
                  code={code}
                  onCodeChange={handleCodeChange}
                  language={language}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AI Interviewer Panel */}
        <div className="lg:w-1/4 flex-shrink-0 flex flex-col h-full overflow-hidden">
          <div className="glass-card h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex-shrink-0">
              <h2 className="font-medium">AI Interviewer</h2>
            </div>
            <div className="flex-1 min-h-0">
              <Interviewer 
                response={interviewerResponse} 
                isRecording={isRecording} 
                onRecord={() => setIsRecording(!isRecording)}
                onUserSpeech={handleUserSpeech}
                elevenLabsApiKey={process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Global Styles */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
        
        .glass-card {
          background: transparent !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          position: relative;
          z-index: 1;
        }
      `}</style>
    </main>
  );
}
