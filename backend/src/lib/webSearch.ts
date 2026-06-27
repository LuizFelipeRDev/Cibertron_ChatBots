/**
 * Módulo de busca web para o Punkbot
 * Usa DuckDuckGo (gratuito, sem API key) como mecanismo de busca padrão.
 * Se disponível, também suporta Brave Search API via chave configurada no .env
 */

const SEARCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Realiza uma busca web usando DuckDuckGo (HTML scraping, sem API key)
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": SEARCH_USER_AGENT,
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo retornou status ${response.status}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // Parse results with simple regex (avoiding cheerio dependency)
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  let count = 0;
  while ((match = resultRegex.exec(html)) !== null && count < 5) {
    const url = match[1]?.replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "") || "";
    const title = match[2]?.replace(/<[^>]*>/g, "").trim() || "";
    const snippet = match[3]?.replace(/<[^>]*>/g, "").trim() || "";
    if (title) {
      results.push({
        title: decodeHtmlEntities(title),
        snippet: decodeHtmlEntities(snippet),
        url: decodeURIComponent(url),
      });
      count++;
    }
  }

  return results;
}

/**
 * Tenta buscar via Brave Search API (se chave configurada no .env)
 */
async function searchBrave(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY não configurada");

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search retornou status ${response.status}`);
  }

  const data: any = await response.json();
  const results: SearchResult[] = [];

  if (data.web?.results) {
    for (const item of data.web.results.slice(0, 5)) {
      results.push({
        title: item.title || "",
        snippet: item.description || "",
        url: item.url || "",
      });
    }
  }

  return results;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/**
 * Formata os resultados da busca como texto para injetar no prompt da IA
 */
function formatResultsAsContext(results: SearchResult[], query: string): string {
  if (results.length === 0) return "";

  let context = `--- RESULTADOS DE BUSCA WEB PARA: "${query}" ---\n`;
  context += `(Obtido via busca em tempo real no momento: ${new Date().toLocaleString("pt-BR")})\n\n`;

  for (let i = 0; i < results.length; i++) {
    context += `[${i + 1}] ${results[i].title}\n`;
    context += `   Fonte: ${results[i].url}\n`;
    context += `   Resumo: ${results[i].snippet}\n\n`;
  }

  context += "--- FIM DOS RESULTADOS DE BUSCA ---\n";
  context +=
    "IMPORTANTE: Use essas informações para responder à pergunta do usuário. Se os resultados forem relevantes, incorpore-os na sua resposta de forma natural com seu estilo cyberpunk. Se não forem relevantes, ignore-os.\n";

  return context;
}

/**
 * Detecta se a mensagem provavelmente precisa de busca web
 */
function needsWebSearch(message: string): boolean {
  const lower = message.toLowerCase();

  // Palavras-chave que indicam necessidade de informação atual
  const realtimeKeywords = [
    "quando",
    "que horas",
    "qual o",
    "quem",
    "onde",
    "notíci",
    "notici",
    "últim",
    "ultim",
    "agora",
    "hoje",
    "amanhã",
    "amanha",
    "ontem",
    "jogo",
    "partid",
    "campeonat",
    "previsão",
    "previsao",
    "clima",
    "temperatura",
    "cotação",
    "cotacao",
    "preço",
    "preco",
    "lançament",
    "lancament",
    "novo",
    "nova",
    "atualiz",
    "resultad",
    "placar",
    "último",
    "ultimo",
    "próxim",
    "proxim",
    "futur",
    "lançado",
    "agend",
    "calendár",
    "calendario",
    "estreia",
    "ao vivo",
    "tabela",
    "classificaç",
    "classificac",
    "2024",
    "2025",
    "2026",
  ];

  return realtimeKeywords.some((keyword) => lower.includes(keyword));
}

/**
 * Função principal: detecta se precisa de busca, executa e retorna contexto formatado
 */
export async function webSearch(message: string): Promise<string> {
  if (!needsWebSearch(message)) {
    return "";
  }

  console.log(`🔍 Busca web detectada para: "${message.substring(0, 60)}..."`);

  try {
    let results: SearchResult[];

    // Tenta Brave Search primeiro (se configurado), depois DuckDuckGo
    try {
      results = await searchBrave(message);
      console.log(`🌐 Brave Search retornou ${results.length} resultados`);
    } catch {
      console.log("🦆 Usando DuckDuckGo como fallback de busca...");
      results = await searchDuckDuckGo(message);
      console.log(`🦆 DuckDuckGo retornou ${results.length} resultados`);
    }

    return formatResultsAsContext(results, message);
  } catch (error: any) {
    console.warn(`⚠️ Busca web falhou: ${error.message}`);
    return "";
  }
}

export { needsWebSearch };
