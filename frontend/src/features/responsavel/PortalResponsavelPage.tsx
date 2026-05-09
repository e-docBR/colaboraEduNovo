import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography
} from "@mui/material";
import { useState } from "react";
import GradeIcon from "@mui/icons-material/Grade";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PersonIcon from "@mui/icons-material/Person";

import { useGetMeuFilhoQuery, useMarkComunicadoReadMutation } from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

const formatNota = (value?: number | null) => (typeof value === "number" ? value.toFixed(1) : "-");

const formatSituacao = (value?: string | null) => {
  if (!value) return { label: "-", color: "default" as const };
  const n = value.toUpperCase();
  if (n.startsWith("APR")) return { label: "Aprovado", color: "success" as const };
  if (n.startsWith("REC")) return { label: "Recuperação", color: "warning" as const };
  if (n.startsWith("REP")) return { label: "Reprovado", color: "error" as const };
  return { label: value, color: "default" as const };
};

export const PortalResponsavelPage = () => {
  const role = useAppSelector((s) => s.auth.user?.role);
  const [tab, setTab] = useState(0);

  const { data, isLoading, isError } = useGetMeuFilhoQuery(undefined, {
    skip: role !== "responsavel"
  });
  const [markRead] = useMarkComunicadoReadMutation();

  if (role !== "responsavel") {
    return <Alert severity="warning">Esta página é exclusiva para responsáveis.</Alert>;
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Não foi possível carregar os dados do seu filho(a).</Alert>;
  }

  const { aluno, ocorrencias, comunicados } = data;
  const unreadCount = comunicados.filter((c) => !c.lido).length;
  const ocorAbertas = ocorrencias.filter((o) => !o.resolvida).length;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Header card */}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <PersonIcon sx={{ fontSize: 48, color: "primary.main" }} />
            <Box flex={1}>
              <Typography variant="h5" fontWeight={700}>{aluno.nome}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
                <Chip label={`Turma: ${aluno.turma}`} size="small" />
                <Chip label={aluno.turno} size="small" />
                <Chip label={`Matrícula: ${aluno.matricula}`} size="small" variant="outlined" />
              </Stack>
            </Box>
            <Stack spacing={1} alignItems={{ sm: "flex-end" }}>
              {aluno.media !== undefined && aluno.media !== null && (
                <Chip
                  label={`Média Geral: ${aluno.media.toFixed(1)}`}
                  color={aluno.media >= 70 ? "success" : aluno.media < 50 ? "error" : "warning"}
                />
              )}
              {ocorAbertas > 0 && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label={`${ocorAbertas} ocorrência${ocorAbertas > 1 ? "s" : ""} aberta${ocorAbertas > 1 ? "s" : ""}`}
                  color="warning"
                  size="small"
                />
              )}
              {unreadCount > 0 && (
                <Chip
                  icon={<NotificationsIcon />}
                  label={`${unreadCount} comunicado${unreadCount > 1 ? "s" : ""} não lido${unreadCount > 1 ? "s" : ""}`}
                  color="primary"
                  size="small"
                />
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<GradeIcon />} iconPosition="start" label="Boletim" />
          <Tab
            icon={<WarningAmberIcon />}
            iconPosition="start"
            label={`Ocorrências${ocorAbertas > 0 ? ` (${ocorAbertas})` : ""}`}
          />
          <Tab
            icon={<NotificationsIcon />}
            iconPosition="start"
            label={`Comunicados${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          />
        </Tabs>
      </Box>

      {/* Tab: Boletim */}
      {tab === 0 && (
        <Card>
          <CardHeader title="Boletim Escolar" subheader={`${aluno.turma} — ${aluno.turno}`} />
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Disciplina</TableCell>
                    <TableCell align="center">1º Tri</TableCell>
                    <TableCell align="center">2º Tri</TableCell>
                    <TableCell align="center">3º Tri</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Faltas</TableCell>
                    <TableCell align="center">Situação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aluno.notas.map((nota) => {
                    const { label, color } = formatSituacao(nota.situacao);
                    return (
                      <TableRow key={nota.id} hover>
                        <TableCell>{nota.disciplina}</TableCell>
                        <TableCell align="center">{formatNota(nota.trimestre1)}</TableCell>
                        <TableCell align="center">{formatNota(nota.trimestre2)}</TableCell>
                        <TableCell align="center">{formatNota(nota.trimestre3)}</TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={600}>{formatNota(nota.total)}</Typography>
                        </TableCell>
                        <TableCell align="center">{nota.faltas ?? 0}</TableCell>
                        <TableCell align="center">
                          <Chip label={label} color={color} size="small" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {aluno.notas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">Nenhuma nota lançada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab: Ocorrências */}
      {tab === 1 && (
        <Card>
          <CardHeader
            title="Ocorrências"
            subheader="Registro de ocorrências disciplinares e de desempenho"
          />
          <CardContent sx={{ p: 0 }}>
            {ocorrencias.length === 0 ? (
              <Box p={3} textAlign="center">
                <CheckCircleOutlineIcon color="success" sx={{ fontSize: 40 }} />
                <Typography color="text.secondary" mt={1}>Nenhuma ocorrência registrada.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {ocorrencias.map((oc, i) => (
                  <Box key={oc.id}>
                    {i > 0 && <Divider />}
                    <ListItem alignItems="flex-start">
                      <ListItemIcon sx={{ mt: 1 }}>
                        <FiberManualRecordIcon
                          sx={{ fontSize: 12 }}
                          color={oc.resolvida ? "disabled" : "warning"}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography fontWeight={600}>{oc.tipo}</Typography>
                            {oc.gravidade && <Chip label={oc.gravidade} size="small" />}
                            <Chip
                              label={oc.resolvida ? "Resolvida" : "Aberta"}
                              color={oc.resolvida ? "default" : "warning"}
                              size="small"
                            />
                          </Stack>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {oc.data_registro
                                ? new Date(oc.data_registro).toLocaleDateString("pt-BR")
                                : ""}
                            </Typography>
                            <Typography variant="body2">{oc.descricao}</Typography>
                            {oc.observacao_pais && (
                              <Typography variant="body2" color="primary" mt={0.5}>
                                <strong>Nota para responsável:</strong> {oc.observacao_pais}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Comunicados */}
      {tab === 2 && (
        <Card>
          <CardHeader title="Comunicados" subheader="Avisos e informações da escola" />
          <CardContent sx={{ p: 0 }}>
            {comunicados.length === 0 ? (
              <Box p={3} textAlign="center">
                <Typography color="text.secondary">Nenhum comunicado recente.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {comunicados.map((com, i) => (
                  <Box key={com.id}>
                    {i > 0 && <Divider />}
                    <ListItem
                      alignItems="flex-start"
                      sx={{ backgroundColor: com.lido ? "transparent" : "action.hover" }}
                      onClick={() => {
                        if (!com.lido) markRead(com.id);
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={com.lido ? 400 : 700}>{com.titulo}</Typography>
                            {!com.lido && <Chip label="Novo" color="primary" size="small" />}
                          </Stack>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" color="text.secondary">
                              {com.data_envio
                                ? new Date(com.data_envio).toLocaleDateString("pt-BR")
                                : ""}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                              {com.conteudo}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
