import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
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
    IconButton,
    Menu,
    MenuItem as MuiMenuItem,
    ListItemIcon,
    Chip,
    Avatar,
    useTheme,
    Fade,
    Autocomplete
} from "@mui/material";
import { useState, useMemo } from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArchiveIcon from "@mui/icons-material/Archive";
import AddIcon from "@mui/icons-material/Add";
import CampaignIcon from "@mui/icons-material/Campaign";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import PushPinIcon from "@mui/icons-material/PushPin"; // Pinnned
import HistoryIcon from "@mui/icons-material/History"; // Archived
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

import {
    useCreateComunicadoMutation,
    useListComunicadosQuery,
    useUpdateComunicadoMutation,
    useDeleteComunicadoMutation,
    useMarkComunicadoReadMutation,
    useListAlunosQuery,
    useGetComunicadoLeiturasQuery
} from "../../lib/api";
import { useAppSelector } from "../../app/hooks";

export const ComunicadosPage = () => {
    const theme = useTheme();
    const { data: comunicadosData, isLoading } = useListComunicadosQuery();
    const comunicados = comunicadosData?.items;
    const [createComunicado, { isLoading: isCreating }] = useCreateComunicadoMutation();
    const [updateComunicado] = useUpdateComunicadoMutation();
    const [deleteComunicado] = useDeleteComunicadoMutation();
    const [markRead] = useMarkComunicadoReadMutation();

    const user = useAppSelector((state) => state.auth.user);
    const isAdmin = user?.role === "admin" ||
        user?.role === "super_admin" ||
        user?.role === "coordenacao" ||
        user?.role === "coordenador" ||
        user?.role === "orientacao" ||
        user?.role === "orientador";

    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [titulo, setTitulo] = useState("");
    const [conteudo, setConteudo] = useState("");
    const [targetType, setTargetType] = useState("TODOS");
    const [targetValue, setTargetValue] = useState("");

    // For filtering turmas
    const { data: alunosData } = useListAlunosQuery({ per_page: 1000 });
    const turmas = useMemo(() => {
        if (!alunosData?.items) return [];
        // Extract unique turmas
        const t = new Set(alunosData.items.map((a: any) => a.turma).filter(Boolean));
        return Array.from(t).sort();
    }, [alunosData]);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false, message: "", severity: "success"
    });

    // Leituras dialog state
    const [leiturasDialogId, setLeiturasDialogId] = useState<number | null>(null);
    const { data: leiturasData, isFetching: isFetchingLeituras } = useGetComunicadoLeiturasQuery(
        leiturasDialogId as number,
        { skip: leiturasDialogId === null }
    );

    // Menu state
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuComunicado, setMenuComunicado] = useState<any | null>(null);

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, comm: any) => {
        setAnchorEl(event.currentTarget);
        setMenuComunicado(comm);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuComunicado(null);
    };

    const handleSave = async () => {
        try {
            if (editingId) {
                await updateComunicado({ id: editingId, titulo, conteudo }).unwrap();
            } else {
                await createComunicado({ titulo, conteudo, target_type: targetType, target_value: targetValue }).unwrap();
            }
            setOpen(false);
            resetForm();
            setSnackbar({ open: true, message: editingId ? "Comunicado atualizado!" : "Comunicado publicado!", severity: "success" });
        } catch (error: any) {
            const msg = error?.data?.error ?? error?.data?.message ?? "Erro ao salvar comunicado. Tente novamente.";
            setSnackbar({ open: true, message: msg, severity: "error" });
        }
    };

    const resetForm = () => {
        setTitulo("");
        setConteudo("");
        setEditingId(null);
        setTargetType("TODOS");
        setTargetValue("");
    };

    const handleEdit = () => {
        if (!menuComunicado) return;
        setEditingId(menuComunicado.id);
        setTitulo(menuComunicado.titulo);
        setConteudo(menuComunicado.conteudo);
        setTargetType("TODOS");
        setOpen(true);
        handleCloseMenu();
    };

    const handleDelete = async () => {
        if (!menuComunicado) return;
        if (confirm("Tem certeza que deseja excluir este comunicado?")) {
            await deleteComunicado(menuComunicado.id);
        }
        handleCloseMenu();
    };

    const handleToggleArchive = async () => {
        if (!menuComunicado) return;
        await updateComunicado({
            id: menuComunicado.id,
            arquivado: !menuComunicado.arquivado
        });
        handleCloseMenu();
    };

    const handleMarkRead = async (id: number, isRead?: boolean) => {
        if (!isAdmin && !isRead) {
            try {
                await markRead(id).unwrap();
            } catch {
                // Falha silenciosa — marcar como lido é operação não-crítica
            }
        }
    };

    // Sort: Pinned/Active first, then by date desc
    // Sort: Unread first (for students), then archived last, then by date desc
    const sortedComunicados = [...(comunicados ?? [])].sort((a, b) => {
        // Archived always last
        if (a.arquivado && !b.arquivado) return 1;
        if (!a.arquivado && b.arquivado) return -1;

        // For students, unread first
        if (!isAdmin) {
            if (!a.is_read && b.is_read) return -1;
            if (a.is_read && !b.is_read) return 1;
        }

        return new Date(b.data_envio).getTime() - new Date(a.data_envio).getTime();
    });

    const getTargetIcon = (type?: string) => {
        switch (type) {
            case "TURMA": return <GroupsIcon fontSize="small" />;
            case "ALUNO": return <PersonIcon fontSize="small" />;
            case "PROFESSOR": return <GroupsIcon fontSize="small" />;
            default: return <SchoolIcon fontSize="small" />;
        }
    };

    const getTargetLabel = (type?: string, value?: string) => {
        switch (type) {
            case "TURMA": return `Turma: ${value}`;
            case "ALUNO": return `Aluno: ${value}`;
            case "PROFESSOR": return "Professores";
            default: return "Todos";
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, minHeight: "100vh", background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(0,0,0,0.02) 100%)" }}>
            {/* Header */}
            <Box mb={5} display="flex" justifyContent="space-between" alignItems="flex-end">
                <Box>
                    <Typography
                        variant="h3"
                        fontWeight={800}
                        sx={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            letterSpacing: "-0.03em",
                            color: "text.primary",
                            mb: 1
                        }}
                    >
                        Mural de Avisos
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Comunicação oficial entre escola, alunos e professores.
                    </Typography>
                </Box>
                {isAdmin && (
                    <Button
                        variant="contained"
                        onClick={() => { resetForm(); setOpen(true); }}
                        startIcon={<AddIcon />}
                        sx={{
                            borderRadius: 3,
                            px: 3,
                            py: 1.2,
                            fontWeight: 700,
                            textTransform: "none",
                            boxShadow: theme.shadows[4],
                            background: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)",
                        }}
                    >
                        Novo Comunicado
                    </Button>
                )}
            </Box>

            {isLoading ? (
                <Grid container spacing={3}>
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Grid key={index} size={12}>
                            <Box sx={{ p: 3, bgcolor: "background.paper", borderRadius: 4 }}>
                                <Fade in={true}><CircularProgress /></Fade>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Stack spacing={3}>
                    {sortedComunicados.map((comm) => (
                        <Card
                            key={comm.id}
                            elevation={0}
                            onClick={() => handleMarkRead(comm.id, comm.is_read)}
                            sx={{
                                borderRadius: 4,
                                border: "1px solid",
                                borderColor: comm.arquivado ? "transparent" : (comm.is_read || isAdmin ? "divider" : "primary.main"),
                                bgcolor: comm.arquivado ? "action.hover" : "background.paper",
                                opacity: comm.arquivado ? 0.7 : 1,
                                transition: "all 0.3s ease",
                                position: "relative",
                                cursor: !isAdmin && !comm.is_read ? "pointer" : "default",
                                overflow: "visible",
                                "&:hover": {
                                    borderColor: "primary.main",
                                    transform: comm.arquivado ? "none" : "translateY(-2px)",
                                    boxShadow: comm.arquivado ? "none" : theme.shadows[2]
                                }
                            }}
                        >
                            {/* Pin or Archive Indicator */}
                            {comm.arquivado ? (
                                <Box position="absolute" top={-10} right={20} sx={{ bgcolor: "text.disabled", color: "white", borderRadius: "50%", p: 0.5, zIndex: 2 }}>
                                    <HistoryIcon fontSize="small" />
                                </Box>
                            ) : (
                                !isAdmin && !comm.is_read ? (
                                    <Box position="absolute" top={-10} right={20} sx={{ bgcolor: "primary.main", color: "white", borderRadius: 2, px: 1, py: 0.2, zIndex: 2, fontWeight: 800, fontSize: "0.7rem", boxShadow: 2 }}>
                                        NOVO
                                    </Box>
                                ) : (
                                    <Box position="absolute" top={-10} right={20} sx={{ bgcolor: "warning.main", color: "white", borderRadius: "50%", p: 0.5, zIndex: 2 }}>
                                        <PushPinIcon fontSize="small" sx={{ transform: "rotate(45deg)" }} />
                                    </Box>
                                )
                            )}

                            <CardHeader
                                sx={{ pb: 1 }}
                                avatar={
                                    <Avatar sx={{ bgcolor: comm.arquivado ? "action.disabled" : (comm.is_read || isAdmin ? "primary.main" : "primary.dark") }}>
                                        <CampaignIcon />
                                    </Avatar>
                                }
                                action={
                                    isAdmin && (
                                        <IconButton onClick={(e) => { e.stopPropagation(); handleOpenMenu(e, comm); }}>
                                            <MoreVertIcon />
                                        </IconButton>
                                    )
                                }
                                title={
                                    <Typography variant="h6" fontWeight={700} color={!isAdmin && !comm.is_read ? "primary.main" : "text.primary"}>
                                        {comm.titulo}
                                    </Typography>
                                }
                                subheader={
                                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(comm.data_envio).toLocaleDateString()} às {new Date(comm.data_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">•</Typography>
                                        <Chip
                                            icon={getTargetIcon(comm.target_type)}
                                            label={getTargetLabel(comm.target_type, comm.target_value)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: "0.65rem", borderColor: "divider" }}
                                        />
                                        <Typography variant="caption" color="text.secondary">•</Typography>
                                        <Typography variant="caption" fontWeight={600} color="primary.main">
                                            {comm.autor}
                                        </Typography>
                                    </Stack>
                                }
                            />
                            <CardContent sx={{ pt: 1, pb: 3 }}>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: "pre-wrap",
                                        color: comm.arquivado ? "text.secondary" : "text.primary",
                                        lineHeight: 1.6
                                    }}
                                >
                                    {comm.conteudo}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))}

                    {sortedComunicados.length === 0 && (
                        <Box textAlign="center" py={8} bgcolor="background.paper" borderRadius={4} border="1px dashed" borderColor="divider">
                            <CampaignIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                            <Typography variant="h6" color="text.secondary">Nenhum comunicado publicado</Typography>
                        </Box>
                    )}
                </Stack>
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
                <MuiMenuItem onClick={handleToggleArchive}>
                    <ListItemIcon><ArchiveIcon fontSize="small" color="action" /></ListItemIcon>
                    {menuComunicado?.arquivado ? "Desarquivar" : "Arquivar"}
                </MuiMenuItem>
                <MuiMenuItem onClick={() => { setLeiturasDialogId(menuComunicado?.id ?? null); handleCloseMenu(); }}>
                    <ListItemIcon><VisibilityIcon fontSize="small" color="info" /></ListItemIcon>
                    Ver leituras
                </MuiMenuItem>
                <Divider />
                <MuiMenuItem onClick={handleDelete}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <Typography color="error" variant="body2" fontWeight={600}>Excluir</Typography>
                </MuiMenuItem>
            </Menu>

            <Dialog
                open={open}
                onClose={() => { setOpen(false); resetForm(); }}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: 4 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {editingId ? "Editar Comunicado" : "Novo Comunicado"}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Título do aviso"
                            fullWidth
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ex: Reunião de Pais"
                            variant="outlined"
                        />
                        <FormControl fullWidth>
                            <InputLabel id="destinatario-label">Destinatário</InputLabel>
                            <Select
                                labelId="destinatario-label"
                                value={targetType}
                                label="Destinatário"
                                onChange={(e) => {
                                    setTargetType(e.target.value);
                                    setTargetValue(""); // Reset value when type changes
                                }}
                                renderValue={(selected) => (
                                    <Box display="flex" alignItems="center" gap={1.5}>
                                        {getTargetIcon(selected)}
                                        <Typography fontWeight={500}>
                                            {selected === "TODOS" ? "Todos (Escola Inteira)" :
                                             selected === "TURMA" ? "Turma Específica" :
                                             selected === "PROFESSOR" ? "Professor(es)" :
                                             "Aluno Específico"}
                                        </Typography>
                                    </Box>
                                )}
                            >
                                <MenuItem value="TODOS">
                                    <ListItemIcon><SchoolIcon fontSize="small" sx={{ color: "primary.main" }} /></ListItemIcon>
                                    <Typography variant="body2">Todos (Escola Inteira)</Typography>
                                </MenuItem>
                                <MenuItem value="TURMA">
                                    <ListItemIcon><GroupsIcon fontSize="small" sx={{ color: "secondary.main" }} /></ListItemIcon>
                                    <Typography variant="body2">Turma Específica</Typography>
                                </MenuItem>
                                <MenuItem value="PROFESSOR">
                                    <ListItemIcon><GroupsIcon fontSize="small" sx={{ color: "warning.main" }} /></ListItemIcon>
                                    <Typography variant="body2">Professor(es)</Typography>
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Dynamic Target Value Input */}
                        {targetType === "TURMA" && (
                            <Autocomplete
                                options={turmas}
                                value={targetValue}
                                onChange={(_, newValue) => setTargetValue(newValue || "")}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Selecione a Turma"
                                        placeholder="Ex: 6º ANO A"
                                        helperText="O comunicado será enviado para todos os alunos desta turma"
                                    />
                                )}
                            />
                        )}

                        <TextField
                            label="Mensagem"
                            fullWidth
                            multiline
                            rows={6}
                            value={conteudo}
                            onChange={(e) => setConteudo(e.target.value)}
                            placeholder="Escreva sua mensagem aqui..."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={() => { setOpen(false); resetForm(); }}
                        sx={{
                            borderRadius: 2,
                            fontWeight: 600,
                            color: "text.secondary"
                        }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        disabled={isCreating || !titulo || !conteudo}
                        sx={{
                            borderRadius: 2,
                            fontWeight: 700,
                            px: 4,
                            py: 1,
                            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", // Indigo/Purple gradient
                            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
                            "&:hover": {
                                background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                            }
                        }}
                    >
                        {editingId ? "Salvar Alterações" : "Publicar Aviso"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Leituras Dialog */}
            <Dialog
                open={leiturasDialogId !== null}
                onClose={() => setLeiturasDialogId(null)}
                fullWidth
                maxWidth="sm"
                PaperProps={{ sx: { borderRadius: 4 } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    Quem leu este comunicado
                    {leiturasData && (
                        <Chip
                            label={`${leiturasData.total_leituras} leitura${leiturasData.total_leituras !== 1 ? "s" : ""}`}
                            size="small"
                            color="primary"
                            sx={{ ml: 1.5, fontWeight: 700 }}
                        />
                    )}
                </DialogTitle>
                <DialogContent dividers>
                    {isFetchingLeituras ? (
                        <Box display="flex" justifyContent="center" py={4}>
                            <CircularProgress />
                        </Box>
                    ) : leiturasData?.leituras.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <VisibilityIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1, opacity: 0.4 }} />
                            <Typography color="text.secondary">Nenhum usuário leu ainda.</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {leiturasData?.leituras.map((l, idx) => (
                                <Box key={l.usuario_id}>
                                    <ListItem sx={{ px: 0 }}>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <CheckCircleIcon color="success" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={<Typography fontWeight={600}>{l.username}</Typography>}
                                            secondary={new Date(l.data_leitura).toLocaleString("pt-BR")}
                                        />
                                    </ListItem>
                                    {idx < (leiturasData?.leituras.length ?? 0) - 1 && <Divider component="li" />}
                                </Box>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setLeiturasDialogId(null)} sx={{ borderRadius: 2, fontWeight: 600 }}>
                        Fechar
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};
