import React, { useEffect, useState } from "react";
import {
    Box,
    Card,
    Typography,
    Stack,
    Chip,
    Avatar,
    Skeleton,
    Grid2 as Grid,
    useTheme,
    Tooltip,
    Alert,
    Button,
    Drawer,
    IconButton,
    Divider,
    TextField,
    Checkbox,
    FormControlLabel,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import CheckIcon from "@mui/icons-material/Check";
import SaveIcon from "@mui/icons-material/Save";

import {
    useGetBulkInterventionsMutation,
    useGeneratePedagogicalPlanMutation,
    useSavePedagogicalPlanFeedbackMutation,
    useGetPedagogicalPlanHistoryQuery,
    PedagogicalAction,
    PedagogicalPlan,
    StudentInterventionAnalysis
} from "../../lib/api";

interface AIInterventionBoardProps {
    studentIds: number[];
}

export const AIInterventionBoard: React.FC<AIInterventionBoardProps> = ({ studentIds }) => {
    const theme = useTheme();
    const [trigger, { data, isLoading, isError }] = useGetBulkInterventionsMutation();
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        if (studentIds.length > 0) {
            trigger({ student_ids: studentIds });
        }
    }, [studentIds, trigger]);

    const handleRefreshList = () => {
        if (studentIds.length > 0) {
            trigger({ student_ids: studentIds });
        }
    };

    if (isLoading) {
        return (
            <Box mt={4}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={2}>
                    <AutoFixHighIcon color="primary" /> Carregando Agente Pedagógico...
                </Typography>
                <Grid container spacing={2}>
                    {[1, 2, 3].map((i) => (
                        <Grid size={{ xs: 12, md: 4 }} key={i}>
                            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    if (isError) {
        return (
            <Box mt={4}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    O Agente Pedagógico Inteligente não está disponível no momento.
                </Alert>
            </Box>
        );
    }

    const students = data?.results || [];
    if (students.length === 0) return null;

    const globalRiskColor = (risk: string) => {
        if (risk === "ALTO") return theme.palette.error.main;
        if (risk === "MEDIO") return theme.palette.warning.main;
        return theme.palette.info.main;
    };

    const handleOpenPlan = (student: any) => {
        setSelectedStudent(student);
        setIsDrawerOpen(true);
    };

    return (
        <Box mt={6}>
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "12px",
                        bgcolor: theme.palette.primary.main + "20",
                        display: "flex",
                        alignItems: "center"
                    }}
                >
                    <AutoFixHighIcon color="primary" />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.01em" }}>
                        Agente Pedagógico Inteligente
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Planos de Ação Individuais gerados por IA com base em notas, faltas, comportamento e diretrizes da escola.
                    </Typography>
                </Box>
            </Stack>

            <Grid container spacing={3}>
                {students.map((student: any) => {
                    const studentName = student.aluno_nome ?? "";
                    const initial = studentName ? studentName[0].toUpperCase() : "?";
                    const riskColor = globalRiskColor(student.global_risk ?? "BAIXO");
                    const hasActivePlan = student.status !== undefined;

                    return (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={student.aluno_id}>
                            <Card
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: 3,
                                    border: "1px solid",
                                    borderColor: hasActivePlan ? theme.palette.primary.main + "30" : "divider",
                                    borderRadius: 4,
                                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                                    position: "relative",
                                    overflow: "hidden",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        borderColor: theme.palette.primary.main + "60",
                                        transform: "translateY(-4px)",
                                        boxShadow: "0 12px 24px -10px rgba(0,0,0,0.08)",
                                    }
                                }}
                            >
                                <Stack spacing={2} height="100%">
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.main + "22", color: theme.palette.primary.main, fontWeight: 700 }}>
                                                {initial}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: 180 }}>
                                                    {studentName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Turma {student.turma || "Não informada"}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                        <Stack direction="row" spacing={0.5}>
                                            <Chip
                                                label={`Risco ${student.global_risk}`}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: "0.65rem",
                                                    fontWeight: 700,
                                                    bgcolor: riskColor + "15",
                                                    color: riskColor,
                                                    borderRadius: 1.5
                                                }}
                                            />
                                            {hasActivePlan && (
                                                <Chip
                                                    label={student.status}
                                                    size="small"
                                                    variant="outlined"
                                                    color={
                                                        student.status === "APROVADO" ? "success" :
                                                        student.status === "PENDENTE" ? "warning" : "error"
                                                    }
                                                    sx={{
                                                        height: 20,
                                                        fontSize: "0.65rem",
                                                        fontWeight: 700,
                                                        borderRadius: 1.5
                                                    }}
                                                />
                                            )}
                                        </Stack>
                                    </Stack>

                                    <Typography variant="body2" color="text.secondary" sx={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: 1.5,
                                        height: 63,
                                        fontStyle: student.diagnostico ? "normal" : "italic"
                                    }}>
                                        {student.diagnostico || student.feedback_usuario || "Nenhum diagnóstico gerado ainda. Inicie o plano pedagógico com o Agente de IA para obter um diagnóstico personalizado."}
                                    </Typography>

                                    <Box mt="auto" pt={2}>
                                        <Button
                                            fullWidth
                                            variant={hasActivePlan ? "outlined" : "contained"}
                                            color="primary"
                                            size="small"
                                            onClick={() => handleOpenPlan(student)}
                                            startIcon={<AutoFixHighIcon />}
                                            sx={{
                                                borderRadius: 2.5,
                                                textTransform: "none",
                                                fontWeight: 600,
                                                py: 1
                                            }}
                                        >
                                            {hasActivePlan ? "Ver Plano Pedagógico" : "Gerar Plano com Agente IA"}
                                        </Button>
                                    </Box>
                                </Stack>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {selectedStudent && (
                <PedagogicalPlanDrawer
                    student={selectedStudent}
                    isOpen={isDrawerOpen}
                    onClose={() => {
                        setIsDrawerOpen(false);
                        setSelectedStudent(null);
                    }}
                    onRefresh={handleRefreshList}
                />
            )}
        </Box>
    );
};
interface PedagogicalPlanDrawerProps {
    student: any;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

const PedagogicalPlanDrawer: React.FC<PedagogicalPlanDrawerProps> = ({ student, isOpen, onClose, onRefresh }) => {
    const theme = useTheme();

    const [generatePlan, { isLoading: isGenerating }] = useGeneratePedagogicalPlanMutation();
    const [saveFeedback, { isLoading: isSaving }] = useSavePedagogicalPlanFeedbackMutation();
    const { data: historyData, isLoading: isLoadingHistory } = useGetPedagogicalPlanHistoryQuery(
        student.aluno_id,
        { skip: !student.aluno_id }
    );

    // Form states
    const [diagnostico, setDiagnostico] = useState("");
    const [metas, setMetas] = useState<string[]>([]);
    const [acoes, setAcoes] = useState<PedagogicalAction[]>([]);
    const [feedbackUsuario, setFeedbackUsuario] = useState("");
    const [planId, setPlanId] = useState<number | null>(null);
    const [status, setStatus] = useState<string>("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Meta additions
    const [newMeta, setNewMeta] = useState("");

    // Action addition/edit state
    const [editingActionIdx, setEditingActionIdx] = useState<number | null>(null);
    const [actionForm, setActionForm] = useState<PedagogicalAction>({
        title: "",
        description: "",
        priority: "MEDIUM",
        type: "ACADEMIC"
    });
    const [isAddingAction, setIsAddingAction] = useState(false);

    // Load initial data
    useEffect(() => {
        if (student) {
            setPlanId(student.id || null);
            setStatus(student.status || "");
            setDiagnostico(student.diagnostico || "");
            setMetas(student.metas || []);
            setAcoes(student.acoes_finais || student.acoes || student.interventions || []);
            setFeedbackUsuario(student.feedback_usuario || "");
            setEditingActionIdx(null);
            setIsAddingAction(false);
            setErrorMsg(null);
        }
    }, [student]);

    const handleGenerate = async () => {
        setErrorMsg(null);
        try {
            const plan = await generatePlan({ aluno_id: student.aluno_id }).unwrap();
            setPlanId(plan.id);
            setStatus(plan.status);
            setDiagnostico(plan.diagnostico);
            setMetas(plan.metas);
            setAcoes(plan.acoes);
            setFeedbackUsuario(plan.feedback_usuario || "");
            onRefresh();
        } catch (err: any) {
            console.error("Erro ao gerar plano pedagógico", err);
            const msg = err?.data?.error || "Erro ao gerar plano pedagógico. Tente novamente.";
            setErrorMsg(msg);
        }
    };

    const handleSaveFeedback = async (targetStatus: "APROVADO" | "REJEITADO") => {
        if (!planId) return;
        setErrorMsg(null);
        try {
            await saveFeedback({
                id: planId,
                status: targetStatus,
                feedback_usuario: feedbackUsuario,
                acoes_finais: acoes
            }).unwrap();
            onRefresh();
            onClose();
        } catch (err: any) {
            console.error("Erro ao salvar feedback", err);
            const msg = err?.data?.error || "Erro ao salvar feedback pedagógico.";
            setErrorMsg(msg);
        }
    };

    const handleAddMeta = () => {
        if (newMeta.trim()) {
            setMetas([...metas, newMeta.trim()]);
            setNewMeta("");
        }
    };

    const handleRemoveMeta = (index: number) => {
        setMetas(metas.filter((_, i) => i !== index));
    };

    const handleToggleMeta = (index: number, text: string) => {
        // Just visual toggle/remove
    };

    // Action actions
    const handleStartEditAction = (index: number) => {
        setEditingActionIdx(index);
        setActionForm({ ...acoes[index] });
        setIsAddingAction(false);
    };

    const handleSaveAction = () => {
        if (!actionForm.title.trim() || !actionForm.description.trim()) return;

        if (editingActionIdx !== null) {
            const updated = [...acoes];
            updated[editingActionIdx] = { ...actionForm };
            setAcoes(updated);
            setEditingActionIdx(null);
        } else if (isAddingAction) {
            setAcoes([...acoes, { ...actionForm }]);
            setIsAddingAction(false);
        }
    };

    const handleRemoveAction = (index: number) => {
        setAcoes(acoes.filter((_, i) => i !== index));
    };

    const handleStartAddAction = () => {
        setIsAddingAction(true);
        setEditingActionIdx(null);
        setActionForm({
            title: "",
            description: "",
            priority: "MEDIUM",
            type: "ACADEMIC"
        });
    };

    const actionPriorityColor = (priority: string) => {
        if (priority === "HIGH") return "error";
        if (priority === "MEDIUM") return "warning";
        return "info";
    };

    const actionTypeLabel = (type: string) => {
        if (type === "ACADEMIC") return "Acadêmica";
        if (type === "BEHAVIORAL") return "Comportamental";
        return "Emergencial";
    };

    const isPendingDraft = status === "PENDENTE" || !status;

    return (
        <Drawer
            anchor="right"
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: "100%", md: 640 },
                    p: 4,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    bgcolor: "background.paper",
                    backgroundImage: "none"
                }
            }}
        >
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.01em" }}>
                        Plano Pedagógico de Intervenção
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {student.aluno_nome} — Turma {student.turma || "Não informada"}
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Stack>

            <Divider sx={{ mb: 3 }} />

            {/* Scrollable Content */}
            <Box sx={{ flex: 1, overflowY: "auto", pr: 1, mb: 2 }}>
                {errorMsg && (
                    <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ borderRadius: 2, mb: 2 }}>
                        {errorMsg}
                    </Alert>
                )}
                {isGenerating ? (
                    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8} gap={2}>
                        <CircularProgress />
                        <Typography color="text.secondary" fontWeight={500}>
                            O Agente de IA está formulando o plano pedagógico ideal...
                        </Typography>
                    </Box>
                ) : !planId ? (
                    // Initial fallback prompt to generate
                    <Box py={4} textAlign="center">
                        <AutoFixHighIcon color="primary" sx={{ fontSize: 48, mb: 2, opacity: 0.8 }} />
                        <Typography variant="subtitle1" fontWeight={700} mb={1}>
                            Nenhum Plano IA Gerado
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={3} px={4}>
                            Deseja iniciar o Agente Pedagógico para analisar os dados acadêmicos e disciplinares deste aluno e gerar um plano estruturado de forma autônoma?
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AutoFixHighIcon />}
                            onClick={handleGenerate}
                            sx={{ borderRadius: 2.5, px: 3, textTransform: "none", fontWeight: 600 }}
                        >
                            Gerar Plano Pedagógico com Agente IA
                        </Button>
                    </Box>
                ) : (
                    <Stack spacing={3.5}>
                        {/* Status alert */}
                        {status === "APROVADO" && (
                            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ borderRadius: 2 }}>
                                Este plano foi aprovado pelo corpo pedagógico e está ativo.
                            </Alert>
                        )}
                        {status === "REJEITADO" && (
                            <Alert severity="error" icon={<CancelIcon />} sx={{ borderRadius: 2 }}>
                                Este plano foi rejeitado e arquivado.
                            </Alert>
                        )}

                        {/* Diagnostico */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                                1. Diagnóstico Geral IA
                            </Typography>
                            <Card
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    bgcolor: theme.palette.action.hover,
                                    borderRadius: 3,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    lineHeight: 1.6
                                }}
                            >
                                <Typography variant="body2" color="text.primary" fontWeight={500}>
                                    {diagnostico}
                                </Typography>
                            </Card>
                        </Box>

                        {/* Metas */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5}>
                                2. Metas de Curto Prazo ({metas.length})
                            </Typography>
                            <Stack spacing={1} mb={2}>
                                {metas.map((meta, index) => (
                                    <Stack
                                        key={index}
                                        direction="row"
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2.5,
                                            border: "1px solid",
                                            borderColor: "divider",
                                            bgcolor: "background.paper"
                                        }}
                                    >
                                        <FormControlLabel
                                            control={<Checkbox size="small" defaultChecked disabled={!isPendingDraft} />}
                                            label={<Typography variant="body2" fontWeight={500}>{meta}</Typography>}
                                            sx={{ mr: 0 }}
                                        />
                                        {isPendingDraft && (
                                            <IconButton size="small" color="error" onClick={() => handleRemoveMeta(index)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Stack>
                                ))}
                                {metas.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                        Nenhuma meta definida.
                                    </Typography>
                                )}
                            </Stack>

                            {isPendingDraft && (
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        placeholder="Adicionar nova meta educacional..."
                                        value={newMeta}
                                        onChange={(e) => setNewMeta(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleAddMeta();
                                            }
                                        }}
                                        sx={{
                                            "& .MuiOutlinedInput-root": {
                                                borderRadius: 2.5
                                            }
                                        }}
                                    />
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleAddMeta}
                                        sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600 }}
                                    >
                                        Adicionar
                                    </Button>
                                </Stack>
                            )}
                        </Box>

                        {/* Acoes recomendadas */}
                        <Box>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                                <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                                    3. Plano de Ações Pedagógicas ({acoes.length})
                                </Typography>
                                {isPendingDraft && !isAddingAction && (
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={handleStartAddAction}
                                        sx={{ textTransform: "none", fontWeight: 600 }}
                                    >
                                        Nova Ação
                                    </Button>
                                )}
                            </Stack>

                            {/* Form for adding/editing actions inline */}
                            {(isAddingAction || editingActionIdx !== null) && (
                                <Card
                                    elevation={0}
                                    sx={{
                                        p: 2.5,
                                        border: "1px solid",
                                        borderColor: "primary.main",
                                        borderRadius: 3,
                                        mb: 3,
                                        bgcolor: theme.palette.primary.main + "03"
                                    }}
                                >
                                    <Typography variant="subtitle2" fontWeight={700} color="primary" mb={2}>
                                        {isAddingAction ? "Nova Ação Pedagógica" : "Editar Ação Pedagógica"}
                                    </Typography>
                                    <Stack spacing={2}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Título da Ação"
                                            value={actionForm.title}
                                            onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                                        />
                                        <TextField
                                            size="small"
                                            fullWidth
                                            multiline
                                            rows={3}
                                            label="Descrição Detalhada"
                                            value={actionForm.description}
                                            onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                                        />
                                        <Stack direction="row" spacing={2}>
                                            <FormControl size="small" fullWidth>
                                                <InputLabel>Prioridade</InputLabel>
                                                <Select
                                                    label="Prioridade"
                                                    value={actionForm.priority}
                                                    onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value as any })}
                                                >
                                                    <MenuItem value="HIGH">Alta</MenuItem>
                                                    <MenuItem value="MEDIUM">Média</MenuItem>
                                                    <MenuItem value="LOW">Baixa</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControl size="small" fullWidth>
                                                <InputLabel>Categoria</InputLabel>
                                                <Select
                                                    label="Categoria"
                                                    value={actionForm.type}
                                                    onChange={(e) => setActionForm({ ...actionForm, type: e.target.value as any })}
                                                >
                                                    <MenuItem value="ACADEMIC">Acadêmica</MenuItem>
                                                    <MenuItem value="BEHAVIORAL">Comportamental</MenuItem>
                                                    <MenuItem value="EMERGENCY">Emergencial</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Stack>
                                        <Stack direction="row" spacing={1.5} justifyContent="flex-end" pt={1}>
                                            <Button
                                                size="small"
                                                color="inherit"
                                                onClick={() => {
                                                    setEditingActionIdx(null);
                                                    setIsAddingAction(false);
                                                }}
                                                sx={{ textTransform: "none", fontWeight: 600 }}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={handleSaveAction}
                                                startIcon={<SaveIcon />}
                                                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                                            >
                                                Salvar Ação
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Card>
                            )}

                            <Stack spacing={1.5}>
                                {acoes.map((action, index) => (
                                    <Card
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            p: 2.5,
                                            border: "1px solid",
                                            borderColor: "divider",
                                            borderRadius: 3,
                                            position: "relative",
                                            overflow: "hidden"
                                        }}
                                    >
                                        {/* Priority Strip */}
                                        <Box
                                            sx={{
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                width: "4px",
                                                height: "100%",
                                                bgcolor: `${actionPriorityColor(action.priority)}.main`
                                            }}
                                        />

                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="body2" fontWeight={700}>
                                                        {action.title}
                                                    </Typography>
                                                    <Chip
                                                        label={actionTypeLabel(action.type)}
                                                        size="small"
                                                        sx={{
                                                            height: 16,
                                                            fontSize: "0.58rem",
                                                            fontWeight: 600,
                                                            borderRadius: 1
                                                        }}
                                                    />
                                                </Stack>
                                                {isPendingDraft && (
                                                    <Stack direction="row" spacing={0.5}>
                                                        <IconButton size="small" onClick={() => handleStartEditAction(index)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleRemoveAction(index)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                )}
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary" lineHeight={1.5}>
                                                {action.description}
                                            </Typography>
                                        </Stack>
                                    </Card>
                                ))}
                                {acoes.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                        Nenhuma ação pedagógica recomendada.
                                    </Typography>
                                )}
                            </Stack>
                        </Box>

                        {/* Feedback Usuario */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                                4. Observações / Comentários do Coordenador
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                placeholder="Insira observações adicionais sobre o aluno ou sobre a aplicação deste plano..."
                                value={feedbackUsuario}
                                onChange={(e) => setFeedbackUsuario(e.target.value)}
                                disabled={!isPendingDraft}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 3
                                    }
                                }}
                            />
                        </Box>

                        {/* Historico */}
                        <Box>
                            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5} display="flex" alignItems="center" gap={1}>
                                <HistoryIcon fontSize="small" /> Histórico de Planos do Aluno
                            </Typography>
                            {isLoadingHistory ? (
                                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
                            ) : historyData && historyData.length > 0 ? (
                                <Stack spacing={1}>
                                    {historyData.map((histPlan) => (
                                        <Accordion key={histPlan.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, "&:before": { display: "none" } }}>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Stack direction="row" spacing={1.5} alignItems="center" width="100%">
                                                    <CheckCircleIcon color="success" fontSize="small" />
                                                    <Typography variant="body2" fontWeight={700}>
                                                        Plano Ativo ({new Date(histPlan.updated_at).toLocaleDateString("pt-BR")})
                                                    </Typography>
                                                    <Chip label={`Risco ${histPlan.global_risk}`} size="small" sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700 }} />
                                                </Stack>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                <Stack spacing={1.5}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                                        DIAGNÓSTICO ANTERIOR:
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {histPlan.diagnostico}
                                                    </Typography>
                                                    {histPlan.feedback_usuario && (
                                                        <>
                                                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                                                OBSERVAÇÕES:
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {histPlan.feedback_usuario}
                                                            </Typography>
                                                        </>
                                                    )}
                                                </Stack>
                                            </AccordionDetails>
                                        </Accordion>
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                    Nenhum histórico de planos aprovados para este aluno.
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Footer Buttons */}
            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={onClose}
                    disabled={isSaving}
                    sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600 }}
                >
                    Fechar
                </Button>

                {planId && isPendingDraft && (
                    <>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<RefreshIcon />}
                            onClick={handleGenerate}
                            disabled={isGenerating || isSaving}
                            sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600 }}
                        >
                            Regerar IA
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={() => handleSaveFeedback("REJEITADO")}
                            disabled={isGenerating || isSaving}
                            sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600 }}
                        >
                            Rejeitar
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CheckIcon />}
                            onClick={() => handleSaveFeedback("APROVADO")}
                            disabled={isGenerating || isSaving}
                            sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600 }}
                        >
                            Aprovar e Ativar
                        </Button>
                    </>
                )}
            </Stack>
        </Drawer>
    );
};
