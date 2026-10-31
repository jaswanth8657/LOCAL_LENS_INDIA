import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTrip } from '../context/TripContext';
import { sendChatMessageToAPI } from '../api/client';
import { GlassCard } from '../components/ui/GlassCard';
import { useChatSpeechRecognition } from '../hooks/useChatSpeechRecognition';
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Clock,
  IndianRupee,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  providerUsed?: string;
  destination?: { name: string; slug: string };
  places?: Array<{
    id: string;
    name: string;
    category: string;
    address: string;
    ticketPriceInr?: number;
    typicalCostInr?: number;
    openingHours?: string;
    rating?: number;
    verificationStatus?: string;
  }>;
  itinerary?: any;
  isError?: boolean;
}

const SUGGESTED_PROMPTS = [
  "What are the best beaches and scenic viewpoints in Visakhapatnam?",
  "Plan a 3-day authentic heritage trip to Jaipur with ₹2,500 daily budget",
  "What is the entry fee and timing of INS Kursura Submarine Museum?",
  "Recommend authentic local street food and thali spots in Kochi",
  "Which destinations are currently available in LOCAL LENS INDIA?",
];

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedDestination, setCurrentItinerary } = useTrip();

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Speech Recognition Hook
  const {
    isSupported: isSpeechSupported,
    isListening,
    error: speechError,
    clearError: clearSpeechError,
    startListening,
    stopListening
  } = useChatSpeechRecognition((recognizedText) => {
    // Deliver recognized speech directly into the editable text input box
    // NEVER automatically submit! The user can edit, correct, or append text.
    setInputMessage((prev) => (prev ? `${prev} ${recognizedText}` : recognizedText));
  });

  // Initial welcome message
  useEffect(() => {
    const defaultCity = selectedDestination?.name || 'Visakhapatnam';
    setMessages([
      {
        id: 'welcome-1',
        sender: 'assistant',
        text: `Namaste! I am your **LOCAL LENS INDIA** travel assistant for ${defaultCity} and destinations across India. How can I help you experience India like a local today? Ask me about verified sights, authentic regional cuisine, entry timings, or request a complete multi-day itinerary.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerUsed: 'DETERMINISTIC'
      }
    ]);

    // Handle query param from home search bar (?q=...)
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setInputMessage(initialQuery);
    }
  }, [selectedDestination, searchParams]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    if (isListening) {
      stopListening();
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const response = await sendChatMessageToAPI({
        message: text,
        destination: selectedDestination?.id,
        history
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerUsed: response.providerUsed,
        destination: response.destination,
        places: response.places,
        itinerary: response.itinerary
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: "I experienced an error connecting to our local backend server. Please ensure the Django service is running on http://127.0.0.1:8000.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          providerUsed: 'DETERMINISTIC'
        }
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleToggleMic = () => {
    clearSpeechError();
    if (isListening) {
      stopListening();
    } else {
      startListening(speechLanguage);
    }
  };

  const handleLoadItinerary = (itinerary: any) => {
    setCurrentItinerary(itinerary);
    navigate('/planner');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header Card */}
      <GlassCard className="p-4 sm:p-5 border-slate-200 dark:border-white/10 shrink-0 mb-4 flex items-center justify-between bg-white/80 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-saffron via-brand-spice to-brand-amber p-0.5 shadow-glow-saffron">
            <div className="w-full h-full bg-slate-100 dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-spice" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>LOCAL LENS Travel Assistant</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30">
                Grounding Active
              </span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Grounded exclusively in verified SQLite records. Supports editable speech input. Text-only responses.
            </p>
          </div>
        </div>

        {/* Speech Language Selector */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-xl text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1 font-medium">Mic Lang:</span>
          {(['en-IN', 'hi-IN'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setSpeechLanguage(lang)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                speechLanguage === lang
                  ? 'bg-brand-saffron text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {lang === 'en-IN' ? 'EN (India)' : 'HI (Hindi)'}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Suggested Quick Prompts */}
      {messages.length <= 2 && (
        <div className="shrink-0 mb-3 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Try asking:</span>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-300/70 dark:border-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <GlassCard className="flex-1 p-4 sm:p-6 border-slate-200 dark:border-white/10 overflow-y-auto space-y-4 mb-4 bg-white/70 dark:bg-slate-900/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Sender & Timestamp */}
            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold">{msg.sender === 'user' ? 'You' : 'Local Lens Assistant'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
              {msg.providerUsed && (
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-medium border ${
                  msg.providerUsed === 'GEMINI'
                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                    : msg.providerUsed === 'OLLAMA'
                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}>
                  {msg.providerUsed}
                </span>
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-brand-saffron to-brand-spice text-white font-medium rounded-tr-none shadow-glow-saffron'
                  : 'bg-slate-100 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-tl-none space-y-3'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Render Grounded Place Cards if included */}
              {msg.places && msg.places.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
                  <span className="text-[11px] font-bold text-brand-spice block">
                    Verified Place Records:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.places.map((place) => (
                      <div
                        key={place.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{place.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 capitalize">
                            {place.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{place.address}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <IndianRupee className="w-3 h-3" />
                            {place.ticketPriceInr !== undefined
                              ? place.ticketPriceInr === 0
                                ? 'Free'
                                : `₹${place.ticketPriceInr}`
                              : 'Fee unavailable'}
                          </span>
                          <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                            <Clock className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{place.openingHours || 'Hours n/a'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Itinerary Summary Action if included */}
              {msg.itinerary && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {msg.itinerary.title || `${msg.itinerary.durationDays}-Day Travel Plan`}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ₹{msg.itinerary.dailyBudgetInr}/day • {msg.itinerary.durationDays} Days • Verified Places
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadItinerary(msg.itinerary)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-saffron text-white hover:opacity-95 shadow-glow-saffron transition-all shrink-0"
                  >
                    <span>Open in Planner</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Local Lens Assistant</span>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-saffron animate-spin" />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                Consulting verified database & synthesizing recommendations...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </GlassCard>

      {/* Speech Status Alert */}
      {isListening && (
        <div className="mb-2 p-3 rounded-xl bg-brand-saffron/15 border border-brand-saffron/30 text-xs text-brand-spice flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>Listening to your voice ({speechLanguage === 'en-IN' ? 'English - India' : 'Hindi'}). Speak your travel query...</span>
          </div>
          <button
            type="button"
            onClick={handleToggleMic}
            className="text-xs font-bold text-white px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 transition-colors"
          >
            Stop Listening
          </button>
        </div>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <div className="mb-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{speechError}</span>
          </div>
          <button
            type="button"
            onClick={clearSpeechError}
            className="text-xs font-bold text-slate-800 dark:text-white hover:underline shrink-0 ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Input & Microphone Control Bar */}
      <GlassCard className="p-2 sm:p-2.5 border-slate-200 dark:border-white/15 shrink-0 flex items-center gap-2 bg-white/80 dark:bg-slate-900/80">
        {/* Speech Recognition Button (Inside Chatbot ONLY) */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`p-2.5 rounded-xl border transition-all shrink-0 ${
            isListening
              ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              : 'bg-slate-100 hover:bg-brand-saffron/20 text-brand-spice border-slate-200 dark:bg-white/5 dark:border-white/10 hover:border-brand-saffron/30'
          }`}
          title={
            !isSpeechSupported
              ? 'Speech recognition requires Chrome or Edge browser'
              : isListening
              ? 'Stop Speech Recording'
              : 'Speak Message (Speech to Text)'
          }
          aria-label={isListening ? 'Stop Speech Recording' : 'Speak Message'}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Editable Message Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder={
            isListening
              ? 'Listening... spoken text will appear here for you to edit'
              : 'Ask about attractions, cuisine, entry tickets, or type "Plan 3 days in Jaipur"...'
          }
          disabled={isLoading}
          className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none px-2"
        />

        {/* Send Button */}
        <button
          type="button"
          disabled={!inputMessage.trim() || isLoading}
          onClick={() => handleSendMessage()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-brand-saffron to-brand-spice text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-glow-saffron transition-all shrink-0"
          title="Send Message"
          aria-label="Send Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </GlassCard>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 px-1">
        <span>Microphone audio is transcribed locally in your browser. No audio files are recorded or stored.</span>
        <span>Responses are generated in text only.</span>
      </div>
    </div>
  );
};
