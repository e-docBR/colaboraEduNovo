import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  DialogActions,
  Divider,
  Grid2 as Grid,
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import { useListAlunosQuery, useListTurmasQuery, useCreateAlunoMutation, useGetDashboardKpisQuery } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { AlunoForm } from "./AlunoForm";


const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FR";

const getMediaColor = (media?: number | null, threshold = 50): "default" | "success" | "warning" | "error" => {
  if (media === undefined || media === null) return "default";
  if (media >= threshold * 1.4) return "success";
  if (media < threshold) return "error";
  return "warning";
};

type RiskLevel = "ALTO" | "MEDIO" | null;

const getRiskLevel = (media?: number | null, media_faltas?: number | null, threshold = 50): RiskLevel => {
  if (media === undefined || media === null) return null;
  if (media < threshold || (media_faltas != null && media_faltas > 20)) return "ALTO";
  if (media < threshold * 1.2 || (media_faltas != null && media_faltas > 12)) return "MEDIO";
  return null;
};


export const AlunosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";

  const setSearch = (value: string) => {
    if (value) {
      searchParams.set("q", value);
    } else {
      searchParams.delete("q");
    }
    setSearchParams(searchParams, { replace: true });
  };

  const [turno, setTurno] = useState("");
  const [turma, setTurma] = useState("");
  const [open, setOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [credentialsDialog, setCredentialsDialog] = useState<{ nome: string; username: string; senha: string } | null>(null);
  const credentialsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-oculta credenciais após 60 segundos para reduzir exposição em tela
  useEffect(() => {
    if (credentialsDialog) {
      credentialsTimerRef.current = setTimeout(() => setCredentialsDialog(null), 60_000);
    }
    return () => {
      if (credentialsTimerRef.current) clearTimeout(credentialsTimerRef.current);
    };
  }, [credentialsDialog]);

  const user = useAppSelector((state) => state.auth.user);
  const [createAluno, { isLoading: isCreating }] = useCreateAlunoMutation();

  const buildUsername = (nome: string, matricula: string) => {
    const firstName = nome.split(" ")[0].toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
    return `${firstName}${matricula}`;
  };

  const handleCreate = async (data: any) => {
    try {
      const aluno = await createAluno(data).unwrap();
      setOpen(false);
      setCreateError(null);
      setCredentialsDialog({
        nome: aluno.nome,
        username: buildUsername(aluno.nome, aluno.matricula),
        // Usa senha gerada pelo backend; fallback para matrícula em contas já existentes
        senha: aluno.senha_inicial ?? aluno.matricula,
      });
    } catch (error: any) {
      const msg = error?.data?.error ?? error?.data?.message ?? "Erro ao cadastrar aluno. Tente novamente.";
      setCreateError(msg);
    }
  };


  const {
    data: turmasData,
    isFetching: isFetchingTurmas
  } = useListTurmasQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true
  });

  const turnoOptions = useMemo(() => {
    const items = turmasData?.items ?? [];
    const turnos = new Set<string>();
    items.forEach((item) => {
      if (item.turno) turnos.add(item.turno);
    });
    return Array.from(turnos).sort();
  }, [turmasData]);

  const turmaOptions = useMemo(() => {
    const items = turmasData?.items ?? [];
    return items.map((t) => t.turma).sort();
  }, [turmasData]);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      per_page: "50"
    };
    if (turno) params.turno = turno;
    if (turma) params.turma = turma;
    if (search) params.q = search;
    return params;
  }, [turno, turma, search]);


  const {
    data,
    isLoading,
    isError,
    isFetching: isFetchingAlunos
  } = useListAlunosQuery(queryParams, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true
  });

  const { data: kpiData } = useGetDashboardKpisQuery();
  const riskThreshold = kpiData?.grading_stage?.threshold ?? 50;


  const alunos = data?.items ?? [];


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
          Alunos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gestão de estudantes e desempenho acadêmico
        </Typography>
      </Box>

      {user?.role && ["admin", "super_admin"].includes(user.role) && (
        <Box mb={3} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
          >
            Novo Aluno
          </Button>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cadastrar Novo Aluno</DialogTitle>
        <DialogContent>
          <AlunoForm
            onSubmit={handleCreate}
            onCancel={() => setOpen(false)}
            isLoading={isCreating}
          />
        </DialogContent>
      </Dialog>


      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={3}>
        <TextField
          placeholder="Buscar aluno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="Turno"
          value={turno}
          onChange={(e) => setTurno(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
          SelectProps={{ native: true }}
        >
          <option value="">Todos</option>
          {turnoOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </TextField>
        <TextField
          select
          label="Turma"
          value={turma}
          onChange={(e) => setTurma(e.target.value)}
          size="small"
          sx={{ minWidth: 140 }}
          SelectProps={{ native: true }}
        >
          <option value="">Todas</option>
          {turmaOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </TextField>
        {(search || turno || turma) && (
          <Button
            variant="outlined"
            onClick={() => {
              setSearch("");
              setTurno("");
              setTurma("");
            }}
            size="small"
          >
            Limpar
          </Button>
        )}
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar alunos</Alert>}

      <Grid container spacing={2}>
        {isLoading || isFetchingTurmas || isFetchingAlunos ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />
            </Grid>
          ))

        ) : alunos.length === 0 ? (
          <Grid size={12}>
            <Box textAlign="center" py={8}>
              <Typography color="text.secondary">Nenhum aluno encontrado</Typography>
            </Box>
          </Grid>
        ) : (
          alunos.map((aluno) => (

            <Grid key={aluno.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "ALTO"
                    ? "error.light"
                    : getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "MEDIO"
                    ? "warning.light"
                    : "divider",
                  height: "100%",
                  transition: "all 0.2s",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 1
                  }
                }}
              >
                <CardActionArea
                  component={RouterLink}
                  to={`/app/alunos/${aluno.id}`}
                  sx={{ height: "100%" }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start" mb={1.5}>
                      <Avatar
                        sx={{
                          bgcolor: getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "ALTO"
                            ? "error.main"
                            : "primary.main",
                          width: 40,
                          height: 40,
                          fontSize: "0.875rem",
                          fontWeight: 700
                        }}
                      >
                        {getInitials(aluno.nome ?? "")}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          fontSize="0.875rem"
                          noWrap
                          mb={0.25}
                        >
                          {aluno.nome}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontSize="0.75rem"
                          color="text.secondary"
                          noWrap
                        >
                          {aluno.turma}
                        </Typography>
                      </Box>
                      {getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) && (
                        <Tooltip
                          title={
                            getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "ALTO"
                              ? "Alto risco de reprovação"
                              : "Atenção: desempenho abaixo da média"
                          }
                        >
                          <WarningAmberIcon
                            fontSize="small"
                            color={getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "ALTO" ? "error" : "warning"}
                            sx={{ flexShrink: 0, mt: 0.25 }}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={0.5}>
                      {aluno.status && (
                        <Chip
                          label={aluno.status}
                          size="small"
                          color={aluno.status === "Transferido" ? "warning" : "error"}
                          sx={{
                            height: 20,
                            fontSize: "0.625rem",
                            fontWeight: 600
                          }}
                        />
                      )}
                      <Chip
                        label={aluno.media !== null && aluno.media !== undefined
                          ? `Média: ${aluno.media.toFixed(1)}`
                          : "Sem média"}
                        size="small"
                        color={aluno.status ? "default" : getMediaColor(aluno.media, riskThreshold)}

                        sx={{
                          height: 20,
                          fontSize: "0.625rem",
                          fontWeight: 600
                        }}
                      />
                      {aluno.faltas !== null && aluno.faltas !== undefined && aluno.faltas > 0 && (
                        <Chip
                          label={`${aluno.faltas} faltas`}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: "0.625rem"
                          }}
                        />
                      )}
                      {getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "ALTO" && (
                        <Chip
                          label="Alto Risco"
                          size="small"
                          color="error"
                          icon={<WarningAmberIcon style={{ fontSize: 10 }} />}
                          sx={{ height: 20, fontSize: "0.625rem", fontWeight: 700 }}
                        />
                      )}
                      {getRiskLevel(aluno.media, aluno.media_faltas, riskThreshold) === "MEDIO" && (
                        <Chip
                          label="Em Atenção"
                          size="small"
                          color="warning"
                          icon={<WarningAmberIcon style={{ fontSize: 10 }} />}
                          sx={{ height: 20, fontSize: "0.625rem", fontWeight: 700 }}
                        />
                      )}
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Snackbar
        open={!!createError}
        autoHideDuration={6000}
        onClose={() => setCreateError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setCreateError(null)} sx={{ width: "100%" }}>
          {createError}
        </Alert>
      </Snackbar>

      {/* Dialog de credenciais após cadastro */}
      <Dialog open={!!credentialsDialog} onClose={() => setCredentialsDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleOutlineIcon color="success" />
          Aluno cadastrado com sucesso!
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            O aluno deverá trocar a senha no primeiro acesso.
          </Alert>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary">Nome</Typography>
              <Typography fontWeight={600}>{credentialsDialog?.nome}</Typography>
            </Box>
            <Divider />
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary">Usuário</Typography>
                <Typography fontFamily="monospace" fontWeight={600}>{credentialsDialog?.username}</Typography>
              </Box>
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(credentialsDialog?.username ?? "")}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="caption" color="text.secondary">Senha inicial (matrícula)</Typography>
                <Typography fontFamily="monospace" fontWeight={600}>{credentialsDialog?.senha}</Typography>
              </Box>
              <IconButton size="small" onClick={() => navigator.clipboard.writeText(credentialsDialog?.senha ?? "")}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCredentialsDialog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
