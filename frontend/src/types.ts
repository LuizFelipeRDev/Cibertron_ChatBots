export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  audioUrl?: string; // Optional URL of recorded/received audio message
  isVoice?: boolean; // Flag if this was sent via voice
  isPending?: boolean; // Processing state
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt?: string;
  deviceId?: string;
  syncStatus?: "local" | "synced" | "pending";
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  latency: number;
  signalStrength: number;
}
