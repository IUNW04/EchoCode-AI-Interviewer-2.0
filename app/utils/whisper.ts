import OpenAI from 'openai';

export const transcribeAudio = async (audioBlob: Blob, apiKey: string): Promise<string> => {
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Explicitly set language to English

    console.log('Sending audio to Whisper API...');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    console.log('Whisper API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      let errorMessage = 'Failed to transcribe audio';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Whisper API response:', data);
    return data.text || '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
};

export const startAudioRecording = async (onDataAvailable: (blob: Blob) => void) => {
  try {
    // Request access to microphone with better audio quality settings
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000, // Standard sample rate for speech recognition
        channelCount: 1,   // Mono audio is sufficient for speech
      } 
    });
    
    // Use a higher quality audio format
    const options = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000 // 128 kbps for better quality
    };
    
    const mediaRecorder = new MediaRecorder(stream, options);
    let audioChunks: BlobPart[] = [];

    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log('Audio chunk size:', event.data.size, 'bytes');
        audioChunks.push(event.data);
      }
    };

    // Handle recording stop
    mediaRecorder.onstop = () => {
      console.log('Recording stopped, creating audio blob...');
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        console.log('Audio blob created, size:', audioBlob.size, 'bytes');
        onDataAvailable(audioBlob);
      } catch (error) {
        console.error('Error creating audio blob:', error);
        throw new Error('Failed to process recorded audio');
      } finally {
        audioChunks = [];
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
      }
    };

    // Start recording with a timeslice to get chunks during recording
    mediaRecorder.start(1000); // Get a chunk every second
    console.log('Recording started with mime type:', mediaRecorder.mimeType);

    return {
      stop: () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          console.log('Stopping recording...');
          mediaRecorder.stop();
        }
      },
      isRecording: () => mediaRecorder.state === 'recording'
    };
  } catch (error) {
    console.error('Error accessing microphone:', error);
    throw error;
  }
};
