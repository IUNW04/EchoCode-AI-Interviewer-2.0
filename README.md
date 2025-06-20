# EchoCode AI

An AI-powered coding interview simulator that replicates real FAANG-style technical interviews with voice-based interaction and real-time code observation.

## Features

- 2 way Voice-based interaction with AI interviewer
- Real-time code observation and follow up questions/feedback generation
- LeetCode-style coding questions
- Monaco editor integration
-  Pinston API integration [soon]
- Natural Voice/Text-to-speech and speech-to-text capabilities vis ElevenLabs API
- FAANG-style interview simulation

## Tech Stack

- Stack: React, Typescript, Next.js, Node.js,  Tailwind CSS
- Editor: Monaco Editor
- Speech Recognition: Web speech API temporarily
- Text-to-Speech: Elevenlabs API
- LLM: DeepSeek R1 (via OpenRoter)
- Questions: AII generated - leetcode style

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with:
```
NEXT_PUBLIC_HUGGINGFACE_API_KEY=your_api_key
NEXT_PUBLIC_OPENROUTER_API_KEY=your_api_key
```

## Project Structure

- `/app`: Next.js app directory
- `/components`: Reusable React components
- `/lib`: Utility functions and configurations
- `/hooks`: Custom React hooks
- `/types`: TypeScript type definitions

## Development Phases

1. MVP (Core Functionality)
   - Basic Next.js setup with Monaco Editor
   - LeetCode question integration
   - Real-time code tracking
   - Basic AI feedback

2. Voice Integration
   - Speech-to-text implementation
   - Text-to-speech implementation
   - Full voice flow integration

3. Polish & Extensions
   - Real-time code feedback
   - Difficulty filtering
   - Performance tracking
   - Authentication

## License

MIT
