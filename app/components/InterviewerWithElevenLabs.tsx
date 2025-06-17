'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ElevenLabsTTS from './ElevenLabsTTS';

// Web Speech API types
type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

interface SpeechRecognitionResult extends Array<SpeechRecognitionAlternative> {
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative | null;
  length: number;
};

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResult[];
  resultIndex: number;
};

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

// Define types for the component
interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface InterviewerProps {
  response: string;
  isRecording: boolean;
  onRecord: () => void;
  onUserSpeech: (text: string) => void;
  elevenLabsApiKey?: string;
}

const InterviewerWithElevenLabs: React.FC<InterviewerProps> = ({
  response,
  isRecording,
  onRecord,
  onUserSpeech,
  elevenLabsApiKey
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [browserSupport, setBrowserSupport] = useState({
    speechRecognition: false,
    speechSynthesis: false,
  });
  
  // Create a ref for the messages end marker
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      console.log('Checking browser support for SpeechRecognition...');
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const isSupported = !!SpeechRecognition;
      console.log('SpeechRecognition supported:', isSupported);
      console.log('SpeechSynthesis supported:', 'speechSynthesis' in window);
      
      setBrowserSupport({
        speechRecognition: isSupported,
        speechSynthesis: 'speechSynthesis' in window,
      });
      
      if (!isSupported) {
        console.error('SpeechRecognition is not supported in this browser');
        setMessages(prev => [...prev, {
          text: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.',
          isUser: false,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error checking browser support:', error);
      setBrowserSupport({
        speechRecognition: false,
        speechSynthesis: false,
      });
    }
  }, []);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isProcessingRef = useRef(false);

  // Request microphone permission immediately
  useEffect(() => {
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log('Microphone access granted'))
        .catch((err) => console.error('Microphone access denied:', err));
    }

    // Initial greeting
    setMessages([{
      text: "Hello! I'm your AI interviewer. I'll ask you coding questions and provide feedback on your solutions. Let's get started!",
      isUser: false,
      timestamp: new Date()
    }]);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Handle speaking state changes from TTS
  const handleSpeakingChange = useCallback((speaking: boolean) => {
    setIsSpeaking(speaking);
  }, []);

  // Format time for message timestamps
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Stop recording and cleanup
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    isProcessingRef.current = false;
  }, []);

  // Update messages when response changes
  useEffect(() => {
    if (response && response.trim()) {
      setMessages((prev) => {
        // Check if this is a new response or an update to the last message
        const isNewMessage = !prev.length || 
                           prev[prev.length - 1].text !== response || 
                           prev[prev.length - 1].isUser;
        
        if (!isNewMessage) return prev;
        
        const newMessage = {
          text: response,
          isUser: false,
          timestamp: new Date(),
        };
        
        return [...prev, newMessage];
      });
      stopRecording();
    }
  }, [response, stopRecording]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    };
    
    // Use requestAnimationFrame to ensure smooth scrolling
    const frameId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frameId);
  }, [messages]);

  // Create speech recognition instance
  const createSpeechRecognition = useCallback((): ISpeechRecognition | null => {
    if (typeof window === 'undefined') {
      console.error('Window is not defined - running in SSR');
      return null;
    }
    
    try {
      // Try standard API first, then vendor-prefixed version
      const SpeechRecognition = (
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      ) as new () => ISpeechRecognition;
      
      if (!SpeechRecognition) {
        const errorMsg = 'Speech Recognition API not supported in this browser. Try using Chrome, Edge, or Safari.';
        console.error(errorMsg);
        setMessages(prev => [...prev, {
          text: errorMsg,
          isUser: false,
          timestamp: new Date()
        }]);
        return null;
      }
      
      console.log('Creating new SpeechRecognition instance');
      const recognition = new SpeechRecognition();
      
      // Configure recognition
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      console.log('SpeechRecognition instance created with settings:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives
      });
      
      return recognition;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating speech recognition:', error);
      setMessages(prev => [...prev, {
        text: `Error initializing speech recognition: ${errorMsg}`,
        isUser: false,
        timestamp: new Date()
      }]);
      return null;
    }
  }, [setMessages]);

  const startRecording = useCallback(async () => {
    console.log('startRecording called');
    
    if (!browserSupport.speechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser. Try using Chrome, Edge, or Safari.';
      console.error(errorMsg);
      setMessages(prev => [...prev, { 
        text: errorMsg, 
        isUser: false, 
        timestamp: new Date() 
      }]);
      return;
    }

    try {
      // Stop any existing recognition
      if (recognitionRef.current) {
        console.log('Stopping existing recognition');
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      
      console.log('Creating new speech recognition instance');
      // Create new recognition instance
      const recognition = createSpeechRecognition();
      if (!recognition) {
        throw new Error('Failed to initialize speech recognition: createSpeechRecognition returned null');
      }
      
      recognitionRef.current = recognition;
      console.log('Speech recognition instance created');
      
      // Configure recognition
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      // Show listening state
      setMessages(prev => {
        const newMessages = prev.filter(msg => 
          !['Listening...', 'Processing...'].includes(msg.text)
        );
        return [...newMessages, { 
          text: 'Listening...', 
          isUser: false, 
          timestamp: new Date() 
        }];
      });
      
      // Start recognition
      recognitionRef.current.start();
      console.log('Speech recognition started');
      
      // Handle recognition results
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        try {
          console.log('Speech recognition results received:', event.results);
          if (!event.results || event.results.length === 0) {
            throw new Error('No recognition results received');
          }
          
          const result = event.results[event.resultIndex];
          if (!result || result.length === 0) {
            throw new Error('No speech detected');
          }
          
          // Get the first alternative from the first result
          const firstAlternative = result[0];
          if (!firstAlternative) {
            throw new Error('No speech alternatives available');
          }
          
          const transcript = firstAlternative.transcript;
          console.log('Speech recognition transcript:', transcript);
          
          // Remove listening/processing messages
          setMessages(prev => {
            const newMessages = prev.filter(msg => 
              !['Listening...', 'Processing...'].includes(msg.text)
            );
            return [...newMessages, { 
              text: transcript, 
              isUser: true, 
              timestamp: new Date() 
            }];
          });
          
          // Call the onUserSpeech callback with the transcript
          onUserSpeech(transcript);
        } catch (error) {
          console.error('Error processing speech recognition result:', error);
          const errorMsg = error instanceof Error ? error.message : 'Error processing speech';
          setMessages(prev => [...prev, {
            text: `Error: ${errorMsg}`,
            isUser: false,
            timestamp: new Date()
          }]);
        }
      };
      
      // Handle errors
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error event:', event);
        let errorMessage = 'Speech recognition error';
        
        if (event.error === 'not-allowed') {
          errorMessage = 'Microphone access was denied. Please allow microphone access to use this feature.';
        } else if (event.error === 'audio-capture') {
          errorMessage = 'No microphone was found. Please ensure a microphone is connected.';
        } else if (event.error === 'not-allowed') {
          errorMessage = 'Microphone access is blocked. Please allow microphone access in your browser settings.';
        } else if (event.error) {
          errorMessage = `Speech recognition error: ${event.error}`;
        }
        
        console.error('Speech recognition error:', errorMessage);
        setMessages(prev => {
          const newMessages = prev.filter(msg => 
            !['Listening...', 'Processing...'].includes(msg.text)
          );
          return [...newMessages, { 
            text: errorMessage, 
            isUser: false, 
            timestamp: new Date() 
          }];
        });
      };
      
      // Handle when recognition ends
      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        // Clean up the recognition instance
        if (recognitionRef.current) {
          recognitionRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error in speech recognition:', error);
      setMessages(prev => {
        const errorMessage = error instanceof Error ? error.message : 'Error processing your speech';
        const newMessages = prev.filter(msg => 
          !['Listening...', 'Processing...'].includes(msg.text)
        );
        return [...newMessages, { 
          text: `Error: ${errorMessage}`, 
          isUser: false, 
          timestamp: new Date() 
        }];
      });
    } finally {
      isProcessingRef.current = false;
      // Clean up recognition reference
    }
  }, [browserSupport.speechRecognition, onUserSpeech, stopRecording]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Main component return
  console.log('ElevenLabs API Key:', elevenLabsApiKey ? 'Key is set' : 'Key is missing');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-card p-3 mb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">AI Interviewer</h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              isRecording 
                ? 'bg-red-500 animate-pulse' 
                : isSpeaking 
                  ? 'bg-blue-500' 
                  : 'bg-green-500'
            }`} />
            <span className="text-sm text-gray-300">
              {isRecording ? 'Listening...' : isSpeaking ? 'AI Speaking...' : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`message-bubble ${message.isUser ? 'user' : 'ai'}`}>
              <div className="whitespace-pre-wrap">{message.text}</div>
              {!message.isUser && (
                <ElevenLabsTTS
                  key={`tts-${index}`}
                  text={message.text}
                  onSpeakingChange={setIsSpeaking}
                  onError={(error) => console.error('TTS Error:', error)}
                  apiKey={elevenLabsApiKey}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="mt-auto p-3">
        <div className="flex space-x-2">
          <button
            onClick={onRecord}
            disabled={isSpeaking}
            className={`record-button flex-1 flex items-center justify-center space-x-2 py-3 px-6 rounded-lg font-medium ${
              isRecording
                ? 'bg-red-600 text-white recording'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span>Stop</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Speak</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setMessages(prev => [
                ...prev,
                { text: 'New question, please!', isUser: true, timestamp: new Date() }
              ]);
              onUserSpeech('new question');
            }}
            disabled={isSpeaking || isRecording}
            className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Question"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="mt-3 text-xs text-center text-gray-400">
          {isProcessing ? (
            <div className="flex items-center justify-center space-x-2">
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></div>
            </div>
          ) : (
            'Press and hold to speak, or tap the mic button to start/stop'
          )}
        </div>
      </div>
      
      {/* TTS Component - Only for AI responses */}
      {messages.length > 0 && !messages[messages.length - 1].isUser && (
        <div className="sr-only" aria-live="polite">
          <ElevenLabsTTS
            key={`tts-${messages.length}-${messages[messages.length - 1].text.substring(0, 20)}`}
            text={messages[messages.length - 1].text}
            apiKey={elevenLabsApiKey}
            onSpeakingChange={handleSpeakingChange}
            onError={(error) => {
              console.error('TTS Error:', error);
              // Show error message to user
              setMessages(prev => [...prev, { 
                text: `Error: ${error.message}`, 
                isUser: false, 
                timestamp: new Date() 
              }]);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default InterviewerWithElevenLabs;
