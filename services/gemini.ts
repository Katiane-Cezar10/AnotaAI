
import { GoogleGenAI, Type } from "@google/genai";
import { MeetingSummary, SummaryLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function generateMeetingSummary(
  transcription: string, 
  level: SummaryLevel = SummaryLevel.EXECUTIVE
): Promise<MeetingSummary> {
  const levelInstruction = {
    [SummaryLevel.QUICK]: "Seja extremamente conciso, apenas o essencial. Resuma em poucas sentenças.",
    [SummaryLevel.EXECUTIVE]: "Equilibre detalhes e síntese para executivos. Foco em impacto e decisões.",
    [SummaryLevel.DETAILED]: "Inclua todas as nuances e detalhes importantes da conversa. Transcreva partes importantes se necessário."
  }[level];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analise a seguinte transcrição de reunião e gere um resumo estruturado.
    Nível de detalhamento solicitado: ${level}. ${levelInstruction}
    
    Além do conteúdo, analise a "Temperatura da reunião":
    - 'Amigável': tom de ajuda, parceria, colaboração.
    - 'Quente': stress, raiva, insatisfação, conflito.
    - 'Padrão': alinhamentos neutros e objetivos.
    
    Estime também a 'userParticipation' (porcentagem de 0 a 100) baseada na frequência que o usuário principal (geralmente quem inicia ou coordena) aparece na transcrição.

    Retorne o JSON com os seguintes blocos:
    1. overview: Visão geral (objetivo e contexto).
    2. keyPoints: Lista de pontos principais discutidos.
    3. decisions: Lista de decisões tomadas (aprovado/rejeitado).
    4. tasks: Itens de ação (tarefa, responsável, prazo).
    5. risks: Riscos ou pontos de atenção levantados.
    6. temperature: Uma das três opções: 'Amigável', 'Quente', 'Padrão'.
    7. temperatureReason: Explique brevemente o MOMENTO EXATO ou a frase que justificou essa classificação de temperatura.
    8. userParticipation: Um número inteiro entre 0 e 100.
    
    Transcrição:
    ${transcription}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                owner: { type: Type.STRING },
                deadline: { type: Type.STRING }
              },
              required: ["description"]
            }
          },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: { type: Type.STRING },
          temperatureReason: { type: Type.STRING },
          userParticipation: { type: Type.INTEGER }
        },
        required: ["overview", "keyPoints", "decisions", "tasks", "risks", "temperature", "temperatureReason", "userParticipation"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}') as MeetingSummary;
  } catch (e) {
    console.error("Failed to parse summary JSON", e);
    throw e;
  }
}
