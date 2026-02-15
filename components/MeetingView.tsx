
import React, { useState, useRef, useEffect } from 'react';
import { Meeting, SummaryLevel } from '../types';
import { jsPDF } from 'jspdf';

interface MeetingViewProps {
  meeting: Meeting;
  onBack: () => void;
  onUpdate: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const MeetingView: React.FC<MeetingViewProps> = ({ meeting, onBack, onUpdate, onDelete, onDuplicate }) => {
  const [showTranscription, setShowTranscription] = useState(false);
  const [exportMode, setExportMode] = useState<'none' | 'email' | 'save'>('none');
  const [emailTarget, setEmailTarget] = useState('');
  
  // Renaming State
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(meeting.name);

  // Options Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getTemperatureStyle = (temp?: string) => {
    switch(temp) {
      case 'Amigável': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'Quente': return 'bg-rose-50 text-rose-800 border-rose-100';
      default: return 'bg-indigo-50 text-indigo-800 border-indigo-100';
    }
  };

  const getTemperatureIcon = (temp?: string) => {
    switch(temp) {
      case 'Amigável': return 'fa-face-smile-beam';
      case 'Quente': return 'fa-fire-flame-curved';
      default: return 'fa-temperature-half';
    }
  };

  const formatSummaryForExport = () => {
    if (!meeting.summary) return '';
    return `
RESUMO DE REUNIÃO: ${meeting.name}
Data: ${meeting.date}
Duração: ${meeting.duration}

VISÃO GERAL:
${meeting.summary.overview}

PONTOS PRINCIPAIS:
${meeting.summary.keyPoints.map(p => `- ${p}`).join('\n')}

DECISÕES TOMADAS:
${meeting.summary.decisions.map(d => `- ${d}`).join('\n')}

ITENS DE AÇÃO:
${meeting.summary.tasks.map(t => `- [${t.deadline || 'S/ DATA'}] ${t.description} (${t.owner || 'Sem responsável'})`).join('\n')}
    `.trim();
  };

  const handleEmailExport = () => {
    const text = formatSummaryForExport();
    const mailto = `mailto:${emailTarget}?subject=Resumo: ${encodeURIComponent(meeting.name)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
    setExportMode('none');
  };

  const handleWhatsAppExport = () => {
    const text = formatSummaryForExport();
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveTxt = () => {
    const text = formatSummaryForExport();
    downloadFile(text, `resumo_${meeting.id}.txt`, 'text/plain');
    setExportMode('none');
  };

  const handleSavePdf = () => {
    const doc = new jsPDF();
    const text = formatSummaryForExport();
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 10, 10);
    doc.save(`resumo_${meeting.id}.pdf`);
    setExportMode('none');
  };

  const handleToggleFavorite = () => {
    onUpdate({ ...meeting, isFavorite: !meeting.isFavorite });
  };

  const handleRenameSubmit = () => {
    if (tempName.trim()) {
      onUpdate({ ...meeting, name: tempName.trim() });
    }
    setIsRenaming(false);
  };

  // Audio Handlers
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatAudioTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white min-h-screen animate-fade-in pb-40">
      {meeting.audioUrl && (
        <audio 
          ref={audioRef} 
          src={meeting.audioUrl} 
          onTimeUpdate={onTimeUpdate} 
          onLoadedMetadata={onLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-40 border-b border-gray-100">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
        <div className="flex space-x-6 text-slate-400 items-center">
          <button 
            onClick={handleToggleFavorite}
            className={`transition-colors text-lg ${meeting.isFavorite ? 'text-yellow-400' : 'hover:text-slate-900'}`}
          >
            <i className={`fa-solid fa-star ${meeting.isFavorite ? '' : 'fa-regular'}`}></i>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="hover:text-slate-900 p-2"
            >
              <i className="fa-solid fa-ellipsis-vertical text-lg"></i>
            </button>
            
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 py-2 animate-fade-in overflow-hidden">
                  <button 
                    onClick={() => { setIsRenaming(true); setIsMenuOpen(false); }}
                    className="w-full text-left px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center"
                  >
                    <i className="fa-solid fa-pen mr-3 opacity-40"></i> Editar Título
                  </button>
                  <button 
                    onClick={() => { onDuplicate(meeting.id); setIsMenuOpen(false); }}
                    className="w-full text-left px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 flex items-center"
                  >
                    <i className="fa-solid fa-copy mr-3 opacity-40"></i> Duplicar Nota
                  </button>
                  <div className="h-[1px] bg-slate-100 my-1" />
                  <button 
                    onClick={() => { if(confirm('Excluir esta nota?')) { onDelete(meeting.id); } setIsMenuOpen(false); }}
                    className="w-full text-left px-5 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center"
                  >
                    <i className="fa-solid fa-trash mr-3 opacity-60"></i> Excluir Nota
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="flex items-start mb-2 group cursor-pointer" onClick={() => !isRenaming && setIsRenaming(true)}>
          <i className="fa-solid fa-pen-nib text-slate-300 text-lg mr-3 mt-1.5 flex-shrink-0"></i>
          {isRenaming ? (
            <input 
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') { setTempName(meeting.name); setIsRenaming(false); }
              }}
              className="w-full bg-slate-50 border-b-2 border-indigo-500 text-2xl font-extrabold text-slate-900 outline-none tracking-tight py-1 px-1 rounded-sm"
            />
          ) : (
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight tracking-tight hover:text-indigo-600 transition-colors">
              {meeting.name}
            </h1>
          )}
        </div>
        
        <div className="flex items-center space-x-2 mb-6 flex-wrap gap-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg">
            {meeting.category}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
            {meeting.type}
          </span>
          <span className="text-xs text-slate-500 font-bold ml-1">
            {meeting.date} • {meeting.duration}
          </span>
        </div>

        {/* Temperature Badge */}
        {meeting.summary && (
          <div className="mb-8">
            <div className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between ${getTemperatureStyle(meeting.summary.temperature)}`}>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-white/50 flex items-center justify-center shadow-inner">
                   <i className={`fa-solid ${getTemperatureIcon(meeting.summary.temperature)} text-xl`}></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-0.5">Temperatura</p>
                  <p className="text-sm font-extrabold">{meeting.summary.temperature}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-0.5">Engajamento</p>
                <p className="text-sm font-extrabold">{meeting.summary.userParticipation}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player */}
        <div className="bg-white rounded-[2.5rem] p-6 flex items-center space-x-5 border border-slate-100 mb-8 card-shadow">
          <button 
            onClick={togglePlay}
            disabled={!meeting.audioUrl}
            className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center flex-shrink-0 shadow-xl transition-all ${isPlaying ? 'bg-slate-900 text-white' : 'tech-gradient text-white shadow-indigo-200'}`}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl ${!isPlaying ? 'ml-1' : ''}`}></i>
          </button>
          
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div className="flex items-end space-x-1 h-8">
               {[...Array(28)].map((_, i) => (
                 <div 
                   key={i} 
                   className={`flex-1 rounded-full transition-all duration-300 ${i/28 * 100 < progress ? 'bg-indigo-500' : 'bg-slate-200'}`} 
                   style={{ height: `${20 + Math.sin(i * 0.5) * 30 + 30}%` }}
                 ></div>
               ))}
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-sm font-black text-slate-900 tracking-tighter tabular-nums">
              {formatAudioTime(currentTime)}
            </span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">
              {formatAudioTime(duration)}
            </span>
          </div>
        </div>

        {meeting.summary ? (
          <div className="space-y-12">
            <section className="animate-fade-in">
              <h2 className="text-lg font-black mb-4 flex items-center text-slate-900">
                <i className="fa-solid fa-compass text-indigo-600 mr-3 text-sm"></i> Visão Geral
              </h2>
              <p className="text-slate-700 leading-relaxed text-[16px] font-medium bg-slate-50 p-5 rounded-3xl border border-slate-100">
                {meeting.summary.overview}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-black mb-5 flex items-center text-slate-900">
                <i className="fa-solid fa-thumbtack text-rose-600 mr-3 text-sm"></i> Pontos Principais
              </h2>
              <ul className="space-y-5">
                {meeting.summary.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start text-[15px] text-slate-800 font-semibold leading-snug">
                    <span className="text-rose-500 mr-4 mt-1.5 w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 shadow-sm"></span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center space-y-6">
             <div className="w-16 h-16 rounded-3xl border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
             <p className="text-xs text-slate-500 font-black uppercase tracking-[0.3em]">IA Processando...</p>
          </div>
        )}
      </div>

      {/* Export UI Overlay / Floating Bar */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all w-[90%] max-w-md">
        {exportMode === 'email' && (
          <div className="bg-slate-900 rounded-[2rem] p-4 shadow-2xl animate-fade-in mb-4 border border-white/20">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 px-2">Enviar resumo por E-mail</p>
            <div className="flex space-x-2">
              <input 
                type="email" 
                placeholder="exemplo@email.com" 
                value={emailTarget}
                onChange={(e) => setEmailTarget(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleEmailExport} className="bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors">Enviar</button>
              <button onClick={() => setExportMode('none')} className="bg-white/10 text-white px-3 py-2.5 rounded-xl"><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
        )}

        {exportMode === 'save' && (
          <div className="bg-slate-900 rounded-[2rem] p-4 shadow-2xl animate-fade-in mb-4 border border-white/20">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 px-2">Escolha o formato de download</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleSavePdf} className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/10 flex flex-col items-center transition-all group">
                <i className="fa-solid fa-file-pdf text-rose-400 text-xl mb-2 group-hover:scale-110 transition-transform"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Baixar PDF</span>
              </button>
              <button onClick={handleSaveTxt} className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl border border-white/10 flex flex-col items-center transition-all group">
                <i className="fa-solid fa-file-lines text-blue-400 text-xl mb-2 group-hover:scale-110 transition-transform"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Baixar .TXT</span>
              </button>
            </div>
          </div>
        )}

        {exportMode === 'none' && (
          <div className="flex items-center justify-center bg-slate-900 text-white rounded-full p-2.5 shadow-2xl space-x-1 border border-white/20 scale-95 transition-all">
            <button onClick={() => setExportMode('email')} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-full transition-colors flex items-center">
              <i className="fa-solid fa-envelope mr-2.5 text-blue-400"></i> Email
            </button>
            <div className="w-[1px] h-4 bg-white/20"></div>
            <button onClick={handleWhatsAppExport} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-full transition-colors flex items-center">
              <i className="fa-brands fa-whatsapp mr-2.5 text-emerald-400"></i> WhatsApp
            </button>
            <div className="w-[1px] h-4 bg-white/20"></div>
            <button onClick={() => setExportMode('save')} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-full transition-colors flex items-center">
              <i className="fa-solid fa-floppy-disk mr-2.5 text-orange-400"></i> Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingView;
