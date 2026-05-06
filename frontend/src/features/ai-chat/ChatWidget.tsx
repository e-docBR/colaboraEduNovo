
import { useState, useRef, useEffect } from "react";
import {
    Box,
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
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { useChatMutation } from "../../lib/api";

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

export const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            text: "Olá! Sou o AI FreiRonaldo. Posso gerar gráficos, tabelas e insights sobre:\n" +

                "📊 Gráficos de médias e turmas\n" +
                "⚠️ Alunos em risco ou com muitas faltas\n" +
                "🌟 Melhores alunos e destaques\n" +
                "📢 Mural de avisos e comunicados\n" +
                "⚖️ Ocorrências e comportamento\n" +
                "🕵️‍♂️ Radar de abandono escolar\n\n" +
                "O que deseja analisar agora?",

            sender: "bot",
            timestamp: new Date(),
            type: "text"
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [sendMessage, { isLoading }] = useChatMutation();

    const handleToggle = () => setIsOpen((prev) => !prev);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: "user",
            timestamp: new Date(),
            type: "text"
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");

        try {
            const responseData = await sendMessage({ message: userMsg.text }).unwrap();


            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: responseData.text || "Desculpe, não entendi sua solicitação.",
                sender: "bot",
                timestamp: new Date(),
                type: responseData.type || "text",
                data: responseData.data,
                chart_config: responseData.chart_config
            };
            setMessages((prev) => [...prev, botMsg]);

        } catch {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Desculpe, tive um problema ao processar sua solicitação complexa.",
                sender: "bot",
                timestamp: new Date(),
                type: "text"
            };
            setMessages((prev) => [...prev, errorMsg]);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const renderContent = (msg: Message) => {
        if (msg.type === "chart" && msg.data && msg.chart_config) {
            const COLORS = ["#14b8a6", "#f59e0b", "#ef4444", "#06b6d4"];
            return (
                <Box sx={{ width: "100%", height: 200, mt: 1 }}>
                    <Typography variant="caption" fontWeight={600} mb={1} display="block">{msg.chart_config.title}</Typography>
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
                                    outerRadius={60}
                                    paddingAngle={5}
                                    label={({ name }) => name}
                                >
                                    {msg.data.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : (
                            <BarChart data={msg.data}>
                                <XAxis dataKey={msg.chart_config.xKey} hide />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey={msg.chart_config.yKey} fill={msg.chart_config.color || "#14b8a6"} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </Box>
            );
        }


        if (msg.type === "table" && msg.data && Array.isArray(msg.data)) {
            if (msg.data.length === 0) return null;
            const headers = Object.keys(msg.data[0]);
            return (
                <TableContainer component={Paper} elevation={0} sx={{ mt: 1, maxHeight: 200, bgcolor: "transparent" }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                {headers.map(h => <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.7rem", py: 0.5 }}>{h}</TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {msg.data.map((row, i) => (
                                <TableRow key={i}>
                                    {headers.map(h => <TableCell key={h} sx={{ fontSize: "0.7rem", py: 0.5 }}>{row[h]}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            );
        }

        return null;
    };

    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 32,
                right: 32,
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
            }}
        >
            <Collapse in={isOpen} orientation="vertical">
                <Paper
                    elevation={6}
                    sx={{
                        width: 400, // Wider for charts
                        height: 550, // Taller
                        mb: 2,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            p: 2,
                            bgcolor: "primary.main",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Box display="flex" alignItems="center" gap={1}>
                            <SmartToyIcon fontSize="small" />
                            <Typography variant="subtitle1" fontWeight={600}>
                                AI FreiRonaldo
                            </Typography>

                        </Box>
                        <IconButton size="small" onClick={handleToggle} sx={{ color: "white" }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Messages Area */}
                    <Box
                        sx={{
                            flex: 1,
                            p: 2,
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
                                    maxWidth: msg.type === "chart" || msg.type === "table" ? "95%" : "85%",
                                    width: msg.type === "chart" || msg.type === "table" ? "100%" : "auto"
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
                                        borderColor: "divider",
                                        borderTopRightRadius: msg.sender === "user" ? 0 : 2,
                                        borderTopLeftRadius: msg.sender === "bot" ? 0 : 2,
                                    }}
                                >
                                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{msg.text}</Typography>

                                    {/* Dynamic Content Renderer */}
                                    {renderContent(msg)}

                                </Paper>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, textAlign: msg.sender === "user" ? "right" : "left", fontSize: "0.7rem" }}>
                                    {msg.sender === "bot" ? "IA" : "Você"}
                                </Typography>
                            </Box>
                        ))}
                        <div ref={messagesEndRef} />
                    </Box>

                    {/* Input Area */}
                    <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Peça gráficos, relatórios ou insights..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={isLoading}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={handleSend} disabled={!inputValue.trim() || isLoading} color="primary">
                                            {isLoading ? <CircularProgress size={20} /> : <SendIcon fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>
                </Paper>
            </Collapse>

            <Fab
                color="primary"
                aria-label="chat"
                onClick={handleToggle}
                sx={{
                    boxShadow: 4,
                    transition: "transform 0.2s",
                    "&:hover": { transform: "scale(1.1)" },
                }}
            >
                {isOpen ? <CloseIcon /> : <SmartToyIcon />}
            </Fab>
        </Box>
    );
};
