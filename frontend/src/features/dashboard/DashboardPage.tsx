import { useMemo } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid2 as Grid,
  Skeleton,
  Typography,
  Stack,
  useTheme,
  Chip
} from "@mui/material";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import GroupsIcon from "@mui/icons-material/Groups";
import SchoolIcon from "@mui/icons-material/School";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AssessmentIcon from "@mui/icons-material/Assessment";

import { useGetDashboardKpisQuery, useGetGraficoQuery } from "../../lib/api";

const formatNumber = new Intl.NumberFormat("pt-BR");

type KpiCard = {
  label: string;
  value: number;
  helper: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
  formatter?: (value: number) => string;
};

export const DashboardPage = () => {
  const theme = useTheme();
  const { data, isLoading, isError } = useGetDashboardKpisQuery();
  const {
    data: situacaoResponse,
    isLoading: isSituacaoLoading,
    isError: isSituacaoError
  } = useGetGraficoQuery({ slug: "situacao-distribuicao" });

  const {
    data: disciplinasResponse,
    isLoading: isDisciplinasLoading,
    isError: isDisciplinasError
  } = useGetGraficoQuery({ slug: "disciplinas-medias" });

  const situacaoChartData = useMemo(
    () =>
      (situacaoResponse?.dados ?? []).map((entry) => {
        const typedEntry = entry as { situacao?: unknown; total?: unknown };
        const situacao = typeof typedEntry.situacao === "string" ? typedEntry.situacao : "Sem classificação";
        const totalValue =
          typeof typedEntry.total === "number"
            ? typedEntry.total
            : Number(typeof typedEntry.total === "string" ? typedEntry.total : 0);
        return { name: situacao, value: totalValue };
      }),
    [situacaoResponse]
  );

  const isSituacaoEmpty = !isSituacaoLoading && situacaoChartData.length === 0;
  const disciplinasData = useMemo(() => {
    const dados = disciplinasResponse?.dados || [];
    return [...dados].sort((a: any, b: any) => b.media - a.media).slice(0, 10);
  }, [disciplinasResponse]);

  const isDisciplinasEmpty = !isDisciplinasLoading && disciplinasData.length === 0;

  const kpiCards: KpiCard[] = [
    {
      label: "Total de Alunos",
      value: data?.total_alunos ?? 0,
      helper: "Estudantes ativos",
      icon: GroupsIcon,
      color: theme.palette.primary.main,
      trend: "+12% vs ano anterior"
    },
    {
      label: "Turmas Ativas",
      value: data?.total_turmas ?? 0,
      helper: "Séries monitoradas",
      icon: SchoolIcon,
      color: theme.palette.success.main,
      trend: "Estável"
    },
    {
      label: "Média Geral",
      value: data?.media_geral ?? 0,
      helper: "Desempenho acadêmico",
      icon: AssessmentIcon,
      color: theme.palette.info.main,
      formatter: (val) => val.toFixed(1)
    },
    {
      label: "Em Risco",
      value: data?.alunos_em_risco ?? 0,
      helper: "Média < 50",
      icon: WarningAmberIcon,
      color: theme.palette.warning.main
    },
    {
      label: "Ocorrências Abertas",
      value: data?.ocorrencias_abertas ?? 0,
      helper: "Não resolvidas",
      icon: WarningAmberIcon,
      color: theme.palette.error.main
    },
    {
      label: "Comunicados (7 dias)",
      value: data?.comunicados_recentes ?? 0,
      helper: "Últimos 7 dias",
      icon: AssessmentIcon,
      color: theme.palette.secondary.main
    }
  ];

  const COLORS = {
    Aprovado: theme.palette.success.main,
    Recuperação: theme.palette.warning.main,
    Reprovado: theme.palette.error.main,
    Outros: theme.palette.grey[500]
  };

  if (isError) {
    return (
      <Box sx={{ minHeight: "100vh", p: 3 }}>
        <Alert severity="error">Erro ao carregar dados do dashboard</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
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
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Visão geral do desempenho acadêmico
        </Typography>
      </Box>

      <Grid container spacing={2} mb={3}>
        {kpiCards.map((card, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
            {isLoading ? (
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
            ) : (
              <Card
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  height: "100%",
                  transition: "all 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 1
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: `${card.color}10`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: card.color
                      }}
                    >
                      <card.icon fontSize="small" />
                    </Box>
                    {card.trend && (
                      <Chip
                        label={card.trend}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.625rem",
                          fontWeight: 600
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="h4" fontWeight={700} fontSize="1.75rem" mb={0.5}>
                    {card.formatter ? card.formatter(card.value) : formatNumber.format(card.value)}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} fontSize="0.875rem" color="text.primary" mb={0.25}>
                    {card.label}
                  </Typography>
                  <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                    {card.helper}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              height: "100%"
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" fontWeight={700} fontSize="1.125rem">
                Desempenho por Disciplina
              </Typography>
              <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                Top 10 disciplinas por média geral
              </Typography>
            </Box>
            <CardContent sx={{ p: 3, height: { xs: 300, md: 400 } }}>

              {isDisciplinasLoading ? (
                <Skeleton variant="rectangular" height="100%" />
              ) : isDisciplinasError ? (
                <Alert severity="error">Erro ao carregar dados</Alert>
              ) : isDisciplinasEmpty ? (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="text.secondary">Sem dados disponíveis</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disciplinasData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis
                      dataKey="disciplina"
                      tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={80}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 4
                      }}
                    />
                    <Bar dataKey="media" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              height: "100%"
            }}
          >
            <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" fontWeight={700} fontSize="1.125rem">
                Situação dos Alunos
              </Typography>
              <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                Distribuição por status
              </Typography>
            </Box>
            <CardContent sx={{ p: 3, height: { xs: 300, md: 400 } }}>

              {isSituacaoLoading ? (
                <Skeleton variant="circular" width={200} height={200} sx={{ mx: "auto" }} />
              ) : isSituacaoError ? (
                <Alert severity="error">Erro ao carregar dados</Alert>
              ) : isSituacaoEmpty ? (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="text.secondary">Sem dados disponíveis</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={situacaoChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {situacaoChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.Outros} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
