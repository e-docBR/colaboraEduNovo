import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import {
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tabs,
  Tab,
  Grid
} from "@mui/material";

import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import DescriptionIcon from "@mui/icons-material/Description";
import GroupIcon from "@mui/icons-material/Group";
import SchoolIcon from "@mui/icons-material/School";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { AIInterventionBoard } from "../dashboard/AIInterventionBoard";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}
import { useState } from "react";
import { useGetAlunoQuery, AlunoNota, useUpdateAlunoMutation, useDeleteAlunoMutation } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { EditNotaDialog } from "../notas/EditNotaDialog";
import { AlunoForm } from "./AlunoForm";


const formatSituacao = (value?: string | null, status?: string | null) => {
  if (status) {
    if (status === "Cancelado") return { label: "Cancelado", color: "error" as const };
    if (status === "Transferido") return { label: "Transferido", color: "warning" as const };
    if (status === "Desistente") return { label: "Desistente", color: "error" as const };
  }

  if (!value) return { label: "-", color: "default" as const };
  const normalized = value.toUpperCase();
  if (normalized.startsWith("APR")) return { label: "Aprovado", color: "success" as const };
  if (normalized === "AR") return { label: "Apr Rec", color: "success" as const };
  if (normalized.startsWith("REP")) return { label: "Reprovado", color: "error" as const };
  if (normalized.startsWith("ACC") || normalized.startsWith("APCC")) return { label: "APCC", color: "info" as const };
  if (normalized.startsWith("REC")) return { label: "Recuperação", color: "warning" as const };
  return { label: value, color: "default" as const };
};

const formatNota = (value?: number | null) => (typeof value === "number" ? value.toFixed(1) : "-");

export const AlunoDetailPage = () => {
  const { alunoId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetAlunoQuery(alunoId ?? "", {
    skip: !alunoId
  });

  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role && ["admin", "super_admin", "coordenacao", "coordenador", "direcao", "diretor", "orientacao", "orientador"].includes(user.role);

  const [editingNota, setEditingNota] = useState<AlunoNota | null>(null);
  const [editingAluno, setEditingAluno] = useState(false);
  const [deletingAluno, setDeletingAluno] = useState(false);

  const [updateAluno, { isLoading: isUpdating }] = useUpdateAlunoMutation();
  const [deleteAluno, { isLoading: isDeleting }] = useDeleteAlunoMutation();

  const handleUpdate = async (formData: any) => {
    try {
      await updateAluno({ id: Number(alunoId), ...formData }).unwrap();
      setEditingAluno(false);
    } catch (error) {
      console.error("Failed to update aluno", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAluno(Number(alunoId)).unwrap();
      navigate("/app/alunos");
    } catch (error) {
      console.error("Failed to delete aluno", error);
    }
  };

  const token = useAppSelector((state) => state.auth.accessToken);

  const handleDownloadPdf = async () => {
    if (!alunoId || !token) return;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";

    try {
      const response = await fetch(`${baseUrl}/alunos/${alunoId}/boletim/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Falha ao gerar PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Boletim_${data?.nome.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro no download", error);
    }
  };


  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Não foi possível carregar o boletim deste aluno.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Breadcrumbs>
          <Link component={RouterLink} to="/app/alunos" underline="hover">
            Alunos
          </Link>
          <Typography color="text.primary">{data.nome}</Typography>
        </Breadcrumbs>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPdf}
          >
            Baixar PDF
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setEditingAluno(true)}
              >
                Editar Aluno
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeletingAluno(true)}
              >
                Excluir
              </Button>
            </>
          )}
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Voltar
          </Button>
        </Stack>
      </Stack>


      <Card>
        <CardContent>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            {data.nome}
            {data.status && (
              <Chip
                label={data.status}
                color={data.status === "Transferido" ? "warning" : "error"}
                size="small"
                sx={{ ml: 2, verticalAlign: "middle" }}
              />
            )}
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Matrícula
              </Typography>
              <Typography fontWeight={600}>{data.matricula}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Turma / Turno
              </Typography>
              <Typography fontWeight={600}>
                {data.turma} • {data.turno}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Média geral
              </Typography>
              <Typography fontWeight={600} color={data.status ? "text.secondary" : (data.media && data.media < 50 ? "error.main" : "success.main")}>
                {data.status ? "Inativo" : (typeof data.media === "number" ? data.media.toFixed(1) : "-")}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 1 }}>
        <Tabs value={tabValue} onChange={handleTabChange} color="secondary">
          <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label="Acadêmico" />
          <Tab icon={<PersonIcon fontSize="small" />} iconPosition="start" label="Dados Pessoais" />
          <Tab icon={<AutoFixHighIcon fontSize="small" />} iconPosition="start" label="IA Insights" />
        </Tabs>
      </Box>

      <CustomTabPanel value={tabValue} index={0}>
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Disciplina</TableCell>
                <TableCell>1º Tri</TableCell>
                <TableCell>2º Tri</TableCell>
                <TableCell>3º Tri</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Faltas</TableCell>
                <TableCell>Situação</TableCell>
                {isAdmin && <TableCell>Ações</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.notas.map((nota) => {
                const situacao = formatSituacao(nota.situacao, data.status);
                return (
                  <TableRow key={nota.id} hover>
                    <TableCell>{nota.disciplina}</TableCell>
                    <TableCell>{formatNota(nota.trimestre1)}</TableCell>
                    <TableCell>{formatNota(nota.trimestre2)}</TableCell>
                    <TableCell>{formatNota(nota.trimestre3)}</TableCell>
                    <TableCell>{formatNota(nota.total)}</TableCell>
                    <TableCell>{nota.faltas ?? "-"}</TableCell>
                    <TableCell>
                      <Chip label={situacao.label} color={situacao.color} size="small" variant="outlined" />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <IconButton size="small" onClick={() => setEditingNota(nota)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CustomTabPanel>

      <CustomTabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {/* Informações Pessoais */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>Identificação Básica</Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Sexo</Typography>
                    <Typography fontWeight={500}>{data.sexo || "-"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Data de Nasc.</Typography>
                    <Typography fontWeight={500}>{data.data_nascimento || "-"}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Naturalidade</Typography>
                    <Typography fontWeight={500}>{data.naturalidade || "-"}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Situação no Ano Anterior</Typography>
                    <Typography fontWeight={500}>{data.situacao_anterior || "-"}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Documentação */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <DescriptionIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>Documentação & Registro</Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">INEP</Typography>
                    <Typography fontWeight={500}>{data.inep || "-"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">CPF</Typography>
                    <Typography fontWeight={500}>{data.cpf || "-"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">NIS</Typography>
                    <Typography fontWeight={500}>{data.nis || "-"}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Status do Aluno</Typography>
                    <Typography fontWeight={500}>
                      <Chip
                        label={data.status || "Ativo"}
                        size="small"
                        color={data.status === "Cancelado" || data.status === "Desistente" ? "error" : "success"}
                        variant="filled"
                      />
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Endereço e Contato */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <HomeIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>Contato e Endereço</Typography>
                </Stack>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Endereço</Typography>
                    <Typography fontWeight={500}>{data.endereco || "-"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Zona</Typography>
                    <Typography fontWeight={500}>{data.zona || "-"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Telefones</Typography>
                    <Typography fontWeight={500}>{data.telefones || "-"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Email</Typography>
                    <Typography fontWeight={500}>{data.email || "-"}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Filiação */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <GroupIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>Filiação e Família</Typography>
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Filiação</Typography>
                  <Typography fontWeight={500} sx={{ whiteSpace: 'pre-line' }}>
                    {data.filiacao || "-"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </CustomTabPanel>

      <CustomTabPanel value={tabValue} index={2}>
        <AIInterventionBoard studentIds={[Number(alunoId)]} />
      </CustomTabPanel>

      {editingNota && (
        <EditNotaDialog
          open={Boolean(editingNota)}
          nota={editingNota}
          onClose={() => setEditingNota(null)}
        />
      )}

      {/* Aluno Edit Dialog */}
      <Dialog open={editingAluno} onClose={() => setEditingAluno(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Editar Informações do Aluno</DialogTitle>
        <DialogContent>
          <AlunoForm
            initialData={data}
            onSubmit={handleUpdate}
            onCancel={() => setEditingAluno(false)}
            isLoading={isUpdating}
          />
        </DialogContent>
      </Dialog>

      {/* Aluno Delete Confirmation Dialog */}
      <Dialog open={deletingAluno} onClose={() => setDeletingAluno(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Excluir Aluno?</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja excluir o aluno <strong>{data.nome}</strong>?
            <br />
            Esta ação é irreversível e excluirá todas as notas e vínculos associados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeletingAluno(false)} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            Confirmar Exclusão
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>

  );
};

