'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Global audio context and queue management
let globalAudioContext: AudioContext | null = null;
let audioQueue: {text: string; onEnd?: () => void}[] = [];
let isPlaying = false;

// Voice ID for ElevenLabs - Rachel's voice
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel's voice ID
const API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

// Clean up audio context when window is unloaded
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (globalAudioContext) {
      globalAudioContext.close();
      globalAudioContext = null;
    }
  });
}

interface ElevenLabsTTSProps {
  text: string;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onError?: (error: Error) => void;
  apiKey?: string;
}

export default function ElevenLabsTTS({ 
  text, 
  onSpeakingChange,
  onError,
  apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY 
}: ElevenLabsTTSProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentTextRef = useRef<string>('');
  const isMounted = useRef(true);

  // Debug log to check if API key is available and validate it
  useEffect(() => {
    const formattedApiKey = (apiKey || '').trim().replace(/['"]/g, '');
    const isValidKey = formattedApiKey && formattedApiKey.length > 10; // Basic validation
    
    console.log('ElevenLabsTTS - API Key:', isValidKey ? 'Valid key detected' : 'Invalid or missing API key');
    
    if (!isValidKey) {
      const error = new Error('Invalid or missing ElevenLabs API key. Please check your .env.local file.');
      setError(error.message);
      onError?.(error);
    } else {
      setError(null);
    }
  }, [apiKey, onError]);

  const processQueue = useCallback(async () => {
    if (isPlaying || audioQueue.length === 0 || !isMounted.current) return;
    
    isPlaying = true;
    const { text: currentText, onEnd } = audioQueue[0];
    currentTextRef.current = currentText;
    
    console.log('Processing TTS with API Key:', apiKey ? 'Key is set' : 'Key is missing');
    
    try {
      setIsSpeaking(true);
      onSpeakingChange?.(true);
      
      // Skip empty text
      if (!currentText?.trim()) {
        throw new Error('Empty text provided for TTS');
      }
      setError(null);

      // Initialize audio context if not already done
      if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Ensure the API key is properly formatted (remove any quotes or newlines)
      const formattedApiKey = (apiKey || '').trim().replace(/['"]/g, '');
      
      // Log the API key prefix for debugging (first 10 characters)
      console.log('Using API Key:', formattedApiKey ? `${formattedApiKey.substring(0, 10)}...` : 'No key provided');

      // Fetch audio from ElevenLabs with error handling
      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': formattedApiKey,
          },
          body: JSON.stringify({
            text: currentText,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.7,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail?.message || `API request failed with status ${response.status}`);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch audio from ElevenLabs');
        console.error('ElevenLabs API Error:', error);
        setError(error.message);
        onError?.(error);
        return;
      }

      try {
        const audioData = await response.arrayBuffer();
        
        // Check if audio data is valid
        if (!audioData || audioData.byteLength === 0) {
          throw new Error('Received empty audio data from ElevenLabs');
        }
        
        // Ensure audio context is in the correct state
        if (globalAudioContext.state === 'suspended') {
          await globalAudioContext.resume();
        }
        
        const audioBuffer = await globalAudioContext.decodeAudioData(audioData);
        
        // Create audio source and connect to destination
        const source = globalAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(globalAudioContext.destination);
        
        // Set up event handlers
        source.onended = () => {
          source.disconnect();
          
          if (isMounted.current) {
            setIsSpeaking(false);
            onSpeakingChange?.(false);
          }
          
          // Process next in queue
          audioQueue.shift();
          isPlaying = false;
          
          if (onEnd) onEnd();
          if (audioQueue.length > 0) {
            processQueue();
          }
        };
        
        // Start playback
        source.start();
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to process audio');
        console.error('Audio Playback Error:', error);
        setError(error.message);
        onError?.(error);
        
        // Reset states
        isPlaying = false;
        audioQueue.shift();
        if (isMounted.current) {
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        }
        
        // Process next in queue if available
        if (audioQueue.length > 0) {
          processQueue();
        }
      }

    } catch (error) {
      console.error('Error in processQueue:', error);
      
      // Clean up and try next in queue
      audioQueue.shift();
      isPlaying = false;
      
      if (isMounted.current) {
        setIsSpeaking(false);
        onSpeakingChange?.(false);
      }
      
      if (audioQueue.length > 0) {
        processQueue();
      }
    }
  }, [apiKey, onSpeakingChange]);

  const speak = useCallback(async () => {
    const textToSpeak = text.trim();
    if (!textToSpeak) return;
    
    if (!apiKey) {
      setError('ElevenLabs API key is not configured');
      return;
    }
    
    // Skip if this exact text is already in the queue
    if (audioQueue.some(item => item.text === textToSpeak)) {
      return;
    }
    
    // Add to queue
    const newItem = {
      text: textToSpeak,
      onEnd: () => {
        if (isMounted.current) {
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        }
      }
    };
    
    audioQueue.push(newItem);
    
    // Process queue if not already playing
    if (!isPlaying) {
      processQueue();
    }
    
    // Clean up queue if it gets too large
    if (audioQueue.length > 5) {
      audioQueue.shift();
    }
  }, [text, apiKey, onSpeakingChange, processQueue]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Clear the queue for this component
      audioQueue = audioQueue.filter(item => item.text !== currentTextRef.current);
      
      // Clean up global audio context if nothing else is using it
      if (globalAudioContext && audioQueue.length === 0) {
        try {
          if (globalAudioContext.state !== 'closed') {
            globalAudioContext.close().catch(console.error);
          }
        } catch (e) {
          console.error('Error closing audio context:', e);
        } finally {
          globalAudioContext = null;
        }
      }
      
      // Reset playing state if no more items in queue
      if (audioQueue.length === 0) {
        isPlaying = false;
      }
    };
  }, []);

  // Speak when text changes
  useEffect(() => {
    if (!text || !text.trim() || text === currentTextRef.current) {
      return;
    }
    
    // Add a small delay to prevent rapid successive calls
    const timer = setTimeout(() => {
      if (isMounted.current) {
        const currentText = text;
        // Only speak if the text hasn't changed during the delay
        if (currentText === text) {
          speak();
        }
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [text]);

  // Initialize on mount
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  return (
    <div className="text-sm text-gray-500">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {isSpeaking && (
        <div className="flex items-center text-blue-500">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Speaking...
        </div>
      )}
    </div>
  );
}
