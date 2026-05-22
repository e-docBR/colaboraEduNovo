import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography,
  useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import GroupsIcon from "@mui/icons-material/Groups";
import SchoolIcon from "@mui/icons-material/School";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssessmentIcon from "@mui/icons-material/Assessment";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FilterListIcon from "@mui/icons-material/FilterList";

import { useGetDashboardKpisQuery, useGetGraficoQuery, useListAlunosQuery } from "../../lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("pt-BR");

function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
  loading = false,
  empty = false,
  error = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
}) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" fontWeight={700} fontSize="1rem">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      <CardContent sx={{ p: 2, height }}>
        {loading ? (
          <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
        ) : error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            Erro ao carregar dados
          </Alert>
        ) : empty ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Typography color="text.secondary" variant="body2">
              Sem dados disponíveis
            </Typography>
          </Box>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Cor baseada em valor vs. threshold (verde → vermelho)
function getValueColor(value: number, threshold: number, theme: Theme): string {
  if (value >= threshold * 1.2) return theme.palette.success.main;
  if (value >= threshold) return theme.palette.success.light;
  if (value >= threshold * 0.7) return theme.palette.warning.main;
  return theme.palette.error.main;
}

// Cor de célula para heatmap
function heatCell(value: number | null, threshold: number): string {
  if (value === null) return "#f0f0f0";
  if (value >= threshold) {
    const t = Math.min((value - threshold) / (100 - threshold), 1);
    return `hsl(142, 55%, ${Math.round(85 - t * 45)}%)`;
  }
  const t = Math.min((threshold - value) / threshold, 1);
  return `hsl(4, 75%, ${Math.round(90 - t * 50)}%)`;
}

const SITUACAO_COLORS: Record<string, string> = {
  "Aprovado":          "#22c55e",
  "Em Recuperação":    "#f59e0b",
  "Reprovado":         "#ef4444",
  "Em Curso":          "#3b82f6",
  "Transferido":       "#8b5cf6",
  "Abandono":          "#6b7280",
  "Outros":            "#d1d5db",
};

const TURNO_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

// ── componente principal ──────────────────────────────────────────────────────

export const DashboardPage = () => {
  const theme = useTheme();

  // Filtros globais
  const [filterTurno, setFilterTurno] = useState<string>("");
  const [filterTurma, setFilterTurma] = useState<string>("");

  // Dados de alunos apenas para popular os dropdowns
  const { data: alunosData } = useListAlunosQuery({ per_page: 2000 });
  const turnos = useMemo(() => {
    if (!alunosData?.items) return [];
    return Array.from(new Set(alunosData.items.map((a) => a.turno).filter(Boolean))).sort() as string[];
  }, [alunosData]);
  const turmas = useMemo(() => {
    if (!alunosData?.items) return [];
    return Array.from(
      new Set(
        alunosData.items
          .filter((a) => !filterTurno || a.turno === filterTurno)
          .map((a) => a.turma)
          .filter(Boolean)
      )
    ).sort() as string[];
  }, [alunosData, filterTurno]);

  const gArgs = useMemo(
    () => ({ turno: filterTurno || undefined, turma: filterTurma || undefined }),
    [filterTurno, filterTurma]
  );

  // KPIs
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useGetDashboardKpisQuery();
  const threshold = kpis?.grading_stage?.threshold ?? 50;
  const maxPts    = kpis?.grading_stage?.max_pts    ?? 100;
  const trimLabel = kpis?.grading_stage?.trimester  ?? "T3";

  // Gráficos
  const { data: gSituacao,   isLoading: lSit,  isError: eSit  } = useGetGraficoQuery({ slug: "situacao-distribuicao",  ...gArgs });
  const { data: gGauss,      isLoading: lGau,  isError: eGau  } = useGetGraficoQuery({ slug: "gauss-escola",          ...gArgs });
  const { data: gEvolucao,   isLoading: lEvo,  isError: eEvo  } = useGetGraficoQuery({ slug: "medias-por-trimestre",  ...gArgs });
  const { data: gTurnos,     isLoading: lTur,  isError: eTur  } = useGetGraficoQuery({ slug: "evolucao-turnos",       ...gArgs });
  const { data: gDisciplinas,isLoading: lDis,  isError: eDis  } = useGetGraficoQuery({ slug: "disciplinas-medias",    ...gArgs });
  const { data: gFaltas,     isLoading: lFal,  isError: eFal  } = useGetGraficoQuery({ slug: "faltas-por-turma",      turno: filterTurno || undefined });
  const { data: gAprovacao,  isLoading: lApr,  isError: eApr  } = useGetGraficoQuery({ slug: "aprovacao-por-turma",   turno: filterTurno || undefined });
  const { data: gCorrelacao, isLoading: lCor,  isError: eCor  } = useGetGraficoQuery({ slug: "correlacao-frequencia", ...gArgs });
  const { data: gHeatmap,    isLoading: lHeat, isError: eHeat } = useGetGraficoQuery({ slug: "heatmap-disciplinas",   turno: filterTurno || undefined });

  // Situação chart data
  const situacaoData = useMemo(
    () => (gSituacao?.dados ?? []).map((d: any) => ({ name: d.situacao, value: d.total })),
    [gSituacao]
  );

  // Evolução trimestral
  const evolucaoData = useMemo(() => gEvolucao?.dados ?? [], [gEvolucao]);

  // Evolução por turno — detecta chaves dinamicamente
  const turnoChartData = useMemo(() => gTurnos?.dados ?? [], [gTurnos]);
  const turnoKeys = useMemo(() => {
    if (!turnoChartData.length) return [];
    return Object.keys(turnoChartData[0] as object).filter((k) => k !== "periodo");
  }, [turnoChartData]);

  // Disciplinas (ordenadas do pior para o melhor — já vem assim do backend)
  const disciplinasData = useMemo(() => gDisciplinas?.dados ?? [], [gDisciplinas]);

  // Heatmap pivot
  const { heatTurmas, heatDiscs, heatMatrix } = useMemo(() => {
    const raw = (gHeatmap?.dados ?? []) as { turma: string; disciplina: string; media: number }[];
    const heatTurmas  = Array.from(new Set(raw.map((r) => r.turma))).sort();
    const heatDiscs   = Array.from(new Set(raw.map((r) => r.disciplina))).sort();
    const heatMatrix: Record<string, Record<string, number | null>> = {};
    heatDiscs.forEach((d) => {
      heatMatrix[d] = {};
      heatTurmas.forEach((t) => { heatMatrix[d][t] = null; });
    });
    raw.forEach((r) => {
      if (heatMatrix[r.disciplina]) heatMatrix[r.disciplina][r.turma] = r.media;
    });
    return { heatTurmas, heatDiscs, heatMatrix };
  }, [gHeatmap]);

  // KPI card definitions
  const kpiCards = [
    {
      label:   "Total de Alunos",
      value:   kpis?.total_alunos ?? 0,
      helper:  "Estudantes ativos",
      icon:    GroupsIcon,
      color:   theme.palette.primary.main,
    },
    {
      label:   "Turmas Ativas",
      value:   kpis?.total_turmas ?? 0,
      helper:  "Séries monitoradas",
      icon:    SchoolIcon,
      color:   theme.palette.success.main,
    },
    {
      label:   "Média Geral",
      value:   kpis?.media_geral ?? 0,
      helper:  `${trimLabel} em andamento · máx. ${maxPts} pts`,
      icon:    AssessmentIcon,
      color:   theme.palette.info.main,
      format:  (v: number) => v.toFixed(1),
    },
    {
      label:   "Em Risco",
      value:   kpis?.alunos_em_risco ?? 0,
      helper:  `Abaixo de ${threshold} pts — 50% do ${trimLabel}`,
      icon:    WarningAmberIcon,
      color:   theme.palette.warning.main,
    },
    {
      label:   "Ocorrências Abertas",
      value:   kpis?.ocorrencias_abertas ?? 0,
      helper:  "Pendentes de resolução",
      icon:    WarningAmberIcon,
      color:   theme.palette.error.main,
    },
    {
      label:   "Comunicados (7 dias)",
      value:   kpis?.comunicados_recentes ?? 0,
      helper:  "Últimos 7 dias",
      icon:    NotificationsIcon,
      color:   theme.palette.secondary.main,
    },
  ];

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 8,
      fontSize: 12,
    },
  };

  if (kpisError) {
    return (
      <Box p={3}>
        <Alert severity="error">Erro ao carregar dados do dashboard</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>

      {/* ── Cabeçalho + Filtros ── */}
      <Box mb={3} display="flex" flexDirection={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} gap={2}>
        <Box>
          <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: "-0.02em", mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visão analítica do desempenho acadêmico
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <FilterListIcon fontSize="small" color="action" />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Turno</InputLabel>
            <Select value={filterTurno} label="Turno" onChange={(e) => { setFilterTurno(e.target.value); setFilterTurma(""); }}>
              <MenuItem value=""><em>Todos os turnos</em></MenuItem>
              {turnos.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Turma</InputLabel>
            <Select value={filterTurma} label="Turma" onChange={(e) => setFilterTurma(e.target.value)}>
              <MenuItem value=""><em>Todas as turmas</em></MenuItem>
              {turmas.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          {(filterTurno || filterTurma) && (
            <Chip label="Limpar filtros" size="small" onDelete={() => { setFilterTurno(""); setFilterTurma(""); }} />
          )}
        </Stack>
      </Box>

      {/* ── Seção 1: KPI Cards ── */}
      <Grid container spacing={2} mb={3}>
        {kpiCards.map((card, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, lg: 2 }}>
            {kpisLoading ? (
              <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} />
            ) : (
              <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", transition: "all 0.2s", "&:hover": { transform: "translateY(-2px)", boxShadow: 2 } }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: `${card.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                      <card.icon fontSize="small" />
                    </Box>
                  </Stack>
                  <Typography variant="h5" fontWeight={800} fontSize="1.5rem">
                    {card.format ? card.format(card.value) : fmt.format(card.value)}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} fontSize="0.8rem" color="text.primary">
                    {card.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                    {card.helper}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        ))}
      </Grid>

      {/* ── Seção 2: Situação dos Alunos + Distribuição de Pontos ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Panorama Geral
      </Typography>
      <Grid container spacing={2} mb={3}>

        {/* Rosca: Situação */}
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Situação dos Alunos" subtitle="Distribuição por grupo de situação" height={280} loading={lSit} error={eSit} empty={!lSit && !situacaoData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={situacaoData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {situacaoData.map((entry: any, i: number) => (
                    <Cell key={i} fill={SITUACAO_COLORS[entry.name] ?? "#d1d5db"} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt.format(v), "Alunos"]} />
                <Legend verticalAlign="bottom" height={40} iconSize={10} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Histograma: Distribuição de pontos */}
        <Grid size={{ xs: 12, md: 8 }}>
          <ChartCard title="Distribuição de Pontuação" subtitle={`Quantidade de alunos por faixa de pontos — aprovação a partir de ${threshold} pts`} height={280} loading={lGau} error={eGau} empty={!lGau && !(gGauss?.dados?.length)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gGauss?.dados ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt.format(v), "Alunos"]} />
                <ReferenceLine x={`${threshold}–${threshold + 10}`} stroke={theme.palette.success.main} strokeDasharray="4 4" label={{ value: `≥${threshold}`, fill: theme.palette.success.main, fontSize: 10 }} />
                <Bar dataKey="alunos" radius={[3, 3, 0, 0]}>
                  {(gGauss?.dados ?? []).map((entry: any, i: number) => {
                    const faixaMin = parseInt(entry.faixa);
                    const color = faixaMin >= threshold ? theme.palette.success.main : faixaMin >= threshold * 0.7 ? theme.palette.warning.main : theme.palette.error.main;
                    return <Cell key={i} fill={color} fillOpacity={0.85} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Seção 3: Evolução Trimestral ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Evolução Trimestral
      </Typography>
      <Grid container spacing={2} mb={3}>

        {/* Área: Evolução média por trimestre */}
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Progressão de Pontos" subtitle="Média da escola por trimestre vs. meta mínima" height={260} loading={lEvo} error={eEvo} empty={!lEvo && !evolucaoData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucaoData as any[]} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMedia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="trimestre" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} domain={[0, "dataMax + 5"]} />
                <Tooltip {...tooltipStyle} formatter={(v: any, name: string) => [Number(v).toFixed(1), name === "media" ? "Média" : name === "meta" ? "Meta mínima" : name]} />
                <Area type="monotone" dataKey="media" stroke={theme.palette.primary.main} strokeWidth={2.5} fill="url(#gradMedia)" dot={{ r: 5, fill: theme.palette.primary.main }} name="media" />
                <Line type="monotone" dataKey="meta" stroke={theme.palette.warning.main} strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="meta" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Linhas: Comparativo por turno */}
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="Comparativo por Turno" subtitle="Média de cada turno ao longo dos trimestres" height={260} loading={lTur} error={eTur} empty={!lTur && !turnoChartData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoChartData as any[]} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="periodo" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                {turnoKeys.map((turno, i) => (
                  <Line key={turno} type="monotone" dataKey={turno} stroke={TURNO_COLORS[i % TURNO_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Seção 4: Disciplinas ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Por Disciplina
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Desempenho por Disciplina" subtitle="Média de pontos por componente curricular — ordenado do menor para o maior" height={300} loading={lDis} error={eDis} empty={!lDis && !disciplinasData.length}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disciplinasData as any[]} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                <XAxis type="number" domain={[0, maxPts]} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="disciplina" width={170} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [Number(v).toFixed(1) + " pts", "Média"]} />
                <ReferenceLine x={threshold} stroke={theme.palette.warning.main} strokeDasharray="4 4" label={{ value: `Meta ${threshold}`, fill: theme.palette.warning.main, fontSize: 10, position: "top" }} />
                <Bar dataKey="media" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => v.toFixed(1) }}>
                  {(disciplinasData as any[]).map((entry: any, i: number) => (
                    <Cell key={i} fill={getValueColor(entry.media, threshold, theme)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Seção 5: Por Turma ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Por Turma
      </Typography>
      <Grid container spacing={2} mb={3}>

        {/* Faltas por turma */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Faltas por Turma" subtitle="Total acumulado de faltas — turmas com maior absenteísmo" height={280} loading={lFal} error={eFal} empty={!lFal && !(gFaltas?.dados?.length)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gFaltas?.dados ?? []} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                <XAxis type="number" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="turma" width={80} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: any, name: string) => [fmt.format(v), name === "faltas" ? "Total de Faltas" : "Média/Aluno"]} />
                <Bar dataKey="faltas" fill={theme.palette.error.main} fillOpacity={0.75} radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Taxa de aprovação por turma */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Taxa de Aprovação por Turma" subtitle={`% de alunos com média ≥ ${threshold} pts`} height={280} loading={lApr} error={eApr} empty={!lApr && !(gAprovacao?.dados?.length)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gAprovacao?.dados ?? []} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="turma" width={80} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: any, name: string) => [name === "taxa_aprovacao" ? `${v}%` : v, name === "taxa_aprovacao" ? "Aprovação" : name === "em_risco" ? "Em Risco" : "Aprovados"]} />
                <ReferenceLine x={75} stroke={theme.palette.success.main} strokeDasharray="3 3" />
                <Bar dataKey="taxa_aprovacao" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, formatter: (v: number) => `${v}%` }}>
                  {(gAprovacao?.dados ?? []).map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.taxa_aprovacao >= 75 ? theme.palette.success.main : entry.taxa_aprovacao >= 50 ? theme.palette.warning.main : theme.palette.error.main} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Seção 6: Ranking de Turmas (tabela) ── */}
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12 }}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" fontWeight={700} fontSize="1rem">Ranking de Turmas</Typography>
              <Typography variant="caption" color="text.secondary">Comparativo de desempenho — ordenado por média (maior → menor)</Typography>
            </Box>
            <Box sx={{ overflowX: "auto" }}>
              {lApr ? (
                <Box p={2}><Skeleton height={160} /></Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Turma</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Alunos</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Média (pts)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Aprovados</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Em Risco</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>Taxa Aprov.</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.75rem", minWidth: 120 }}>Desempenho</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(gAprovacao?.dados ?? []).map((row: any, i: number) => {
                      const barColor = row.taxa_aprovacao >= 75 ? theme.palette.success.main : row.taxa_aprovacao >= 50 ? theme.palette.warning.main : theme.palette.error.main;
                      return (
                        <TableRow key={row.turma} hover>
                          <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", fontWeight: 600 }}>{i + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>{row.turma}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{row.total}</TableCell>
                          <TableCell align="right">
                            <Chip label={row.media.toFixed(1)} size="small" sx={{ bgcolor: `${getValueColor(row.media, threshold, theme)}18`, color: getValueColor(row.media, threshold, theme), fontWeight: 700, fontSize: "0.7rem", height: 20 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", color: "success.dark" }}>{row.aprovados}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", color: "error.main", fontWeight: row.em_risco > 0 ? 700 : 400 }}>{row.em_risco}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.8rem", fontWeight: 700, color: barColor }}>{row.taxa_aprovacao}%</TableCell>
                          <TableCell>
                            <MuiTooltip title={`${row.taxa_aprovacao}% aprovados`}>
                              <Box sx={{ height: 8, borderRadius: 4, bgcolor: "grey.200", overflow: "hidden" }}>
                                <Box sx={{ height: "100%", width: `${row.taxa_aprovacao}%`, bgcolor: barColor, borderRadius: 4, transition: "width 0.4s" }} />
                              </Box>
                            </MuiTooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* ── Seção 7: Correlação Frequência × Nota ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Análise de Risco
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12 }}>
          <ChartCard
            title="Correlação: Faltas × Desempenho"
            subtitle={`Cada ponto é um aluno — quadrante superior esquerdo (poucos pontos + muitas faltas) = zona crítica`}
            height={340}
            loading={lCor}
            error={eCor}
            empty={!lCor && !(gCorrelacao?.dados?.length)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis
                  dataKey="media"
                  type="number"
                  name="Média"
                  domain={[0, maxPts]}
                  label={{ value: "Média de Pontos", position: "insideBottomRight", offset: -10, fontSize: 11, fill: theme.palette.text.secondary }}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="faltas"
                  type="number"
                  name="Faltas"
                  label={{ value: "Faltas", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: theme.palette.text.secondary }}
                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis range={[25, 50]} />
                <Tooltip
                  {...tooltipStyle}
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as any;
                    return (
                      <Box sx={{ p: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 2, fontSize: 12 }}>
                        <Typography variant="caption" fontWeight={700} display="block">{d.nome}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.turma}</Typography>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" display="block">Média: <b>{d.media} pts</b></Typography>
                        <Typography variant="caption" display="block">Faltas: <b>{d.faltas}</b></Typography>
                      </Box>
                    );
                  }}
                />
                {/* Linhas de referência para zona de risco */}
                <ReferenceLine x={threshold} stroke={theme.palette.warning.main} strokeDasharray="4 4" label={{ value: `${threshold} pts`, fill: theme.palette.warning.main, fontSize: 10 }} />
                <ReferenceLine y={15} stroke={theme.palette.error.light} strokeDasharray="4 4" label={{ value: "15 faltas", fill: theme.palette.error.light, fontSize: 10 }} />
                <Scatter
                  data={gCorrelacao?.dados ?? []}
                  fill={theme.palette.primary.main}
                  fillOpacity={0.55}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Seção 8: Heatmap Disciplina × Turma ── */}
      <Typography variant="overline" color="text.secondary" fontWeight={700} display="block" mb={1.5}>
        Mapa de Calor — Disciplina × Turma
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12 }}>
          <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" fontWeight={700} fontSize="1rem">Heatmap de Desempenho</Typography>
              <Typography variant="caption" color="text.secondary">
                Média por disciplina em cada turma — verde ≥ {threshold} pts, vermelho &lt; {threshold} pts
              </Typography>
            </Box>
            <Box sx={{ overflowX: "auto", p: 2 }}>
              {lHeat ? (
                <Skeleton height={200} />
              ) : eHeat || !heatDiscs.length ? (
                <Box py={4} textAlign="center">
                  <Typography color="text.secondary" variant="body2">Sem dados disponíveis</Typography>
                </Box>
              ) : (
                <Table size="small" sx={{ minWidth: 400 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "grey.50", minWidth: 160 }}>Disciplina</TableCell>
                      {heatTurmas.map((t) => (
                        <TableCell key={t} align="center" sx={{ fontWeight: 700, fontSize: "0.7rem", bgcolor: "grey.50", minWidth: 70 }}>{t}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {heatDiscs.map((disc) => (
                      <TableRow key={disc}>
                        <TableCell sx={{ fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>{disc}</TableCell>
                        {heatTurmas.map((t) => {
                          const val = heatMatrix[disc]?.[t] ?? null;
                          return (
                            <MuiTooltip key={t} title={val !== null ? `${disc} · ${t}: ${val} pts` : "Sem dados"}>
                              <TableCell
                                align="center"
                                sx={{
                                  bgcolor:    heatCell(val, threshold),
                                  fontSize:   "0.72rem",
                                  fontWeight: val !== null ? 700 : 400,
                                  color:      val === null ? undefined : val >= threshold ? "#14532d" : "#7f1d1d",
                                  cursor:     "default",
                                  transition: "filter 0.15s",
                                  "&:hover":  { filter: "brightness(0.9)" },
                                }}
                              >
                                {val !== null ? val.toFixed(0) : "—"}
                              </TableCell>
                            </MuiTooltip>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
            {/* Legenda do heatmap */}
            {!lHeat && heatDiscs.length > 0 && (
              <Box px={2} pb={2} display="flex" alignItems="center" gap={1.5}>
                <Typography variant="caption" color="text.secondary">Legenda:</Typography>
                {[0, 25, 50, 75, 100].map((v) => (
                  <Box key={v} display="flex" alignItems="center" gap={0.5}>
                    <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: heatCell(v, threshold) }} />
                    <Typography variant="caption" color="text.secondary">{v}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

    </Box>
  );
};
