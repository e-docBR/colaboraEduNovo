import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { useState } from "react";
import { useListAcademicYearsQuery, useUpdateAcademicYearStatusMutation } from "../../lib/api";

type YearRow = {
  id: number;
  label: string;
  is_current: boolean;
  status: string;
  closed_at: string | null;
};

type ConfirmState = { year: YearRow; action: "open" | "closed" } | null;

export const AcademicYearsPage = () => {
  const { data: years, isLoading, isError } = useListAcademicYearsQuery();
  const [updateStatus, { isLoading: isUpdating }] = useUpdateAcademicYearStatusMutation();
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      await updateStatus({ yearId: confirm.year.id, status: confirm.action }).unwrap();
      setFeedback({
        type: "success",
        msg: confirm.action === "closed"
          ? `Ano letivo ${confirm.year.label} encerrado com sucesso.`
          : `Ano letivo ${confirm.year.label} reaberto com sucesso.`
      });
    } catch {
      setFeedback({ type: "error", msg: "Erro ao atualizar o ano letivo. Tente novamente." });
    } finally {
      setConfirm(null);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Gestão de Anos Letivos
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Encerre anos anteriores para deixá-los somente leitura. Um ano encerrado pode ser reaberto para correções.
      </Typography>

      {feedback && (
        <Alert severity={feedback.type} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}

      {isLoading && <CircularProgress size={24} />}
      {isError && <Alert severity="error">Erro ao carregar anos letivos.</Alert>}

      {years && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Ano</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Encerrado em</strong></TableCell>
                <TableCell align="right"><strong>Ações</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {years.map((year) => (
                <TableRow key={year.id} hover>
                  <TableCell>
                    {year.label}
                    {year.is_current && (
                      <Chip label="Atual" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {year.status === "closed" ? (
                      <Chip icon={<LockIcon />} label="Encerrado" size="small" color="default" />
                    ) : (
                      <Chip icon={<LockOpenIcon />} label="Aberto" size="small" color="success" />
                    )}
                  </TableCell>
                  <TableCell>
                    {year.closed_at
                      ? new Date(year.closed_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {year.status === "closed" ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LockOpenIcon />}
                        onClick={() => setConfirm({ year, action: "open" })}
                      >
                        Reabrir
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<LockIcon />}
                        disabled={year.is_current}
                        title={year.is_current ? "Não é possível encerrar o ano letivo atual" : ""}
                        onClick={() => setConfirm({ year, action: "closed" })}
                      >
                        Encerrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirm?.action === "closed" ? "Encerrar Ano Letivo" : "Reabrir Ano Letivo"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm?.action === "closed" ? (
              <>
                Deseja encerrar o ano letivo <strong>{confirm.year.label}</strong>?
                <br /><br />
                Após o encerramento, todos os dados deste ano serão <strong>somente leitura</strong>.
                Nenhuma nota, ocorrência ou comunicado poderá ser alterado.
              </>
            ) : (
              <>
                Deseja reabrir o ano letivo <strong>{confirm?.year.label}</strong>?
                <br /><br />
                Os dados voltarão a ser editáveis para todos os usuários.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            color={confirm?.action === "closed" ? "warning" : "primary"}
            variant="contained"
            disabled={isUpdating}
          >
            {isUpdating ? "Aguarde..." : confirm?.action === "closed" ? "Encerrar" : "Reabrir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
