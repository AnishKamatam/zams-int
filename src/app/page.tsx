"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Mic, Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Extend Window interface for speech recognition
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    SpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const handleSubmitRef = useRef<(() => void) | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
        setIsRecording(true);
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
        setIsRecording(false);
        
        // Auto-send the transcribed message
        setTimeout(() => {
          if (transcript.trim() && handleSubmitRef.current) {
            handleSubmitRef.current();
          }
        }, 100);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  // Suppress service worker errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('chrome-extension') || 
          event.message?.includes('service worker') ||
          event.message?.includes('Cache')) {
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('chrome-extension') ||
          event.reason?.message?.includes('service worker') ||
          event.reason?.message?.includes('Cache')) {
        event.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Stream text character by character
  const streamText = useCallback((messageId: string, fullText: string, speed: number = 30) => {
    let currentIndex = 0;
    
    const streamNext = () => {
      if (currentIndex < fullText.length) {
        const nextChunk = fullText.slice(0, currentIndex + 1);
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: nextChunk }
              : msg
          )
        );
        currentIndex++;
        streamTimeoutRef.current = setTimeout(streamNext, speed);
      } else {
        // Finished streaming
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, isStreaming: false }
              : msg
          )
        );
      }
    };
    
    streamNext();
  }, []);

  // Handle microphone click
  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim()
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: '',
      isStreaming: true
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      if (data.success && data.content) {
        // Start streaming the full response
        streamText(assistantMessage.id, data.content);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: 'Sorry, there was an error processing your request.', isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, streamText]);

  // Sync handleSubmit to ref for speech recognition
  useEffect(() => {
    handleSubmitRef.current = () => handleSubmit();
  }, [handleSubmit]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Welcome message - only show when no messages */}
          {messages.length === 0 && (
            <div className="flex justify-center items-center h-96">
              <h1 className="text-black text-4xl font-light text-center">
                Ready when you are.
              </h1>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white rounded-2xl px-4 py-3'
                      : ''
                  }`}
                >
                  <div className={`text-lg leading-relaxed ${message.type === 'assistant' ? 'prose prose-sm max-w-none' : ''}`}>
                    {message.type === 'assistant' ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children, className }) => 
                            className ? (
                              <code className={`${className} bg-gray-100 px-1 py-0.5 rounded text-sm`}>
                                {children}
                              </code>
                            ) : (
                              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">
                                {children}
                              </code>
                            ),
                          pre: ({ children }) => (
                            <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm">
                              {children}
                            </pre>
                          ),
                          ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    {message.isStreaming && (
                      <span className="animate-pulse ml-1">|</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input field container - fixed at bottom */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center space-x-3 w-full shadow-sm border border-gray-200">
              {/* Plus icon */}
              <button 
                type="button"
                className="text-gray-600 text-xl font-light cursor-pointer hover:text-gray-800 transition-colors"
              >
                <Plus size={20} />
              </button>
              
              {/* Input field */}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isRecording ? "Listening..." : "Ask anything"}
                className="flex-1 bg-transparent text-black placeholder-gray-500 outline-none text-lg"
                disabled={isLoading}
              />
              
              {/* Action buttons */}
              <div className="flex items-center space-x-3">
                {/* Microphone icon */}
                <button 
                  type="button"
                  onClick={handleMicClick}
                  className={`transition-colors ${
                    isRecording 
                      ? 'text-red-500 hover:text-red-600' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  disabled={isLoading}
                >
                  <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
                </button>
                
                {/* Send icon */}
                <button 
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
