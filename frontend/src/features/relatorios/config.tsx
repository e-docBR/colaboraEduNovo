import type { ReactNode, ElementType } from "react";
import {
  EmojiEvents,
  TrendingDown,
  WarningAmber,
  AssignmentLate,
  GridOn,
  ScatterPlot,
  Radar,
  School,
  Groups,
  TrendingUp,
  Assessment,
  QueryStats,
  Gavel,
  MarkEmailRead,
  Timeline,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
} from "@mui/icons-material";
import { Chip } from "@mui/material";

export type RelatorioSlug =
  | "turmas-mais-faltas"
  | "melhores-medias"
  | "alunos-em-risco"
  | "disciplinas-notas-baixas"
  | "melhores-alunos"
  | "performance-heatmap"
  | "attendance-correlation"
  | "class-radar"
  | "radar-abandono"
  | "comparativo-eficiencia"
  | "top-movers"
  | "alunos-abaixo-trimestre"
  | "ocorrencias-reincidentes"
  | "comunicados-engajamento"
  | "faltas-por-disciplina"
  | "distribuicao-situacao"
  | "evolucao-trimestres";

export type RelatorioColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render: (row: Record<string, unknown>) => ReactNode;
};

export type RelatorioFilters = {
  turno?: boolean;
  serie?: boolean;
  turma?: boolean;
  disciplina?: boolean;
  trimestre?: boolean;
};

export type RelatorioDefinition = {
  slug: RelatorioSlug;
  title: string;
  description: string;
  type?: "table" | "heatmap" | "scatter" | "radar" | "bar" | "pie" | "line";
  columns: RelatorioColumn[];
  icon: ElementType;
  span?: 1 | 2 | 3;
  variant: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
  filters?: RelatorioFilters;
  category: "alertas" | "desempenho" | "estatisticas";
};

const asNumber = (value: unknown, digits = 1) => {
  if (typeof value === "number") return value.toFixed(digits);
  if (typeof value === "string" && value) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed.toFixed(digits);
  }
  return "-";
};

export const RELATORIOS: RelatorioDefinition[] = [
  {
    slug: "turmas-mais-faltas",
    title: "Turmas com Alta Evasão",
    description: "Identifique turmas com índices críticos de faltas para intervenção.",
    type: "table",
    icon: Groups,
    span: 1,
    variant: "danger",
    filters: { turno: true, serie: true, disciplina: true },
    category: "alertas",
    columns: [
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      {
        key: "faltas",
        label: "Média de faltas por Aluno",
        align: "right",
        render: (row) => asNumber(row.faltas, 1),
      },
    ],
  },
  {
    slug: "alunos-em-risco",
    title: "Alunos em Risco",
    description: "Estudantes com média global inferior a 50.0.",
    type: "table",
    icon: TrendingDown,
    span: 1,
    variant: "warning",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "alertas",
    columns: [
      { key: "nome", label: "Aluno", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      {
        key: "media",
        label: "Média",
        align: "right",
        render: (row) => asNumber(row.media, 1),
      },
      {
        key: "faltas",
        label: "Faltas",
        align: "right",
        render: (row) => row.faltas as ReactNode,
      },
    ],
  },
  {
    slug: "disciplinas-notas-baixas",
    title: "Alertas de Disciplina",
    description: "Mapeamento de desvios negativos de performance por matéria.",
    type: "table",
    icon: AssignmentLate,
    span: 1,
    variant: "warning",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "alertas",
    columns: [
      { key: "disciplina", label: "Disciplina", render: (row) => row.disciplina as ReactNode },
      {
        key: "media",
        label: "Média",
        align: "right",
        render: (row) => asNumber(row.media, 1),
      },
    ],
  },
  {
    slug: "melhores-medias",
    title: "Ranking de Turmas",
    description: "Comparativo geral de desempenho acadêmico.",
    type: "table",
    icon: Assessment,
    span: 2,
    variant: "primary",
    filters: { turno: true, serie: true, disciplina: true },
    category: "desempenho",
    columns: [
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "turno", label: "Turno", render: (row) => row.turno as ReactNode },
      {
        key: "media",
        label: "Média",
        align: "right",
        render: (row) => asNumber(row.media, 1),
      },
    ],
  },
  {
    slug: "melhores-alunos",
    title: "Quadro de Honra",
    description: "Top 10 alunos com as maiores médias globais.",
    type: "table",
    icon: EmojiEvents,
    span: 1,
    variant: "success",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "desempenho",
    columns: [
      { key: "nome", label: "Aluno", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "turno", label: "Turno", render: (row) => row.turno as ReactNode },
      {
        key: "media",
        label: "Média",
        align: "right",
        render: (row) => asNumber(row.media, 2),
      },
    ],
  },
  {
    slug: "performance-heatmap",
    title: "Mapa Térmico",
    description: "Visão matricial macro de Notas x Disciplina x Turma.",
    type: "heatmap",
    icon: GridOn,
    span: 1,
    variant: "info",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "estatisticas",
    columns: [],
  },
  {
    slug: "attendance-correlation",
    title: "Correlação: Freq. vs Notas",
    description: "Análise gráfica do impacto da assiduidade no desempenho.",
    type: "scatter",
    icon: ScatterPlot,
    span: 1,
    variant: "secondary",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "estatisticas",
    columns: [],
  },
  {
    slug: "class-radar",
    title: "Radar de Competências",
    description: "Comparativo multidimensional entre turmas.",
    type: "radar",
    icon: Radar,
    span: 1,
    variant: "primary",
    filters: { turno: true, serie: true, disciplina: true },
    category: "estatisticas",
    columns: [],
  },
  {
    slug: "radar-abandono",
    title: "Radar de Abandono",
    description: "PREDITIVO: Alunos com alto risco de evasão (Nota < 50 + Faltas > 15).",
    type: "table",
    icon: WarningAmber,
    span: 1,
    variant: "danger",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "alertas",
    columns: [
      { key: "nome", label: "Aluno", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "media", label: "Média", align: "right", render: (row) => asNumber(row.media, 1) },
      { key: "faltas", label: "Faltas", align: "right", render: (row) => row.faltas as ReactNode },
      { key: "risco", label: "Risco", align: "right", render: (row) => <span style={{ color: "#ef4444", fontWeight: "bold" }} > {(row.risco as number ?? 0) * 100}% </span> },
    ],
  },
  {
    slug: "comparativo-eficiencia",
    title: "Eficiência Docente",
    description: "DIAGNÓSTICO: Disparidade entre média da turma vs média da escola.",
    type: "bar",
    icon: School,
    span: 2,
    variant: "info",
    filters: { turno: true, serie: true, turma: true, disciplina: true },
    category: "desempenho",
    columns: [
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "media", label: "Média", align: "right", render: (row) => asNumber(row.media, 1) },
      {
        key: "delta",
        label: "Diferença",
        align: "right",
        render: (row) => {
          const delta = row.delta as number ?? 0;
          const color = delta >= 0 ? "#10b981" : "#ef4444";
          return <span style={{ color, fontWeight: "bold" }}> {(delta >= 0 ? "+" : "") + delta.toFixed(1)} </span>;
        }
      },
    ],
  },
  {
    slug: "top-movers",
    title: "Top Movers (Tendência)",
    description: "Alunos com maior variação entre trimestres consecutivos.",
    type: "table",
    icon: TrendingUp,
    span: 1,
    variant: "success",
    filters: { turno: true, serie: true, turma: true, disciplina: true, trimestre: true },
    category: "desempenho",
    columns: [
      { key: "nome", label: "Aluno", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      {
        key: "delta",
        label: "Variação",
        align: "right",
        render: (row) => {
          const delta = row.delta as number ?? 0;
          const color = delta > 0 ? "#10b981" : "#ef4444";
          return <span style={{ color, fontWeight: "bold" }}> {delta > 0 ? "+" : ""}{delta.toFixed(1)} </span>;
        }
      },
    ],
  },
  {
    slug: "alunos-abaixo-trimestre",
    title: "Alunos Abaixo da Média por Trimestre",
    description: "Lista todas as combinações aluno × disciplina com nota inferior a 50% dos pontos distribuídos no trimestre selecionado.",
    type: "table",
    icon: QueryStats,
    span: 2,
    variant: "danger",
    filters: { trimestre: true, turno: true, turma: true, disciplina: true },
    category: "alertas",
    columns: [
      { key: "nome",       label: "Aluno",      align: "left",  render: (row) => row.nome as ReactNode },
      { key: "turma",      label: "Turma",      align: "left",  render: (row) => row.turma as ReactNode },
      { key: "turno",      label: "Turno",      align: "left",  render: (row) => row.turno as ReactNode },
      { key: "disciplina", label: "Disciplina", align: "left",  render: (row) => row.disciplina as ReactNode },
      {
        key: "nota",
        label: "Nota",
        align: "right",
        render: (row) => <b>{asNumber(row.nota, 1)} pts</b>,
      },
      {
        key: "threshold",
        label: "Mínimo",
        align: "right",
        render: (row) => `${row.threshold} pts`,
      },
      {
        key: "deficit",
        label: "Déficit",
        align: "right",
        render: (row) => (
          <Chip
            label={`-${asNumber(row.deficit, 1)} pts`}
            size="small"
            color="error"
          />
        ),
      },
    ],
  },
  {
    slug: "ocorrencias-reincidentes",
    title: "Alunos Reincidentes em Ocorrências",
    description: "Alunos com 2+ ocorrências, priorizando as mais graves.",
    type: "table",
    icon: Gavel,
    span: 2,
    variant: "danger",
    filters: { turno: true, serie: true, turma: true },
    category: "alertas",
    columns: [
      { key: "nome", label: "Aluno", align: "left", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", align: "left", render: (row) => row.turma as ReactNode },
      { key: "turno", label: "Turno", align: "left", render: (row) => row.turno as ReactNode },
      { key: "total", label: "Total", align: "right", render: (row) => row.total as ReactNode },
      {
        key: "graves",
        label: "Graves",
        align: "right",
        render: (row) => (
          <Chip
            label={String(row.graves ?? 0)}
            size="small"
            color={Number(row.graves) > 0 ? "error" : "default"}
          />
        ),
      },
      {
        key: "pendentes",
        label: "Pendentes",
        align: "right",
        render: (row) => (
          <Chip
            label={String(row.pendentes ?? 0)}
            size="small"
            color={Number(row.pendentes) > 0 ? "warning" : "default"}
          />
        ),
      },
      { key: "ultima", label: "Última", align: "right", render: (row) => row.ultima as ReactNode },
    ],
  },
  {
    slug: "comunicados-engajamento",
    title: "Engajamento de Comunicados",
    description: "Taxa de leitura dos comunicados enviados a pais e responsáveis.",
    type: "table",
    icon: MarkEmailRead,
    span: 2,
    variant: "info",
    filters: {},
    category: "estatisticas",
    columns: [
      { key: "titulo", label: "Título", align: "left", render: (row) => row.titulo as ReactNode },
      { key: "target", label: "Destinatário", align: "left", render: (row) => row.target as ReactNode },
      { key: "data_envio", label: "Enviado", align: "center", render: (row) => row.data_envio as ReactNode },
      { key: "lidos", label: "Lidos", align: "right", render: (row) => row.lidos as ReactNode },
      { key: "destinatarios", label: "Destinatários", align: "right", render: (row) => row.destinatarios as ReactNode },
      {
        key: "taxa_leitura",
        label: "Taxa",
        align: "right",
        render: (row) => (
          <Chip
            label={`${row.taxa_leitura}%`}
            size="small"
            color={Number(row.taxa_leitura) > 70 ? "success" : Number(row.taxa_leitura) > 40 ? "warning" : "error"}
          />
        ),
      },
    ],
  },
  {
    slug: "faltas-por-disciplina",
    title: "Faltas por Disciplina",
    description: "Média de faltas por aluno agrupado por disciplina.",
    type: "bar",
    icon: BarChartIcon,
    span: 1,
    variant: "warning",
    filters: { turno: true, serie: true, turma: true },
    category: "estatisticas",
    columns: [
      { key: "disciplina", label: "Disciplina", render: (row) => row.disciplina as ReactNode },
      {
        key: "faltas",
        label: "Média de faltas",
        align: "right",
        render: (row) => asNumber(row.faltas, 1),
      },
    ],
  },
  {
    slug: "distribuicao-situacao",
    title: "Distribuição de Situação",
    description: "Percentual de alunos Aprovados, em Recuperação ou Reprovados.",
    type: "pie",
    icon: PieChartIcon,
    span: 2,
    variant: "info",
    filters: { turno: true, serie: true, turma: true },
    category: "desempenho",
    columns: [
      { key: "nome", label: "Aluno", render: (row) => row.nome as ReactNode },
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "media", label: "Média", align: "right", render: (row) => asNumber(row.media, 1) },
      {
        key: "situacao",
        label: "Situação",
        align: "center",
        render: (row) => {
          const sit = row.situacao as string;
          const color = sit === "APROVADO" ? "success" : sit === "RECUPERAÇÃO" ? "warning" : "error";
          return <Chip label={sit} size="small" color={color} sx={{ fontWeight: 600 }} />;
        }
      },
    ],
  },
  {
    slug: "evolucao-trimestres",
    title: "Evolução Trimestral",
    description: "Comparação do desempenho médio das turmas ao longo dos trimestres.",
    type: "line",
    icon: Timeline,
    span: 2,
    variant: "primary",
    filters: { turno: true, serie: true, turma: true },
    category: "desempenho",
    columns: [
      { key: "turma", label: "Turma", render: (row) => row.turma as ReactNode },
      { key: "t1", label: "1º Trimestre", align: "right", render: (row) => asNumber(row.t1, 1) },
      { key: "t2", label: "2º Trimestre", align: "right", render: (row) => asNumber(row.t2, 1) },
      { key: "t3", label: "3º Trimestre", align: "right", render: (row) => asNumber(row.t3, 1) },
    ],
  },
];

export const RELATORIOS_BY_SLUG = Object.fromEntries(
  RELATORIOS.map((relatorio) => [relatorio.slug, relatorio])
) as Record<RelatorioSlug, RelatorioDefinition>;
