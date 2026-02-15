
export enum AppTab {
  MEETINGS = 'meetings',
  SUMMARIES = 'summaries',
  ACTIONS = 'actions',
  SETTINGS = 'settings'
}

export enum SummaryLevel {
  QUICK = 'Rápido',
  EXECUTIVE = 'Executivo',
  DETAILED = 'Detalhado'
}

export type MeetingTemperature = 'Amigável' | 'Quente' | 'Padrão';
export type MeetingType = 'Profissional' | 'Pessoal';

export interface Task {
  id: string;
  description: string;
  owner?: string;
  deadline?: string;
  completed?: boolean; // New field for status tracking
  meetingId: string;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  decisions: string[];
  tasks: Array<{ description: string; owner: string; deadline: string; completed?: boolean }>;
  risks: string[];
  temperature: MeetingTemperature;
  temperatureReason?: string;
  userParticipation: number;
}

export interface Meeting {
  id: string;
  name: string;
  category: string;
  type: MeetingType;
  date: string;
  startTime: number;
  duration: string;
  durationMinutes: number;
  transcription: string;
  summary?: MeetingSummary;
  isRecording: boolean;
  levelPreference?: SummaryLevel;
  audioUrl?: string;
  isFavorite?: boolean;
}

export interface TranscriptionTurn {
  speaker: string;
  text: string;
  timestamp: string;
}
