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

import { useGetTurmaAlunosQuery } from "../../lib/api";

const formatSituacao = (situacao?: string | null, status?: string | null) => {
  // Manual status (Special situations) take precedence
  if (status) {
    if (status === "Cancelado") return { label: "Cancelado", color: "error" as const };
    if (status === "Transferido") return { label: "Transferido", color: "warning" as const };
    if (status === "Desistente") return { label: "Desistente", color: "error" as const };
    return { label: status, color: "default" as const };
  }

  if (!situacao) return { label: "Sem status", color: "default" as const };
  const s = situacao.toUpperCase();

  if (s.startsWith("APR")) {
    return { label: "Aprovado", color: "success" as const };
  }
  if (s === "AR") {
    return { label: "Apr Rec", color: "success" as const };
  }
  if (s.startsWith("REP")) {
    return { label: "Reprovado", color: "error" as const };
  }
  if (s.startsWith("ACC") || s.startsWith("APCC")) {
    return { label: "APCC", color: "info" as const };
  }
  return { label: "Recuperação", color: "warning" as const };
};

export const TurmaDetailPage = () => {
  const { turmaId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetTurmaAlunosQuery(turmaId ?? "", {
    skip: !turmaId
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Não foi possível carregar os alunos desta turma.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Breadcrumbs>
          <Link component={RouterLink} to="/app/turmas" underline="hover">
            Turmas
          </Link>
          <Typography color="text.primary">{data.turma}</Typography>
        </Breadcrumbs>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h5" fontWeight={600}>
            {data.turma}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.turno} • {data.total} alunos
          </Typography>
        </CardContent>
      </Card>

      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Aluno</TableCell>
              <TableCell>Matrícula</TableCell>
              <TableCell>Média</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Notas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.alunos.map((aluno) => {
              const situacao = formatSituacao(aluno.situacao, aluno.status);
              return (
                <TableRow key={aluno.id} hover>
                  <TableCell>
                    <Link
                      component={RouterLink}
                      to={`/app/alunos/${aluno.id}`}
                      color="inherit"
                      underline="hover"
                      fontWeight={600}
                    >
                      {aluno.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{aluno.matricula}</TableCell>
                  <TableCell>{aluno.media ? aluno.media.toFixed(1) : "-"}</TableCell>
                  <TableCell>
                    <Chip label={situacao.label} color={situacao.color} size="small" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {aluno.notas.map((nota) => (
                        <Chip
                          key={`${aluno.id}-${nota.disciplina}`}
                          label={`${nota.disciplina}: ${nota.total ?? "-"}`}
                          variant="outlined"
                          size="small"
                          color={typeof nota.total === 'number' && nota.total < 50 ? "error" : "default"}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};
