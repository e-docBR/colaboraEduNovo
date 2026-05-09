import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  Paper,
  Divider,
  Fade,
  Menu
} from "@mui/material";
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import TimelineIcon from "@mui/icons-material/Timeline";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Legend,
  Area,
  AreaChart,
  Scatter,
  ScatterChart,
  ZAxis
} from "recharts";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import InsightsIcon from "@mui/icons-material/Insights";
import {
  useGetGraficoQuery,
  useGetNotasFiltrosQuery,
  useListTurmasQuery,
  type GraficoQueryArgs
} from "../../lib/api";
import { CHARTS, CHARTS_BY_SLUG, type ChartSlug, TRIMESTRES, TURNOS } from "./config";

// Professional palette - Sharp Academic Precision
const COLORS = [
  "#14b8a6", // Teal-500 (Primary)
  "#10b981", // Emerald-500 (Secondary)
  "#06b6d4", // Cyan-500
  "#f59e0b", // Amber-500
  "#ef4444", // Red-500
  "#8b5cf6", // Violet-500 (accent only)
  "#64748b", // Slate-500
];

const STATUS_COLORS: Record<string, string> = {
  "Aprovado": "#10b981",     // Emerald
  "Recuperação": "#f59e0b", // Amber
  "Reprovado": "#ef4444",   // Red
  "Outros": "#94a3b8"       // Slate
};

const CHART_ICONS: Record<string, React.ElementType> = {
  "disciplinas-medias": BarChartIcon,
  "medias-por-trimestre": EqualizerIcon,
  "turmas-trimestre": TimelineIcon,
  "situacao-distribuicao": PieChartIcon,
  "faltas-por-turma": BarChartIcon,
  "heatmap-disciplinas": GridOnIcon,
  "gauss-escola": InsightsIcon,
  "correlacao-frequencia": ScatterPlotIcon,
  "evolucao-turnos": TimelineIcon,
};

export const GraficosPage = () => {
  const theme = useTheme();
  const [chartSlug, setChartSlug] = useState<ChartSlug>("disciplinas-medias");
  const [turno, setTurno] = useState("");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [trimestre, setTrimestre] = useState("3");
  const [disciplina, setDisciplina] = useState("");
  const chart = CHARTS_BY_SLUG[chartSlug];

  const token = useSelector((state: RootState) => state.auth.accessToken);
  const tenantId = useSelector((state: RootState) => state.app.tenantId);
  const academicYearId = useSelector((state: RootState) => state.app.academicYearId);
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [exportSnackbar, setExportSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "error"
  });

  const handleExportClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    handleExportClose();
    try {
      const qs = new URLSearchParams();
      if (chart.supportsTurno && turno) qs.set("turno", turno);
      if (chart.supportsSerie && serie) qs.set("serie", serie);
      if (chart.supportsTurma && turma) qs.set("turma", turma);
      if (chart.supportsTrimestre && trimestre) qs.set("trimestre", trimestre);
      if (chart.supportsDisciplina && disciplina) qs.set("disciplina", disciplina);
      qs.set("format", format);

      const url = `/api/v1/relatorios/${chartSlug}?${qs.toString()}`;
      
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`
      };
      if (tenantId) headers["X-Tenant-ID"] = String(tenantId);
      if (academicYearId) headers["x-academic-year-id"] = String(academicYearId);

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Erro na exportação");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `relatorio_${chartSlug}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      setExportSnackbar({ open: true, message: "Erro ao exportar relatório. Tente novamente.", severity: "error" });
    }
  };

  const { data: turmasData } = useListTurmasQuery();
  const turmaOptions = useMemo(() => turmasData?.items ?? [], [turmasData]);
  const serieOptions = useMemo(() => {
    const items = turmasData?.items ?? [];
    const series = new Set<string>();
    items.forEach((item) => {
      const parts = (item.turma ?? "").split(" ");
      const prefix = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : item.turma;
      if (prefix) {
        series.add(prefix);
      }
    });
    return Array.from(series).sort();
  }, [turmasData]);

  const { data: notasFiltrosData } = useGetNotasFiltrosQuery();
  const disciplinaOptions = useMemo(() => {
    const list = notasFiltrosData?.disciplinas ?? [];
    return [...list].sort();
  }, [notasFiltrosData]);

  const queryArgs = useMemo<GraficoQueryArgs>(() => {
    const params: GraficoQueryArgs = { slug: chartSlug };
    if (chart.supportsTurno && turno) params.turno = turno;
    if (chart.supportsSerie && serie) params.serie = serie;
    if (chart.supportsTurma && turma) params.turma = turma;
    if (chart.supportsTrimestre && trimestre) params.trimestre = trimestre;
    if (chart.supportsDisciplina && disciplina) params.disciplina = disciplina;
    return params;
  }, [chartSlug, chart, turno, serie, turma, trimestre, disciplina]);

  const { data, isLoading, isFetching, isError } = useGetGraficoQuery(queryArgs);
  const rawData = useMemo(() => {
    const rows = Array.isArray(data?.dados) ? data?.dados : [];
    if (chart.maxItems) {
      return rows.slice(0, chart.maxItems);
    }
    return rows;
  }, [chart, data]);

  const heatmap = useMemo(() => {
    if (chart.type !== "heatmap") return null;
    const turmasSet = new Set<string>();
    const disciplinasSet = new Set<string>();
    const values = new Map<string, number>();
    for (const row of rawData as Array<Record<string, unknown>>) {
      const turmaNome = String(row.turma ?? "-");
      const disciplina = String(row.disciplina ?? "-");
      turmasSet.add(turmaNome);
      disciplinasSet.add(disciplina);
      const media = typeof row.media === "number" ? row.media : Number(row.media ?? 0);
      values.set(`${turmaNome}-${disciplina}`, Math.round(media * 10) / 10);
    }
    return {
      turmas: Array.from(turmasSet),
      disciplinas: Array.from(disciplinasSet),
      values
    };
  }, [chart.type, rawData]);

  const handleReset = () => {
    setTurno("");
    setSerie("");
    setTurma("");
    setTrimestre("3");
    setDisciplina("");
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card sx={{ p: 1.5, boxShadow: theme.shadows[4], border: "none", backgroundColor: "rgba(255, 255, 255, 0.95)" }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>{label}</Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box width={8} height={8} borderRadius="50%" bgcolor={entry.color || entry.fill} />
              <Typography variant="body2" color="text.secondary">
                {entry.name}: <span style={{ fontWeight: 600, color: theme.palette.text.primary }}>{entry.value}</span>
              </Typography>
            </Box>
          ))}
        </Card>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (chart.type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Tooltip content={<CustomChartTooltip />} />
            <Legend verticalAlign="bottom" height={36} />
            <Pie
              data={rawData}
              dataKey={chart.valueKey ?? "total"}
              nameKey="situacao"
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              paddingAngle={2}
            >
              {rawData.map((entry: any, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.situacao] || COLORS[index % COLORS.length]}
                  strokeWidth={0}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "line") {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={rawData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey={chart.type === "line" && chart.slug === "evolucao-turnos" ? "periodo" : "trimestre"} // Adaptation for multiple line charts
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }} />
            {chart.slug === "evolucao-turnos" ? (
              // Hardcoded assumption for this specific chart based on data structure
              <>
                <Line type="monotone" dataKey="matutino" name="Matutino" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="vespertino" name="Vespertino" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
                <Legend />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey={chart.yKey ?? "media"}
                stroke={COLORS[0]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 7 }}
              />
            )}

          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "area") {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={rawData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey={chart.xKey}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomChartTooltip />} />
            <Area
              type="monotone"
              dataKey={chart.yKey ?? "value"}
              stroke={COLORS[0]}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
            <XAxis
              type="number"
              dataKey={chart.xKey}
              name="Frequência"
              unit="%"
              domain={[0, 100]}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey={chart.yKey}
              name="Média"
              domain={[0, 20]}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" range={[100, 100]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter name="Alunos" data={rawData} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (chart.type === "heatmap" && heatmap) {
      return (
        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: "text.secondary" }}>Turma</TableCell>
                {heatmap.disciplinas.map((disciplina) => (
                  <TableCell key={disciplina} align="center" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.75rem" }}>
                    {disciplina.substring(0, 3).toUpperCase()}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {heatmap.turmas.map((turmaNome) => (
                <TableRow key={turmaNome} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{turmaNome}</TableCell>
                  {heatmap.disciplinas.map((disciplina) => {
                    const value = heatmap.values.get(`${turmaNome}-${disciplina}`) ?? 0;
                    // Color scale blue -> white -> red ?? No, usually heatmap is one color.
                    // Let's use opacity of Primary Color.
                    // Simple heatmap logic: <50 red, >70 green, else yellow
                    let bgColor = "transparent";
                    let textColor = theme.palette.text.primary;

                    if (value > 0) {
                      if (value < 60) bgColor = "#fee2e2"; // Red 100
                      else if (value < 80) bgColor = "#fef9c3"; // Yellow 100
                      else bgColor = "#dcfce7"; // Green 100
                    }

                    return (
                      <TableCell
                        key={`${turmaNome}-${disciplina}`}
                        align="center"
                        sx={{
                          backgroundColor: bgColor,
                          color: textColor,
                          transition: "all 0.2s"
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>{value.toFixed(1)}</Typography>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={rawData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
          <XAxis
            dataKey={chart.xKey ?? "disciplina"}
            tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={60}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar
            dataKey={chart.yKey ?? "media"}
            fill={COLORS[0]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const hasData = rawData.length > 0 || chart.type === "heatmap";

  return (
    <Box sx={{ minHeight: "100vh" }}>
      {/* Header - Compact */}
      <Box mb={3}>
        <Typography
          variant="h3"
          fontWeight={800}
          sx={{
            letterSpacing: "-0.02em",
            color: "text.primary",
            mb: 0.5
          }}
        >
          Análise Visual
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Exploração profunda de dados com métricas interativas
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Navigation / Selection Panel */}
        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={2}>
            <Typography variant="overline" color="text.secondary" fontWeight={700} pl={1}>
              Disponíveis ({CHARTS.length})
            </Typography>
            {CHARTS.map((chartItem) => {
              const isActive = chartItem.slug === chartSlug;
              const Icon = CHART_ICONS[chartItem.slug] ?? BarChartIcon;

              return (
                <Card
                  key={chartItem.slug}
                  elevation={0}
                  sx={{
                    borderRadius: 1,
                    bgcolor: isActive ? "background.paper" : "transparent",
                    border: "1px solid",
                    borderColor: isActive ? "primary.main" : "transparent",
                    transition: "all 0.2s",
                    "&:hover": {
                      bgcolor: "background.paper",
                      transform: "translateX(2px)",
                      borderColor: isActive ? "primary.main" : "divider"
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => setChartSlug(chartItem.slug)}
                    sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-start" }}
                  >
                    <Box
                      sx={{
                        p: 0.75,
                        borderRadius: 1,
                        bgcolor: isActive ? `${theme.palette.primary.main}10` : "action.hover",
                        color: isActive ? "primary.main" : "text.secondary"
                      }}
                    >
                      <Icon fontSize="small" color={isActive ? "primary" : "inherit"} />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="body2" fontWeight={600} fontSize="0.875rem" color={isActive ? "primary.main" : "text.primary"} noWrap>
                        {chartItem.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontSize="0.75rem" sx={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {chartItem.description}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        </Grid>

        {/* Main Chart Area */}
        <Grid size={{ xs: 12, lg: 9 }}>
          <Stack spacing={3}>
            {/* Filters Toolbar */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "center"
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mr="auto">
                <FilterListIcon color="action" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={600} fontSize="0.875rem">Filtros</Typography>
              </Box>

              <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

              {chart.supportsTurno && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Turno</InputLabel>
                  <Select value={turno} label="Turno" onChange={(e) => setTurno(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    {TURNOS.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {chart.supportsSerie && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Série</InputLabel>
                  <Select value={serie} label="Série" onChange={(e) => setSerie(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {serieOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {chart.supportsTurma && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Turma</InputLabel>
                  <Select value={turma} label="Turma" onChange={(e) => setTurma(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {turmaOptions.map((o) => <MenuItem key={o.turma} value={o.turma}>{o.turma}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {chart.supportsDisciplina && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Disciplina</InputLabel>
                  <Select value={disciplina} label="Disciplina" onChange={(e) => setDisciplina(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {disciplinaOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {chart.supportsTrimestre && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Trimestre</InputLabel>
                  <Select value={trimestre} label="Trimestre" onChange={(e) => setTrimestre(e.target.value)}>
                    {TRIMESTRES.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              <Button
                startIcon={<RestartAltIcon />}
                onClick={handleReset}
                variant="outlined"
                size="small"
                sx={{ ml: "auto", borderStyle: "dashed", borderRadius: 2 }}
                disabled={!turno && !serie && !turma && !disciplina && trimestre === "3"}
              >
                Limpar
              </Button>
              
              <Button
                variant="contained"
                size="small"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportClick}
                disabled={!hasData || isLoading || isFetching}
                sx={{ borderRadius: 2 }}
              >
                Exportar
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleExportClose}
              >
                <MenuItem onClick={() => handleExport("xlsx")}>Exportar XLSX (Excel)</MenuItem>
                <MenuItem onClick={() => handleExport("csv")}>Exportar CSV</MenuItem>
              </Menu>
            </Paper>

            {/* Chart Card */}
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
              <Box p={2.5} borderBottom="1px solid" borderColor="divider" bgcolor={(theme) => theme.palette.mode === "light" ? "grey.50" : "grey.900"}>
                <Typography variant="h6" fontWeight={700} fontSize="1.125rem">
                  {chart.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.75rem" mt={0.5}>
                  {chart.description}
                </Typography>
              </Box>

              <CardContent sx={{ p: 3, minHeight: 450 }}>
                <Fade in={!isLoading && !isFetching} timeout={500}>
                  <Box width="100%" height="100%">
                    {isLoading || isFetching ? (
                      <Stack alignItems="center" justifyContent="center" height={400} spacing={2}>
                        <CircularProgress thickness={4} />
                        <Typography color="text.secondary" variant="caption">Carregando dados...</Typography>
                      </Stack>
                    ) : isError ? (
                      <Alert severity="error" variant="outlined">Não foi possível carregar os dados visualizados.</Alert>
                    ) : hasData ? (
                      renderChart()
                    ) : (
                      <Stack alignItems="center" justifyContent="center" height={400} spacing={2} bgcolor="background.paper" borderRadius={3} border="1px dashed" borderColor="divider">
                        <ShowChartIcon sx={{ fontSize: 60, color: "divider" }} />
                        <Typography color="text.secondary">Nenhum dado encontrado com os filtros atuais.</Typography>
                        <Button variant="text" onClick={handleReset}>Redefinir Filtros</Button>
                      </Stack>
                    )}
                  </Box>
                </Fade>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Snackbar
        open={exportSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setExportSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={exportSnackbar.severity} onClose={() => setExportSnackbar((s) => ({ ...s, open: false }))}>
          {exportSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
