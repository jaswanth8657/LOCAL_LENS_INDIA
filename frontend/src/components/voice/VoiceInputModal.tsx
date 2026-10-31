import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Mic, MicOff, Volume2, Globe, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { VoiceLanguage } from '../../types';
import { useTrip } from '../../context/TripContext';
import { useNavigate } from 'react-router-dom';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({ isOpen, onClose }) => {
  const { setVoiceQuery, setPreferences } = useTrip();
  const navigate = useNavigate();

  const [language, setLanguage] = useState<VoiceLanguage>('en-IN');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Suggested voice sample queries
  const sampleQueries = {
    'en-IN': [
      'Find beautiful beaches in Visakhapatnam',
      'Plan a 3-day cultural heritage trip in Jaipur under 2000 rupees',
      'Show authentic local food and street markets in Kochi'
    ],
    'hi-IN': [
      'विशाखापट्टनम में खूबसूरत समुद्र तट खोजें',
      'जयपुर में 2000 रुपये के बजट में 3 दिन की यात्रा की योजना बनाएं',
      'वाराणसी में प्रसिद्ध मंदिर और गंगा घाट दिखाएं'
    ],
    'te-IN': [
      'విశాఖపట్నంలో అందమైన బీచ్‌లను చూపించండి',
      'రోజుకు 2000 రూపాయల బడ్జెట్‌లో 3 రోజుల జైపూర్ ట్రిప్ ప్లాన్ చేయండి',
      'కొచ్చిలో స్థానిక సంస్కృతి మరియు ప్రసిద్ధ ప్రదేశాలు'
    ]
  };

  useEffect(() => {
    if (!isOpen) {
      if (isRecording) stopRecording();
      setErrorMessage(null);
    }
  }, [isOpen]);

  const requestMicAccess = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Audio recording is not supported in this browser environment.');
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (err: unknown) {
      setErrorMessage('Microphone access was denied. Please allow microphone permissions in browser settings.');
      return null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setTranscript('');
    const stream = await requestMicAccess();
    if (!stream) return;

    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setIsRecording(true);

      // In Phase 1 frontend, we simulate the speech capture interval with localized mock transcription
      // In Phase 6, this streams directly to the local faster-whisper CPU endpoint
      const timer = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          stopRecording();
        }
      }, 4000);

      mediaRecorder.onstop = () => {
        clearTimeout(timer);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsProcessing(true);

        setTimeout(() => {
          setIsProcessing(false);
          const sample = sampleQueries[language][0];
          setTranscript(sample);
        }, 900);
      };
    } catch (e: unknown) {
      setIsRecording(false);
      setErrorMessage('Failed to initialize audio recorder.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  };

  const handleApplyVoiceQuery = () => {
    if (!transcript.trim()) return;

    setVoiceQuery(transcript);
    
    // Parse known destinations from voice
    const lower = transcript.toLowerCase();
    if (lower.includes('visakhapatnam') || lower.includes('విశాఖపట్నం')) {
      setPreferences((prev) => ({ ...prev, destination: 'visakhapatnam', destinationName: 'Visakhapatnam' }));
    } else if (lower.includes('jaipur') || lower.includes('जयपुर')) {
      setPreferences((prev) => ({ ...prev, destination: 'jaipur', destinationName: 'Jaipur' }));
    } else if (lower.includes('kochi') || lower.includes('cochin')) {
      setPreferences((prev) => ({ ...prev, destination: 'kochi', destinationName: 'Kochi (Cochin)' }));
    }

    onClose();
    navigate('/discover');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Local Voice Travel Assistant">
      <div className="space-y-6">
        {/* Local Guarantee Badge */}
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-brand-peacock/10 border border-brand-peacock/20 text-xs text-sky-300">
          <Globe className="w-4 h-4 text-brand-peacock shrink-0" />
          <span>
            <strong>Local Speech Architecture:</strong> Audio stays entirely on your machine. No recordings are uploaded to cloud APIs.
          </span>
        </div>

        {/* Language Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-brand-saffron" />
            Spoken Language
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'en-IN', label: 'English (India)', native: 'English' },
              { id: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
              { id: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id as VoiceLanguage)}
                className={`py-2 px-3 rounded-xl text-center border transition-all text-xs ${
                  language === lang.id
                    ? 'bg-brand-saffron/20 border-brand-saffron text-white font-bold shadow-glow-saffron'
                    : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">{lang.native}</div>
                <div className="text-[10px] opacity-75">{lang.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Central Mic & Recording Visualizer */}
        <div className="flex flex-col items-center justify-center py-6 px-4 rounded-3xl bg-slate-950/60 border border-white/5 space-y-4">
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 rounded-full animate-ping bg-brand-saffron/30 scale-125" />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording
                  ? 'bg-red-500 text-white shadow-red-500/50 scale-105'
                  : 'bg-gradient-to-tr from-brand-saffron to-brand-spice text-white shadow-glow-saffron hover:scale-105'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">
              {isRecording
                ? 'Listening to your voice...'
                : isProcessing
                ? 'Processing on local CPU inference...'
                : 'Tap microphone to speak your travel request'}
            </p>
            <p className="text-xs text-slate-400">
              {isRecording ? 'Tap again when finished speaking' : 'Speech remains 100% private and on-device'}
            </p>
          </div>

          {/* Soundwave animation when recording */}
          {isRecording && (
            <div className="flex items-center gap-1 h-6">
              {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 0.9, 0.3].map((delay, idx) => (
                <div
                  key={idx}
                  className="w-1 bg-brand-saffron rounded-full animate-bounce"
                  style={{
                    height: `${Math.max(8, Math.min(24, Math.random() * 24))}px`,
                    animationDelay: `${delay * 0.2}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Error Warning */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Microphone Notice</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Editable Recognized Text or Direct Text Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span>Recognized Request (Editable)</span>
            <span className="text-[10px] text-slate-500">Text fallback enabled</span>
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={`e.g. "${sampleQueries[language][0]}" or type here...`}
            rows={3}
            className="w-full rounded-2xl bg-slate-900 border border-white/10 p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-saffron/60 focus:ring-1 focus:ring-brand-saffron/60 resize-none transition-all"
          />
        </div>

        {/* Quick Sample Prompts */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400">Try asking:</span>
          <div className="flex flex-col gap-1.5">
            {sampleQueries[language].map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTranscript(sample)}
                className="text-left text-xs text-slate-300 hover:text-brand-spice bg-white/[0.02] hover:bg-white/[0.06] p-2 rounded-xl border border-white/5 transition-all truncate"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!transcript.trim()}
            onClick={handleApplyVoiceQuery}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice hover:opacity-95 shadow-glow-saffron disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Apply to Search
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
