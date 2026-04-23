import React, { useState, useMemo } from "react";
import {
    Box,
    Typography,
    Stack,
    Card,
    Button,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Alert,
    CircularProgress,
    IconButton,
    Tooltip,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useListTurmasQuery, useGetTurmaAlunosQuery } from "../../lib/api";
import { AIInterventionBoard } from "./AIInterventionBoard";

export const BulkInterventionPage: React.FC = () => {
    const [selectedTurma, setSelectedTurma] = useState<string>("");
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [showAnalysis, setShowAnalysis] = useState(false);

    const { data: turmasData, isLoading: loadingTurmas } = useListTurmasQuery();
    const { data: turmaAlunos, isLoading: loadingAlunos } = useGetTurmaAlunosQuery(selectedTurma, {
        skip: !selectedTurma,
    });

    const turmas = turmasData?.items ?? [];
    const students = turmaAlunos?.alunos ?? [];

    const handleToggleStudent = (id: number) => {
        setSelectedStudents((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedStudents(students.map((s) => s.id));
        } else {
            setSelectedStudents([]);
        }
    };

    const handleGenerateAnalysis = () => {
        if (selectedStudents.length > 0) {
            setShowAnalysis(true);
        }
    };

    const handleReset = () => {
        setSelectedStudents([]);
        setShowAnalysis(false);
    };

    return (
        <Box>
            <Box mb={4}>
                <Typography variant="h3" fontWeight={800} gutterBottom sx={{ letterSpacing: "-0.02em" }}>
                    Intervenções em Lote
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Selecione uma turma e os alunos para gerar análises pedagógicas e planos de ação automatizados.
                </Typography>
            </Box>

            <Card sx={{ p: 3, mb: 4, borderRadius: 3, border: "1px solid", borderColor: "divider" }} elevation={0}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <FormControl fullWidth sx={{ maxWidth: 300 }}>
                        <InputLabel>Selecionar Turma</InputLabel>
                        <Select
                            value={selectedTurma}
                            label="Selecionar Turma"
                            onChange={(e) => {
                                setSelectedTurma(e.target.value);
                                handleReset();
                            }}
                            disabled={loadingTurmas}
                        >
                            {turmas.map((t) => (
                                <MenuItem key={t.slug || t.turma} value={t.slug || t.turma}>
                                    {t.turma} ({t.turno})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        startIcon={<AutoFixHighIcon />}
                        onClick={handleGenerateAnalysis}
                        disabled={selectedStudents.length === 0 || showAnalysis}
                        sx={{ height: 56, px: 4, borderRadius: 2 }}
                    >
                        Gerar Análise para {selectedStudents.length} Alunos
                    </Button>

                    {showAnalysis && (
                        <IconButton onClick={handleReset} color="secondary">
                            <RefreshIcon />
                        </IconButton>
                    )}
                </Stack>
            </Card>

            {selectedTurma && !showAnalysis && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: "action.hover" }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedStudents.length > 0 && selectedStudents.length < students.length}
                                        checked={students.length > 0 && selectedStudents.length === students.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Aluno</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Matrícula</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Média</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loadingAlunos ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" mt={1}>Carregando alunos...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">Nenhum aluno encontrado nesta turma.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                students.map((student) => (
                                    <TableRow 
                                        key={student.id} 
                                        hover 
                                        sx={{ cursor: "pointer" }}
                                        onClick={() => handleToggleStudent(student.id)}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedStudents.includes(student.id)}
                                                onChange={() => handleToggleStudent(student.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{student.nome}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">{student.matricula}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            {student.media && student.media < 60 ? (
                                                <Chip 
                                                    icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
                                                    label="Em Risco" 
                                                    size="small" 
                                                    color="warning" 
                                                    variant="outlined" 
                                                />
                                            ) : (
                                                <Chip 
                                                    icon={<CheckCircleIcon sx={{ fontSize: "14px !important" }} />}
                                                    label="Regular" 
                                                    size="small" 
                                                    color="success" 
                                                    variant="outlined" 
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" fontWeight={700}>
                                                {student.media?.toFixed(1) || "-"}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {!selectedTurma && (
                <Box textAlign="center" py={8} border="2px dashed" borderColor="divider" borderRadius={3}>
                    <Typography color="text.secondary">Selecione uma turma para começar.</Typography>
                </Box>
            )}

            {showAnalysis && (
                <Box mt={2}>
                    <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                        Exibindo recomendações de intervenção para {selectedStudents.length} alunos selecionados.
                    </Alert>
                    <AIInterventionBoard studentIds={selectedStudents} />
                </Box>
            )}
        </Box>
    );
};
