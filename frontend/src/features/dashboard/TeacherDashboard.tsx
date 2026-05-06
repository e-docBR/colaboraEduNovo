import { useState, useEffect } from "react";
import {
    Alert,
    Box,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Grid2 as Grid,
    List,
    ListItem,
    Typography,
    Chip,
    TextField,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    InputAdornment,
    Stack,
    Avatar,
    useTheme,
    Divider
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PersonIcon from "@mui/icons-material/Person";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { useGetTeacherDashboardQuery, useListTurmasQuery } from "../../lib/api";
import { AIInterventionBoard } from "./AIInterventionBoard";

const BAR_RANGE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

export const TeacherDashboard = () => {
    const theme = useTheme();
    const [searchInput, setSearchInput] = useState("");
    const [filters, setFilters] = useState({ q: "", turno: "Todos", turma: "Todas" });

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => setFilters(prev => ({ ...prev, q: searchInput })), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const apiFilters = {
        q: filters.q || undefined,
        turno: filters.turno === "Todos" ? undefined : filters.turno,
        turma: filters.turma === "Todas" ? undefined : filters.turma,
    };

    const { data, isLoading, error } = useGetTeacherDashboardQuery(apiFilters);
    const { data: turmasData } = useListTurmasQuery();

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ borderRadius: 2 }}>Erro ao carregar dashboard do professor.</Alert>;
    }

    if (!data) return null;

    const chartData = Object.entries(data.distribution || {}).map(([key, value]) => ({
        range: key,
        count: value as number,
    }));

    const uniqueTurmas = turmasData?.items.map((t: any) => t.turma) || [];
    const alertCount = data.alerts?.length ?? 0;

    const stats = [
        { label: "Turmas Ativas", value: data.classes_count, icon: <SchoolIcon />, color: theme.palette.primary.main },
        { label: "Total de Alunos", value: data.total_students, icon: <GroupsIcon />, color: theme.palette.success.main },
        { label: "Média Global", value: data.global_average, icon: <TrendingUpIcon />, color: theme.palette.info.main },
        { label: "Alunos em Risco", value: alertCount, icon: <WarningAmberIcon />, color: theme.palette.error.main },
    ];

    const hasNoStudents = data.total_students === 0;

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: "-0.02em", mb: 0.5 }}>
                    Visão do Professor
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Monitore o desempenho das suas turmas e identifique alunos em risco.
                </Typography>
            </Box>

            {/* Filters */}
            <Card elevation={0} sx={{ mb: 4, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
                    <TextField
                        placeholder="Buscar por nome ou matrícula..."
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 2 }
                        }}
                    />

                    <Stack direction="row" spacing={2} sx={{ minWidth: { md: 400 } }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel id="turno-label">Turno</InputLabel>
                            <Select
                                labelId="turno-label"
                                value={filters.turno}
                                label="Turno"
                                onChange={(e) => setFilters(prev => ({ ...prev, turno: e.target.value }))}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="Todos">Todos</MenuItem>
                                <MenuItem value="Matutino">Matutino</MenuItem>
                                <MenuItem value="Vespertino">Vespertino</MenuItem>
                                <MenuItem value="Noturno">Noturno</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" fullWidth>
                            <InputLabel id="turma-label">Turma</InputLabel>
                            <Select
                                labelId="turma-label"
                                value={filters.turma}
                                label="Turma"
                                onChange={(e) => setFilters(prev => ({ ...prev, turma: e.target.value }))}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="Todas">Todas</MenuItem>
                                {uniqueTurmas.map((turma: string) => (
                                    <MenuItem key={turma} value={turma}>
                                        {turma}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </Stack>
            </Card>

            {/* Empty state */}
            {hasNoStudents && (
                <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                    Nenhum aluno encontrado com os filtros selecionados.
                </Alert>
            )}

            {/* Stat Cards */}
            <Grid container spacing={3} mb={4}>
                {stats.map((stat, index) => (
                    <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                            <CardContent sx={{ p: 3 }}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Avatar sx={{ bgcolor: `${stat.color}15`, color: stat.color, borderRadius: 1.5 }}>
                                        {stat.icon}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {stat.label}
                                        </Typography>
                                        <Typography variant="h4" fontWeight={700} color={index === 3 && alertCount > 0 ? "error.main" : "text.primary"}>
                                            {stat.value}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={3}>
                {/* Grade Distribution */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, height: "100%" }}>
                        <CardHeader
                            title="Distribuição de Notas"
                            titleTypographyProps={{ variant: "h6", fontWeight: 700 }}
                            subheader="Visão por faixas de pontuação"
                        />
                        <Divider />
                        <CardContent sx={{ height: 350, pt: 4 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{
                                            backgroundColor: theme.palette.background.paper,
                                            borderRadius: 8,
                                            border: `1px solid ${theme.palette.divider}`,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                        formatter={(value: any) => [value, "Alunos"]}
                                        labelFormatter={(label: string) => {
                                            const qualLabels: Record<string, string> = {
                                                "0-20": "0-20 (Crítico)",
                                                "20-40": "20-40 (Preocupante)",
                                                "40-60": "40-60 (Em Atenção)",
                                                "60-80": "60-80 (Bom)",
                                                "80-100": "80-100 (Excelente)"
                                            };
                                            return qualLabels[label] || label;
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                                        {chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={BAR_RANGE_COLORS[index % BAR_RANGE_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Risk Alerts */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, height: "100%" }}>
                        <CardHeader
                            title="Alerta de Risco (IA)"
                            titleTypographyProps={{ color: "error.main", fontWeight: 700, variant: "h6" }}
                            subheader="Alunos que precisam de atenção imediata"
                            avatar={<WarningAmberIcon color="error" />}
                        />
                        <Divider />
                        <CardContent sx={{ p: 0 }}>
                            <List sx={{ py: 0 }}>
                                {data.alerts?.map((aluno: any, idx: number) => (
                                    <ListItem
                                        key={aluno.id}
                                        divider={idx !== data.alerts.length - 1}
                                        sx={{
                                            px: 3,
                                            py: 2,
                                            transition: "background-color 0.2s",
                                            "&:hover": { bgcolor: "action.hover" }
                                        }}
                                    >
                                        <Stack direction="row" spacing={2} alignItems="center" width="100%">
                                            <Avatar sx={{ bgcolor: theme.palette.error.main + "15", color: theme.palette.error.main }}>
                                                <PersonIcon fontSize="small" />
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Link
                                                    to={`/app/alunos/${aluno.id}`}
                                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                                >
                                                    <Typography fontWeight={600} noWrap sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}>
                                                        {aluno.nome}
                                                    </Typography>
                                                </Link>
                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                    <Typography variant="caption" color="text.secondary">
                                                        Média: <strong>{aluno.media}</strong>
                                                    </Typography>
                                                    <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "text.disabled" }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        {aluno.turma}
                                                    </Typography>
                                                    {aluno.faltas != null && aluno.faltas > 0 && (
                                                        <>
                                                            <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "text.disabled" }} />
                                                            <Typography variant="caption" color={aluno.faltas > 20 ? "error.main" : "text.secondary"} fontWeight={aluno.faltas > 20 ? 700 : 400}>
                                                                {aluno.faltas} faltas
                                                            </Typography>
                                                        </>
                                                    )}
                                                </Stack>
                                            </Box>
                                            <Chip
                                                label={`${(aluno.risk_score * 100).toFixed(0)}% Risco`}
                                                color="error"
                                                size="small"
                                                sx={{ fontWeight: 700, borderRadius: 1, flexShrink: 0 }}
                                            />
                                        </Stack>
                                    </ListItem>
                                ))}
                                {(!data.alerts || data.alerts.length === 0) && (
                                    <Box p={4} textAlign="center">
                                        <Typography color="text.secondary">Nenhum alerta de risco detectado.</Typography>
                                    </Box>
                                )}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* AI Pedagogical Interventions */}
            {alertCount > 0 && (
                <AIInterventionBoard studentIds={data.alerts.map((a: any) => a.id)} />
            )}
        </Box>
    );
};
