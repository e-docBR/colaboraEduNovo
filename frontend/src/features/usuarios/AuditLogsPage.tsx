import {
    Box,
    Typography,
    Card,
    CardContent,
    Stack,
    Alert,
    CircularProgress,
    Chip,
    Divider,
    Grid2 as Grid,
    useTheme,
    Fade,
    TextField,
    MenuItem,
    Pagination,
    InputAdornment,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LayersIcon from "@mui/icons-material/Layers";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";
import { useState } from "react";
import { useListAuditLogsQuery } from "../../lib/api";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

const ACTION_OPTIONS = ["", "CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT"];
const TARGET_OPTIONS = ["", "Nota", "Aluno", "Usuario", "Ocorrencia", "Comunicado"];

const getActionColor = (action: string): "error" | "warning" | "success" | "info" => {
    if (action.includes("DELETE")) return "error";
    if (action.includes("UPDATE") || action.includes("PATCH")) return "warning";
    if (action.includes("CREATE") || action.includes("POST")) return "success";
    return "info";
};

export const AuditLogsPage = () => {
    const theme = useTheme();

    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState("");
    const [targetTypeFilter, setTargetTypeFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");
    const [userInput, setUserInput] = useState("");

    const PER_PAGE = 20;

    const { data, isLoading, error } = useListAuditLogsQuery({
        page,
        per_page: PER_PAGE,
        action: actionFilter || undefined,
        target_type: targetTypeFilter || undefined,
        user: userFilter || undefined,
    });

    const logs = data?.items ?? [];
    const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;

    const handleUserSearch = () => {
        setUserFilter(userInput);
        setPage(1);
    };

    const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        setPage(1);
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <Stack spacing={2} alignItems="center">
                    <CircularProgress size={40} thickness={4} sx={{ color: "primary.main" }} />
                    <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: 1 }}>
                        CARREGANDO LOGS...
                    </Typography>
                </Stack>
            </Box>
        );
    }

    if (error) {
        return (
            <Box p={4}>
                <Alert severity="error" variant="filled" sx={{ borderRadius: 3 }}>
                    Erro ao carregar logs de auditoria.
                </Alert>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box mb={4}>
                <Stack direction="row" spacing={2} alignItems="center" mb={0.5}>
                    <Box sx={{ p: 1, bgcolor: "primary.main", color: "white", borderRadius: 1 }}>
                        <HistoryIcon />
                    </Box>
                    <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: "-0.03em" }}>
                        Auditoria de Sistema
                    </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    Rastreabilidade completa de todas as alterações críticas e ações administrativas.
                </Typography>
            </Box>

            {/* Stats */}
            <Grid container spacing={2} mb={4}>
                {[
                    { label: "Total de Eventos", value: data?.total ?? 0, icon: <LayersIcon />, color: "primary" },
                    { label: "Ações Críticas (DELETE)", value: logs.filter(l => l.action.includes("DELETE")).length, icon: <VisibilityIcon />, color: "error" },
                ].map((stat, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                                            {stat.label.toUpperCase()}
                                        </Typography>
                                        <Typography variant="h4" fontWeight={800} color={`${stat.color}.main`}>
                                            {stat.value}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${stat.color}.light`, color: `${stat.color}.main`, opacity: 0.8 }}>
                                        {stat.icon}
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Filters */}
            <Card elevation={0} sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ py: 2 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                        <TextField
                            select
                            label="Ação"
                            value={actionFilter}
                            onChange={handleFilterChange(setActionFilter)}
                            size="small"
                            sx={{ minWidth: 140 }}
                        >
                            {ACTION_OPTIONS.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt || "Todas"}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Entidade"
                            value={targetTypeFilter}
                            onChange={handleFilterChange(setTargetTypeFilter)}
                            size="small"
                            sx={{ minWidth: 150 }}
                        >
                            {TARGET_OPTIONS.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt || "Todas"}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            placeholder="Filtrar por usuário..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                            size="small"
                            sx={{ flex: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                )
                            }}
                        />
                        {(actionFilter || targetTypeFilter || userFilter) && (
                            <Chip
                                label="Limpar filtros"
                                size="small"
                                onDelete={() => {
                                    setActionFilter("");
                                    setTargetTypeFilter("");
                                    setUserFilter("");
                                    setUserInput("");
                                    setPage(1);
                                }}
                                color="default"
                            />
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Log List */}
            <Stack spacing={1.5}>
                {logs.map((log, index) => (
                    <Fade in timeout={100 + index * 30} key={log.id}>
                        <Card
                            elevation={0}
                            sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                transition: "all 0.15s",
                                "&:hover": { borderColor: "primary.light", bgcolor: "action.hover" }
                            }}
                        >
                            <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: 2 } }}>
                                <Grid container spacing={2} alignItems="center">
                                    {/* Action & Time */}
                                    <Grid size={{ xs: 12, md: 2 }}>
                                        <Stack spacing={0.5}>
                                            <Chip
                                                label={log.action}
                                                size="small"
                                                color={getActionColor(log.action)}
                                                sx={{ fontWeight: 700, fontSize: "0.65rem", height: 20, width: "fit-content" }}
                                            />
                                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                {dayjs(log.timestamp).fromNow()}
                                            </Typography>
                                            <Typography variant="caption" fontSize="0.65rem" color="text.disabled">
                                                {dayjs(log.timestamp).format("DD/MM/YY HH:mm:ss")}
                                            </Typography>
                                        </Stack>
                                    </Grid>

                                    {/* Actor */}
                                    <Grid size={{ xs: 12, md: 2.5 }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Box sx={{ p: 0.75, bgcolor: "action.selected", borderRadius: "50%" }}>
                                                <PersonIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block" }}>
                                                    USUÁRIO
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600} fontSize="0.8rem">
                                                    {log.user}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Grid>

                                    <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

                                    {/* Target */}
                                    <Grid size={{ xs: 12, md: 2 }}>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block" }}>
                                            ENTIDADE
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600} color="primary.main" fontSize="0.8rem">
                                            {log.target}
                                        </Typography>
                                    </Grid>

                                    {/* Details */}
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        {log.details && Object.keys(log.details).length > 0 ? (
                                            <Box sx={{
                                                p: 1.5,
                                                bgcolor: "background.default",
                                                borderRadius: 1,
                                                border: "1px solid",
                                                borderColor: "divider",
                                                maxHeight: 100,
                                                overflow: "auto"
                                            }}>
                                                <Typography
                                                    variant="caption"
                                                    component="pre"
                                                    sx={{
                                                        fontFamily: "monospace",
                                                        fontSize: "0.68rem",
                                                        color: "text.primary",
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-all",
                                                        m: 0
                                                    }}
                                                >
                                                    {JSON.stringify(log.details, null, 2)}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.disabled" fontStyle="italic">
                                                Sem detalhes registrados
                                            </Typography>
                                        )}
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Fade>
                ))}

                {logs.length === 0 && (
                    <Box textAlign="center" py={8} border="1px dashed" borderColor="divider" borderRadius={2}>
                        <HistoryIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                        <Typography color="text.secondary">Nenhum evento encontrado com os filtros aplicados.</Typography>
                    </Box>
                )}
            </Stack>

            {/* Pagination */}
            {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, value) => setPage(value)}
                        color="primary"
                        shape="rounded"
                    />
                </Box>
            )}
        </Box>
    );
};
