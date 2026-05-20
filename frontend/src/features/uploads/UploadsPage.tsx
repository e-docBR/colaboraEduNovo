import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableRowsIcon from "@mui/icons-material/TableRows";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { useGetJobStatusQuery, useUploadBoletimMutation, useUploadAlunosCsvMutation, type CsvImportResponse } from "../../lib/api";

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
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);

  useEffect(() => {
    if (jobStatus) {
      if (jobStatus.status === "finished") {
        const { count, logs, year } = jobStatus.result || { count: 0, logs: [], year: "?" };
        let msg = `Concluído! ${count} registros processados para o Ano Letivo: ${year}.`;
        if (logs && logs.length > 0) {
          msg += ` (${logs.length} aviso${logs.length !== 1 ? "s" : ""} encontrado${logs.length !== 1 ? "s" : ""})`;
          setProcessingLogs(logs as string[]);
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
    setProcessingLogs([]);
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
            <Alert severity={feedback.type} sx={{ mb: processingLogs.length > 0 ? 1 : 2 }}>
              {feedback.message}
            </Alert>
          )}
          {processingLogs.length > 0 && (
            <Accordion disableGutters sx={{ mb: 2, border: "1px solid", borderColor: "warning.light", borderRadius: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2" color="warning.dark">
                  Ver avisos de importação ({processingLogs.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense disablePadding>
                  {processingLogs.map((log, i) => (
                    <ListItem key={i} divider>
                      <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={log} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
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

      <CsvImportCard />
    </Box>
  );
};

const CSV_TEMPLATE_HEADER = "matricula,nome,turma,turno,sexo,data_nascimento,telefones,email,email_responsavel,telefone_responsavel";

const CsvImportCard = () => {
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<CsvImportResponse | null>(null);
  const [csvError, setCsvError] = useState<string>("");
  const [csvJobId, setCsvJobId] = useState<string | null>(null);

  const [uploadAlunosCsv, { isLoading: isCsvUploading }] = useUploadAlunosCsvMutation();
  const { data: csvJobStatus } = useGetJobStatusQuery(csvJobId || "", {
    pollingInterval: 3000,
    skip: !csvJobId
  });

  useEffect(() => {
    if (!csvJobStatus) return;
    if (csvJobStatus.status === "finished") {
      setCsvJobId(null);
    } else if (csvJobStatus.status === "failed") {
      setCsvError("O processamento falhou no servidor. Verifique os dados e tente novamente.");
      setCsvJobId(null);
    }
  }, [csvJobStatus]);

  const handleCsvSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setCsvError("");
    setCsvResult(null);
    try {
      const result = await uploadAlunosCsv(csvFile).unwrap();
      setCsvResult(result);
      setCsvJobId(result.job_id);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
    } catch (err: unknown) {
      const data = (err as { data?: { error?: string } }).data;
      setCsvError(data?.error ?? "Erro ao enviar o arquivo CSV.");
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADER + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader
        title="Importação de alunos via CSV"
        subheader="Cadastre múltiplos alunos de uma vez a partir de uma planilha CSV"
        avatar={<TableRowsIcon color="primary" />}
      />
      {(isCsvUploading || !!csvJobId) && <LinearProgress />}
      <CardContent>
        <Stack spacing={2}>
          <Alert severity="info" icon={<InfoOutlinedIcon />}>
            O CSV deve conter as colunas <strong>matricula, nome, turma, turno</strong> (obrigatórias). Alunos com
            matrícula já existente são ignorados (não sobrescritos).{" "}
            <Button size="small" onClick={downloadTemplate} sx={{ p: 0, minWidth: 0, textTransform: "none" }}>
              Baixar modelo
            </Button>
          </Alert>

          {csvError && <Alert severity="error">{csvError}</Alert>}

          {csvResult && (
            <Alert severity={csvResult.rows_queued > 0 ? "success" : "warning"}>
              <strong>{csvResult.rows_queued}</strong> linha{csvResult.rows_queued !== 1 ? "s" : ""} enviada
              {csvResult.rows_queued !== 1 ? "s" : ""} para processamento (Job: {csvResult.job_id}).
              {csvResult.parse_errors.length > 0 && (
                <> &nbsp;<Chip label={`${csvResult.parse_errors.length} erros de parse`} size="small" color="warning" /></>
              )}
            </Alert>
          )}

          {csvResult && csvResult.parse_errors.length > 0 && (
            <Box>
              <Typography variant="subtitle2" mb={1}>Linhas com erro (não importadas):</Typography>
              <List dense disablePadding sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                {csvResult.parse_errors.map((err, i) => (
                  <ListItem key={i} divider>
                    <ListItemText
                      primary={`Linha ${err.row}: ${err.message}`}
                      secondary={err.field ? `Campo(s): ${err.field}` : undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {csvJobId && csvJobStatus && (
            <Alert severity="info">
              Processando importação... Status: <strong>{csvJobStatus.status}</strong>
            </Alert>
          )}

          <Box component="form" onSubmit={handleCsvSubmit}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" gap={2}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                sx={{ minWidth: 200 }}
              >
                Selecionar CSV
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </Button>
              <Typography flex={1} color={csvFile ? "text.primary" : "text.secondary"}>
                {csvFile ? csvFile.name : "Nenhum arquivo selecionado"}
              </Typography>
              <Button
                type="submit"
                variant="contained"
                disabled={!csvFile || isCsvUploading || !!csvJobId}
              >
                {isCsvUploading ? "Enviando..." : "Importar alunos"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
