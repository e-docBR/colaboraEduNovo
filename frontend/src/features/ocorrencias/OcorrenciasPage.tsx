import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid2 as Grid,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography,
    Autocomplete,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem as MuiMenuItem,
    ListItemIcon,
    Tooltip,
    Avatar,
    useTheme,
    Fade,
    Checkbox,
    FormControlLabel
} from "@mui/material";
import { useState, useMemo, useEffect } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import StarIcon from "@mui/icons-material/Star";
import ScheduleIcon from "@mui/icons-material/Schedule";
import BlockIcon from "@mui/icons-material/Block";
import InfoIcon from "@mui/icons-material/Info";
import AddIcon from "@mui/icons-material/Add";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import NotificationsIcon from "@mui/icons-material/Notifications";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { ocorrenciaSchema, getFieldErrors, type ZodFieldErrors } from "../../lib/schemas";

import {
    useCreateOcorrenciaMutation,
    useListOcorrenciasQuery,
    useListAlunosQuery,
    useUpdateOcorrenciaMutation,
    useDeleteOcorrenciaMutation,
    useRenotificarOcorrenciaMutation,
    useUpdateAlunoMutation
} from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

const TIPO_CONFIG: Record<string, { color: string, label: string, icon: React.ElementType, bgcolor: string }> = {
    ADVERTENCIA: { color: "#f59e0b", label: "Advertência", icon: WarningAmberIcon, bgcolor: "#fef3c7" },
    ELOGIO: { color: "#10b981", label: "Elogio", icon: StarIcon, bgcolor: "#d1fae5" },
    ATRASO: { color: "#3b82f6", label: "Atraso", icon: ScheduleIcon, bgcolor: "#dbeafe" },
    SUSPENSAO: { color: "#ef4444", label: "Suspensão", icon: BlockIcon, bgcolor: "#fee2e2" },
    OUTRO: { color: "#6b7280", label: "Outro", icon: InfoIcon, bgcolor: "#f3f4f6" }
};

const GRAVIDADE_CONFIG: Record<string, { color: string, label: string, bgcolor: string }> = {
    LEVE: { color: "#3b82f6", label: "Leve", bgcolor: "#dbeafe" },
    MEDIA: { color: "#f59e0b", label: "Média", bgcolor: "#fef3c7" },
    GRAVE: { color: "#ef4444", label: "Grave", bgcolor: "#fee2e2" },
    GRAVISSIMA: { color: "#7f1d1d", label: "Gravíssima", bgcolor: "#fecaca" }
};

export const OcorrenciasPage = () => {
    const theme = useTheme();
    const { data: alunosData } = useListAlunosQuery({ per_page: 1000 });
    const [createOcorrencia, { isLoading: isCreating }] = useCreateOcorrenciaMutation();
    const [updateOcorrencia] = useUpdateOcorrenciaMutation();
    const [deleteOcorrencia] = useDeleteOcorrenciaMutation();
    const [renotificarOcorrencia] = useRenotificarOcorrenciaMutation();
    const [updateAluno] = useUpdateAlunoMutation();

    const user = useAppSelector((state) => state.auth.user);
    const isStaff = user?.role !== "aluno";
    const canWrite = user?.role === "admin" ||
        user?.role === "super_admin" ||
        user?.role === "coordenacao" ||
        user?.role === "coordenador" ||
        user?.role === "orientacao" ||
        user?.role === "orientador";

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false, message: "", severity: "success"
    });
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const [fieldErrors, setFieldErrors] = useState<ZodFieldErrors>({});
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [alunoId, setAlunoId] = useState<number | null>(null);
    const [tipo, setTipo] = useState("ADVERTENCIA");
    const [descricao, setDescricao] = useState("");
    const [observacaoPais, setObservacaoPais] = useState("");
    const [gravidade, setGravidade] = useState("LEVE");
    const [acaoTomada, setAcaoTomada] = useState("");
    const [notificarResponsaveis, setNotificarResponsaveis] = useState(false);

    // Responsável inline form (quando o aluno não tem contato cadastrado)
    const [showResponsavelForm, setShowResponsavelForm] = useState(false);
    const [novoEmailResponsavel, setNovoEmailResponsavel] = useState("");
    const [novoTelefoneResponsavel, setNovoTelefoneResponsavel] = useState("");
    const [contatosAtualizados, setContatosAtualizados] = useState<Record<number, { email_responsavel?: string; telefone_responsavel?: string }>>({});

    // Menu state
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuOcorrencia, setMenuOcorrencia] = useState<any | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const queryArgs = useMemo(
        () => (dateFrom || dateTo ? { date_from: dateFrom || undefined, date_to: dateTo || undefined } : undefined),
        [dateFrom, dateTo]
    );
    const [pollingInterval, setPollingInterval] = useState(0);
    const { data: ocorrencias, isLoading } = useListOcorrenciasQuery(queryArgs, { pollingInterval });

    useEffect(() => {
        const hasPending = (ocorrencias ?? []).some((o) => o.notificacao_status === "Pendente");
        setPollingInterval(hasPending ? 4000 : 0);
    }, [ocorrencias]);

    const [dataRegistro, setDataRegistro] = useState(new Date().toISOString().split("T")[0]);
    const [filterTurma, setFilterTurma] = useState<string>("");

    const alunoSelecionado = useMemo(
        () => alunosData?.items?.find((a) => a.id === alunoId) || null,
        [alunosData, alunoId]
    );

    const contatoResponsavel = alunoId ? contatosAtualizados[alunoId] : undefined;
    const alunoTemContato = Boolean(
        alunoSelecionado?.email_responsavel ||
        alunoSelecionado?.telefone_responsavel ||
        contatoResponsavel?.email_responsavel ||
        contatoResponsavel?.telefone_responsavel
    );

    const buildNotificationPreview = () => {
        const tipoLabel = TIPO_CONFIG[tipo]?.label || tipo;
        const gravidadeLabel = GRAVIDADE_CONFIG[gravidade]?.label || gravidade;
        const dataStr = dataRegistro ? new Date(dataRegistro + "T00:00:00").toLocaleDateString("pt-BR") : "—";
        const nomeAluno = alunoSelecionado?.nome || "—";
        let msg = `Prezados Pais/Responsáveis,\n\nInformamos o registro de uma ocorrência para o(a) aluno(a) ${nomeAluno}.\n\n📅 Data: ${dataStr}\n📝 Tipo: ${tipoLabel}\n⚠️ Gravidade: ${gravidadeLabel}\n📄 Descrição: ${descricao || "—"}`;
        if (observacaoPais) msg += `\n\n💡 Ação necessária: ${observacaoPais}`;
        msg += `\n\nAtenciosamente,\nCoordenação Pedagógica`;
        return msg;
    };

    const turmas = useMemo(() => {
        if (!alunosData?.items) return [];
        const t = new Set(alunosData.items.map((a) => a.turma).filter(Boolean));
        return Array.from(t).sort();
    }, [alunosData]);

    const filteredAlunos = useMemo(() => {
        let items = alunosData?.items || [];
        if (filterTurma) {
            items = items.filter((a) => a.turma === filterTurma);
        }
        return items;
    }, [alunosData, filterTurma]);

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, ocorrencia: any) => {
        setAnchorEl(event.currentTarget);
        setMenuOcorrencia(ocorrencia);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuOcorrencia(null);
    };

    const filteredOcorrencias = ocorrencias?.filter((oc) => {
        if (!searchTerm) return true;
        const lowTerm = searchTerm.toLowerCase();
        return (
            oc.aluno_nome?.toLowerCase().includes(lowTerm) ||
            oc.descricao?.toLowerCase().includes(lowTerm) ||
            oc.tipo?.toLowerCase().includes(lowTerm)
        );
    }) || [];

    const handleSave = async () => {
        if (!alunoId) return;
        const result = ocorrenciaSchema.safeParse({ aluno_id: alunoId, tipo, descricao, gravidade });
        if (!result.success) {
            setFieldErrors(getFieldErrors(result));
            return;
        }
        setFieldErrors({});
        try {
            // Se o usuário preencheu dados do responsável, atualizar o cadastro do aluno primeiro
            if (!editingId && (novoEmailResponsavel.trim() || novoTelefoneResponsavel.trim())) {
                const emailResponsavel = novoEmailResponsavel.trim();
                const telefoneResponsavel = novoTelefoneResponsavel.trim();
                await updateAluno({
                    id: alunoId,
                    ...(emailResponsavel && { email_responsavel: emailResponsavel }),
                    ...(telefoneResponsavel && { telefone_responsavel: telefoneResponsavel }),
                }).unwrap();
                setContatosAtualizados((prev) => ({
                    ...prev,
                    [alunoId]: {
                        ...prev[alunoId],
                        ...(emailResponsavel && { email_responsavel: emailResponsavel }),
                        ...(telefoneResponsavel && { telefone_responsavel: telefoneResponsavel }),
                    }
                }));
            }

            if (editingId) {
                await updateOcorrencia({
                    id: editingId,
                    tipo,
                    descricao,
                    data_registro: dataRegistro
                }).unwrap();
            } else {
                await createOcorrencia({
                    aluno_id: alunoId,
                    tipo,
                    descricao,
                    observacao_pais: observacaoPais,
                    gravidade,
                    acao_tomada: acaoTomada,
                    data_registro: dataRegistro,
                    notificar_responsaveis: notificarResponsaveis
                }).unwrap();
            }
            setOpen(false);
            resetForm();
            setSnackbar({ open: true, message: editingId ? "Ocorrência atualizada!" : "Ocorrência registrada!", severity: "success" });
        } catch (error: any) {
            const msg = error?.data?.error ?? error?.data?.message ?? "Erro ao salvar ocorrência. Tente novamente.";
            setSnackbar({ open: true, message: msg, severity: "error" });
        }
    };

    const resetForm = () => {
        setDescricao("");
        setObservacaoPais("");
        setAcaoTomada("");
        setGravidade("LEVE");
        setAlunoId(null);
        setEditingId(null);
        setTipo("ADVERTENCIA");
        setDataRegistro(new Date().toISOString().split("T")[0]);
        setFilterTurma("");
        setNotificarResponsaveis(false);
        setShowResponsavelForm(false);
        setNovoEmailResponsavel("");
        setNovoTelefoneResponsavel("");
    };

    const handleEdit = () => {
        if (!menuOcorrencia) return;
        setEditingId(menuOcorrencia.id);
        setAlunoId(menuOcorrencia.aluno_id);
        setTipo(menuOcorrencia.tipo);
        setDescricao(menuOcorrencia.descricao);
        setObservacaoPais(menuOcorrencia.observacao_pais || "");
        setGravidade(menuOcorrencia.gravidade || "LEVE");
        setAcaoTomada(menuOcorrencia.acao_tomada || "");
        // Ensure valid date string
        if (menuOcorrencia.data_registro) {
            setDataRegistro(menuOcorrencia.data_registro.split("T")[0]);
        }
        setOpen(true);
        handleCloseMenu();
    };

    const handleDelete = () => {
        if (!menuOcorrencia) return;
        setDeleteConfirmId(menuOcorrencia.id);
        handleCloseMenu();
    };

    const handleConfirmDelete = async () => {
        if (deleteConfirmId == null) return;
        await deleteOcorrencia(deleteConfirmId);
        setDeleteConfirmId(null);
    };

    const handleToggleResolve = async () => {
        if (!menuOcorrencia) return;
        await updateOcorrencia({
            id: menuOcorrencia.id,
            resolvida: !menuOcorrencia.resolvida
        });
        handleCloseMenu();
    };

    const handleRenotify = async () => {
        if (!menuOcorrencia) return;
        handleCloseMenu();
        try {
            await renotificarOcorrencia(menuOcorrencia.id).unwrap();
            setSnackbar({ open: true, message: "Notificação reenviada! Status: Pendente", severity: "success" });
        } catch {
            setSnackbar({ open: true, message: "Erro ao reenviar notificação", severity: "error" });
        }
    };

    if (!isStaff && !isLoading && (!ocorrencias || ocorrencias.length === 0)) {
        return (
            <Box textAlign="center" py={10}>
                <Typography variant="h6" color="text.secondary">Nenhuma ocorrência registrada.</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh" }}>
            {/* Header - Compact */}
            <Box mb={3} display="flex" flexDirection={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-end" }} gap={2}>
                <Box>
                    <Typography
                        variant="h3"
                        fontWeight={800}
                        sx={{
                            letterSpacing: "-0.02em",
                            color: "text.primary",
                            mb: 0.5
                        }}
                    >
                        Ocorrências
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Registro e acompanhamento disciplinar dos alunos
                    </Typography>
                </Box>
                {canWrite && (
                    <Button
                        variant="contained"
                        onClick={() => setOpen(true)}
                        startIcon={<AddIcon />}
                        sx={{
                            px: 2.5,
                            py: 1,
                            fontWeight: 600,
                            textTransform: "none",
                            bgcolor: "error.main",
                            "&:hover": { bgcolor: "error.dark" }
                        }}
                    >
                        Nova Ocorrência
                    </Button>
                )}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} alignItems="center">
                <TextField
                    placeholder="Buscar por aluno, tipo ou descrição..."
                    fullWidth
                    size="small"
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                    }}
                />
                <TextField
                    label="De"
                    type="date"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <CalendarTodayIcon fontSize="small" color="action" />
                            </InputAdornment>
                        )
                    }}
                    sx={{ minWidth: 170 }}
                />
                <TextField
                    label="Até"
                    type="date"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <CalendarTodayIcon fontSize="small" color="action" />
                            </InputAdornment>
                        )
                    }}
                    sx={{ minWidth: 170 }}
                />
                {(dateFrom || dateTo) && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => { setDateFrom(""); setDateTo(""); }}
                        sx={{ whiteSpace: "nowrap" }}
                    >
                        Limpar datas
                    </Button>
                )}
            </Stack>

            {isLoading ? (
                <Grid container spacing={3}>
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6, lg: 4 }}>
                            <Box sx={{ height: 200, bgcolor: "background.paper", borderRadius: 4, p: 3 }}>
                                <Fade in={true}><CircularProgress /></Fade>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            ) : filteredOcorrencias.length > 0 ? (
                <Grid container spacing={2}>
                    {filteredOcorrencias.map((oc) => {
                        const config = TIPO_CONFIG[oc.tipo] || TIPO_CONFIG["OUTRO"];
                        const Icon = config.icon;

                        return (
                            <Grid key={oc.id} size={{ xs: 12, md: 6, lg: 4 }}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        border: "1px solid",
                                        borderColor: oc.resolvida ? "success.light" : "divider",
                                        bgcolor: "background.paper",
                                        position: "relative",
                                        overflow: "visible",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            transform: "translateY(-2px)",
                                            boxShadow: theme.shadows[2],
                                            borderColor: config.color
                                        }
                                    }}
                                >
                                    {/* Status Indicator Stripe */}
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: 20,
                                            left: 0,
                                            width: 4,
                                            height: 40,
                                            borderTopRightRadius: 4,
                                            borderBottomRightRadius: 4,
                                            bgcolor: config.color
                                        }}
                                    />

                                    <Box p={2.5}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                            <Stack direction="row" spacing={2} alignItems="center">
                                                <Avatar sx={{ bgcolor: config.bgcolor, color: config.color }}>
                                                    <Icon />
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="h6" fontWeight={700} fontSize="1.125rem" lineHeight={1.2}>
                                                        {oc.aluno_nome}
                                                    </Typography>
                                                    <Typography variant="caption" fontSize="0.75rem" color="text.secondary">
                                                        Registrado por {oc.autor_nome}
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            {canWrite && (
                                                <IconButton onClick={(e) => handleOpenMenu(e, oc)} size="small">
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Stack>

                                        <Stack direction="row" spacing={1} mb={2}>
                                            <Chip
                                                label={config.label}
                                                size="small"
                                                sx={{
                                                    bgcolor: config.bgcolor,
                                                    color: config.color,
                                                    fontWeight: 600,
                                                    fontSize: "0.625rem",
                                                    height: 20
                                                }}
                                            />
                                            {oc.gravidade && (
                                                <Chip
                                                    label={GRAVIDADE_CONFIG[oc.gravidade]?.label || oc.gravidade}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: GRAVIDADE_CONFIG[oc.gravidade]?.bgcolor || "divider",
                                                        color: GRAVIDADE_CONFIG[oc.gravidade]?.color || "text.primary",
                                                        fontWeight: 700,
                                                        fontSize: "0.625rem",
                                                        height: 20,
                                                        textTransform: "uppercase"
                                                    }}
                                                />
                                            )}
                                        </Stack>

                                        <Typography
                                            variant="body1"
                                            sx={{
                                                color: "text.primary",
                                                mb: 2,
                                                minHeight: 48,
                                                display: "-webkit-box",
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                                textDecoration: oc.resolvida ? "line-through" : "none",
                                                opacity: oc.resolvida ? 0.6 : 1
                                            }}
                                        >
                                            {oc.descricao}
                                        </Typography>

                                        {oc.acao_tomada && (
                                            <Box mb={2} p={1.5} sx={{ bgcolor: "grey.50", borderRadius: 2, borderLeft: "3px solid", borderColor: "grey.300" }}>
                                                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                                                    AÇÃO TOMADA:
                                                </Typography>
                                                <Typography variant="body2" color="text.primary">
                                                    {oc.acao_tomada}
                                                </Typography>
                                            </Box>
                                        )}

                                        <Stack direction="row" justifyContent="space-between" alignItems="center" pt={2} borderTop="1px solid" borderColor="divider">
                                            <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                                                <CalendarTodayIcon sx={{ fontSize: 14 }} />
                                                <Typography variant="caption" fontWeight={500}>
                                                    {new Date(oc.data_registro).toLocaleDateString()}
                                                </Typography>
                                            </Stack>

                                            {oc.notificacao_status && (() => {
                                                const s = oc.notificacao_status;
                                                const isParcial = s.startsWith("Parcial");
                                                const color = s === "Enviado" ? "success" : s === "Falha" ? "error" : s === "Pendente" ? "warning" : "warning";
                                                const label = isParcial ? "Parcial" : s;
                                                return (
                                                    <Tooltip title={`Notificação: ${s}`}>
                                                        <Chip
                                                            label={label}
                                                            size="small"
                                                            color={color}
                                                            sx={{ height: 20, fontSize: "0.6rem" }}
                                                        />
                                                    </Tooltip>
                                                );
                                            })()}

                                            {oc.resolvida ? (
                                                <Chip
                                                    icon={<CheckCircleIcon sx={{ fontSize: "14px !important" }} />}
                                                    label="Resolvido"
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                    sx={{ height: 24, fontSize: "0.7rem", fontWeight: 600 }}
                                                />
                                            ) : (
                                                <Typography variant="caption" color="warning.main" fontWeight={700}>
                                                    Pendente
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            ) : (
                <Box textAlign="center" py={10} bgcolor="background.paper" borderRadius={4} border="1px dashed" borderColor="divider">
                    <SearchIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" color="text.primary" gutterBottom>Nenhum registro encontrado</Typography>
                </Box>
            )}

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
                PaperProps={{
                    elevation: 3,
                    sx: { borderRadius: 3, minWidth: 150 }
                }}
            >
                <MuiMenuItem onClick={handleEdit}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    Editar
                </MuiMenuItem>
                <MuiMenuItem onClick={handleToggleResolve}>
                    <ListItemIcon><CheckCircleIcon fontSize="small" color={menuOcorrencia?.resolvida ? "disabled" : "success"} /></ListItemIcon>
                    {menuOcorrencia?.resolvida ? "Reabrir" : "Marcar como Resolvido"}
                </MuiMenuItem>
                <MuiMenuItem onClick={handleRenotify}>
                    <ListItemIcon><NotificationsIcon fontSize="small" color="primary" /></ListItemIcon>
                    Reenviar Notificação
                </MuiMenuItem>
                <Divider />
                <MuiMenuItem onClick={handleDelete}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <Typography color="error" variant="body2" fontWeight={600}>Excluir</Typography>
                </MuiMenuItem>
            </Menu>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog open={deleteConfirmId != null} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Excluir ocorrência</DialogTitle>
                <DialogContent>
                    <Typography>Tem certeza que deseja excluir esta ocorrência? Esta ação não pode ser desfeita.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">Excluir</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={open}
                onClose={() => { setOpen(false); resetForm(); }}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: 4 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {editingId ? "Editar Ocorrência" : "Nova Ocorrência"}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {/* Section 1: Identification */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight={700}>Identificação</Typography>
                            <Stack direction="row" spacing={2} alignItems="center" mt={1}>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Filtro Turma</InputLabel>
                                    <Select
                                        value={filterTurma}
                                        label="Filtro Turma"
                                        onChange={(e) => setFilterTurma(e.target.value)}
                                    >
                                        <MenuItem value="">
                                            <em>Todas</em>
                                        </MenuItem>
                                        {turmas.map((t) => (
                                            <MenuItem key={t} value={t}>{t}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Autocomplete
                                    fullWidth
                                    options={filteredAlunos}
                                    getOptionLabel={(option) => `${option.nome} (${option.turma})`}
                                    onChange={(_, value) => setAlunoId(value?.id || null)}
                                    value={alunosData?.items?.find((a) => a.id === alunoId) || null}
                                    renderInput={(params) => <TextField {...params} label="Selecione o Aluno" variant="outlined" size="small" />}
                                    disabled={!!editingId} // Disable student change on edit
                                    ListboxProps={{ style: { maxHeight: 200 } }}
                                />
                            </Stack>
                        </Box>

                        <Divider />

                        {/* Section 2: Details */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight={700}>Detalhes da Ocorrência</Typography>
                            <Grid container spacing={2} mt={0.5}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        type="date"
                                        label="Data do Fato"
                                        value={dataRegistro}
                                        onChange={(e) => setDataRegistro(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Tipo de Ocorrência</InputLabel>
                                        <Select
                                            value={tipo}
                                            label="Tipo de Ocorrência"
                                            onChange={(e) => setTipo(e.target.value)}
                                        >
                                            {Object.entries(TIPO_CONFIG).map(([key, config]) => (
                                                <MenuItem key={key} value={key}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <config.icon fontSize="small" sx={{ color: config.color }} />
                                                        <Typography variant="body2">{config.label}</Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Gravidade</InputLabel>
                                        <Select
                                            value={gravidade}
                                            label="Gravidade"
                                            onChange={(e) => setGravidade(e.target.value)}
                                        >
                                            {Object.entries(GRAVIDADE_CONFIG).map(([key, config]) => (
                                                <MenuItem key={key} value={key}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: config.color }} />
                                                        <Typography variant="body2" fontWeight={600}>{config.label}</Typography>
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        label="Descrição Detalhada do Fato"
                                        fullWidth
                                        multiline
                                        rows={3}
                                        value={descricao}
                                        onChange={(e) => setDescricao(e.target.value)}
                                        placeholder="O que aconteceu?"
                                        error={!!fieldErrors.descricao}
                                        helperText={fieldErrors.descricao}
                                    />
                                </Grid>
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Section 3: Resolution & Communication */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight={700}>Resolução e Comunicação</Typography>
                            <Stack spacing={2} mt={1}>
                                <TextField
                                    fullWidth
                                    label="Medida Disciplinar / Ação Tomada"
                                    multiline
                                    rows={2}
                                    value={acaoTomada}
                                    onChange={(e) => setAcaoTomada(e.target.value)}
                                    placeholder="Ex: Advertência verbal, suspensão de 2 dias..."
                                />

                                <TextField
                                    fullWidth
                                    label="Instruções para os Pais (Aparece na Notificação)"
                                    multiline
                                    rows={2}
                                    value={observacaoPais}
                                    onChange={(e) => setObservacaoPais(e.target.value)}
                                    placeholder="Ex: Favor comparecer à coordenação amanhã às 8h."
                                />

                                {!editingId && (
                                    <Box>
                                        {/* Painel para cadastrar responsável inline quando ainda não há contato */}
                                        {alunoId && !alunoTemContato && (
                                            <Box mb={1}>
                                                <Alert
                                                    severity="warning"
                                                    sx={{ borderRadius: 2 }}
                                                    action={
                                                        <Button
                                                            size="small"
                                                            color="warning"
                                                            startIcon={<ContactPhoneIcon />}
                                                            onClick={() => setShowResponsavelForm(!showResponsavelForm)}
                                                            endIcon={<ExpandMoreIcon sx={{ transform: showResponsavelForm ? "rotate(180deg)" : "none", transition: "0.2s" }} />}
                                                        >
                                                            {showResponsavelForm ? "Fechar" : "Cadastrar"}
                                                        </Button>
                                                    }
                                                >
                                                    Aluno sem contato de responsável — notificação não será enviada.
                                                </Alert>
                                                {showResponsavelForm && (
                                                    <Box mt={1.5} p={2} sx={{ bgcolor: "warning.50", borderRadius: 2, border: "1px solid", borderColor: "warning.200" }}>
                                                        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1.5}>
                                                            CONTATO DO RESPONSÁVEL — será salvo no cadastro do aluno ao registrar a ocorrência
                                                        </Typography>
                                                        <Stack spacing={1.5}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="Email do Responsável"
                                                                type="email"
                                                                value={novoEmailResponsavel}
                                                                onChange={(e) => setNovoEmailResponsavel(e.target.value)}
                                                                placeholder="ex: pai@email.com"
                                                                helperText="Será usado para notificações por e-mail"
                                                            />
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="WhatsApp do Responsável"
                                                                value={novoTelefoneResponsavel}
                                                                onChange={(e) => setNovoTelefoneResponsavel(e.target.value)}
                                                                placeholder="ex: 73999998888"
                                                                helperText="Com DDD, sem espaços ou traços"
                                                            />
                                                        </Stack>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                        <Box p={1.5} sx={{ bgcolor: "error.50", borderRadius: 3, border: "1px solid", borderColor: "error.100" }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={notificarResponsaveis}
                                                        onChange={(e) => setNotificarResponsaveis(e.target.checked)}
                                                        color="error"
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700} color="error.dark">Notificar Responsáveis</Typography>
                                                        <Typography variant="caption" color="text.secondary">Dispara Email e WhatsApp imediatamente</Typography>
                                                    </Box>
                                                }
                                            />
                                            {notificarResponsaveis && (
                                                <Box mt={1.5} p={1.5} sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "error.200" }}>
                                                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                                                        PRÉVIA DA MENSAGEM
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ whiteSpace: "pre-line", fontFamily: "monospace", fontSize: "0.72rem", color: "text.primary" }}>
                                                        {buildNotificationPreview()}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => { setOpen(false); resetForm(); }} sx={{ borderRadius: 2, fontWeight: 600 }}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        color="error" // Keep red for serious action
                        disabled={isCreating || !alunoId}
                        sx={{ borderRadius: 2, fontWeight: 700, px: 4 }}
                    >
                        {editingId ? "Salvar Alterações" : "Registrar Ocorrência"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
