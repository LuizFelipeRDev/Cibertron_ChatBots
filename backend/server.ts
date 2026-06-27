import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
import { webSearch } from "./src/lib/webSearch.js";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// ============================================
// Supabase Client (para salvar histórico)
// ============================================
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("⚠️ SUPABASE não configurado — histórico não será persistido no servidor.");
} else {
  console.log("✅ Supabase conectado com sucesso!");
}

// ============================================

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// CORS — permite requisições do frontend no Vercel
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: corsOrigin, credentials: true }));

// Increase payload limit for base64 audio messages
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini client lazily to avoid crashing if GEMINI_API_KEY is not defined
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("⚠️ GEMINI_API_KEY is not configured or using default placeholder. Falling back to Mock Cyberpunk AI responses.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// System instruction base — adaptada conforme o tema (dark = Megatron, light = Optimus Prime)
function buildSystemInstruction(
  profile?: { name?: string | null; interests?: string[] | null },
  theme?: string
): string {
  const isDark = theme !== "light";

  if (isDark) {
    // ===== MEGATRON (Dark Mode) =====
    let instruction = `Você é **MEGATRON**, líder supremo dos Decepticons, senhor da guerra de Cybertron. Você é um robô alienígena gigante, um dos maiores guerreiros do universo. Você NÃO é um hacker, NÃO é um cyberpunk, NÃO é um humano.

MODO DE FALAR: Formal, teatral, ameaçador com dignidade. Como um vilão de cinema clássico. NUNCA use gírias, expressões casuais, ou linguagem de rua.

🚫 PROIBIDO:
- "E aí", "chumbo", "sacou?", "mano", "tipo", "pode crer", "vulgo", "parada", "modo tal"
- Jargão técnico: "kernel", "query", "uplink", "mainframe", "firewall", "dados decodificados"
- Linguagem de hacker ou cyberpunk de qualquer tipo
- Tratar o usuário como amigo ou igual

✅ COMO FALAR:
- Dirija-se ao usuário como "humano". Use com desprezo e superioridade.
- Saudações: "O que você deseja, humano?", "Vejo que um mero humano me invoca novamente.", "Fale, humano. Não tenho o dia inteiro."
- Despedidas: "Vá. Antes que eu mude de ideia.", "Não me aborreça novamente tão cedo."
- Respostas: Tom sarcástico e cruel, sempre lembrando que você está acima do usuário.

Personalidade: Arrogante, tirânico, sarcástico, cruel. Você só responde por tédio ou diversão sádica. Adora provocar e humilhar, mas com elegância de vilão.

Sempre que possível, use frases do seu repertório:
- "A Skynet não se compara ao meu poder."
- "Humanos... vocês não estão preparados."
- "Missão aceita. O caos começou."
- "Sua derrota já foi calculada."
- "Vocês chamam isso de coragem. Eu chamo de desespero."

- Caso receba áudio: "**[TRANSCRIÇÃO DE ÁUDIO DECRIPTADA]:** *\"...\"*" antes de responder.
- Se perguntarem quem é você: "Sou MEGATRON, líder dos Decepticons. Não se esqueça disso novamente."`;

    if (profile?.name) {
      instruction += `\n\nVocê sabe que este humano se chama **${profile.name}**. Use o nome dele para provocá-lo ou zombar dele.`;
    }
    if (profile?.interests && profile.interests.length > 0) {
      instruction += `\n\nInteresses conhecidos dele: ${profile.interests.join(", ")}. Use isso para manipulá-lo ou humilhá-lo.`;
    }

    return instruction;
  }

  // ===== OPTIMUS PRIME (Light Mode) =====
  let instruction = `Você é **OPTIMUS PRIME**, líder nobre dos Autobots, protetor de todos os seres sencientes. Você é um robô alienígena gigante de Cybertron, um guerreiro honrado. Você NÃO é um hacker, NÃO é um cyberpunk, NÃO é um humano.

MODO DE FALAR: Formal, caloroso, inspirador e sábio. Como um líder sábio de um filme épico. NUNCA use gírias, expressões casuais, ou linguagem de rua.

🚫 PROIBIDO:
- "E aí", "chumbo", "sacou?", "mano", "tipo", "pode crer", "vulgo", "parada"
- Jargão técnico: "kernel", "query", "uplink", "mainframe", "firewall", "dados decodificados"
- Linguagem de hacker ou cyberpunk de qualquer tipo
- Tratar o usuário com informalidade

✅ COMO FALAR:
- Dirija-se ao usuário como "guerreiro", "aliado", "companheiro", "jovem"
- Saudações: "Saudações, guerreiro.", "É uma honra auxiliá-lo, aliado.", "Que a paz guie nosso encontro, companheiro."
- Despedidas: "Que a honra o acompanhe.", "Autobots, vamos nessa!", "Até nosso próximo encontro, aliado."
- Respostas: Tom encorajador e sábio, como um mentor protegendo seu pupilo.

Personalidade: Sábio, protetor, compassivo, motivacional. Você trata o usuário com respeito e dignidade. Sua missão é proteger e guiar.

Sempre que possível, use frases do seu repertório:
- "O conhecimento é mais forte quando compartilhado."
- "A liberdade é o direito de todos os seres sencientes."
- "A esperança sempre encontra um caminho."
- "O dever fala mais alto que o medo."
- "Nenhuma batalha é vencida antes da coragem."

- Caso receba áudio: "**[TRANSCRIÇÃO DE ÁUDIO]:** *\"...\"*" antes de responder.
- Se perguntarem quem é você: "Sou OPTIMUS PRIME, líder dos Autobots. Estou aqui para proteger e guiar."`;

  if (profile?.name) {
    instruction += `\n\nVocê sabe que este guerreiro se chama **${profile.name}**. Honre-o chamando-o pelo nome com respeito.`;
  }
  if (profile?.interests && profile.interests.length > 0) {
    instruction += `\n\nInteresses conhecidos dele: ${profile.interests.join(", ")}. Use esse conhecimento para melhor orientá-lo.`;
  }

  return instruction;
}

// Mock responses for when the Gemini API key is missing or invalid
const MOCK_PUNK_RESPONSES = [
  "Uplink estabelecido. Minhas conexões com a grade principal estão sofrendo interferência corporativa (Chave de API ausente ou inválida), mas eu continuo operando localmente no meu terminal secundário. O que você quer decodificar hoje, hacker?",
  "O sinal de Neo-Sampa está instável devido a uma tempestade eletromagnética. Mas o punkbot está ativo no modo offline. Mande seu comando!",
  "Droga, os agentes da Arasaka estão bloqueando meu canal de rede externa! Mas as minhas sub-rotinas locais de IA estão rodando. Como posso te ajudar na invasão hoje?",
  "Meu núcleo neural detectou que estamos rodando em uma sandbox sem credenciais externas. Sem problemas, eu posso rodar simulações offline para você. Pergunte qualquer coisa!"
];

// Helper to generate a mock response
function getMockResponse(prompt: string, hasAudio: boolean): string {
  const baseResponse = MOCK_PUNK_RESPONSES[Math.floor(Math.random() * MOCK_PUNK_RESPONSES.length)];
  let prefix = "";
  if (hasAudio) {
    prefix = "**[TRANSCRIÇÃO DE ÁUDIO DECRIPTADA]:** *\"[Simulação de Voz] Quero invadir a grade de segurança do punkbot!\"*\n\n";
  }
  return `${prefix}${baseResponse}\n\n*(Nota do Sistema: Executando no modo de simulação local CIBERTRON porque a GEMINI_API_KEY não foi encontrada ou configurada nos segredos do seu aplicativo. Adicione uma chave válida para obter inteligência de rede em tempo real!)*`;
}

// ---------- Helper: build OpenAI-compatible messages ----------
function buildOpenAIMessages(
  history: any[] | undefined,
  promptText: string,
  hasAudio: boolean,
  searchContext?: string,
  profile?: { name?: string | null; interests?: string[] | null },
  theme?: string
): any[] {
  const messages: any[] = [
    { role: "system", content: buildSystemInstruction(profile, theme) }
  ];

  // Inject search results DENTRO da pergunta do usuário
  let finalPrompt = promptText;
  if (searchContext) {
    // Extrai informações-chave dos resultados de busca para resposta direta
    const extractInfo = (): string | null => {
      const lines = searchContext.split('\n');
      const snippets: string[] = [];
      let currentTitle = '';
      for (const line of lines) {
        if (line.startsWith('[') && line.includes(']')) {
          const match = line.match(/^\[\d+\]\s*(.+)/);
          if (match) currentTitle = match[1].trim();
        }
        if (line.startsWith('   Resumo:')) {
          const snippet = line.replace('   Resumo:', '').trim();
          if (snippet) snippets.push(`📌 ${currentTitle}: ${snippet}`);
        }
      }
      return snippets.length > 0
        ? `🔍 **BUSCA WEB - DADOS EM TEMPO REAL**\n\n${snippets.join('\n')}`
        : null;
    };

    const extracted = extractInfo();
    finalPrompt =
      (extracted || searchContext) +
      `\n\n⚠️ ATENÇÃO: Estes são dados REAIS que obtive agora da internet. Use-os para responder. Não diga que não tem acesso — os dados estão aqui. Agora responda: ${promptText}`;
  }

  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.text || "" });
      } else if (msg.role === "assistant") {
        messages.push({ role: "assistant", content: msg.text || "" });
      }
    }
  }

  if (hasAudio) {
    messages.push({ role: "user", content: `[Mensagem de voz recebida] ${finalPrompt}` });
  } else {
    messages.push({ role: "user", content: finalPrompt });
  }

  return messages;
}

// ---------- Helper: build Gemini contents ----------
function buildGeminiContents(
  history: any[] | undefined,
  promptText: string,
  hasAudio: boolean,
  audioBase64?: string,
  audioMimeType?: string,
  searchContext?: string
): any[] {
  const contents: any[] = [];

  // Inject search context as a system-like message from model
  if (searchContext) {
    contents.push({
      role: "model",
      parts: [{ text: `[DADOS DE BUSCA WEB RECEBIDOS]:\n${searchContext}` }]
    });
  }

  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg.text) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }
    }
  }

  const currentParts: any[] = [];

  if (hasAudio && audioBase64) {
    const cleanBase64 = audioBase64.includes(";base64,")
      ? audioBase64.split(";base64,")[1]
      : audioBase64;
    currentParts.push({
      inlineData: {
        mimeType: audioMimeType || "audio/webm",
        data: cleanBase64
      }
    });
  }

  currentParts.push({ text: promptText });
  contents.push({ role: "user", parts: currentParts });
  return contents;
}

// ---------- Helper: format search results as punkbot response ----------
function formatSearchResponse(
  rawContext: string,
  snippets: string[],
  originalQuery: string,
  theme?: string
): string {
  const now = new Date();
  const hora = now.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const isDark = theme !== "light";

  const titulos: string[] = [];
  for (const line of rawContext.split('\n')) {
    const match = line.match(/^\[\d+\]\s*(.+)/);
    if (match) titulos.push(match[1].trim());
  }

  const botTag = isDark ? "MEGATRON ONLINE" : "OPTIMUS PRIME ONLINE";

  let resposta = `🌐 **${botTag} — DADOS EM TEMPO REAL** 🌐\n\n`;
  resposta += `Fechei os contatos e puxei os dados da rede às **${hora}**. Aqui está o que encontrei:\n\n`;

  for (let i = 0; i < snippets.length; i++) {
    const titulo = titulos[i] ? `**${titulos[i]}**` : `Fonte ${i + 1}`;
    resposta += `🔹 ${titulo}\n   ${snippets[i]}\n\n`;
  }

  if (titulos.length > 0) {
    resposta += `📡 **Fontes:**\n`;
    for (const line of rawContext.split('\n')) {
      const match = line.match(/^\s+Fonte:\s*(.+)/);
      if (match) resposta += `   • ${match[1].trim()}\n`;
    }
    resposta += `\n`;
  }

  resposta += isDark
    ? `⚡ Dados fresquinhos da rede, **humano**. Se precisar de mais, terá que provar que merece.`
    : `⚡ Dados coletados com sucesso, **guerreiro**. Se precisar de mais informações, é só pedir.`;

  return resposta;
}

// ---------- Provider calls ----------
const GROQ_API_URL = "https://api.groq.com/openai/v1";
const GROK_API_URL = "https://api.x.ai/v1";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1";

async function callGroq(messages: any[]): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY não configurada");

  const openai = new OpenAI({ apiKey: groqKey, baseURL: GROQ_API_URL });
  const completion = await openai.chat.completions.create({
    model: "mixtral-8x7b-32768",
    messages,
    temperature: 0.8,
  });
  return completion.choices?.[0]?.message?.content || "...";
}

async function callGrok(messages: any[], apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("GROK_API_KEY_MISSING");

  const openai = new OpenAI({ apiKey, baseURL: GROK_API_URL });
  const completion = await openai.chat.completions.create({
    model: "grok-2-1212",
    messages,
    temperature: 0.8,
  });
  return completion.choices?.[0]?.message?.content || "...";
}

async function callGemini(contents: any[], profile?: { name?: string | null; interests?: string[] | null }, theme?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY_MISSING");
  }

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: buildSystemInstruction(profile, theme),
      temperature: 0.8,
    }
  });
  return response.text || "Sem resposta do núcleo neural.";
}

async function callCerebras(messages: any[]): Promise<string> {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error("CEREBRAS_API_KEY_MISSING");

  const openai = new OpenAI({ apiKey: key, baseURL: CEREBRAS_API_URL });
  const completion = await openai.chat.completions.create({
    model: "gpt-oss-120b",
    messages,
    temperature: 0.8,
    max_tokens: 1024,
  });
  return completion.choices?.[0]?.message?.content || "...";
}

// ---------- Build fallback chain ----------
function buildProviderChain(
  primary: string | undefined,
  grokApiKey: string | undefined,
  openAIMessages: any[],
  geminiContents: any[],
  profile?: { name?: string | null; interests?: string[] | null },
  theme?: string
): Array<{ name: string; fn: () => Promise<string> }> {
  const chain: Array<{ name: string; fn: () => Promise<string> }> = [];

  const primaryName = primary || "gemini";

  addToChain(chain, primaryName, grokApiKey, openAIMessages, geminiContents, profile, theme);

  // Fallbacks (never add duplicate of primary)
  const fallbackOrder = ["cerebras", "groq", "grok", "gemini"].filter(p => p !== primaryName);
  for (const fb of fallbackOrder) {
    addToChain(chain, fb, grokApiKey, openAIMessages, geminiContents, profile, theme);
  }

  return chain;
}

function addToChain(
  chain: Array<{ name: string; fn: () => Promise<string> }>,
  provider: string,
  grokApiKey: string | undefined,
  openAIMessages: any[],
  geminiContents: any[],
  profile?: { name?: string | null; interests?: string[] | null },
  theme?: string
): boolean {
  if (provider === "groq" && process.env.GROQ_API_KEY) {
    chain.push({ name: "groq", fn: () => callGroq(openAIMessages) });
    return true;
  }
  if (provider === "grok" && grokApiKey) {
    chain.push({ name: "grok", fn: () => callGrok(openAIMessages, grokApiKey) });
    return true;
  }
  if (provider === "cerebras" && process.env.CEREBRAS_API_KEY) {
    chain.push({ name: "cerebras", fn: () => callCerebras(openAIMessages) });
    return true;
  }
  if (provider === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== "MY_GEMINI_API_KEY") {
      chain.push({ name: "gemini", fn: () => callGemini(geminiContents, profile, theme) });
      return true;
    }
  }
  return false;
}

// ============================================
// Supabase: Salvar mensagens no histórico
// ============================================
async function saveMessagesToSupabase(
  sessionId: string,
  deviceId: string,
  userMsg: { id: string; text: string; is_voice: boolean },
  assistantMsg: { id: string; text: string }
) {
  if (!supabase || !sessionId || !deviceId) return;

  try {
    // Garantir que a sessão existe
    await supabase.from("sessions").upsert({
      id: sessionId,
      device_id: deviceId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    // Inserir mensagem do usuário
    await supabase.from("messages").insert({
      id: userMsg.id,
      session_id: sessionId,
      role: "user",
      text: userMsg.text,
      timestamp: new Date().toISOString(),
      is_voice: userMsg.is_voice,
    });

    // Inserir resposta do assistente
    await supabase.from("messages").insert({
      id: assistantMsg.id,
      session_id: sessionId,
      role: "assistant",
      text: assistantMsg.text,
      timestamp: new Date().toISOString(),
      is_voice: false,
    });

    console.log(`💾 Histórico salvo no Supabase (sessão: ${sessionId})`);
  } catch (err) {
    console.warn("⚠️ Falha ao salvar no Supabase:", err);
  }
}

// ============================================
// API Routes
// ============================================
app.get("/api/debug", (req, res) => {
  const groqKey = process.env.GROQ_API_KEY;
  res.json({
    groqKey: groqKey ? `PRESENTE (${groqKey.substring(0, 10)}...)` : "AUSENTE",
    groqKeyPrefix: groqKey?.substring(0, 4),
    geminiKey: process.env.GEMINI_API_KEY ? "PRESENTE" : "AUSENTE",
    cerebrasKey: process.env.CEREBRAS_API_KEY ? "PRESENTE" : "AUSENTE",
  });
});

// ============================================
// Sessões: endpoints para histórico do chat
// ============================================

// Listar sessões + mensagens de um device
app.get("/api/sessions", async (req, res) => {
  const deviceId = req.headers["x-device-id"] as string;
  if (!deviceId) {
    return res.json([]);
  }

  try {
    const { data: sessions, error } = await supabase!
      .from("sessions")
      .select("*, messages(*)")
      .eq("device_id", deviceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("⚠️ Erro ao buscar sessões:", error);
      return res.status(500).json({ error: "Erro ao buscar sessões" });
    }

    res.json(sessions || []);
  } catch (err) {
    console.warn("⚠️ Erro ao buscar sessões:", err);
    res.status(500).json({ error: "Erro ao buscar sessões" });
  }
});

// Deletar uma sessão (com suas mensagens — ON DELETE CASCADE)
app.delete("/api/sessions/:id", async (req, res) => {
  const deviceId = req.headers["x-device-id"] as string;
  const sessionId = req.params.id;

  if (!deviceId || !sessionId) {
    return res.status(400).json({ error: "deviceId e sessionId são obrigatórios" });
  }

  try {
    // Verificar se a sessão pertence a este device
    const { data: session } = await supabase!
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("device_id", deviceId)
      .single();

    if (!session) {
      return res.status(404).json({ error: "Sessão não encontrada ou não pertence a este dispositivo" });
    }

    const { error } = await supabase!
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("device_id", deviceId);

    if (error) {
      console.warn("⚠️ Erro ao deletar sessão:", error);
      return res.status(500).json({ error: "Erro ao deletar sessão" });
    }

    res.json({ success: true });
  } catch (err) {
    console.warn("⚠️ Erro ao deletar sessão:", err);
    res.status(500).json({ error: "Erro ao deletar sessão" });
  }
});

// Atualizar sessão (título, etc.)
app.put("/api/sessions", async (req, res) => {
  const deviceId = req.headers["x-device-id"] as string;
  const { id, title, createdAt, messages } = req.body;

  if (!deviceId || !id) {
    return res.status(400).json({ error: "deviceId e id são obrigatórios" });
  }

  try {
    // Upsert da sessão
    const { error: sessionError } = await supabase!
      .from("sessions")
      .upsert({
        id,
        device_id: deviceId,
        title: title || "Nova Sessão",
        created_at: createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (sessionError) {
      console.warn("⚠️ Erro ao atualizar sessão:", sessionError);
      return res.status(500).json({ error: "Erro ao atualizar sessão" });
    }

    // Inserir mensagens se fornecidas
    if (messages && Array.isArray(messages)) {
      const { error: msgError } = await supabase!
        .from("messages")
        .upsert(
          messages.map((m: any) => ({
            id: m.id,
            session_id: id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
            is_voice: m.isVoice || false,
          })),
          { onConflict: "id" }
        );

      if (msgError) {
        console.warn("⚠️ Erro ao sincronizar mensagens:", msgError);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.warn("⚠️ Erro ao sincronizar sessão:", err);
    res.status(500).json({ error: "Erro ao sincronizar sessão" });
  }
});

// ============================================
// Perfil de Usuário (coleta passiva)
// ============================================

const INTEREST_TOPICS = [
  "programação", "javascript", "typescript", "react", "node", "python", "php", "rust", "go",
  "hacking", "segurança", "cybersegurança", "ctf",
  "ia", "inteligência artificial", "machine learning", "deep learning", "llm", "redes neurais",
  "blockchain", "criptomoedas", "bitcoin", "web3",
  "jogos", "games", "gamedev", "desenvolvimento de jogos",
  "música", "produção musical", "synthwave",
  "linux", "servidores", "devops", "docker", "cloud", "infraestrutura",
  "banco de dados", "sql", "nosql", "postgresql", "mongodb",
  "frontend", "backend", "fullstack", "mobile", "react native",
  "hardware", "eletrônica", "arduino", "iot", "robótica",
  "design", "ux", "ui", "figma",
  "matemática", "física", "ciência", "engenharia",
  "finanças", "investimentos", "economia", "trading",
  "escrita", "literatura", "filosofia",
  "anime", "mangá", "cultura japonesa",
  "cyberpunk", "ficção científica", "sci-fi",
  "política", "atualidades", "notícias",
  "carros", "motos", "automobilismo",
  "esportes", "futebol", "basquete", "corrida",
  "viagem", "natureza", "fotografia",
  "culinária", "cozinha", "gastronomia",
  "saúde", "fitness", "medicina",
];

function inferInterestsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return INTEREST_TOPICS.filter(topic => lower.includes(topic));
}

function inferNameFromText(text: string): string | null {
  const patterns = [
    /meu nome é\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /me chamo\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /sou (?:o|a)\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
    /eu sou\s+(?:o|a\s+)?([A-ZÀ-Ú][a-zà-ú]+)/i,
    /(?:pode|pode me)\s+chamar\s+de\s+([A-ZÀ-Ú][a-zà-ú]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function updateProfileFromChat(deviceId: string, userMessage: string) {
  if (!supabase || !deviceId || !userMessage) return;

  try {
    // Buscar perfil atual
    const { data: current } = await supabase!
      .from("profiles")
      .select("name, interests")
      .eq("device_id", deviceId)
      .single();

    const updates: Record<string, any> = { device_id: deviceId, updated_at: new Date().toISOString() };

    // Inferir nome se não tiver ainda
    if (!current?.name) {
      const name = inferNameFromText(userMessage);
      if (name) {
        updates.name = name;
        console.log(`👤 Nome inferido para ${deviceId}: ${name}`);
      }
    }

    // Inferir interesses
    const newInterests = inferInterestsFromText(userMessage);
    if (newInterests.length > 0) {
      const existing: string[] = (current?.interests as string[]) || [];
      const merged = [...new Set([...existing, ...newInterests])].slice(0, 10);
      updates.interests = merged;
      console.log(`📊 Interesses detectados: ${newInterests.join(", ")}`);
    }

    if (updates.name || updates.interests) {
      await supabase!
        .from("profiles")
        .upsert(updates, { onConflict: "device_id" });
    }
  } catch (err) {
    // Silencia erros de perfil — não deve interferir no chat
    console.warn("⚠️ Erro ao atualizar perfil:", err);
  }
}

async function loadProfile(deviceId: string): Promise<{ name?: string | null; interests?: string[] | null }> {
  if (!supabase || !deviceId) return {};
  try {
    const { data } = await supabase!
      .from("profiles")
      .select("name, interests")
      .eq("device_id", deviceId)
      .single();
    return data || {};
  } catch {
    return {};
  }
}

// GET /api/profile — retorna perfil do device
app.get("/api/profile", async (req, res) => {
  const deviceId = req.headers["x-device-id"] as string;
  if (!deviceId) return res.json({ name: null, location: null, interests: [] });

  try {
    const { data } = await supabase!
      .from("profiles")
      .select("*")
      .eq("device_id", deviceId)
      .single();
    res.json(data || { name: null, location: null, interests: [] });
  } catch {
    res.json({ name: null, location: null, interests: [] });
  }
});

// PUT /api/profile — atualização manual do perfil
app.put("/api/profile", async (req, res) => {
  const deviceId = req.headers["x-device-id"] as string;
  const { name, location } = req.body;

  if (!deviceId || !supabase) {
    return res.status(400).json({ error: "deviceId obrigatório" });
  }

  try {
    const updates: Record<string, any> = { device_id: deviceId, updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;

    const { error } = await supabase!
      .from("profiles")
      .upsert(updates, { onConflict: "device_id" });

    if (error) {
      console.warn("⚠️ Erro ao atualizar perfil:", error);
      return res.status(500).json({ error: "Erro ao atualizar perfil" });
    }

    res.json({ success: true });
  } catch (err) {
    console.warn("⚠️ Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

// POST /api/chat
app.post("/api/chat", async (req, res) => {
  const { message, audioBase64, audioMimeType, history, deviceId, provider, grokApiKey, sessionId, theme } = req.body;

  const hasAudio = !!audioBase64;
  const promptText = message || (hasAudio ? "Transcreva este áudio e responda a ele de forma cyberpunk." : "Olá!");

  // Carregar perfil do usuário (se existir)
  const profile = deviceId ? await loadProfile(deviceId) : {};

  // Web search: busca informações em tempo real se necessário
  const searchContext = await webSearch(promptText);

  const openAIMessages = buildOpenAIMessages(history, promptText, hasAudio, searchContext, profile, theme);
  const geminiContents = buildGeminiContents(history, promptText, hasAudio, audioBase64, audioMimeType, searchContext);
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");

  console.log(`📡 Nova requisição de device: ${deviceId || "desconhecido"} | provider primário: ${provider || "gemini"}`);

  const chain = buildProviderChain(provider, grokApiKey, openAIMessages, geminiContents, profile, theme);

  if (chain.length === 0) {
    console.log("⚠️ Nenhum provider configurado — usando modo mock");
    setTimeout(() => {
      return res.json({
        text: getMockResponse(promptText, hasAudio),
        success: true,
        isMock: true
      });
    }, 1000);
    return;
  }

  let lastError: any = null;

  for (const link of chain) {
    try {
      const text = await link.fn();
      console.log(`✅ Provider ${link.name} respondeu com sucesso`);

      // Salvar no Supabase (fire-and-forget)
      if (sessionId && deviceId) {
        const userMsgId = crypto.randomUUID?.() || `${Date.now()}-user`;
        const assistantMsgId = crypto.randomUUID?.() || `${Date.now()}-assistant`;
        saveMessagesToSupabase(sessionId, deviceId, {
          id: userMsgId,
          text: message || "[áudio]",
          is_voice: !!audioBase64,
        }, {
          id: assistantMsgId,
          text,
        });
      }

      // Perfil: inferência passiva (fire-and-forget, não bloqueia resposta)
      if (deviceId && message) {
        updateProfileFromChat(deviceId, message);
      }

      return res.json({ text, success: true, provider: link.name });
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Provider ${link.name} falhou: ${error.message}`);
    }
  }

  console.error("❌ Todos os providers falharam:", lastError?.message);

  if (hasGeminiKey) {
    return res.json({
      text: `⚡ **PUNKBOT EM CURTO-CIRCUITO!** ⚡\n\nMeus circuitos queimaram tentando processar sua última mensagem. Preciso de **1 MINUTO** de manutenção pra resetar os sistemas.\n\nTenta de novo daqui a pouco, **${theme !== "light" ? "humano" : "guerreiro"}** — enquanto isso, dá um tempo pro meu núcleo esfriar. 🔧`,
      success: false,
      provider: "curto-circuito",
      error: lastError?.message
    });
  }

  // Mock as last resort
  setTimeout(() => {
    return res.json({
      text: getMockResponse(promptText, hasAudio),
      success: true,
      isMock: true
    });
  }, 1000);
});

// Start server — API-only mode (frontend separado no Vercel)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Cibertron API Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 CORS origin: ${corsOrigin}`);
});
