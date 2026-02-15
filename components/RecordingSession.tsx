
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { createBlobFromFloat32 } from '../utils/audio';

interface RecordingSessionProps {
  onStop: (finalTranscription: string, audioUrl?: string) => void;
}

const RecordingSession: React.FC<RecordingSessionProps> = ({ onStop }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [turns, setTurns] = useState<Array<{ speaker: string, text: string, time: string }>>([]);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionRef = useRef<string>("");

  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    initRecording();
    return () => {
      clearInterval(timer);
      stopResources();
    };
  }, []);

  const initRecording = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup MediaRecorder for actual storage
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'Você é um assistente executivo. Transcreva fielmente tudo que ouvir. Identifique mudanças de locutor e forneça o texto claro.'
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            const source = audioCtx.createMediaStreamSource(stream);
            const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));
              const pcmBlob = createBlobFromFloat32(inputData);
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioCtx.destination);
          },
          onmessage: async (message) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              transcriptionRef.current += " " + text;
              
              const now = new Date();
              const timeStr = now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
              
              setTurns(prev => {
                if (prev.length > 0 && prev[prev.length - 1].time === timeStr) {
                   const last = prev[prev.length - 1];
                   return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
                }
                return [...prev, { speaker: 'Participante', text, time: timeStr }];
              });
            }
          }
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const stopResources = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
  };

  const handleStop = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to data URL for storage
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          onStop(transcriptionRef.current, base64Audio);
          stopResources();
        };
      };
      mediaRecorderRef.current.stop();
    } else {
      onStop(transcriptionRef.current);
      stopResources();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Dynamic Header */}
      <div className="px-6 pt-12 pb-6 border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Gravando Reunião</span>
          </div>
          <span className="text-2xl font-black text-gray-900 tracking-tighter tabular-nums">{formatTime(elapsed)}</span>
        </div>
        <h2 className="text-xl font-extrabold mt-4 text-gray-900">Transcrição em Tempo Real</h2>
      </div>

      {/* Transcript Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
        {turns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20">
             <i className="fa-solid fa-microphone-lines text-6xl text-gray-900"></i>
             <p className="text-sm font-black uppercase tracking-widest">Ouvindo o ambiente...</p>
          </div>
        ) : (
          turns.map((turn, i) => (
            <div key={i} className="animate-fade-in border-l-2 border-gray-100 pl-5">
              <div className="flex items-center space-x-2 mb-3">
                 <span className="text-[10px] font-black text-gray-500 font-mono tracking-tighter">{turn.time}</span>
                 <span className="w-1 h-1 rounded-full bg-blue-600"></span>
                 <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{turn.speaker}</span>
              </div>
              <p className="text-gray-900 leading-relaxed text-[16px] font-medium">
                {turn.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Action Footer */}
      <div className="p-10 border-t border-gray-100 flex flex-col items-center justify-center bg-gray-50/50">
         <button 
           onClick={handleStop}
           className="w-16 h-16 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group"
         >
           <i className="fa-solid fa-stop text-xl group-hover:scale-110 transition-transform"></i>
         </button>
         <p className="mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Finalizar Sessão</p>
      </div>
    </div>
  );
};

export default RecordingSession;
