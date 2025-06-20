'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

import Editor from './components/Editor';
import Interviewer from './components/InterviewerWithElevenLabs';
import QuestionPanel, { Question } from './components/QuestionPanel';
import LanguageSelector from './components/LanguageSelector';

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [interviewerResponse, setInterviewerResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(120);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevIsTTSPlayingRef = useRef<boolean>();

  const isReadOnly = isAnalyzing || isTTSPlaying;

  const handleAnalysisRef = useRef<() => Promise<void>>();

  const resetAnalysisTimer = useCallback(() => {
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    setTimer(120);

    const newTimer = setTimeout(() => {
      handleAnalysisRef.current?.();
    }, 2 * 60 * 1000); // 2 minutes
    analysisTimerRef.current = newTimer;

    countdownTimerRef.current = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
  }, []);

  const handleAnalysis = useCallback(async () => {
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
    }
    if(countdownTimerRef.current){
      clearInterval(countdownTimerRef.current)
    }

    // Reset timer immediately when manually triggered
    setTimer(120);

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          code: code,
          language: language,
        }),
      });

      const data = await response.json();
      if (data.feedback) {
        setInterviewerResponse(data.feedback);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred';
      setInterviewerResponse(
        `I'm having trouble analyzing your code: ${errorMessage}. Please try again in a moment.`
      );
    } finally {
      setIsAnalyzing(false);
      resetAnalysisTimer(); // Restart the timer after analysis
    }
  }, [code, currentQuestion, language, resetAnalysisTimer]);

  useEffect(() => {
    handleAnalysisRef.current = handleAnalysis;
  }, [handleAnalysis]);

  useEffect(() => {
    const prevIsTTSPlaying = prevIsTTSPlayingRef.current;

    // When TTS starts speaking, pause the timer.
    if (prevIsTTSPlaying === false && isTTSPlaying === true) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    } 
    // When TTS stops speaking, reset the timer.
    else if (prevIsTTSPlaying === true && isTTSPlaying === false) {
      resetAnalysisTimer();
    }

    // Keep track of the previous state for the next render.
    prevIsTTSPlayingRef.current = isTTSPlaying;
  }, [isTTSPlaying, resetAnalysisTimer]);

  useEffect(() => {
    resetAnalysisTimer();
    return () => {
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [resetAnalysisTimer]);

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
    resetAnalysisTimer(); // Reset timer on code change
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
      handleAnalysis();
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
          question: currentQuestion,
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
    
    setIsAnalyzing(true);
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
    } finally {
      setIsAnalyzing(false);
      resetAnalysisTimer();
    }
  };

  return (
    <main className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 overflow-hidden">
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
      <header className="relative z-10 flex justify-between items-center p-4 bg-gray-900/50 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
        <h1 className="text-2xl font-bold text-white tracking-wider">
          EchoCode <span className="text-blue-400">AI</span>
        </h1>
      </header>

      <div className="flex-grow flex flex-col lg:flex-row gap-6 p-6 min-h-0">
        {/* Left Side: Question and Editor */}
        <div className="lg:w-3/4 flex flex-col gap-6 h-full">
          {/* Question Panel */}
          <div className="glass-card flex flex-col flex-shrink-0" style={{ height: '30%' }}>
            <div className="flex-1 overflow-y-auto">
              <QuestionPanel question={currentQuestion} onNewQuestion={fetchQuestion} />
            </div>
          </div>

          {/* Code Editor Panel */}
          <div className="glass-card flex-1 flex flex-col min-h-0" style={{ height: '70%' }}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center flex-shrink-0">
              <h2 className="font-medium">Code Editor</h2>
              <LanguageSelector value={language} onChange={setLanguage} />
            </div>
            <div className="flex-1 min-h-0 relative">
              {isReadOnly && (
                <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded-b-lg">
                  <div className="text-white text-lg flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </div>
                </div>
              )}
              <Editor
                code={code}
                onCodeChange={handleCodeChange}
                language={language}
                isReadOnly={isReadOnly}
              />
            </div>
            <div className="p-2 border-t border-white/10 flex justify-end items-center flex-shrink-0">
              <div className="text-sm text-gray-400 mr-4">
                Auto-analysis in: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </div>
              <button
                onClick={handleAnalysis}
                disabled={isAnalyzing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 transition-colors"
              >
                Interviewer's Question
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: AI Interviewer */}
        <div className="lg:w-1/4 flex flex-col h-full">
          <div className="glass-card h-full flex flex-col">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-medium">AI Interviewer</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <Interviewer
                response={interviewerResponse}
                isRecording={isRecording}
                onRecord={() => setIsRecording(prev => !prev)}
                onUserSpeech={handleUserSpeech}
                onSpeakingChange={setIsTTSPlaying}
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
          background: rgba(15, 23, 42, 0.6); /* semi-transparent slate-900 */
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          position: relative;
          z-index: 1;
          backdrop-filter: blur(10px);
        }
      `}</style>
    </main>
  );
}
