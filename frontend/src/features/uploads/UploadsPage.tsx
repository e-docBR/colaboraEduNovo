import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { useGetJobStatusQuery, useUploadBoletimMutation } from "../../lib/api";

const turnos = ["Matutino", "Vespertino", "Noturno"];

export const UploadsPage = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [turno, setTurno] = useState("");
  const [turma, setTurma] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const [uploadBoletim, { isLoading: isUploading }] = useUploadBoletimMutation();
  const { data: jobStatus } = useGetJobStatusQuery(currentJobId || "", {
    pollingInterval: 5000,
    skip: !currentJobId
  });

  const [queuedStartTime, setQueuedStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (jobStatus) {
      if (jobStatus.status === "finished") {
        const { count, logs, year } = jobStatus.result || { count: 0, logs: [], year: "?" };
        let msg = `Concluído! ${count} registros processados para o Ano Letivo: ${year}.`;
        if (logs && logs.length > 0) {
          msg += ` (${logs.length} avisos encontrados)`;
          console.warn("Logs de processamento:", logs);
        }
        setFeedback({ type: "success", message: msg });
        setCurrentJobId(null);
        setQueuedStartTime(null);
      } else if (jobStatus.status === "failed") {
        setFeedback({ type: "error", message: "Erro no processamento do arquivo. Verifique o formato do PDF." });
        setCurrentJobId(null);
        setQueuedStartTime(null);
      } else if (jobStatus.status === "queued") {
        if (!queuedStartTime) {
          setQueuedStartTime(Date.now());
        } else if (Date.now() - queuedStartTime > 15000) {
          setFeedback({
            type: "error",
            message: "O processamento está demorando mais que o esperado. O serviço de ingestão pode estar temporariamente offline."
          });
        } else {
          setFeedback({ type: "info", message: "Arquivo na fila... Aguardando processamento." });
        }
      } else {
        setFeedback({ type: "info", message: `Processando arquivo... Status: ${jobStatus.status}` });
        setQueuedStartTime(null);
      }
    }
  }, [jobStatus, queuedStartTime]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected ?? null);
  };

  const resetForm = () => {
    setTurno("");
    setTurma("");
    setFile(null);
    setFeedback(null);
    setCurrentJobId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !turno || !turma) {
      setFeedback({ type: "error", message: "Preencha turno, turma e selecione um PDF." });
      return;
    }
    try {
      const response = await uploadBoletim({ file, turno, turma }).unwrap();
      setFeedback({
        type: "info",
        message: `Upload recebido. Iniciando processamento (Job: ${response.job_id})...`
      });
      setCurrentJobId(response.job_id);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message =
        (error as { data?: { error?: string; detail?: string } }).data?.error ||
        (error as { data?: { detail?: string } }).data?.detail ||
        "Falha ao enviar boletim";
      setFeedback({ type: "error", message });
    }
  };

  const canSubmit = Boolean(file && turno && turma && !isUploading && !currentJobId);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Card>
        <CardHeader
          title="Upload de boletins PDF"
          subheader="Envie arquivos por turno/turma para acionar a ingestão automática"
        />
        {(isUploading || !!currentJobId) && <LinearProgress />}
        <CardContent>
          {feedback && (
            <Alert severity={feedback.type} sx={{ mb: 2 }}>
              {feedback.message}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
            <Stack direction={{ xs: "column", md: "row" }} gap={2}>
              <TextField
                label="Turno"
                select
                SelectProps={{ native: true }}
                value={turno}
                onChange={(event) => setTurno(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {turnos.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </TextField>
              <TextField
                label="Turma"
                placeholder="Ex: 6º A"
                value={turma}
                onChange={(event) => setTurma(event.target.value)}
                required
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} alignItems="center" gap={2}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                sx={{ minWidth: 200 }}
              >
                Selecionar PDF
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              <Typography flex={1} color={file ? "text.primary" : "text.secondary"}>
                {file ? file.name : "Nenhum arquivo selecionado"}
              </Typography>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                Enviar para ingestão
              </Button>
              <Button variant="outlined" onClick={resetForm} disabled={isUploading || !!currentJobId}>
                Limpar
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" gap={2}>
            <InfoOutlinedIcon color="primary" />
            <Box>
              <Typography fontWeight={600}>Regras do processamento</Typography>
              <Typography variant="body2" color="text.secondary">
                Os PDFs enviados são organizados automaticamente na pasta configurada (por turno/turma) e
                processados imediatamente. Alunos existentes são atualizados e novos registros são criados a
                partir das disciplinas encontradas.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
