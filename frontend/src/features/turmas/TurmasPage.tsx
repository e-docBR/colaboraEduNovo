import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Chip,
  Avatar,
  useTheme,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel
} from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import GroupIcon from "@mui/icons-material/Group";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightlightIcon from "@mui/icons-material/Nightlight";
import ClassIcon from "@mui/icons-material/Class";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";

import { TurmaSummary, useListTurmasQuery, useUpdateTurmaMutation, useDeleteTurmaMutation, useListUsuariosQuery } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

const TURNOS = ["Matutino", "Vespertino", "Noturno"];

const progressFromMedia = (media?: number | null, maxPts?: number | null) => {
  if (media === undefined || media === null) return 0;
  const scale = maxPts ?? (media > 20 ? 100 : 20);
  return Math.min(100, Math.max(0, (media / scale) * 100));
};

const getPerformanceColor = (media: number, theme: any, maxPts?: number | null) => {
  const scale = maxPts ?? (media > 20 ? 100 : 20);
  const ratio = media / scale;
  if (ratio < 0.50) {
    return theme.palette.error.main;
  }
  if (ratio < 0.57) {
    return theme.palette.warning.main;
  }
  return theme.palette.success.main;
};

export const TurmasPage = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const navigate = useNavigate();

  const user = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const tenantId = useAppSelector((state) => state.app.tenantId);
  const academicYearId = useAppSelector((state) => state.app.academicYearId);
  const isAdmin = user?.role && ["admin", "super_admin"].includes(user.role);
  const canGenerateAccessNotices = Boolean(user?.role && [
    "admin",
    "super_admin",
    "coordenador",
    "coordenacao",
    "diretor",
    "orientador",
    "orientacao"
  ].includes(user.role));

  const setSearch = (value: string) => {
    if (value) {
      searchParams.set("q", value);
    } else {
      searchParams.delete("q");
    }
    setSearchParams(searchParams, { replace: true });
  };

  const { data, isLoading, isError } = useListTurmasQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true
  });
  const turmas = useMemo(() => data?.items ?? [], [data?.items]);

  const [updateTurma, { isLoading: isUpdating }] = useUpdateTurmaMutation();
  const [deleteTurma, { isLoading: isDeleting }] = useDeleteTurmaMutation();

  const [editingTurma, setEditingTurma] = useState<TurmaSummary | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTurno, setEditTurno] = useState("");
  const [editProfessores, setEditProfessores] = useState<number[]>([]);

  const { data: usersResponse } = useListUsuariosQuery(
    { role: "professor", per_page: 100 },
    { skip: !editingTurma }
  );
  const professorsList = useMemo(() => usersResponse?.items ?? [], [usersResponse]);

  const [deletingTurma, setDeletingTurma] = useState<TurmaSummary | null>(null);
  const [accessNoticeOpen, setAccessNoticeOpen] = useState(false);
  const [accessNoticeTurma, setAccessNoticeTurma] = useState("");
  const [isGeneratingAccessNotice, setIsGeneratingAccessNotice] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success"
  });

  const openEdit = (turma: TurmaSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditNome(turma.turma);
    setEditTurno(turma.turno);
    setEditProfessores(turma.professor_ids || []);
    setEditingTurma(turma);
  };

  const openDelete = (turma: TurmaSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTurma(turma);
  };

  const handleUpdate = async () => {
    if (!editingTurma) return;
    const slug = editingTurma.slug || editingTurma.turma;
    try {
      await updateTurma({ slug, nome: editNome, turno: editTurno, professor_ids: editProfessores }).unwrap();
      setEditingTurma(null);
      setSnackbar({ open: true, message: "Turma atualizada com sucesso!", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Erro ao atualizar turma.", severity: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deletingTurma) return;
    const slug = deletingTurma.slug || deletingTurma.turma;
    try {
      const result = await deleteTurma(slug).unwrap();
      setDeletingTurma(null);
      setSnackbar({ open: true, message: `Turma excluída. ${result.deleted} aluno(s) removido(s).`, severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Erro ao excluir turma.", severity: "error" });
    }
  };

  const handleDownloadAccessNotices = async () => {
    if (!accessNoticeTurma || !accessToken) return;
    const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
    const params = new URLSearchParams({ turma: accessNoticeTurma });
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (tenantId) headers["X-Tenant-ID"] = String(tenantId);
    if (academicYearId) headers["x-academic-year-id"] = String(academicYearId);

    setIsGeneratingAccessNotice(true);
    try {
      const response = await fetch(`${API_BASE}/exports/comunicados-acesso?${params.toString()}`, { headers });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao gerar comunicados.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fallback = `comunicados_acesso_${accessNoticeTurma.replace(/\W+/g, "_")}.docx`;
      const filename = filenameMatch?.[1] || fallback;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setAccessNoticeOpen(false);
      setSnackbar({ open: true, message: "Comunicados gerados com sucesso!", severity: "success" });
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.message || "Erro ao gerar comunicados.", severity: "error" });
    } finally {
      setIsGeneratingAccessNotice(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return turmas;
    return turmas.filter((t) =>
      t.turma?.toLowerCase().includes(term) ||
      t.turno?.toLowerCase().includes(term)
    );
  }, [turmas, search]);

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box mb={3} display="flex" flexDirection={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <Box>
          <Typography variant="h3" fontWeight={800} sx={{ letterSpacing: "-0.02em", color: "text.primary", mb: 0.5 }}>
            Turmas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestão de turmas e desempenho por série
          </Typography>
        </Box>
        {canGenerateAccessNotices && (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => {
              setAccessNoticeTurma(filtered[0]?.turma || "");
              setAccessNoticeOpen(true);
            }}
            sx={{ alignSelf: { xs: "stretch", md: "flex-start" }, fontWeight: 700, textTransform: "none" }}
          >
            Gerar comunicados de acesso
          </Button>
        )}
      </Box>

      <TextField
        placeholder="Buscar turma..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 3, maxWidth: 400 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />

      {isError && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar turmas</Alert>}

      <Grid container spacing={2}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
            </Grid>
          ))
        ) : filtered.length === 0 ? (
          <Grid size={12}>
            <Box textAlign="center" py={8}>
              <Typography color="text.secondary">Nenhuma turma encontrada</Typography>
            </Box>
          </Grid>
        ) : (
          filtered.map((turma) => {
            const mediaVal = turma.media ?? 0;
            const progress = progressFromMedia(mediaVal, turma.max_pts);
            const performanceColor = getPerformanceColor(mediaVal, theme, turma.max_pts);

            return (
              <Grid key={turma.slug || turma.turma} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    height: "100%",
                    transition: "all 0.2s",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: 1 },
                    position: "relative"
                  }}
                >
                  {isAdmin && (
                    <Box
                      sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Editar turma">
                        <IconButton size="small" onClick={(e) => openEdit(turma, e)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir turma">
                        <IconButton size="small" color="error" onClick={(e) => openDelete(turma, e)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  <CardActionArea
                    onClick={() => navigate(`/app/turmas/${turma.slug || turma.turma}`)}
                    sx={{ height: "100%" }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={1.5} mb={2}>
                        <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
                          <ClassIcon />
                        </Avatar>
                        <Box flex={1} minWidth={0} pr={isAdmin ? 6 : 0}>
                          <Typography variant="h6" fontWeight={700} fontSize="1.125rem" noWrap mb={0.25}>
                            {turma.turma}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {turma.turno === "Matutino" ? (
                              <WbSunnyIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                            ) : (
                              <NightlightIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                            )}
                            <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                              {turma.turno}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1} mb={2}>
                        <Chip
                          icon={<GroupIcon sx={{ fontSize: "14px !important" }} />}
                          label={`${turma.total_alunos ?? 0} alunos`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 24, fontSize: "0.75rem" }}
                        />
                        <Chip
                          label={`Média: ${mediaVal.toFixed(1)}`}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: "0.75rem",
                            bgcolor: `${performanceColor}15`,
                            color: performanceColor,
                            fontWeight: 600
                          }}
                        />
                      </Stack>

                      <Box>
                        <Stack direction="row" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                            Desempenho
                          </Typography>
                          <Typography variant="caption" fontSize="0.75rem" fontWeight={600}>
                            {progress.toFixed(0)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: "action.hover",
                            "& .MuiLinearProgress-bar": { bgcolor: performanceColor, borderRadius: 3 }
                          }}
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editingTurma)} onClose={() => setEditingTurma(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Editar Turma</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome da Turma"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              fullWidth
              size="small"
              required
            />
            <TextField
              select
              label="Turno"
              value={editTurno}
              onChange={(e) => setEditTurno(e.target.value)}
              fullWidth
              size="small"
            >
              {TURNOS.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>

            <FormControl fullWidth size="small">
              <InputLabel id="edit-professores-label">Professores da Turma</InputLabel>
              <Select
                labelId="edit-professores-label"
                id="edit-professores-select"
                multiple
                value={editProfessores}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditProfessores(typeof value === "string" ? value.split(",").map(Number) : value as number[]);
                }}
                input={<OutlinedInput label="Professores da Turma" />}
                renderValue={(selected) => {
                  const selectedUsers = professorsList.filter(u => selected.includes(u.id));
                  return selectedUsers.map(u => u.username).join(", ");
                }}
              >
                {professorsList.map((prof) => (
                  <MenuItem key={prof.id} value={prof.id}>
                    <Checkbox checked={editProfessores.includes(prof.id)} />
                    <ListItemText primary={prof.username} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setEditingTurma(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            disabled={isUpdating || !editNome.trim()}
          >
            Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={Boolean(deletingTurma)} onClose={() => setDeletingTurma(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Excluir Turma?</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Esta ação é irreversível e excluirá todos os alunos da turma.
          </Alert>
          <Typography>
            Tem certeza que deseja excluir a turma <strong>{deletingTurma?.turma}</strong>?
            <br />
            <strong>{deletingTurma?.total_alunos ?? 0} aluno(s)</strong> serão permanentemente removidos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeletingTurma(null)} variant="outlined">Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={isDeleting}>
            Confirmar Exclusão
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={accessNoticeOpen} onClose={() => setAccessNoticeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Gerar Comunicados de Acesso</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              As senhas temporárias dos responsáveis da turma selecionada serão redefinidas.
            </Alert>
            <TextField
              select
              label="Turma"
              value={accessNoticeTurma}
              onChange={(e) => setAccessNoticeTurma(e.target.value)}
              fullWidth
              size="small"
            >
              {turmas.map((turma) => (
                <MenuItem key={turma.slug || turma.turma} value={turma.turma}>
                  {turma.turma} - {turma.turno}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setAccessNoticeOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadAccessNotices}
            disabled={isGeneratingAccessNotice || !accessNoticeTurma}
          >
            {isGeneratingAccessNotice ? "Gerando..." : "Baixar DOCX"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
