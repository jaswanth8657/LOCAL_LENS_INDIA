import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTrip } from '../../context/TripContext';
import { sendChatMessageToAPI } from '../../api/client';
import { useChatSpeechRecognition } from '../../hooks/useChatSpeechRecognition';
import {
  Sparkles,
  X,
  Minus,
  Send,
  Mic,
  MicOff,
  Trash2,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

interface FloatingMessage {
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
  }>;
  itinerary?: any;
}

const QUICK_PROMPTS = [
  "What verified sights are must-visit?",
  "Recommend authentic local food and thalis",
  "Plan a 2-day trip within ₹2,500 daily budget",
  "Tell me about entry fees and timings",
];

export const FloatingChatbot: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedDestination, setCurrentItinerary } = useTrip();
  const prefersReducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Speech Recognition Hook (Speech-to-text ONLY; strictly no TTS or audio playback)
  const {
    isSupported: isSpeechSupported,
    isListening,
    error: speechError,
    clearError: clearSpeechError,
    startListening,
    stopListening,
  } = useChatSpeechRecognition((recognizedText) => {
    // Deliver recognized speech directly to the editable input box without auto-submitting
    setInputMessage((prev) => (prev ? `${prev} ${recognizedText}` : recognizedText));
  });

  // Default welcome message when opened
  useEffect(() => {
    if (messages.length === 0) {
      const destName = selectedDestination?.name || 'India';
      setMessages([
        {
          id: 'float-welcome-1',
          sender: 'assistant',
          text: `Namaste! I'm your **LOCAL LENS INDIA** AI guide for **${destName}**. Ask me about verified attractions, regional delicacies, opening hours, or budget trip plans!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          providerUsed: 'DETERMINISTIC',
        },
      ]);
    }
  }, [selectedDestination, messages.length]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }, [messages, isOpen, prefersReducedMotion]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Hide the floating widget if user is already on the dedicated /chat route
  if (location.pathname === '/chat') {
    return null;
  }

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    if (isListening) {
      stopListening();
    }
    clearSpeechError();

    const userMsg: FloatingMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.sender,
        content: m.text,
      }));

      const res = await sendChatMessageToAPI({
        message: textToSend,
        destination: selectedDestination?.id,
        history: historyPayload,
      });

      const assistantMsg: FloatingMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerUsed: res.providerUsed || 'DETERMINISTIC',
        destination: res.destination,
        places: res.places,
        itinerary: res.itinerary,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't reach the AI assistant service. Please check your connection and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          providerUsed: 'DETERMINISTIC',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const destName = selectedDestination?.name || 'India';
    setMessages([
      {
        id: `float-clear-${Date.now()}`,
        sender: 'assistant',
        text: `Conversation cleared. How can I assist you with **${destName}**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        providerUsed: 'DETERMINISTIC',
      },
    ]);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      clearSpeechError();
      startListening(speechLanguage);
    }
  };

  const formatMessageText = (content: string) => {
    return content.split('\n').map((line, idx) => {
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <span
          key={idx}
          className="block mb-1 last:mb-0"
          dangerouslySetInnerHTML={{ __html: boldProcessed }}
        />
      );
    });
  };

  return (
    <aside aria-label="AI Travel Assistant" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Expanded Floating Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[calc(100vw-32px)] sm:w-[420px] h-[540px] max-h-[82vh] mb-3 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-stone-200/80 dark:border-white/10 bg-[#faf8f5]/95 dark:bg-[#0c1222]/95 backdrop-blur-xl text-stone-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-brand-saffron/15 via-brand-spice/10 to-transparent dark:from-brand-saffron/20 dark:via-slate-800/80 dark:to-transparent border-b border-stone-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-saffron to-brand-spice flex items-center justify-center text-white shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-white">
                      LOCAL LENS AI Guide
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-stone-600 dark:text-slate-400">
                    {selectedDestination ? `${selectedDestination.name} • Grounded` : 'Experience Like a Local'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                  className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Link
                  to="/chat"
                  title="Open full page chat"
                  aria-label="Open full page chat"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimize assistant"
                  aria-label="Minimize assistant"
                  className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close assistant"
                  aria-label="Close assistant"
                  className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                        isUser
                          ? 'bg-brand-saffron text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800/90 text-stone-900 dark:text-slate-100 border border-stone-200 dark:border-white/10 rounded-bl-none'
                      }`}
                    >
                      <div className="text-[12px]">{formatMessageText(m.text)}</div>

                      {/* Itinerary Preview CTA if generated */}
                      {m.itinerary && (
                        <div className="mt-2.5 pt-2 border-t border-stone-200 dark:border-white/10 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-brand-spice">
                            {m.itinerary.durationDays || 3}-Day Trip Built
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentItinerary(m.itinerary);
                              navigate('/planner');
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-spice text-white text-[10px] font-bold hover:opacity-95"
                          >
                            <span>Open in Planner</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-stone-500 dark:text-slate-400">
                      <span>{m.timestamp}</span>
                      {m.providerUsed && (
                        <span className="font-semibold uppercase text-[9px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-white/10 text-stone-700 dark:text-slate-300">
                          {m.providerUsed}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-stone-500 dark:text-slate-400 text-xs italic">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-saffron animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-saffron animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-saffron animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>Grounded AI synthesizing verified places...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Bar */}
            {messages.length <= 2 && (
              <div className="px-3 py-1.5 border-t border-stone-200 dark:border-white/5 bg-stone-100/60 dark:bg-black/20 flex gap-1.5 overflow-x-auto text-[11px]">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 hover:bg-brand-saffron/10 border border-stone-200 dark:border-white/10 text-stone-700 dark:text-slate-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Speech error indicator if any */}
            {speechError && (
              <div className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>{speechError}</span>
                <button
                  type="button"
                  onClick={clearSpeechError}
                  className="font-bold underline ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2.5 bg-white dark:bg-slate-900 border-t border-stone-200 dark:border-white/10 flex items-center gap-1.5"
            >
              {/* Language toggle for speech */}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={() => setSpeechLanguage((prev) => (prev === 'en-IN' ? 'hi-IN' : 'en-IN'))}
                  title={`Speech language: ${speechLanguage === 'en-IN' ? 'English (India)' : 'Hindi'}`}
                  aria-label={`Speech language: ${speechLanguage === 'en-IN' ? 'English (India)' : 'Hindi'}`}
                  className="px-1.5 py-1 rounded text-[10px] font-bold text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10"
                >
                  {speechLanguage === 'en-IN' ? 'EN' : 'HI'}
                </button>
              )}

              {/* Microphone Button (Speech-to-text ONLY; strictly no TTS or audio playback) */}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Speak your query'}
                  aria-label={isListening ? 'Stop listening' : 'Speak your query'}
                  className={`p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-md'
                      : 'bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-slate-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isListening ? 'Listening... speak clearly' : 'Ask about places, food, hours...'}
                className="flex-1 bg-stone-100 dark:bg-slate-800/80 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-500 focus:outline-none focus:border-brand-saffron"
              />

              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                title="Send query"
                aria-label="Send query"
                className="p-2 rounded-xl bg-gradient-to-r from-brand-saffron to-brand-spice text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:opacity-95 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Circular Launcher Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        title={isOpen ? 'Close AI Guide' : 'Chat with Local Lens AI Guide'}
        aria-label={isOpen ? 'Close AI Guide' : 'Chat with Local Lens AI Guide'}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-saffron via-brand-spice to-amber-500 text-white shadow-xl hover:shadow-glow-saffron flex items-center justify-center relative border-2 border-white/30 focus:outline-none focus:ring-4 focus:ring-brand-saffron/30"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close-icon"
              initial={prefersReducedMotion ? { opacity: 1 } : { rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="sparkles-icon"
              initial={prefersReducedMotion ? { opacity: 1 } : { rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <Sparkles className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </aside>
  );
};
