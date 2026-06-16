import { useEffect, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AppsIcon from "@mui/icons-material/Apps";
import {
  Box,
  Card,
  TextField,
  InputAdornment,
  Alert,
  Typography,
  Chip,
  useTheme,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import { useListNotasQuery, useListTurmasQuery, useGetNotasFiltrosQuery } from "../../lib/api";

const gradeFormatter = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? `${numberValue}` : numberValue.toFixed(1);
};

const getGradeColor = (value: number | null | undefined, theme: any) => {
  if (value === null || value === undefined) return theme.palette.text.disabled;
  if (value < 12) return theme.palette.error.main;
  if (value < 15) return theme.palette.warning.main;
  return theme.palette.success.main;
};

const getGradeBg = (value: number | null | undefined, theme: any) => {
  if (value === null || value === undefined) return "transparent";
  if (value < 12) return `${theme.palette.error.main}10`;
  if (value < 15) return `${theme.palette.warning.main}10`;
  return `${theme.palette.success.main}10`;
};

const EmptyState = () => (
  <Box height="100%" display="flex" alignItems="center" justifyContent="center" flexDirection="column" gap={2} p={4} textAlign="center">
    <AppsIcon sx={{ fontSize: 48, color: "divider", opacity: 0.3 }} />
    <Box>
      <Typography variant="h6" color="text.primary" gutterBottom>Nenhum registro encontrado</Typography>
      <Typography variant="body2" color="text.secondary">
        Tente ajustar os filtros de busca para encontrar as notas desejadas.
      </Typography>
    </Box>
  </Box>
);

export const NotasPage = () => {
  const theme = useTheme();
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") ?? "";
  });
  const [turma, setTurma] = useState(() => new URLSearchParams(window.location.search).get("turma") ?? "");
  const [disciplina, setDisciplina] = useState(() => new URLSearchParams(window.location.search).get("disciplina") ?? "");
  const [turno, setTurno] = useState(() => new URLSearchParams(window.location.search).get("turno") ?? "");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (turma) params.set("turma", turma);
    if (disciplina) params.set("disciplina", disciplina);
    if (turno) params.set("turno", turno);
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [search, turma, disciplina, turno]);

  const queryFilters = useMemo(
    () => ({
      turma: turma || undefined,
      disciplina: disciplina || undefined,
      turno: turno || undefined
    }),
    [turma, disciplina, turno]
  );

  const { data, isFetching, isError } = useListNotasQuery(queryFilters);
  const { data: turmasData } = useListTurmasQuery();
  const { data: filtrosData } = useGetNotasFiltrosQuery();
  const notas = useMemo(() => data?.items ?? [], [data?.items]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredNotas = useMemo(() => {
    if (!normalizedSearch) return notas;
    return notas.filter((nota) => {
      const tokens = [nota.aluno?.nome, nota.aluno?.turma, nota.disciplina];
      return tokens.some((token) => token?.toLowerCase().includes(normalizedSearch));
    });
  }, [normalizedSearch, notas]);

  const columns: GridColDef[] = [
    {
      field: "aluno",
      headerName: "Aluno",
      flex: 1,
      minWidth: 240,
      renderCell: (params: GridRenderCellParams) => (
        <Box display="flex" flexDirection="column" justifyContent="center" height="100%">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight={600} fontSize="0.875rem" lineHeight={1.2}>
              {params.row.alunoName}
            </Typography>
            {params.row.status && (
              <Chip
                label={params.row.status}
                size="small"
                color={params.row.status === "Transferido" ? "warning" : "error"}
                sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
            {params.row.turma}
          </Typography>
        </Box>
      )
    },
    {
      field: "disciplina",
      headerName: "Disciplina",
      width: 180,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{
            borderColor: "divider",
            bgcolor: "background.paper",
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "text.primary"
          }}
        />
      )
    },
    {
      field: "trimestre1",
      headerName: "Tri 1",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize="0.875rem" color={getGradeColor(params.value, theme)}>
          {gradeFormatter(params.value)}
        </Typography>
      )
    },
    {
      field: "trimestre2",
      headerName: "Tri 2",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize="0.875rem" color={getGradeColor(params.value, theme)}>
          {gradeFormatter(params.value)}
        </Typography>
      )
    },
    {
      field: "trimestre3",
      headerName: "Tri 3",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize="0.875rem" color={getGradeColor(params.value, theme)}>
          {gradeFormatter(params.value)}
        </Typography>
      )
    },
    {
      field: "total",
      headerName: "Média Final",
      width: 110,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const val = params.value;
        const color = getGradeColor(val, theme);
        const bg = getGradeBg(val, theme);
        return (
          <Box
            sx={{
              bgcolor: bg,
              color: color,
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              display: "inline-block",
              fontWeight: 700,
              fontSize: "0.875rem"
            }}
          >
            {gradeFormatter(val)}
          </Box>
        );
      }
    },
    {
      field: "faltas",
      headerName: "Faltas",
      width: 80,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const value = params.value;
        return (
          <Typography color="text.secondary" variant="body2" fontSize="0.875rem">
            {value === null || value === undefined ? "—" : `${value}`}
          </Typography>
        );
      }
    }
  ];

  const rows = filteredNotas.map((nota) => ({
    id: `${nota.aluno?.id ?? "na"}-${nota.disciplina}`,
    alunoName: nota.aluno?.nome ?? "Aluno sem nome",
    turma: nota.aluno?.turma ?? "",
    disciplina: nota.disciplina,
    status: nota.aluno?.status,
    trimestre1: nota.trimestre1 ?? null,
    trimestre2: nota.trimestre2 ?? null,
    trimestre3: nota.trimestre3 ?? null,
    total: nota.total ?? null,
    faltas: nota.faltas ?? null
  }));

  const turmaOptions = useMemo(() => {
    const items = turmasData?.items ?? [];
    const filtered = turno ? items.filter((t) => t.turno === turno) : items;
    return filtered.map((t) => t.turma).sort();
  }, [turmasData, turno]);
  const disciplinaOptions = useMemo(
    () => filtrosData?.disciplinas ?? [],
    [filtrosData]
  );
  const turnoOptions = useMemo(
    () => Array.from(new Set(turmasData?.items.map((t) => t.turno) ?? [])).sort(),
    [turmasData]
  );

  // Reset turma when turno changes (cascading filter)
  useEffect(() => {
    setTurma("");
  }, [turno]);

  const handleReset = () => {
    setSearch("");
    setTurma("");
    setDisciplina("");
    setTurno("");
  };

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
          Boletim Escolar
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Consulte notas, faltas e desempenho acadêmico detalhado
        </Typography>
      </Box>

      {/* Modern Filter Toolbar - Compact */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          alignItems: "center"
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mr="auto" minWidth={100}>
          <FilterListIcon color="action" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600} fontSize="0.875rem">Filtros</Typography>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

        <TextField
          placeholder="Buscar aluno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: { xs: "100%", md: 220 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />

        <FormControl size="small" sx={{ minWidth: 120, width: { xs: "100%", md: "auto" } }}>
          <InputLabel>Turma</InputLabel>
          <Select value={turma} label="Turma" onChange={(e) => setTurma(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {turmaOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140, width: { xs: "100%", md: "auto" } }}>
          <InputLabel>Disciplina</InputLabel>
          <Select value={disciplina} label="Disciplina" onChange={(e) => setDisciplina(e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {disciplinaOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100, width: { xs: "100%", md: "auto" } }}>
          <InputLabel>Turno</InputLabel>
          <Select value={turno} label="Turno" onChange={(e) => setTurno(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {turnoOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
        </FormControl>

        <Button
          onClick={handleReset}
          startIcon={<RestartAltIcon />}
          variant="outlined"
          size="small"
          sx={{ ml: { md: "auto" }, width: { xs: "100%", md: "auto" }, borderStyle: "dashed" }}
          disabled={!search && !turma && !disciplina && !turno}
        >
          Limpar
        </Button>
      </Paper>

      {isError && <Alert severity="error" sx={{ mb: 3 }}>Não foi possível carregar as notas.</Alert>}

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: (theme) => theme.palette.mode === "light" ? "grey.50" : "grey.900" }}>
          <Typography variant="subtitle2" fontWeight={600} fontSize="0.875rem" color="text.secondary">
            Registros encontrados: {filteredNotas.length}
          </Typography>
        </Box>
        <Box height={600} width="100%">
          <DataGrid
            rows={rows}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            loading={isFetching}
            slots={{ noRowsOverlay: EmptyState }}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 }
              }
            }}
            pageSizeOptions={[25, 50, 100]}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "transparent",
                color: "text.secondary",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid",
                borderBottomColor: "divider",
              },
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid",
                borderBottomColor: "divider"
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "action.hover"
              }
            }}
          />
        </Box>
      </Card>
    </Box>
  );
};
