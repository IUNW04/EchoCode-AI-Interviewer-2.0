'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface InterviewerProps {
  response: string;
  isRecording: boolean;
  onRecord: () => void;
  onUserSpeech: (text: string) => void;
}

export default function Interviewer({ 
  response, 
  isRecording, 
  onRecord,
  onUserSpeech 
}: InterviewerProps) {
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const [speechText, setSpeechText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [browserSupport, setBrowserSupport] = useState({
    speechSynthesis: false,
    speechRecognition: false
  });

  // Check browser support and request microphone permission
  useEffect(() => {
    const speechSynthesis = 'speechSynthesis' in window;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecognition = !!SpeechRecognition;
    
    setBrowserSupport({
      speechSynthesis,
      speechRecognition
    });

    // Request microphone permission immediately
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => console.log('Microphone access granted'))
        .catch(err => console.error('Microphone access denied:', err));
    }

    // Initialize audio context to prevent browser autoplay issues
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('Audio context resumed');
        });
      }
    }

    if (speechSynthesis) {
      speechSynthesisRef.current = window.speechSynthesis;
      
      // Load voices when they become available
      const loadVoices = () => {
        if (speechSynthesisRef.current) {
          const voices = speechSynthesisRef.current.getVoices();
          console.log('Available voices:', voices.map((v: any) => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            default: v.default
          })));
          
          // Try to select a default voice if none is selected
          if (voices.length > 0) {
            const defaultVoice = voices.find((v: any) => v.default) || voices[0];
            console.log('Default voice:', defaultVoice);
          }
        }
      };
      
      speechSynthesisRef.current.onvoiceschanged = loadVoices;
      loadVoices();
      
      // Force voice loading in Chrome
      const checkVoices = setInterval(() => {
        const voices = speechSynthesisRef.current?.getVoices() || [];
        if (voices.length > 0) {
          loadVoices();
          clearInterval(checkVoices);
        }
      }, 100);
      
      return () => {
        clearInterval(checkVoices);
        if (speechSynthesisRef.current) {
          speechSynthesisRef.current.cancel();
          speechSynthesisRef.current.onvoiceschanged = null;
        }
      };
    }
  }, []);

  // Handle speaking the AI response
  useEffect(() => {
    if (response && !isRecording) {
      console.log('New response to speak:', response);
      speakResponse(response);
    }
  }, [response, isRecording]);

  const speakResponse = useCallback((text: string) => {
    if (!text.trim()) {
      console.log('No text to speak');
      return;
    }
    
    if (!speechSynthesisRef.current) {
      console.error('Speech synthesis not available');
      return;
    }
    
    console.log('Attempting to speak text:', text);
    
    // Stop any ongoing speech
    speechSynthesisRef.current.cancel();
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure utterance
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Set up event handlers
    utterance.onstart = () => {
      console.log('Speech started');
      setIsSpeaking(true);
    };
    
    utterance.onend = () => {
      console.log('Speech ended');
      setIsSpeaking(false);
    };
    
    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      setIsSpeaking(false);
    };
    
    // Try to speak immediately
    try {
      speechSynthesisRef.current.speak(utterance);
      console.log('Speech synthesis started');
    } catch (err) {
      console.error('Error starting speech synthesis:', err);
      setIsSpeaking(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Stopped speech recognition');
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    try {
      // Stop any existing recognition
      stopListening();
      
      // Create new recognition instance
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      // Configure recognition
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      // Event handlers
      recognition.onstart = () => {
        console.log('Speech recognition started');
        setSpeechText('Listening...');
      };
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0]?.transcript || '')
          .join(' ');
        
        console.log('Speech recognition result:', transcript);
        setSpeechText(transcript);
        
        // Send final results to parent
        if (event.results[0]?.isFinal) {
          onUserSpeech(transcript);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          console.error('Microphone access was denied');
        } else if (event.error === 'audio-capture') {
          console.error('No microphone found');
        }
        stopListening();
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
      };
      
      // Start listening
      console.log('Starting speech recognition...');
      recognition.start();
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }, [onUserSpeech, stopListening]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording) {
      console.log('Starting listening...');
      startListening();
    } else {
      console.log('Stopping listening...');
      stopListening();
    }

    return () => {
      console.log('Cleaning up...');
      stopListening();
    };
  }, [isRecording, startListening, stopListening]);

  if (!browserSupport.speechSynthesis || !browserSupport.speechRecognition) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-800 rounded-lg">
        <p>Your browser has limited support for speech features. For best experience, use the latest version of Chrome or Edge.</p>
        <p>Speech Synthesis: {browserSupport.speechSynthesis ? '✅ Supported' : '❌ Not Supported'}</p>
        <p>Speech Recognition: {browserSupport.speechRecognition ? '✅ Supported' : '❌ Not Supported'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg">
      <div className="w-full max-w-2xl">
        <div className="bg-gray-900 rounded-lg p-4 mb-4 h-48 overflow-y-auto text-gray-200">
          {speechText || 'Your speech will appear here...'}
        </div>
        <button
          onClick={onRecord}
          disabled={isSpeaking}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } ${isSpeaking ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
          {isSpeaking && ' (Speaking...)'}
        </button>
        
        {/* Debug info */}
        <div className="mt-4 text-xs text-gray-400">
          <p>Status: {isRecording ? 'Recording...' : 'Ready'}</p>
          <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
        </div>
      </div>
    </div>
  );
}
