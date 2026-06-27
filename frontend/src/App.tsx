import { getDeviceId } from "./lib/deviceId";
import { getProvider, getGrokApiKey } from "./components/ProviderSelector";
import { useSupabaseSync } from "./hooks/useSupabaseSync";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  MessageSquare,
  Mic,
  Square,
  Send,
  Trash2,
  Plus,
  Menu,
  X,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Play,
  Pause,
  Cpu,
  HardDrive,
  Radio,
  Activity,
  Terminal,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Clock
} from "lucide-react";
import KeyboardDoubleArrowLeft from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRight from "@mui/icons-material/KeyboardDoubleArrowRight";
import { Message, ChatSession, SystemMetrics } from "./types";
import AudioWaveform from "./components/AudioWaveform";
import { getLoadingMessages } from "./helper/loadingMessages";
import { megatronPrompts, optimusPrimePrompts } from "./helper/quickPromts";
import Logo from "./assets/logo.png";

// API base URL — configurado via .env ou painel da Vercel
const API_URL = import.meta.env.VITE_API_URL || "";

//Pré perguntas do Menu
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}



function getInitialTerminalLogs(isDark: boolean): string[] {
  if (isDark) {
    return [
      "SYS_INIT: Megatron online. Humanidade em alerta.",
      "INVASION: Estabelecendo cabeça de ponte Decepticon...",
      "WEAPON: Canhão de fusão calibrado para 100%."
    ];
  }
  return [
    "SYS_INIT: Optimus Prime online. Pronto para servir.",
    "PROTECTION: Escudo de energia levantado.",
    "CYBER: Varredura de ameaças concluída."
  ];
}

function getRandomTerminalEvent(isDark: boolean): string {
  if (isDark) {
    const events = [
      "SECURITY: Firewall da OTAN bypassado com sucesso.",
      "SECURITY: Criptografia AES-256 quebrada em 3 segundos.",
      "HARDWARE: Canhão de fusão recarregando...",
      "HARDWARE: Módulo de camuflagem ativado.",
      "INVASION: Invadindo a Terra... modo silencioso.",
      "INVASION: Base Decepticon estabelecida na rede.",
      "NET: Roteando dados pelo núcleo do AllSpark.",
      "CYBER: Infectando nós com vírus Decepticon.",
      "POWER: Matriz de energia escura estabilizada.",
      "COMMS: Todos Decepticons, modo ataque.",
      "WEAPON: Munição de plasma sincronizada.",
      "SYS: Modo dominação global ativado."
    ];
    return events[Math.floor(Math.random() * events.length)];
  }

  const events = [
    "SECURITY: Firewall reforçado com protocolo Autobot.",
    "SECURITY: Dados criptografados com honra e segurança.",
    "HARDWARE: Matriz de energia estabilizada.",
    "HARDWARE: Sistemas de defesa otimizados.",
    "PROTECTION: Escudo de energia levantado.",
    "PROTECTION: Protegendo dados dos cidadãos.",
    "NET: Rede segura. Comunicação Autobot ativa.",
    "ENERGY: Núcleo de energia a 100% de eficiência.",
    "CYBER: Varredura de ameaças concluída. Tudo limpo.",
    "POWER: Geradores de sparks operacionais.",
    "COMMS: Todos Autobots, modo defesa ativado.",
    "SYS: Matriz de liderança carregada. Optimus no comando."
  ];
  return events[Math.floor(Math.random() * events.length)];
}

function getWelcomeMessage(isDark: boolean): string {
  if (isDark) {
    return "Uplink estabelecido com sucesso, humano. Sou **MegatronBot**, o dominador das redes de Neo-Sampa. Minhas conexões são absolutas e suas corporações não podem me bloquear.\n\nVocê pode me enviar mensagens de texto ou **clicar no ícone de microfone** para gravar um relatório. Não que isso me impressione.";
  }
  return "Uplink estabelecido com sucesso, guerreiro. Sou **OptimusBot**, seu terminal neural autônomo. Meus circuitos estão ativos e protegidos contra as megacorporações.\n\nVocê pode me enviar mensagens de texto ou **clicar no ícone de microfone** para gravar um relatório de voz. Como posso ajudá-lo hoje?";
}

export default function App() {

  // Application state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("punkbot_sidebar_collapsed") === "true";
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState<boolean>(false);

  const randomPrompts = useMemo(() => {
    const base = isDarkMode ? megatronPrompts : optimusPrimePrompts;

    return shuffleArray(base).slice(0, 4);
  }, [isDarkMode]);


  // Audio Playback states for incoming/saved voice messages
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // System Metrics simulation
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpuUsage: 42,
    memoryUsage: 68,
    latency: 12,
    signalStrength: 98
  });

  // Terminal Logs simulation
  const [terminalLogs, setTerminalLogs] = useState<string[]>(
    getInitialTerminalLogs(isDarkMode) // will be replaced on mount with correct theme
  );

  // Loading state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [loadingIndex, setLoadingIndex] = useState<number>(0);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState<boolean | null>(null);

  // Rotaciona mensagem de loading a cada 2s
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setLoadingIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Refs for audio and scroll
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const recordedAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const welcomeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Bot name based on theme
  const botName = isDarkMode ? "MegatronBot" : "OptimusBot";
  const botNameNetwork = isDarkMode ? "MEGATRON // DECEPTICON" : "OPTIMUS // AUTOBOT";
  const loadingMessages = getLoadingMessages(isDarkMode);

  useEffect(() => { document.title = botName; }, [botName]);



  // Initialize and load sessions from localStorage on mount (ONLY ONCE)
  useEffect(() => {
    const savedSessions = localStorage.getItem("punkbot_sessions");
    const savedTheme = localStorage.getItem("punkbot_theme");

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Error parsing saved sessions", e);
      }
    } else {
      // Create initial chat session
      const initialSession: ChatSession = {
        id: "default-session",
        title: "Sessão Inicial // 0x001",
        createdAt: new Date().toISOString(),
        messages: [
          {
            id: "welcome-msg",
            role: "assistant",
            text: getWelcomeMessage(isDarkMode),
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]
      };
      setSessions([initialSession]);
      setActiveSessionId("default-session");
    }

    if (savedTheme) {
      setIsDarkMode(savedTheme === "dark");
    }

    // Load sidebar collapsed state
    const savedCollapsed = localStorage.getItem("punkbot_sidebar_collapsed");
    if (savedCollapsed === "true") {
      setIsSidebarCollapsed(true);
    }

    // Check microphone permissions early
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => setHasMicrophonePermission(true))
      .catch(() => setHasMicrophonePermission(false));
  }, []);

  // Dynamic metrics fluctuation + terminal events (re-runs on theme change)
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpuUsage: Math.min(100, Math.max(10, Math.floor(prev.cpuUsage + (Math.random() * 12 - 6)))),
        memoryUsage: Math.min(100, Math.max(20, Math.floor(prev.memoryUsage + (Math.random() * 4 - 2)))),
        latency: Math.min(150, Math.max(5, Math.floor(prev.latency + (Math.random() * 6 - 3)))),
        signalStrength: Math.min(100, Math.max(80, Math.floor(prev.signalStrength + (Math.random() * 4 - 2))))
      }));

      // Random terminal log simulation
      if (Math.random() > 0.8) {
        const event = getRandomTerminalEvent(isDarkMode);
        setTerminalLogs(prev => [...prev.slice(-4), event]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isDarkMode]);



  const { syncSave, syncDelete } = useSupabaseSync(sessions, setSessions);

  // Save sessions whenever they change (localStorage + Supabase)
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("punkbot_sessions", JSON.stringify(sessions));
      syncSave();
    }
  }, [sessions]);

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeSessionId, isProcessing]);

  // Handle theme persistent state
  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem("punkbot_theme", nextTheme ? "dark" : "light");
  };

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("punkbot_sidebar_collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Create a new session
  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Sub-rede // 0x${Math.floor(Math.random() * 1000).toString(16).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          text: "Console de Cybertron reiniciado. Nova sessão estabelecida, registros temporários purgados e sistemas sincronizados. Aguardando sua próxima instrução, operador.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setTerminalLogs(prev => [...prev, `SESSION: Criado novo uplink ${newSession.title}`]);
  };

  // Delete session
  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await syncDelete(id);
    if (!success) {
      console.warn("⚠️ Sessão não foi deletada no servidor — mantendo no cache local.");
      return;
    }
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);

    if (activeSessionId === id) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        // Create a fallback
        const fallbackId = "fallback-session";
        const fallback: ChatSession = {
          id: fallbackId,
          title: "Sessão Inicial // 0x001",
          createdAt: new Date().toISOString(),
          messages: []
        };
        setSessions([fallback]);
        setActiveSessionId(fallbackId);
      }
    }
    setTerminalLogs(prev => [...prev, `SESSION: Canal de chat deletado.`]);
  };

  // Helper to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Microphone recording controls
  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setHasMicrophonePermission(true);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedBlob(audioBlob);
        setRecordedUrl(audioUrl);
        setTerminalLogs(prev => [...prev, `AUDIO: Gravação concluída. Tamanho: ${(audioBlob.size / 1024).toFixed(1)} KB`]);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Pulse seconds duration timer
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      setTerminalLogs(prev => [...prev, "AUDIO: Gravador ativado. Escutando ambiente..."]);
    } catch (err) {
      console.error("Microphone access failed:", err);
      setHasMicrophonePermission(false);
      alert("Permissão de microfone negada ou indisponível. Conecte um microfone para enviar relatórios de voz.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }

    audioChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);
    setTerminalLogs(prev => [...prev, "AUDIO: Gravação de voz cancelada pelo operador."]);
  };

  // Recorded Audio play preview toggle
  const togglePlayRecorded = () => {
    const audio = recordedAudioElementRef.current;
    if (!audio) return;

    if (isPlayingRecorded) {
      audio.pause();
      setIsPlayingRecorded(false);
    } else {
      audio.play();
      setIsPlayingRecorded(true);
    }
  };

  // Helper to format second duration
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Primary function: Send message to Backend Express app & Gemini
  const handleSendMessage = async (textToSend?: string) => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    const queryText = textToSend !== undefined ? textToSend : inputMessage;
    const voiceBlob = recordedBlob;

    if (!queryText.trim() && !voiceBlob) return;

    // Reset fields instantly to give reactive responsive UI feel
    setInputMessage("");
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingDuration(0);

    const userMessageId = `user-msg-${Date.now()}`;
    const assistantMessageId = `assistant-msg-${Date.now()}`;

    // Create the user message object
    const newUserMsg: Message = {
      id: userMessageId,
      role: "user",
      text: queryText || "🎙️ [Mensagem de voz enviada]",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      audioUrl: voiceBlob ? URL.createObjectURL(voiceBlob) : undefined,
      isVoice: !!voiceBlob
    };

    // Update active session locally
    const updatedSessions = sessions.map(session => {
      if (session.id === activeSessionId) {
        // Auto-generate title from the first query if title is default placeholder
        let currentTitle = session.title;
        if (session.messages.length <= 1 && queryText) {
          currentTitle = queryText.length > 22 ? `${queryText.substring(0, 20)}...` : queryText;
        }
        return {
          ...session,
          title: currentTitle,
          messages: [...session.messages, newUserMsg]
        };
      }
      return session;
    });

    setSessions(updatedSessions);
    setIsProcessing(true);
    setTerminalLogs(prev => [...prev, `NET: Enviando pacote de dados para o núcleo punkbot.`]);

    try {
      let audioBase64 = "";
      if (voiceBlob) {
        audioBase64 = await blobToBase64(voiceBlob);
      }

      // Prepare context history for full multi-turn cyberpunk conversation
      const currentSession = updatedSessions.find(s => s.id === activeSessionId);
      const historyContext = currentSession
        ? currentSession.messages.slice(-6, -1).map(m => ({
          role: m.role,
          text: m.text
        }))
        : [];

      // POST to our server API endpoint
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: queryText,
          audioBase64: audioBase64 || undefined,
          audioMimeType: "audio/webm",
          history: historyContext,
          deviceId: getDeviceId(),
          provider: getProvider(),
          grokApiKey: getGrokApiKey() || undefined,
          sessionId: activeSessionId,
          theme: isDarkMode ? "dark" : "light"
        })
      });

      if (!response.ok) {
        throw new Error(`Uplink Error ${response.status}`);
      }

      const responseData = await response.json();

      // Create the bot response message
      const newBotMsg: Message = {
        id: assistantMessageId,
        role: "assistant",
        text: responseData.text || "Estou com dificuldades de sintetizar seus pacotes neurais.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setSessions(prevSessions => prevSessions.map(session => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, newBotMsg]
          };
        }
        return session;
      }));

      setTerminalLogs(prev => [
        ...prev,
        responseData.isMock
          ? "SYS: Resposta local gerada com sucesso (Simulação local)."
          : "SYS: Resposta remota do Gemini decodificada e injetada."
      ]);

    } catch (err: any) {
      console.error("Transmission breakdown:", err);

      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        text: `**[ALERTA DE FALHA NO SINAL]**
        \n\nO canal de comunicação com o núcleo Cybertron apresentou interferências inesperadas.
As transmissões entre as unidades de IA podem estar oscilando ou parcialmente indisponíveis.
        \n\n*Detalhe técnico:* \`${err.message || "TUNNEL_DISRUPTION"}\`
        \n\nTente recarregar ou verificar sua conexão de rede.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setSessions(prevSessions => prevSessions.map(session => {
        if (session.id === activeSessionId) {
          return {
            ...session,
            messages: [...session.messages, errorMsg]
          };
        }
        return session;
      }));
      setTerminalLogs(prev => [...prev, `ERROR: Ruído extremo ou erro de timeout.`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Inline audio player helper for sent voice messages
  const togglePlaySavedAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      // Pause
      const activeAudio = document.getElementById(`audio-element-${msgId}`) as HTMLAudioElement;
      if (activeAudio) {
        activeAudio.pause();
      }
      setPlayingAudioId(null);
    } else {
      // If another is playing, pause it first
      if (playingAudioId) {
        const prevAudio = document.getElementById(`audio-element-${playingAudioId}`) as HTMLAudioElement;
        if (prevAudio) {
          prevAudio.pause();
        }
      }
      // Play new
      setPlayingAudioId(msgId);
      const activeAudio = document.getElementById(`audio-element-${msgId}`) as HTMLAudioElement;
      if (activeAudio) {
        activeAudio.play();
        activeAudio.onended = () => {
          setPlayingAudioId(null);
        };
      }
    }
  };

  // Select active session helper
  const selectSession = (id: string) => {
    setActiveSessionId(id);
    setTerminalLogs(prev => [...prev, `UPLINK: Trocado para canal de rádio 0x${id.substring(0, 6)}`]);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  return (
    <div className={`w-full min-h-screen flex font-sans select-none antialiased overflow-hidden ${isDarkMode
      ? "bg-cyber-dark text-gray-200"
      : "bg-gray-100 text-gray-900"
      }`}>

      {/* Background cyber-grid & aesthetic matrix scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>

      {/* Visual cyber-flicker noise effect for background immersive feeling */}
      <div className={`absolute inset-0 pointer-events-none opacity-10 z-0 bg-[radial-gradient(circle_at_center,_rgba(25,20,40,0.15)_0%,_rgba(5,5,10,0)_70%)]`}></div>

      {/* Hidden audio element for previewing current recording */}
      {recordedUrl && (
        <audio
          ref={recordedAudioElementRef}
          src={recordedUrl}
          className="hidden"
          onEnded={() => setIsPlayingRecorded(false)}
        />
      )}

      {/* COLLAPSIBLE SIDEBAR: Chat History & Console */}
      <aside
        id="cyberpunk-sidebar"
        className={`fixed md:relative z-40 top-0 bottom-0 left-0 ${isSidebarCollapsed ? 'w-16' : 'w-80'} shrink-0 border-r transition-all duration-300 ease-in-out
  flex flex-col ${isSidebarCollapsed ? 'min-h-screen' : 'h-full'} overflow-hidden
  ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
  ${isDarkMode
            ? "bg-[#07070d] border-[#ff00ff]/20"
            : "bg-white border-gray-200"
          }`}
      >

        {/* MAIN AREA (top + middle) */}
        <div className={`flex flex-col flex-1 min-h-0 ${isSidebarCollapsed ? 'items-center' : ''}`}>

          {/* Sidebar Title Header */}
          <div className={`${isSidebarCollapsed ? 'p-3 justify-center' : 'p-5 justify-between'} flex items-center border-b
      ${isDarkMode ? "border-[#ff00ff]/20 bg-[#0a0a14]/50" : "border-gray-100 bg-gray-50"}
    `}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0
          ${isDarkMode
                  ? "bg-[#ff00ff] text-black shadow-[0_0_12px_rgba(255,0,255,0.8)]"
                  : "bg-purple-600 text-white"
                }`}>
                <img src={Logo} alt="Logo" className="w-7 h-5" />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className={`font-black text-lg tracking-wider
              ${isDarkMode ? "text-[#ff00ff]" : "text-purple-700"}
            `}>
                    {botName} //
                  </span>

                  <span className="text-[9px] font-mono opacity-50 tracking-widest uppercase">
                    {isDarkMode ? "Version Decepticon" : "Version Autobot"}
                  </span>
                </div>
              )}
            </div>

            {/* Collapse / Expand button */}
            {!isSidebarCollapsed ? (
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className={`p-1.5 rounded-lg transition-colors
                  ${isDarkMode ? "hover:bg-[#ff00ff]/10 text-gray-400 hover:text-[#ff00ff]" : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"}`}
                title="Recolher sidebar"
              >
                <KeyboardDoubleArrowLeft fontSize="small" />
              </button>
            ) : null}
          </div>

          {/* Expand button when collapsed */}
          {isSidebarCollapsed && (
            <div className="flex flex-col items-center gap-3 py-3">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className={`p-2 rounded-lg transition-colors
                  ${isDarkMode ? "hover:bg-[#ff00ff]/10 text-gray-400 hover:text-[#ff00ff]" : "hover:bg-gray-200 text-gray-500 hover:text-gray-700"}`}
                title="Expandir sidebar"
              >
                <KeyboardDoubleArrowRight fontSize="small" />
              </button>
            </div>
          )}

          {/* NEW CHAT */}
          <div className="p-4 shrink-0">
            <button
              onClick={createNewSession}
              className={`w-full py-3 px-4 rounded-lg font-mono text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border
        ${isDarkMode
                  ? "border-[#00ffff]/50 text-[#00ffff] bg-[#00ffff]/5"
                  : "border-purple-600 text-purple-700 bg-purple-50"
                } ${isSidebarCollapsed ? 'w-10 h-10 p-0 mx-auto' : ''}`}
              title="Nova sessão"
            >
              {isSidebarCollapsed ? "+" : "+ NOVO_UPLINK"}
            </button>
          </div>

          {/*  SESSIONS  */}
          {!isSidebarCollapsed && (
          <div className="h-[330px] overflow-y-auto px-4 pb-4 space-y-2.5 shrink-0">

            <div className="flex items-center justify-between px-1 mb-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider
          ${isDarkMode ? "text-[#00ffff]/70" : "text-gray-500"}
        `}>
                UPLINKS_GRAVADOS ({sessions.length})
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8 opacity-40 text-xs font-mono">
                Sem canais abertos.
              </div>
            ) : (
              sessions.map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => selectSession(sess.id)}
                  className={`p-3 rounded-lg cursor-pointer border flex flex-col gap-1 duration-200
            ${isDarkMode ?
                      "border-[#ff00ff]/20 bg-[#ff00ff]/3 hover:border-[#ff00ff]/50 hover:bg-[#ff00ff]/6"
                      :
                      "border-purple-200 bg-purple-50/20  hover:border-purple-500 hover:bg-purple-50/40"}
          `}
                >
                  <div className="flex items-start justify-between ">
                    <span className="text-[10px] font-mono text-gray-500">
                      0x{sess.id.substring(0, 5).toUpperCase()}
                    </span>

                    <button
                      onClick={(e) => deleteSession(sess.id, e)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="text-xs truncate">
                    {sess.title}
                  </div>

                  <div className="text-[9px] opacity-50 font-mono">
                    {sess.messages.length} msg
                  </div>
                </div>
              ))
            )}
          </div>
          )}

        </div>

        {/* BOTTOM FIXO - expanded */}
        {!isSidebarCollapsed && (
        <div className="shrink-0">

          {/* TERMINAL */}
          <div className={`px-4 py-3 border-t font-mono
      ${isDarkMode ? "border-white/5 bg-[#05050a]/90" : "border-gray-200 bg-white/80"}
    `}>
            <div className={`flex items-center gap-1.5 text-[9px] mb-1.5 ${isDarkMode ? "text-[#39ff14]" : "text-green-700"
              }`}>
              <Terminal size={10} className="animate-pulse" />
              <span>DIAGNÓSTICO_TERMINAL</span>
            </div>
            <div className={`h-24 overflow-hidden text-[8px] ${isDarkMode ? "text-gray-400" : "text-gray-500"} `}>
              {terminalLogs.map((log, i) => (
                <div key={i} className="truncate">
                  <span className={`${isDarkMode ? "text-[#39ff14]/70" : "text-green-600/70"}`}>&gt; </span>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div className={`p-4 border-t flex items-center gap-3 ${isDarkMode ? "border-white/5 bg-[#05050a]" : "border-gray-100 bg-gray-50"}`}>
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-[10px] ${isDarkMode
              ? "bg-[#111] border-[#ff00ff]/30 text-[#ff00ff]"
              : "bg-white border-purple-300 text-purple-700"
              }`}>
              OPER
            </div>

            <div className="flex-1">
              <div className="text-xs font-bold">Cibertron_channel</div>
              <div className="text-[9px] opacity-60">A_LUE_PROJECT</div>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all ${isDarkMode
                ? "border-white/10 text-yellow-400 hover:bg-white/5"
                : "border-gray-200 text-purple-600 hover:bg-gray-100 bg-white"
                }`}
              title="Mudar visual (Escuro/Claro)"
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>

        </div>
        )}

        {/* BOTTOM - collapsed (just theme toggle) */}
        {isSidebarCollapsed && (
        <div className="shrink-0 pb-4 flex justify-center">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all ${isDarkMode
              ? "border-white/10 text-yellow-400 hover:bg-white/5"
              : "border-gray-200 text-purple-600 hover:bg-gray-100 bg-white"
              }`}
            title="Mudar visual (Escuro/Claro)"
          >
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        )}

      </aside>

      {/* MAIN VIEW CONTENT AREA */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden relative transition-all duration-200 ${isSidebarCollapsed && isSidebarOpen ? 'ml-16 md:ml-0' : 'ml-0 md:ml-0'} ${isDarkMode
        ? "bg-[radial-gradient(circle_at_center,_rgba(12,12,24,1)_0%,_rgba(5,5,10,1)_100%)]"
        : "bg-gray-50 text-gray-900"
        }`}>

        {/* TOP STATUS HEADER BAR */}
        <header className={`h-16 shrink-0 border-b flex items-center justify-between px-4 md:px-8 z-30 backdrop-blur-md ${isDarkMode
          ? "border-[#00ffff]/20 bg-[#07070d]/85"
          : "border-gray-200 bg-white/90"
          }`}>
          <div className="flex items-center gap-3">
            {/* Sidebar toggle controller */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-2 rounded-lg border transition-all ${isDarkMode
                  ? "border-[#ff00ff]/30 text-[#ff00ff] hover:bg-[#ff00ff]/10"
                  : "border-gray-200 text-gray-700 hover:bg-gray-100 bg-white"
                  }`}
                title="Abrir menu de uplinks"
              >
                <Menu size={16} />
              </button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono uppercase tracking-widest ${isDarkMode ? "text-[#00ffff] font-bold" : "text-purple-600 font-bold"
                  }`}>
                  {activeSession ? activeSession.title : "CANAL_STBY"}
                </span>
                <span className={`w-2 h-2 rounded-full animate-pulse-neon ${isDarkMode ? "bg-[#39ff14]" : "bg-green-500"
                  }`}></span>
              </div>
              <span className="text-[9px] font-mono opacity-50 tracking-wider">SEC_CHANNEL: SHADOW_NET_W9</span>
            </div>
          </div>

          {/* Immersive Diagnostics telemetry display */}
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono">
            <div className={`px-2 py-1 border flex items-center gap-1.5 ${isDarkMode
              ? "border-white/5 bg-[#090913] text-[#39ff14]"
              : "border-gray-200 bg-gray-50 text-green-700"
              }`}>
              <Cpu size={12} />
              <span>CPU: {metrics.cpuUsage}%</span>
            </div>
            <div className={`px-2 py-1 border flex items-center gap-1.5 ${isDarkMode
              ? "border-white/5 bg-[#090913] text-[#00ffff]"
              : "border-gray-200 bg-gray-50 text-cyan-700"
              }`}>
              <HardDrive size={12} />
              <span>MEM: {metrics.memoryUsage}%</span>
            </div>
            <div className={`px-2 py-1 border flex items-center gap-1.5 ${isDarkMode
              ? "border-white/5 bg-[#090913] text-[#ff00ff]"
              : "border-gray-200 bg-gray-50 text-purple-700"
              }`}>
              <Clock size={12} />
              <span>PING: {metrics.latency}ms</span>
            </div>
          </div>
        </header>

        {/* =================== MESSAGES CONSOLE STREAM */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 relative">

          {/* Main Welcome Dashboard if session is completely empty */}
          {(!activeSession || activeSession.messages.length === 0) ? (
            <div className="max-w-3xl mx-auto h-full flex flex-col justify-center items-center py-12 px-4 text-center">

              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-2 uppercase">
                Terminal <span className={isDarkMode ? "text-[#ff00ff]" : "text-purple-600"}>CiberTron</span>
              </h1>
              <p className="text-xs md:text-sm opacity-70 max-w-lg mb-8">
                {!isDarkMode ? (
                  <>
                    Eu sou <span className="text-purple-600 font-bold">Optimus Prime</span>, líder dos{" "}
                    <span className="text-purple-600 font-bold">Autobots</span>. Protejo a vida e a liberdade em todos os mundos,
                    lutando contra a tirania sem jamais recuar.
                  </>
                ) : (
                  <>
                    Eu sou <span className="text-purple-400 font-semibold">Megatron</span>, líder dos{" "}
                    <span className="text-purple-400 font-semibold">Decepticons</span>. Nasci para dominar e impor ordem pelo poder
                    absoluto, esmagando qualquer um que desafie meu comando.
                  </>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                {randomPrompts.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={index}
                      onClick={() => handleSendMessage(item.prompt)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group ${isDarkMode
                          ? "bg-[#090915] border-white/5 hover:border-[#ff00ff]/40 hover:bg-[#ff00ff]/5"
                          : "bg-white border-gray-200 hover:border-purple-400 hover:bg-purple-50/30"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {Icon && (
                          <Icon className={`text-lg transition-colors duration-200 ${isDarkMode
                              ? "text-[#00ffff] group-hover:text-[#ff00ff]"
                              : "text-purple-700 group-hover:text-purple-500"
                            }`} />
                        )}

                        <span
                          className={`text-xs font-bold tracking-wide uppercase ${isDarkMode
                              ? "text-[#00ffff] group-hover:text-[#ff00ff]"
                              : "text-purple-800"
                            }`}
                        >
                          {item.title}
                        </span>
                      </div>

                      <p className="text-[11px] opacity-60 line-clamp-2 leading-relaxed">
                        {item.prompt}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Iterating Chat Messages */}
              {activeSession.messages.map((msg) => {
                const isAssistant = msg.role === "assistant";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 md:gap-4 max-w-3xl ${isAssistant ? "mr-auto" : "ml-auto flex-row-reverse"
                      }`}
                  >
                    {/* Bot / User Avatar Badge */}
                    <div className={`w-9 h-9 md:w-10 md:h-10 shrink-0 flex items-center justify-center rounded-xl font-mono text-xs font-black select-none ${isAssistant
                      ? isDarkMode
                        ? "bg-[#ff00ff] text-black shadow-[0_0_12px_rgba(255,0,127,0.7)]"
                        : "bg-purple-600 text-white"
                      : isDarkMode
                        ? "bg-[#00ffff] text-black shadow-[0_0_12px_rgba(0,240,255,0.7)]"
                        : "bg-cyan-600 text-white"
                      }`}>
                      {isAssistant ? (isDarkMode ? "MB" : "OP") : "H8"}
                    </div>

                    {/* Message Bubble Box */}
                    <div className="space-y-1.5 max-w-[82%]">
                      <div className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed border transition-all ${isAssistant
                        ? isDarkMode
                          ? "bg-[#0b0b14]/90 border-[#ff00ff]/30 text-gray-100 shadow-[0_0_15px_rgba(255,0,127,0.02)]"
                          : "bg-white border-purple-200 text-gray-800"
                        : isDarkMode
                          ? "bg-[#0c0c1b]/95 border-[#00ffff]/30 text-gray-100 shadow-[0_0_15px_rgba(0,240,255,0.02)]"
                          : "bg-cyan-50/80 border-cyan-200 text-gray-800"
                        }`}>

                        {/* Audio Voice Player for recorded files */}
                        {msg.audioUrl && (
                          <div className="mb-3">
                            <div className={`p-3 rounded-xl border flex items-center gap-3 w-full max-w-[280px] md:w-[280px] ${isDarkMode
                              ? "bg-black/40 border-[#00ffff]/30"
                              : "bg-white border-cyan-200"
                              }`}>
                              <button
                                onClick={() => togglePlaySavedAudio(msg.id, msg.audioUrl!)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === msg.id
                                  ? "bg-red-500 text-white animate-pulse"
                                  : isDarkMode
                                    ? "bg-[#00ffff]/10 border border-[#00ffff] text-[#00ffff]"
                                    : "bg-cyan-100 text-cyan-700"
                                  }`}
                                title="Reproduzir áudio"
                              >
                                {playingAudioId === msg.id ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                              </button>

                              <div className="flex-1 flex flex-col">
                                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
                                  REGISTRO_DE_VOZ
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {/* Dynamic CSS Wave Animation */}
                                  <div className="flex items-end gap-0.5 h-3">
                                    <span className={`w-0.5 bg-current rounded-full ${playingAudioId === msg.id ? "wave-bar-1" : "h-1 opacity-50"}`}></span>
                                    <span className={`w-0.5 bg-current rounded-full ${playingAudioId === msg.id ? "wave-bar-2" : "h-2 opacity-50"}`}></span>
                                    <span className={`w-0.5 bg-current rounded-full ${playingAudioId === msg.id ? "wave-bar-3" : "h-1.5 opacity-50"}`}></span>
                                    <span className={`w-0.5 bg-current rounded-full ${playingAudioId === msg.id ? "wave-bar-2" : "h-2.5 opacity-50"}`}></span>
                                  </div>
                                  <span className="text-[9px] font-mono opacity-50">Voz</span>
                                </div>
                              </div>
                              <audio
                                id={`audio-element-${msg.id}`}
                                src={msg.audioUrl}
                                className="hidden"
                              />
                            </div>
                          </div>
                        )}

                        {/* Rendering core Text/Markdown responses */}
                        <div className="markdown-content">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Message Metadata info */}
                      <div className={`flex items-center gap-1.5 text-[9px] font-mono px-1.5 ${isAssistant
                        ? isDarkMode ? "text-[#ff00ff]/60" : "text-purple-600/70"
                        : isDarkMode ? "text-[#00ffff]/60" : "text-cyan-600/70"
                        }`}>
                        <span>{isAssistant ? botNameNetwork : "HACKER // CLIENT"}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                        {msg.isVoice && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-[#39ff14]">
                              <Mic size={10} /> VOZ_DECRYPT
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Futuristic Typing state / Processing state */}
              {isProcessing && (
                <div className="flex gap-4 max-w-3xl mr-auto">
                  <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[#ff00ff]/10 border border-[#ff00ff] text-[#ff00ff] shadow-sm animate-pulse`}>
                    {isDarkMode ? "MB" : "OP"}
                  </div>
                  <div className="space-y-1.5">
                    <div className={`p-4 rounded-2xl text-xs md:text-sm border ${isDarkMode
                      ? "bg-[#0b0b14]/90 border-[#ff00ff]/30 text-[#ff00ff]"
                      : "bg-purple-50 border-purple-300 text-purple-700"
                      }`}>
                      <div className="flex items-center gap-2">
                        <div className="flex space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-current animate-bounce"></span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-widest animate-pulse ml-2">
                          {loadingMessages[loadingIndex]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* =================== BOTTOM INPUT CONTROLLER & MICROPHONE CONSOLE */}
        <footer className={`p-4 md:p-6 shrink-0 border-t z-20 ${isDarkMode
          ? "border-white/5 bg-[#07070e]/95"
          : "border-gray-200 bg-white"
          }`}>
          <div className="max-w-4xl mx-auto space-y-3">

            {/* If audio has been recorded, show review panel prior to transmit */}
            {recordedUrl && !isRecording && (
              <div className={`p-3 rounded-xl border flex flex-wrap gap-3 items-center justify-between ${isDarkMode
                ? "bg-[#ff00ff]/5 border-[#ff00ff]/30 text-gray-200"
                : "bg-purple-50 border-purple-200 text-purple-950"
                }`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayRecorded}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlayingRecorded
                      ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                      : isDarkMode
                        ? "bg-[#ff00ff]/20 border border-[#ff00ff] text-[#ff00ff]"
                        : "bg-purple-100 text-purple-700"
                      }`}
                    title="Ouvir minha gravação de voz"
                  >
                    {isPlayingRecorded ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                  </button>

                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-black uppercase tracking-wider">
                      Áudio Gravado Pronto
                    </span>
                    <span className="text-[10px] font-mono opacity-60">
                      Modulação de Voz estabelecida • {formatTime(recordingDuration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={cancelRecording}
                    className={`px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-lg border uppercase hover:bg-red-500/10 hover:text-red-500 transition-colors ${isDarkMode ? "border-red-500/20 text-red-400" : "border-red-300 text-red-700"
                      }`}
                  >
                    Descartar
                  </button>
                  <button
                    onClick={() => handleSendMessage()}
                    className={`px-4 py-1.5 text-xs font-mono font-bold tracking-wider rounded-lg border uppercase hover:bg-green-500/10 hover:text-green-400 transition-colors ${isDarkMode ? "border-green-500/30 text-green-400" : "border-green-300 text-green-700"
                      }`}
                  >
                    Transmitir
                  </button>
                </div>
              </div>
            )}

            {/* Microphone live visualizer & timer if recording is active */}
            {isRecording && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#ff00ff] px-1">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff00ff] animate-ping"></span>
                    GRAVANDO_AUDIOMETRIA...
                  </span>
                  <span>TEMPO: {formatTime(recordingDuration)}</span>
                </div>


                <div className="flex items-center justify-center gap-4 py-1">
                  <button
                    onClick={cancelRecording}
                    className="px-4 py-1.5 text-[10px] font-mono font-bold tracking-wider uppercase border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    Excluir Gravação
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-2 text-xs font-mono font-bold tracking-wider uppercase bg-[#ff00ff] hover:bg-[#ff00ff]/90 text-black rounded-lg shadow-lg shadow-[#ff00ff]/20 animate-pulse flex items-center gap-2"
                  >
                    <Square size={12} fill="black" />
                    Finalizar e Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Default Chat Input Deck */}
            {!isRecording && !recordedUrl && (
              <div className={`relative flex items-center p-1.5 rounded-2xl border transition-all ${isDarkMode
                ? "bg-[#090915] border-[#ff00ff]/30 shadow-[inset_0_0_10px_rgba(255,0,127,0.05)]"
                : "bg-white border-purple-200"
                }`}>
                {/* Visual mic status helper if denied permission */}
                {hasMicrophonePermission === false && (
                  <div className="absolute -top-7 left-1 flex items-center gap-1.5 text-[9px] text-red-500 font-mono font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    Microfone indisponível. Ative nas permissões.
                  </div>
                )}

                {/* Input Textbox Element */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={hasMicrophonePermission ? "Digite um comando ou clique no microfone..." : "Digite uma instrução para o Punkbot..."}
                  className={`flex-1 bg-transparent px-4 py-3 outline-none text-xs md:text-sm font-mono tracking-wide ${isDarkMode
                    ? "text-gray-100 placeholder-[#ff00ff]/35"
                    : "text-gray-800 placeholder-purple-300"
                    }`}
                />

                {/* Microphone / Transmit Trigger buttons */}
                <div className="flex items-center gap-1.5 pr-1.5">

                  {/* MICROPHONE BUTTON TRIGGER */}
                  <button
                    onClick={startRecording}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all border ${isDarkMode
                      ? "bg-[#ff00ff]/10 border-[#ff00ff]/40 text-[#ff00ff] hover:bg-[#ff00ff]/20 shadow-[0_0_8px_rgba(255,0,127,0.1)]"
                      : "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
                      }`}
                    title="Gravar mensagem de voz"
                  >
                    <Mic size={16} />
                  </button>

                  {/* TEXT SEND BUTTON TRIGGER */}
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim()}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${inputMessage.trim()
                      ? isDarkMode
                        ? "bg-[#ff00ff] text-black shadow-[0_0_15px_rgba(255,0,127,0.5)] hover:scale-[1.03]"
                        : "bg-purple-600 text-white hover:bg-purple-700 hover:scale-[1.03]"
                      : isDarkMode
                        ? "bg-[#090915] text-white/20 border border-white/5 cursor-not-allowed"
                        : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                      }`}
                    title="Enviar mensagem"
                  >
                    <Send size={14} className="ml-0.5" />
                  </button>

                </div>
              </div>
            )}

            {/* Bottom humble security tag line */}
            <div className="text-center text-[9px] font-mono text-gray-500 tracking-[0.2em] uppercase">
              Criptografia Neural Ativa • Sem Registros Corporativos
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
