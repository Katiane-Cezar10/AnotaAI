
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppTab, Meeting, SummaryLevel, MeetingType, MeetingTemperature } from './types';
import RecordingSession from './components/RecordingSession';
import MeetingView from './components/MeetingView';
import { generateMeetingSummary } from './services/gemini';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.MEETINGS);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [activeType, setActiveType] = useState<MeetingType | 'Todos'>('Todos');
  const [insightsPeriod, setInsightsPeriod] = useState<'Dia' | 'Semana' | 'Mês'>('Semana');
  const [profileImage, setProfileImage] = useState<string | null>(localStorage.getItem('notee_profile_img'));
  
  // Tasks Tab Specific State
  const [taskFilter, setTaskFilter] = useState<'pending' | 'completed'>('pending');

  // New User Preferences
  const [defaultSummaryLevel, setDefaultSummaryLevel] = useState<SummaryLevel>(
    (localStorage.getItem('notee_pref_summary_level') as SummaryLevel) || SummaryLevel.EXECUTIVE
  );
  const [confidentialMode, setConfidentialMode] = useState(
    localStorage.getItem('notee_pref_confidential') === 'true'
  );
  const [weeklyReport, setWeeklyReport] = useState(
    localStorage.getItem('notee_pref_weekly_report') === 'true'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = [
    { name: "Todas", icon: "fa-layer-group" },
    { name: "Favoritos", icon: "fa-star" },
    { name: "Negócios", icon: "fa-briefcase" },
    { name: "Marketing", icon: "fa-rocket" }
  ];

  useEffect(() => {
    const saved = localStorage.getItem('notee_meetings_v4');
    if (saved) {
      setMeetings(JSON.parse(saved));
    } else {
      const mock: Meeting[] = [
        {
          id: '1',
          name: 'Discussão Anual de Estratégia GTM',
          category: 'Negócios',
          type: 'Profissional',
          date: 'Ontem',
          startTime: Date.now() - 86400000,
          duration: '32:04',
          durationMinutes: 32,
          transcription: 'Transcrição simulada...',
          isRecording: false,
          isFavorite: true,
          summary: {
            overview: 'Alinhamento global para o plano de expansão anual.',
            keyPoints: ['Aumento de 20% no budget de ADS', 'Foco em LATAM'],
            decisions: ['Aprovação do novo CRM'],
            tasks: [
              { description: 'Configurar Hubspot', owner: 'Pedro', deadline: '05/11', completed: false },
              { description: 'Revisar contratos de fornecedores', owner: 'Julia', deadline: 'Hoje', completed: false }
            ],
            risks: ['Baixa retenção no mobile'],
            temperature: 'Padrão',
            temperatureReason: 'O tom manteve-se pragmático focado em KPIs sem grandes oscilações emocionais.',
            userParticipation: 45
          }
        }
      ];
      setMeetings(mock);
      localStorage.setItem('notee_meetings_v4', JSON.stringify(mock));
    }
  }, []);

  // Persistence for preferences
  useEffect(() => {
    localStorage.setItem('notee_pref_summary_level', defaultSummaryLevel);
    localStorage.setItem('notee_pref_confidential', String(confidentialMode));
    localStorage.setItem('notee_pref_weekly_report', String(weeklyReport));
  }, [defaultSummaryLevel, confidentialMode, weeklyReport]);

  const handleStartMeeting = () => setIsRecording(true);

  const handleStopRecording = async (transcription: string, audioUrl?: string) => {
    setIsRecording(false);
    if (!transcription.trim()) return;

    const newMeeting: Meeting = {
      id: Date.now().toString(),
      name: `Nota em ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      category: 'Reuniões',
      type: 'Profissional',
      date: 'Hoje',
      startTime: Date.now(),
      duration: '00:00',
      durationMinutes: 0,
      transcription: transcription.trim(),
      isRecording: false,
      audioUrl: audioUrl,
    };

    const updated = [newMeeting, ...meetings];
    setMeetings(updated);
    setSelectedMeetingId(newMeeting.id);

    try {
      const summary = await generateMeetingSummary(transcription, defaultSummaryLevel);
      setMeetings(prev => {
        const up = prev.map(m => m.id === newMeeting.id ? { ...m, summary } : m);
        localStorage.setItem('notee_meetings_v4', JSON.stringify(up));
        return up;
      });
    } catch (err) {
      console.error("Failed to summarize:", err);
    }
  };

  const handleUpdateMeeting = (updatedMeeting: Meeting) => {
    const updated = meetings.map(m => m.id === updatedMeeting.id ? updatedMeeting : m);
    setMeetings(updated);
    localStorage.setItem('notee_meetings_v4', JSON.stringify(updated));
  };

  const handleDeleteMeeting = (id: string) => {
    const updated = meetings.filter(m => m.id !== id);
    setMeetings(updated);
    localStorage.setItem('notee_meetings_v4', JSON.stringify(updated));
    setSelectedMeetingId(null);
  };

  const handleDuplicateMeeting = (id: string) => {
    const original = meetings.find(m => m.id === id);
    if (original) {
      const copy: Meeting = {
        ...original,
        id: Date.now().toString(),
        name: `${original.name} (Cópia)`,
        isFavorite: false
      };
      const updated = [copy, ...meetings];
      setMeetings(updated);
      localStorage.setItem('notee_meetings_v4', JSON.stringify(updated));
    }
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setProfileImage(base64);
        localStorage.setItem('notee_profile_img', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Enhanced Insights Data logic
  const insightsData = useMemo(() => {
    const count = meetings.length;
    const totalMinutes = meetings.reduce((acc, m) => acc + (m.durationMinutes || 0), 0);
    const meetingsWithSummary = meetings.filter(m => m.summary !== undefined);
    const countWithSummary = meetingsWithSummary.length;
    
    const avgParticipation = countWithSummary > 0 
      ? Math.round(meetingsWithSummary.reduce((acc, m) => acc + (m.summary?.userParticipation || 0), 0) / countWithSummary) 
      : 0;

    // Mood distribution
    const moodCounts = meetingsWithSummary.reduce((acc, m) => {
      const temp = m.summary?.temperature || 'Padrão';
      acc[temp] = (acc[temp] || 0) + 1;
      return acc;
    }, { Amigável: 0, Padrão: 0, Quente: 0 } as Record<MeetingTemperature, number>);

    const moodStats = {
      Amigável: countWithSummary > 0 ? Math.round((moodCounts['Amigável'] / countWithSummary) * 100) : 0,
      Padrão: countWithSummary > 0 ? Math.round((moodCounts['Padrão'] / countWithSummary) * 100) : 0,
      Quente: countWithSummary > 0 ? Math.round((moodCounts['Quente'] / countWithSummary) * 100) : 0,
    };

    // Real Weekly Distribution for Chart
    const labels = insightsPeriod === 'Dia' ? ['08h', '11h', '14h', '17h', '20h'] : 
                   insightsPeriod === 'Semana' ? ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] :
                   ['SEM 1', 'SEM 2', 'SEM 3', 'SEM 4'];
    
    let values = labels.map(() => 0);

    if (insightsPeriod === 'Semana') {
      const now = new Date();
      const currentDay = now.getDay();
      const diffToMonday = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diffToMonday));
      startOfWeek.setHours(0,0,0,0);

      meetings.forEach(m => {
        const mDate = new Date(m.startTime);
        if (mDate >= startOfWeek) {
           const d = mDate.getDay(); 
           const index = d === 0 ? 6 : d - 1; 
           if (index >= 0 && index < 7) {
            values[index]++;
           }
        }
      });
      const maxValue = Math.max(...values, 1);
      values = values.map(v => (v / maxValue) * 100);
    } else {
      values = labels.map(() => Math.floor(Math.random() * 80) + 20);
    }

    return { count, totalMinutes, avgParticipation, moodStats, chart: { labels, values } };
  }, [meetings, insightsPeriod]);

  // Enhanced Task Handling
  const toggleTaskStatus = (meetingId: string, taskDesc: string) => {
    const updated = meetings.map(m => {
      if (m.id === meetingId && m.summary) {
        const newTasks = m.summary.tasks.map(t => 
          t.description === taskDesc ? { ...t, completed: !t.completed } : t
        );
        return { ...m, summary: { ...m.summary, tasks: newTasks } };
      }
      return m;
    });
    setMeetings(updated);
    localStorage.setItem('notee_meetings_v4', JSON.stringify(updated));
  };

  const allTasks = useMemo(() => {
    return meetings.flatMap(m => 
      (m.summary?.tasks || []).map(t => ({ 
        ...t, 
        meetingId: m.id, 
        meetingName: m.name,
        meetingCategory: m.category
      }))
    );
  }, [meetings]);

  const filteredTasks = allTasks.filter(t => 
    taskFilter === 'completed' ? t.completed : !t.completed
  );

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = activeType === 'Todos' || m.type === activeType;
      const matchesCategory = activeCategory === 'Todas' || 
                              (activeCategory === 'Favoritos' && m.isFavorite) ||
                              m.category === activeCategory;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [meetings, searchTerm, activeType, activeCategory]);

  const renderContent = () => {
    if (selectedMeetingId) {
      const meeting = meetings.find(m => m.id === selectedMeetingId);
      if (meeting) return (
        <MeetingView 
          meeting={meeting} 
          onBack={() => setSelectedMeetingId(null)} 
          onUpdate={handleUpdateMeeting}
          onDelete={handleDeleteMeeting}
          onDuplicate={handleDuplicateMeeting}
        />
      );
    }

    switch (activeTab) {
      case AppTab.MEETINGS:
        return (
          <div className="px-6 pt-12 pb-56 animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-6">Minhas Notas</h1>
              
              {/* Category Folder Selector - "Pasta Favoritos com Estrela" */}
              <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-6">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl whitespace-nowrap transition-all border font-black text-[10px] uppercase tracking-widest ${activeCategory === cat.name ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                  >
                    <i className={`fa-solid ${cat.icon} ${cat.name === 'Favoritos' ? 'text-yellow-400' : ''}`}></i>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200">
                {['Todos', 'Profissional', 'Pessoal'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setActiveType(type as any)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeType === type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="relative mb-6">
                <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                <input 
                  type="text" 
                  placeholder="Encontrar nota" 
                  className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-4 pl-14 pr-4 text-[15px] font-bold text-slate-900 focus:ring-4 focus:ring-indigo-50 outline-none transition-all shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </header>
            <div className="space-y-6">
               {filteredMeetings.length === 0 ? (
                 <div className="py-20 flex flex-col items-center justify-center opacity-20 text-center">
                    <i className="fa-solid fa-folder-open text-6xl mb-4"></i>
                    <p className="text-sm font-black uppercase tracking-widest">Nenhuma nota encontrada</p>
                 </div>
               ) : (
                 filteredMeetings.map(m => (
                   <div 
                     key={m.id} 
                     onClick={() => setSelectedMeetingId(m.id)}
                     className="flex items-center space-x-5 p-6 rounded-[2rem] border border-slate-100 bg-white hover:border-indigo-300 transition-all cursor-pointer group card-shadow"
                   >
                     <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center transition-all border border-slate-100">
                        <i className={`fa-solid ${m.category === 'Marketing' ? 'fa-rocket' : m.category === 'Negócios' ? 'fa-briefcase' : 'fa-brain'} text-lg bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-500 bg-clip-text text-transparent`}></i>
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-slate-900 truncate text-[16px] leading-tight tracking-tight">{m.name}</h3>
                          {m.isFavorite && <i className="fa-solid fa-star text-yellow-400 text-[10px]"></i>}
                        </div>
                        <div className="flex items-center space-x-2.5 mt-1">
                           <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${m.type === 'Profissional' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.type}</span>
                           <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{m.date} • {m.duration}</span>
                        </div>
                     </div>
                     <i className="fa-solid fa-chevron-right text-[12px] text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1.5 transition-all"></i>
                   </div>
                 ))
               )}
            </div>
            <div className="fixed bottom-28 left-0 right-0 max-w-md mx-auto flex justify-center z-30 pointer-events-none px-6">
              <button 
                onClick={handleStartMeeting}
                className="pointer-events-auto tech-gradient text-white font-black py-5 px-14 rounded-full shadow-2xl flex items-center justify-center space-x-3 transition-all transform hover:scale-105 active:scale-95 w-full sm:w-auto"
              >
                <i className="fa-solid fa-microphone-lines text-sm"></i>
                <span className="text-[11px] uppercase tracking-[0.25em]">Gravar Agora</span>
              </button>
            </div>
          </div>
        );

      case AppTab.SUMMARIES:
        return (
          <div className="px-6 pt-12 pb-40 animate-fade-in space-y-10 overflow-y-auto no-scrollbar">
             <header className="flex justify-between items-center">
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">Insights de IA</h1>
               <div className="w-10 h-10 tech-gradient rounded-xl flex items-center justify-center text-white shadow-lg">
                  <i className="fa-solid fa-chart-pie"></i>
               </div>
             </header>
             
             {/* Period Selector */}
             <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                {(['Dia', 'Semana', 'Mês'] as const).map((period) => (
                  <button 
                    key={period}
                    onClick={() => setInsightsPeriod(period)}
                    className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${insightsPeriod === period ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500'}`}
                  >
                    {period}
                  </button>
                ))}
             </div>

             {/* Main Dashboard Cards */}
             <div className="grid grid-cols-2 gap-5">
                {/* Participation Chart - "Ajustado com borda sem cortes" */}
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] card-shadow flex flex-col items-center justify-center min-h-[220px]">
                   <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90 overflow-visible">
                        {/* Background track circle - Com respiro para o stroke de 12 */}
                        <circle cx="64" cy="64" r="50" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                        <circle 
                          cx="64" cy="64" r="50" 
                          stroke="url(#participation_grad_final)" 
                          strokeWidth="12" fill="none" 
                          strokeDasharray="314.16" 
                          strokeDashoffset={314.16 - (314.16 * insightsData.avgParticipation) / 100} 
                          strokeLinecap="round" 
                          className="transition-all duration-1000 ease-in-out" 
                        />
                        <defs>
                           <linearGradient id="participation_grad_final" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#6366f1" />
                              <stop offset="100%" stopColor="#a855f7" />
                           </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute text-3xl font-black text-slate-900 tracking-tighter">{insightsData.avgParticipation}%</span>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Participação</p>
                </div>
                
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] card-shadow flex flex-col justify-center min-h-[220px]">
                   <div className="space-y-5">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Amigável</span>
                         <span className="text-sm font-black text-slate-900">{insightsData.moodStats.Amigável}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                         <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${insightsData.moodStats.Amigável}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Padrão</span>
                         <span className="text-sm font-black text-slate-900">{insightsData.moodStats.Padrão}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                         <div className="h-full bg-slate-400 transition-all duration-1000" style={{ width: `${insightsData.moodStats.Padrão}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Quente</span>
                         <span className="text-sm font-black text-slate-900">{insightsData.moodStats.Quente}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                         <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${insightsData.moodStats.Quente}%` }}></div>
                      </div>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-8 text-center">Mood Tracker</p>
                </div>
             </div>

             {/* Volume Chart */}
             <div className="bg-white border border-slate-100 p-10 rounded-[3rem] card-shadow">
                <div className="flex justify-between items-start mb-12">
                   <div>
                     <p className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Volume Mensal</p>
                     <p className="text-3xl font-black text-slate-900 tracking-tight">Atividade Recente</p>
                   </div>
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                      <i className="fa-solid fa-chart-line text-slate-300 text-xl"></i>
                   </div>
                </div>
                
                <div className="h-44 flex items-end justify-between space-x-3 px-2">
                   {insightsData.chart.values.map((val, i) => (
                     <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end">
                        <div className="relative w-full h-full flex flex-col justify-end">
                           <div className="absolute -top-10 left-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md z-10 whitespace-nowrap pointer-events-none">
                              {Math.round((val / 100) * Math.max(...meetings.reduce((acc, m) => {
                                const d = new Date(m.startTime).getDay();
                                const idx = d === 0 ? 6 : d - 1;
                                acc[idx] = (acc[idx] || 0) + 1;
                                return acc;
                              }, [0,0,0,0,0,0,0]))) || 0} sessões
                           </div>
                           <div 
                             className={`w-full transition-all duration-700 rounded-t-xl group-hover:brightness-110 shadow-sm ${val > 0 ? 'bg-indigo-500 shadow-indigo-100' : 'bg-slate-100'}`} 
                             style={{ height: `${Math.max(val, 5)}%` }}
                           ></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 mt-6 tracking-tighter uppercase whitespace-nowrap">{insightsData.chart.labels[i]}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white card-shadow flex items-center justify-between relative overflow-hidden">
                <div className="relative z-10">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-3">Total de Horas</p>
                   <p className="text-4xl font-black tracking-tighter">
                      {Math.floor(insightsData.totalMinutes / 60)}h {insightsData.totalMinutes % 60}m
                   </p>
                </div>
                <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center backdrop-blur-md relative z-10 border border-white/10 shadow-inner">
                   <i className="fa-solid fa-clock-rotate-left text-3xl text-indigo-300"></i>
                </div>
                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl"></div>
             </div>
          </div>
        );

      case AppTab.ACTIONS:
        return (
          <div className="px-6 pt-12 pb-32 animate-fade-in flex flex-col h-full overflow-hidden">
             <header className="mb-8">
               <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-6">Suas Pendências</h1>
               <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button 
                    onClick={() => setTaskFilter('pending')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${taskFilter === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Abertas ({allTasks.filter(t => !t.completed).length})
                  </button>
                  <button 
                    onClick={() => setTaskFilter('completed')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${taskFilter === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    Concluídas ({allTasks.filter(t => t.completed).length})
                  </button>
               </div>
             </header>

             <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-20">
                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                    <i className="fa-solid fa-clipboard-check text-6xl mb-6"></i>
                    <p className="text-sm font-black uppercase tracking-widest">Tudo em dia!</p>
                  </div>
                ) : (
                  filteredTasks.map((task, i) => (
                    <div 
                      key={`${task.meetingId}-${i}`} 
                      className={`p-6 rounded-[2rem] border transition-all card-shadow flex items-start space-x-5 ${task.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                    >
                       <button 
                         onClick={() => toggleTaskStatus(task.meetingId, task.description)}
                         className={`w-8 h-8 rounded-xl border-2 flex-shrink-0 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-200 hover:border-indigo-400'}`}
                       >
                         {task.completed && <i className="fa-solid fa-check text-xs"></i>}
                       </button>
                       
                       <div className="flex-1 min-w-0">
                          <p className={`text-[15px] font-extrabold leading-tight mb-1.5 ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {task.description}
                          </p>
                          <div className="flex items-center space-x-3">
                             <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
                                {task.meetingName}
                             </span>
                             {task.deadline && (
                               <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${task.deadline.toLowerCase().includes('hoje') ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                 <i className="fa-solid fa-calendar-day mr-1"></i> {task.deadline}
                               </span>
                             )}
                          </div>
                       </div>
                       
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border text-[14px] ${task.meetingCategory === 'Marketing' ? 'bg-orange-50 text-orange-400 border-orange-100' : 'bg-indigo-50 text-indigo-400 border-indigo-100'}`}>
                          <i className={`fa-solid ${task.meetingCategory === 'Marketing' ? 'fa-rocket' : task.meetingCategory === 'Negócios' ? 'fa-briefcase' : 'fa-brain'}`}></i>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        );

      case AppTab.SETTINGS:
        return (
          <div className="px-6 pt-12 pb-32 animate-fade-in space-y-10">
             <header>
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">Perfil e Configurações</h1>
               <p className="text-slate-400 text-sm mt-1 font-medium">Gerencie sua identidade executiva digital</p>
             </header>

             {/* Profile Main Card */}
             <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 card-shadow">
               <div className="flex items-center space-x-6">
                 <div 
                   className="w-24 h-24 rounded-[1.8rem] tech-gradient flex items-center justify-center text-white text-3xl font-black shadow-xl relative group overflow-hidden cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}
                 >
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      "JD"
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fa-solid fa-camera text-white text-xl"></i>
                    </div>
                 </div>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleProfileImageChange} 
                   accept="image/*" 
                   className="hidden" 
                 />
                 <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">João D.</h2>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded-md">Membro Pro</p>
                    <button className="block text-[11px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest mt-4 transition-colors">Alterar Senha</button>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-2xl font-black text-slate-900">{insightsData.count}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reuniões</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-slate-900">{Math.round(insightsData.totalMinutes / 60)}h</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tempo Total</p>
                  </div>
               </div>
             </div>

             {/* IA Preferences */}
             <section className="space-y-4">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center">
                 <i className="fa-solid fa-brain mr-3 text-indigo-500"></i> Inteligência Artificial
               </h3>
               <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-6 card-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Nível de Resumo Padrão</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Define o detalhamento inicial</p>
                    </div>
                    <select 
                      value={defaultSummaryLevel}
                      onChange={(e) => setDefaultSummaryLevel(e.target.value as SummaryLevel)}
                      className="bg-slate-50 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-50"
                    >
                      {Object.values(SummaryLevel).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Relatório Estratégico Semanal</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Receber por e-mail todo domingo</p>
                    </div>
                    <button 
                      onClick={() => setWeeklyReport(!weeklyReport)}
                      className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${weeklyReport ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all ${weeklyReport ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
               </div>
             </section>

             {/* Security & Confidentiality */}
             <section className="space-y-4">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center">
                 <i className="fa-solid fa-shield-halved mr-3 text-emerald-500"></i> Segurança e Sigilo
               </h3>
               <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-6 card-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Modo Confidencial</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Bloquear notas com biometria</p>
                    </div>
                    <button 
                      onClick={() => setConfidentialMode(!confidentialMode)}
                      className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${confidentialMode ? 'bg-emerald-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all ${confidentialMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <button className="w-full py-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors">
                    Limpar histórico de gravações
                  </button>
               </div>
             </section>

             {/* Plan & Billing */}
             <section className="space-y-4">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center">
                 <i className="fa-solid fa-credit-card mr-3 text-rose-500"></i> Plano e Assinatura
               </h3>
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Atualize para Unlimited</p>
                    <p className="text-2xl font-black mb-1">Transcrição Infinita</p>
                    <p className="text-sm opacity-60 font-medium">Sem limites de minutos mensais e acesso ao Gemini 3 Pro.</p>
                    <button className="mt-8 bg-white text-slate-900 px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                      Ver Opções de Upgrade
                    </button>
                  </div>
                  <i className="fa-solid fa-gem absolute -right-6 -bottom-6 text-9xl opacity-10 -rotate-12"></i>
               </div>
             </section>

             <div className="pt-8 pb-12 flex flex-col items-center space-y-2 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest">ExecuScribe v2.4.0</p>
                <p className="text-[9px] font-bold">Desenvolvido para Profissionais de Elite</p>
             </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isRecording) return <RecordingSession onStop={handleStopRecording} />;

  return (
    <div className="h-screen max-w-md mx-auto relative bg-white border-x border-slate-100 overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.05)]">
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {renderContent()}
      </main>

      <nav className="h-20 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around px-4 shrink-0 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <button onClick={() => { setActiveTab(AppTab.MEETINGS); setSelectedMeetingId(null); }} className={`flex flex-col items-center space-y-2 transition-all w-1/4 ${activeTab === AppTab.MEETINGS && !selectedMeetingId ? 'text-slate-900 scale-105' : 'text-slate-300'}`}>
          <i className="fa-solid fa-house text-lg"></i>
          <span className="text-[9px] font-black uppercase tracking-[0.25em]">Início</span>
        </button>
        <button onClick={() => { setActiveTab(AppTab.SUMMARIES); setSelectedMeetingId(null); }} className={`flex flex-col items-center space-y-2 transition-all w-1/4 ${activeTab === AppTab.SUMMARIES ? 'text-slate-900 scale-105' : 'text-slate-300'}`}>
          <i className="fa-solid fa-lightbulb text-lg"></i>
          <span className="text-[9px] font-black uppercase tracking-[0.25em]">Insights</span>
        </button>
        <button onClick={() => { setActiveTab(AppTab.ACTIONS); setSelectedMeetingId(null); }} className={`flex flex-col items-center space-y-2 transition-all w-1/4 ${activeTab === AppTab.ACTIONS ? 'text-slate-900 scale-105' : 'text-slate-300'}`}>
          <i className="fa-solid fa-list-check text-lg"></i>
          <span className="text-[9px] font-black uppercase tracking-[0.25em]">Tarefas</span>
        </button>
        <button onClick={() => { setActiveTab(AppTab.SETTINGS); setSelectedMeetingId(null); }} className={`flex flex-col items-center space-y-2 transition-all w-1/4 ${activeTab === AppTab.SETTINGS ? 'text-slate-900 scale-105' : 'text-slate-300'}`}>
          <i className="fa-solid fa-circle-user text-lg"></i>
          <span className="text-[9px] font-black uppercase tracking-[0.25em]">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
