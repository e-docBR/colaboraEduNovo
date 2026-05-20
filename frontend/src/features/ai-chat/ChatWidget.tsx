import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Chip,
  Fab,
  Paper,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { useLocation } from "react-router-dom";

import { useGetAIInfoQuery } from "../../lib/api";
import type { ConversationTurn, PageContext } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

// Roles com acesso ao assistente de IA
const AI_CHAT_ROLES = new Set(["admin", "super_admin", "diretor", "coordenador", "orientador"]);

const CHART_COLORS = ["#0A3CA0", "#147864", "#D6B34B", "#d32f2f", "#6a1b9a", "#00695c", "#e65100"];

type ChartConfig = {
  type: string;
  xKey: string;
  yKey: string;
  color: string;
  title: string;
};

type Message = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  type?: "text" | "table" | "chart";
  data?: Record<string, unknown>[];
  chart_config?: ChartConfig;
  analysis_text?: string;
  isStreaming?: boolean;
  analysisStreaming?: boolean;
};

// Sugestões rápidas por role (A.5)
const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  coordenador: [
    "Alunos em risco de reprovação",
    "Ranking de turmas por média",
    "Alunos com infrequência grave",
    "Prioridades de intervenção",
    "Gráfico de notas por disciplina",
    "Ocorrências da semana",
  ],
  diretor: [
    "Visão geral da escola",
    "Taxa de aprovação por turma",
    "Radar de evasão escolar",
    "Comunicados e taxa de leitura",
    "Turmas com mais ocorrências",
    "Resumo pedagógico geral",
  ],
  orientador: [
    "Alunos com infrequência alta",
    "Histórico de ocorrências por aluno",
    "Intervenção para aluno específico",
    "Alunos em recuperação",
    "Turmas com mais faltas",
    "Ocorrências por gravidade",
  ],
  admin: [
    "Visão geral da escola",
    "Alunos em risco",
    "Gráfico de médias por turma",
    "Comunicados ativos",
    "Radar de abandono",
    "Ocorrências recentes",
  ],
};

// Renderização markdown melhorada: suporta negrito, itálico, listas e parágrafos (A.3)
const renderMarkdown = (text: string): React.ReactNode => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <Box component="ul" key={key++} sx={{ pl: 2, my: 0.5, "& li": { mb: 0.25 } }}>
          {listItems.map((item, i) => (
            <li key={i}>
              <Typography variant="body2" component="span">
                {renderInline(item)}
              </Typography>
            </li>
          ))}
        </Box>
      );
      listItems = [];
    }
  };

  const renderInline = (str: string): React.ReactNode => {
    // Processa **negrito** e *itálico* na mesma passagem
    const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      listItems.push(trimmed.slice(2));
    } else if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      flushList();
      const level = trimmed.startsWith("### ") ? "caption" : "body2";
      const content = trimmed.replace(/^#{2,3}\s/, "");
      elements.push(
        <Typography key={key++} variant={level} fontWeight={700} display="block" sx={{ mt: 0.5 }}>
          {renderInline(content)}
        </Typography>
      );
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      elements.push(
        <Typography key={key++} variant="body2" sx={{ lineHeight: 1.5 }}>
          {renderInline(trimmed)}
        </Typography>
      );
    }
  }
  flushList();
  return <>{elements}</>;
};

// Exporta tabela como CSV (B.3)
const exportTableCsv = (data: Record<string, unknown>[]) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((r) =>
    headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analise-ia.csv";
  a.click();
  URL.revokeObjectURL(url);
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const user = useAppSelector((state) => state.auth.user);
  const userRole = user?.role ?? "";
  const hasAccess = AI_CHAT_ROLES.has(userRole);

  // Detecta contexto da página atual para enriquecer perguntas (B.2)
  const location = useLocation();
  const pageContext = useMemo((): PageContext | null => {
    const alunoMatch = location.pathname.match(/\/app\/alunos\/(\d+)(?:\/|$)/);
    if (alunoMatch) return { type: "aluno", id: alunoMatch[1] };
    const turmaMatch = location.pathname.match(/\/app\/turmas\/([^/]+)(?:\/|$)/);
    if (turmaMatch) return { type: "turma", id: decodeURIComponent(turmaMatch[1]) };
    return null;
  }, [location.pathname]);

  // Busca o nome e status do assistente para este tenant
  const { data: aiInfo } = useGetAIInfoQuery(undefined, { skip: !hasAccess });
  const aiName = aiInfo?.ai_name ?? "Assistente IA";
  const llmActive = aiInfo?.llm_active ?? false;

  // Chave do sessionStorage por usuário (B.1)
  const chatKey = `colabora.ai.chat.${user?.id ?? "anon"}`;

  const buildWelcome = useCallback(
    (info: typeof aiInfo): Message => ({
      id: "welcome",
      text:
        `Olá! Sou o **${info?.ai_name ?? "Assistente IA"}**, assistente de análise educacional da **${info?.tenant_name ?? "sua escola"}**.\n\n` +
        "Posso gerar relatórios e insights sobre:\n" +
        "📊 Desempenho por turma, disciplina e turno\n" +
        "👥 Alunos em risco, melhores alunos, recuperação\n" +
        "📅 Frequência e radar de abandono escolar\n" +
        "⚖️ Ocorrências por tipo, gravidade e aluno\n" +
        "📢 Comunicados e taxa de leitura\n" +
        "🎓 Intervenções pedagógicas e prioridades\n\n" +
        "💡 *Dica*: Você pode filtrar por turma, turno ou trimestre.\n" +
        "O que deseja analisar agora?",
      sender: "bot",
      timestamp: new Date(),
      type: "text",
    }),
    []
  );

  // Restaura histórico do sessionStorage (B.1)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(chatKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {
      // sessionStorage indisponível ou JSON inválido
    }
    return [];
  });

  // Salva no sessionStorage sempre que mensagens mudam (B.1)
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(chatKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // Ignora falha de quota
    }
  }, [messages, chatKey]);

  // Inicializa com mensagem de boas-vindas quando aiInfo carrega (e não há histórico)
  useEffect(() => {
    if (aiInfo && messages.length === 0) {
      setMessages([buildWelcome(aiInfo)]);
    }
  }, [aiInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const [streamingId, setStreamingId] = useState<string | null>(null);
  const isLoading = streamingId !== null;
  const abortRef = useRef<AbortController | null>(null);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handleClearChat = () => {
    const welcome = buildWelcome(aiInfo);
    setMessages([welcome]);
    try {
      sessionStorage.removeItem(chatKey);
    } catch { /* */ }
  };

  // Pré-preenche o input ao abrir o widget em página de aluno ou turma (B.2)
  useEffect(() => {
    if (!isOpen || !pageContext || inputValue) return;
    const hasUserMessages = messages.some((m) => m.sender === "user");
    if (hasUserMessages) return;
    if (pageContext.type === "turma") {
      setInputValue(`Perfil completo da turma ${pageContext.id}`);
    } else if (pageContext.type === "aluno") {
      setInputValue("Análise completa deste aluno");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const sendUserMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsgId = Date.now().toString();
    const botMsgId = (Date.now() + 1).toString();

    // Histórico antes de adicionar a nova mensagem (A.1)
    const history: ConversationTurn[] = messages
      .filter((m) => m.id !== "welcome")
      .slice(-6)
      .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

    setInputValue("");
    setStreamingId(botMsgId);
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, text, sender: "user", timestamp: new Date(), type: "text" },
      { id: botMsgId, text: "", sender: "bot", timestamp: new Date(), type: "text", isStreaming: true },
    ]);

    try {
      const resp = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken ?? ""}`,
        },
        body: JSON.stringify({
          message: text,
          history,
          ...(pageContext ? { page_context: pageContext } : {}),
        }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const ev = JSON.parse(jsonStr) as Record<string, unknown>;
            if (ev.type === "meta") {
              const rt = ev.response_type as Message["type"];
              setMessages((prev) => prev.map((m) => m.id !== botMsgId ? m : {
                ...m,
                type: rt ?? "text",
                data: ev.data as Message["data"],
                chart_config: ev.chart_config as Message["chart_config"],
                isStreaming: rt !== "chart",
                analysisStreaming: rt === "chart",
                analysis_text: "",
              }));
            } else if (ev.type === "chunk") {
              setMessages((prev) => prev.map((m) => m.id !== botMsgId ? m : {
                ...m, text: m.text + ((ev.text as string) || ""),
              }));
            } else if (ev.type === "analysis_chunk") {
              setMessages((prev) => prev.map((m) => m.id !== botMsgId ? m : {
                ...m, analysis_text: (m.analysis_text ?? "") + ((ev.text as string) || ""),
              }));
            } else if (ev.type === "done" || ev.type === "error") {
              const errText = ev.type === "error" ? ((ev.message as string) || "Ocorreu um erro.") : null;
              setMessages((prev) => prev.map((m) => m.id !== botMsgId ? m : {
                ...m, isStreaming: false, analysisStreaming: false,
                text: errText ?? m.text,
              }));
              setStreamingId(null);
              break outer;
            }
          } catch { /* ignore JSON parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => prev.map((m) => m.id !== botMsgId ? m : {
          ...m, text: "Ocorreu um erro ao processar sua pergunta. Tente novamente.",
          isStreaming: false, analysisStreaming: false,
        }));
      }
    } finally {
      setStreamingId(null);
    }
  };

  // Cancela stream ao desmontar
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleSend = () => sendUserMessage(inputValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Sugestões baseadas no role do usuário (A.5)
  const quickSuggestions = useMemo(
    () => SUGGESTIONS_BY_ROLE[userRole] ?? SUGGESTIONS_BY_ROLE.admin,
    [userRole]
  );

  const renderContent = (msg: Message) => {
    // Gráfico
    if (msg.type === "chart" && msg.data && msg.chart_config) {
      return (
        <Box>
          <Box sx={{ width: "100%", height: 220, mt: 1 }}>
            <Typography variant="caption" fontWeight={700} mb={0.5} display="block">
              {msg.chart_config.title}
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              {msg.chart_config.type === "pie" ? (
                <PieChart>
                  <Pie
                    data={msg.data}
                    dataKey={msg.chart_config.yKey}
                    nameKey={msg.chart_config.xKey}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {msg.data.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
                  <RechartsTooltip />
                </PieChart>
              ) : (
                <BarChart data={msg.data} margin={{ bottom: 20 }}>
                  <XAxis
                    dataKey={msg.chart_config.xKey}
                    tick={{ fontSize: 10 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar
                    dataKey={msg.chart_config.yKey}
                    fill={msg.chart_config.color || CHART_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
          {/* Análise textual do gráfico (A.4) */}
          {(msg.analysis_text || msg.analysisStreaming) && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block", fontStyle: "italic", lineHeight: 1.4 }}
            >
              {msg.analysis_text || ""}
              {msg.analysisStreaming && <span style={{ opacity: 0.5 }}> ▋</span>}
            </Typography>
          )}
        </Box>
      );
    }

    // Tabela com botão de exportar CSV (B.3)
    if (msg.type === "table" && Array.isArray(msg.data) && msg.data.length > 0) {
      const headers = Object.keys(msg.data[0]);
      return (
        <Box>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ mt: 1, maxHeight: 220, bgcolor: "transparent", border: "1px solid", borderColor: "divider" }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((h) => (
                    <TableCell
                      key={h}
                      sx={{ fontWeight: 700, fontSize: "0.68rem", py: 0.5, bgcolor: "action.hover" }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {msg.data.map((row, i) => (
                  <TableRow key={i} hover>
                    {headers.map((h) => (
                      <TableCell key={h} sx={{ fontSize: "0.68rem", py: 0.4 }}>
                        {String(row[h] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="flex-end" mt={0.5}>
            <Tooltip title="Exportar CSV">
              <IconButton size="small" onClick={() => exportTableCsv(msg.data!)} sx={{ opacity: 0.6 }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      );
    }

    return null;
  };

  // Não renderiza para usuários sem acesso
  if (!hasAccess) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 32,
        right: 32,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      <Collapse in={isOpen} orientation="vertical">
        <Paper
          elevation={8}
          sx={{
            width: 420,
            height: 580,
            mb: 2,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 1.5,
              background: "linear-gradient(135deg, #0A3CA0 0%, #062A73 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <SmartToyIcon fontSize="small" />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} lineHeight={1.2}>
                  {aiName}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: "0.65rem" }}>
                  Análise educacional
                </Typography>
              </Box>
              {llmActive && (
                <Tooltip title="IA generativa ativa">
                  <Chip
                    icon={<AutoAwesomeIcon sx={{ fontSize: "0.75rem !important" }} />}
                    label="IA"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.6rem",
                      bgcolor: "rgba(255,255,255,0.2)",
                      color: "white",
                      "& .MuiChip-icon": { color: "#D6B34B" },
                    }}
                  />
                </Tooltip>
              )}
            </Box>
            <Box display="flex" alignItems="center">
              {/* Limpar conversa (B.1) */}
              <Tooltip title="Limpar conversa">
                <IconButton size="small" onClick={handleClearChat} sx={{ color: "rgba(255,255,255,0.7)" }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton size="small" onClick={handleToggle} sx={{ color: "white" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              p: 1.5,
              overflowY: "auto",
              bgcolor: "background.default",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            {messages.map((msg) => (
              <Box
                key={msg.id}
                sx={{
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: msg.type === "chart" || msg.type === "table" ? "98%" : "88%",
                  width: msg.type === "chart" || msg.type === "table" ? "100%" : "auto",
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: msg.sender === "user" ? "primary.main" : "background.paper",
                    color: msg.sender === "user" ? "primary.contrastText" : "text.primary",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: msg.sender === "user" ? "primary.dark" : "divider",
                    borderTopRightRadius: msg.sender === "user" ? 0 : 8,
                    borderTopLeftRadius: msg.sender === "bot" ? 0 : 8,
                    position: "relative",
                  }}
                >
                  {/* Botão copiar para mensagens de texto do bot (B.3) */}
                  {msg.sender === "bot" && msg.type === "text" && msg.id !== "welcome" && (
                    <Tooltip title={copied === msg.id ? "Copiado!" : "Copiar"}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        sx={{ position: "absolute", top: 4, right: 4, opacity: 0.4, "&:hover": { opacity: 1 } }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {/* Dots enquanto aguarda primeiro chunk; markdown quando há texto */}
                  <Box sx={{ whiteSpace: "pre-wrap", "& > *": { mb: 0.25 } }}>
                    {msg.sender === "bot" && msg.isStreaming && !msg.text ? (
                      <Box display="flex" gap={0.5} py={0.25}>
                        {[0, 1, 2].map((i) => (
                          <Box key={i} sx={{
                            width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main",
                            animation: "bounce 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                            "@keyframes bounce": { "0%,80%,100%": { transform: "scale(0)" }, "40%": { transform: "scale(1)" } },
                          }} />
                        ))}
                      </Box>
                    ) : (
                      renderMarkdown(msg.text)
                    )}
                  </Box>
                  {renderContent(msg)}
                </Paper>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    display: "block",
                    mt: 0.3,
                    fontSize: "0.62rem",
                    textAlign: msg.sender === "user" ? "right" : "left",
                  }}
                >
                  {msg.sender === "bot" ? aiName : "Você"} •{" "}
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>

          {/* Quick Suggestions — apenas antes de qualquer mensagem do usuário (A.5) */}
          {messages.filter((m) => m.sender === "user").length === 0 && (
            <Box
              sx={{
                px: 1.5,
                pb: 1,
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
                bgcolor: "background.default",
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              {quickSuggestions.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  size="small"
                  variant="outlined"
                  onClick={() => sendUserMessage(s)}
                  sx={{ fontSize: "0.65rem", cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                />
              ))}
            </Box>
          )}

          {/* Input */}
          <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            <TextField
              fullWidth
              size="small"
              multiline
              maxRows={3}
              placeholder="Peça análises, relatórios ou gráficos..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      color="primary"
                    >
                      {isLoading ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>
      </Collapse>

      {/* FAB */}
      <Tooltip title={`Abrir ${aiName}`} placement="left">
        <Fab
          color="primary"
          aria-label="chat"
          onClick={handleToggle}
          sx={{
            background: "linear-gradient(135deg, #0A3CA0 0%, #062A73 100%)",
            boxShadow: 4,
            transition: "transform 0.2s",
            "&:hover": { transform: "scale(1.08)" },
          }}
        >
          {isOpen ? <CloseIcon /> : <SmartToyIcon />}
        </Fab>
      </Tooltip>
    </Box>
  );
};
