import { useState, useRef, useEffect } from "react";
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

import { useChatMutation, useGetAIInfoQuery } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

// Roles que têm acesso ao assistente de IA
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
  data?: any;
  chart_config?: ChartConfig;
};

// Sugestões rápidas de perguntas
const QUICK_SUGGESTIONS = [
  "Visão geral da escola",
  "Alunos em risco",
  "Radar de abandono",
  "Melhores alunos",
  "Gráfico de médias por turma",
  "Ocorrências recentes",
];

const renderMarkdown = (text: string) => {
  // Renderização mínima de markdown: **negrito**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userRole = useAppSelector((state) => state.auth.user?.role ?? "");
  const hasAccess = AI_CHAT_ROLES.has(userRole);

  // Busca o nome e status do assistente para este tenant
  const { data: aiInfo } = useGetAIInfoQuery(undefined, { skip: !hasAccess });
  const aiName = aiInfo?.ai_name ?? "Assistente IA";
  const llmActive = aiInfo?.llm_active ?? false;

  const [sendMessage, { isLoading }] = useChatMutation();

  // Mensagem de boas-vindas — atualizada com nome correto quando aiInfo carrega
  useEffect(() => {
    if (aiInfo && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          text:
            `Olá! Sou o **${aiInfo.ai_name}**, assistente de análise educacional da **${aiInfo.tenant_name}**.\n\n` +
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
        },
      ]);
    }
  }, [aiInfo]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const sendUserMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    try {
      const res = await sendMessage({ message: text }).unwrap();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: res.text || "Não entendi sua solicitação.",
          sender: "bot",
          timestamp: new Date(),
          type: res.type || "text",
          data: res.data,
          chart_config: res.chart_config,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Ocorreu um erro ao processar sua pergunta. Tente novamente.",
          sender: "bot",
          timestamp: new Date(),
          type: "text",
        },
      ]);
    }
  };

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

  const renderContent = (msg: Message) => {
    // Gráfico
    if (msg.type === "chart" && msg.data && msg.chart_config) {
      return (
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
                  {msg.data.map((_: any, i: number) => (
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
      );
    }

    // Tabela
    if (msg.type === "table" && Array.isArray(msg.data) && msg.data.length > 0) {
      const headers = Object.keys(msg.data[0]);
      return (
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
              {msg.data.map((row: any, i: number) => (
                <TableRow key={i} hover>
                  {headers.map((h) => (
                    <TableCell key={h} sx={{ fontSize: "0.68rem", py: 0.4 }}>
                      {row[h]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
            <IconButton size="small" onClick={handleToggle} sx={{ color: "white" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
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
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {renderMarkdown(msg.text)}
                  </Typography>
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
            {isLoading && (
              <Box alignSelf="flex-start">
                <Paper
                  elevation={0}
                  sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", display: "flex", gap: 0.5 }}
                >
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main",
                        animation: "bounce 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                        "@keyframes bounce": {
                          "0%, 80%, 100%": { transform: "scale(0)" },
                          "40%": { transform: "scale(1)" },
                        },
                      }}
                    />
                  ))}
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Quick Suggestions — só antes de qualquer mensagem do usuário */}
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
              {QUICK_SUGGESTIONS.map((s) => (
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
