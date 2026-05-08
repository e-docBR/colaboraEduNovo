import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import ArchiveIcon from "@mui/icons-material/Archive";
import { useListArchivedAlunosQuery, useRestoreAlunoMutation } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import type { AlunoSummary } from "../../lib/api";

const ALUNOS_PER_PAGE = 20;

export const ArchivedAlunosPage = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = Boolean(currentUser?.is_admin || currentUser?.role === "admin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<AlunoSummary | null>(null);
  const [snackMsg, setSnackMsg] = useState("");

  const { data, isFetching, isError } = useListArchivedAlunosQuery(
    { page, per_page: ALUNOS_PER_PAGE, q: search.trim() || undefined },
    { skip: !isAdmin }
  );
  const [restoreAluno, { isLoading: isRestoring }] = useRestoreAlunoMutation();

  const alunos = data?.items ?? [];
  const pageMeta = data?.meta;
  const totalPages = pageMeta ? Math.max(1, Math.ceil(pageMeta.total / ALUNOS_PER_PAGE)) : 1;

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreAluno(restoreTarget.id).unwrap();
      setSnackMsg(`Aluno "${restoreTarget.nome}" restaurado com sucesso.`);
      setRestoreTarget(null);
    } catch {
      setSnackMsg("Erro ao restaurar aluno. Tente novamente.");
    }
  };

  if (!isAdmin) {
    return <Alert severity="warning">Apenas administradores podem acessar o arquivo de alunos.</Alert>;
  }

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Stack direction="row" alignItems="center" gap={1}>
        <ArchiveIcon color="action" />
        <Typography variant="h5">Alunos Arquivados</Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Alunos arquivados têm seus dados e histórico preservados, mas não aparecem nas listas ativas, dashboards ou
        relatórios. Restaure um aluno para reativá-lo.
      </Typography>

      <TextField
        label="Buscar por nome ou matrícula"
        fullWidth
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        InputLabelProps={{ shrink: true }}
      />

      {isError && <Alert severity="error">Não foi possível carregar os alunos arquivados.</Alert>}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Arquivo</Typography>
            <Typography variant="body2" color="text.secondary">
              {pageMeta?.total ?? 0} aluno{pageMeta?.total !== 1 ? "s" : ""} arquivado{pageMeta?.total !== 1 ? "s" : ""}
            </Typography>
          </Stack>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Matrícula</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Turma</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Turno</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Arquivado em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isFetching && !alunos.length ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Carregando...</TableCell>
                  </TableRow>
                ) : alunos.length ? (
                  alunos.map((aluno) => (
                    <TableRow key={aluno.id} hover>
                      <TableCell>
                        <Stack>
                          <Typography fontWeight={600}>{aluno.nome}</Typography>
                          <Chip label="Arquivado" color="default" size="small" sx={{ width: "fit-content" }} />
                        </Stack>
                      </TableCell>
                      <TableCell>{aluno.matricula}</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{aluno.turma}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{aluno.turno}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                        {aluno.deleted_at
                          ? new Date(aluno.deleted_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" color="success" onClick={() => setRestoreTarget(aluno)}>
                          Restaurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">Nenhum aluno arquivado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>

          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="body2" color="text.secondary">
              Página {pageMeta?.page ?? page} de {totalPages}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button
                variant="outlined"
                disabled={pageMeta ? pageMeta.page >= totalPages : alunos.length === 0}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(restoreTarget)} onClose={() => setRestoreTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Restaurar aluno</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Deseja restaurar o aluno "{restoreTarget?.nome}" ({restoreTarget?.matricula})? Ele voltará a aparecer nas
            listas ativas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreTarget(null)}>Cancelar</Button>
          <Button color="success" variant="contained" onClick={handleRestore} disabled={isRestoring}>
            {isRestoring ? "Restaurando..." : "Restaurar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackMsg}
        autoHideDuration={4000}
        onClose={() => setSnackMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setSnackMsg("")}>{snackMsg}</Alert>
      </Snackbar>
    </Box>
  );
};
