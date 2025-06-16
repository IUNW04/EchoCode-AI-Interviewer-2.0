import React, { useRef, useEffect, useState } from 'react';

interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResult[];
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

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
  const [speechText, setSpeechText] = useState('');
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (response && !isRecording) {
      speakResponse(response);
    }
  }, [response, isRecording]);

  const speakResponse = (text: string) => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1;
    utterance.volume = 1;

    speechSynthesisRef.current = window.speechSynthesis;
    speechSynthesisRef.current.speak(utterance);
  };

  const startListening = async () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in your browser.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setSpeechText(transcript);
        onUserSpeech(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    if (recognition) {
      recognition.stop();
    }
    setIsListening(false);
    setSpeechText('');
  };

  useEffect(() => {
    if (isRecording) {
      startListening();
    } else {
      stopListening();
    }
  }, [isRecording]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Interviewer</h2>
        <button
          onClick={onRecord}
          className={`px-4 py-2 rounded-full ${
            isRecording ? 'bg-red-500 text-white' : 'bg-gray-200'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Record'}
        </button>
      </div>
      
      <div className="space-y-4">
        {response && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-700">{response}</p>
          </div>
        )}
        {isListening && (
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-green-700">Listening... {speechText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
