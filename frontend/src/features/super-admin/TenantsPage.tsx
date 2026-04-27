import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid2 as Grid,
    IconButton,
    TextField,
    Typography,
    Divider,
    Snackbar,
    Stack,
    Switch,
    FormControlLabel,
    Tooltip,
    InputAdornment,
    Collapse,
    Alert,
    CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SchoolIcon from "@mui/icons-material/School";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DomainIcon from "@mui/icons-material/Domain";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import SecurityIcon from "@mui/icons-material/Security";
import { useState } from "react";
import {
    useListTenantsQuery,
    useCreateTenantMutation,
    useAddAcademicYearToTenantMutation,
    useUpdateTenantMutation,
    useDeleteTenantMutation
} from "../../lib/api";
import { useAppSelector } from "../../app/hooks";
import { Navigate } from "react-router-dom";

export const TenantsPage = () => {
    const user = useAppSelector((state) => state.auth.user);
    const { data: tenants, isLoading } = useListTenantsQuery();

    const [createTenant] = useCreateTenantMutation();
    const [addYear] = useAddAcademicYearToTenantMutation();
    const [updateTenant] = useUpdateTenantMutation();
    const [deleteTenant] = useDeleteTenantMutation();

    const [search, setSearch] = useState("");
    const [openTenantDialog, setOpenTenantDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [openYearDialog, setOpenYearDialog] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [selectedTenant, setSelectedTenant] = useState<any>(null);
    const [newTenant, setNewTenant] = useState({
        name: "",
        slug: "",
        initial_year: new Date().getFullYear().toString(),
        domain: "",
        admin_email: "",
        admin_password: ""
    });
    const [editData, setEditData] = useState({ name: "", domain: "" });
    const [newYearLabel, setNewYearLabel] = useState("");
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
        open: false, message: "", severity: "success"
    });

    const handleCreateTenant = async () => {
        setCreateError(null);
        setIsCreating(true);
        try {
            await createTenant(newTenant).unwrap();
            setOpenTenantDialog(false);
            setNewTenant({ name: "", slug: "", initial_year: new Date().getFullYear().toString(), domain: "", admin_email: "", admin_password: "" });
        } catch (e: any) {
            const msg = e?.data?.error || e?.error || "Erro ao criar escola. Tente novamente.";
            setCreateError(msg);
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTenant = async () => {
        if (selectedTenant) {
            try {
                await updateTenant({ id: selectedTenant.id, ...editData }).unwrap();
                setOpenEditDialog(false);
                setSnackbar({ open: true, message: "Escola atualizada com sucesso!", severity: "success" });
            } catch (e: any) {
                const msg = e?.data?.error ?? "Erro ao atualizar escola. Tente novamente.";
                setSnackbar({ open: true, message: msg, severity: "error" });
            }
        }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            await updateTenant({ id, is_active: !currentStatus }).unwrap();
            setSnackbar({ open: true, message: currentStatus ? "Escola desativada." : "Escola ativada.", severity: "success" });
        } catch (e: any) {
            const msg = e?.data?.error ?? "Erro ao alterar status da escola.";
            setSnackbar({ open: true, message: msg, severity: "error" });
        }
    };

    const handleDeleteTenant = async (id: number, name: string) => {
        if (window.confirm(`Tem certeza que deseja excluir a escola "${name}"? Esta ação é irreversível.`)) {
            try {
                await deleteTenant(id).unwrap();
                setSnackbar({ open: true, message: `Escola "${name}" excluída.`, severity: "success" });
            } catch (e: any) {
                const msg = e?.data?.error ?? "Erro ao excluir escola. Verifique se há dados vinculados.";
                setSnackbar({ open: true, message: msg, severity: "error" });
            }
        }
    };

    const handleAddYear = async () => {
        if (selectedTenant) {
            try {
                await addYear({ tenantId: selectedTenant.id, label: newYearLabel, set_current: true }).unwrap();
                setOpenYearDialog(false);
                setNewYearLabel("");
                setSnackbar({ open: true, message: `Ano letivo ${newYearLabel} adicionado!`, severity: "success" });
            } catch (e: any) {
                const msg = e?.data?.error ?? "Erro ao adicionar ano letivo.";
                setSnackbar({ open: true, message: msg, severity: "error" });
            }
        }
    };

    // Filtered List
    const filteredTenants = tenants?.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    if (user?.role !== "super_admin") {
        return <Navigate to="/app" replace />;
    }

    if (isLoading) return (
        <Box display="flex" justifyContent="center" py={10}>
            <CircularProgress sx={{ color: '#14b8a6' }} />
        </Box>
    );

    const stats = {
        total: tenants?.length || 0,
        active: tenants?.filter(t => t.is_active).length || 0,
        inactive: tenants?.filter(t => !t.is_active).length || 0,
    };

    const TEAL_COLOR = "#14b8a6";

    return (
        <Box p={{ xs: 2, md: 4 }}>
            {/* Search Bar at Page Level (matching image intent) */}
            <Box mb={4} display="flex" gap={2}>
                <TextField
                    placeholder="Buscar instituições pelo nome ou slug..."
                    variant="outlined"
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flex: 1, bgcolor: 'background.paper', borderRadius: 1 }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
                    }}
                />
            </Box>

            {/* Header Section */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
                <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
                        Gestão de Escolas
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Painel de Controle de Provisionamento (SaaS)
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    size="large"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenTenantDialog(true)}
                    sx={{
                        borderRadius: 2,
                        px: 4,
                        py: 1.5,
                        fontWeight: 700,
                        bgcolor: TEAL_COLOR,
                        '&:hover': { bgcolor: '#0d9488' }
                    }}
                >
                    Provisionar Nova Escola
                </Button>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={3} mb={5}>
                {[
                    { label: "Total de Escolas", value: stats.total, color: "text.primary" },
                    { label: "Operações Ativas", value: stats.active, color: "success.main" },
                    { label: "Acessos Bloqueados", value: stats.inactive, color: "error.main" },
                ].map((s, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 4 }}>
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                            <CardContent>
                                <Typography variant="overline" fontWeight={700} color="text.secondary">{s.label}</Typography>
                                <Typography variant="h3" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* List Header */}
            <Typography variant="h6" fontWeight={700} mb={3}>Lista de Instituições</Typography>

            <Stack spacing={2.5}>
                {filteredTenants?.map((tenant) => (
                    <Card
                        key={tenant.id}
                        variant="outlined"
                        sx={{
                            borderRadius: 4,
                            transition: 'all 0.2s',
                            '&:hover': { boxShadow: 4, borderColor: TEAL_COLOR },
                            position: 'relative',
                            opacity: tenant.is_active ? 1 : 0.8,
                            bgcolor: tenant.is_active ? 'background.paper' : 'action.hover'
                        }}
                    >
                        <CardContent sx={{ p: 4 }}>
                            <Grid container spacing={4} alignItems="center">
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Box display="flex" alignItems="center" gap={2}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2.5,
                                                bgcolor: tenant.is_active ? `${TEAL_COLOR}15` : 'action.disabledBackground',
                                                color: tenant.is_active ? TEAL_COLOR : 'text.disabled'
                                            }}
                                        >
                                            <SchoolIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800}>{tenant.name}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <DomainIcon fontSize="inherit" /> /{tenant.slug}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>

                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Box>
                                        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, letterSpacing: 1 }}>
                                            <HistoryIcon fontSize="inherit" /> CICLOS ATIVOS
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            {(tenant.academic_years ?? []).map((year: any) => (
                                                <Chip
                                                    key={year.id}
                                                    label={year.label}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: year.is_current ? 800 : 400,
                                                        bgcolor: year.is_current ? TEAL_COLOR : 'transparent',
                                                        color: year.is_current ? '#fff' : 'text.primary',
                                                        border: '1px solid',
                                                        borderColor: year.is_current ? TEAL_COLOR : 'divider'
                                                    }}
                                                />
                                            ))}
                                            <IconButton size="small" sx={{ color: TEAL_COLOR }} onClick={() => {
                                                setSelectedTenant(tenant);
                                                setOpenYearDialog(true);
                                            }}>
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </Box>
                                </Grid>

                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={tenant.is_active}
                                                    onChange={() => handleToggleActive(tenant.id, tenant.is_active)}
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': { color: TEAL_COLOR },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: TEAL_COLOR }
                                                    }}
                                                />
                                            }
                                            label={<Typography variant="caption" fontWeight={800} sx={{ color: tenant.is_active ? 'success.main' : 'error.main' }}>{tenant.is_active ? "ATIVO" : "BLOQUEADO"}</Typography>}
                                        />
                                        <Divider orientation="vertical" flexItem />
                                        <Tooltip title="Editar Dados">
                                            <IconButton size="small" onClick={() => {
                                                setSelectedTenant(tenant);
                                                setEditData({ name: tenant.name, domain: tenant.domain || "" });
                                                setOpenEditDialog(true);
                                            }}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Excluir">
                                            <IconButton color="error" size="small" onClick={() => handleDeleteTenant(tenant.id, tenant.name)}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                ))}

                {filteredTenants?.length === 0 && (
                    <Box
                        textAlign="center"
                        py={12}
                        sx={{
                            borderRadius: 4,
                            border: '2px dashed',
                            borderColor: 'divider',
                            bgcolor: 'action.hover'
                        }}
                    >
                        <SchoolIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2, opacity: 0.3 }} />
                        <Typography variant="h6" color="text.secondary" fontWeight={700}>Nenhuma instituição encontrada</Typography>
                        <Typography variant="body2" color="text.disabled">Inicie o provisionamento de uma nova escola para começar.</Typography>
                    </Box>
                )}
            </Stack>

            {/* Dialog Provisionar (New) */}
            <Dialog
                open={openTenantDialog}
                onClose={() => { setOpenTenantDialog(false); setCreateError(null); }}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem' }}>Provisionamento SaaS</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Typography variant="overline" color="primary" fontWeight={800}>Dados da Instituição</Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Nome Oficial da Escola"
                                    fullWidth
                                    variant="filled"
                                    value={newTenant.name}
                                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField
                                    label="Slug URL (/escola)"
                                    fullWidth
                                    variant="filled"
                                    value={newTenant.slug}
                                    onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                                />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField
                                    label="Ano Inicial"
                                    fullWidth
                                    variant="filled"
                                    value={newTenant.initial_year}
                                    onChange={(e) => setNewTenant({ ...newTenant, initial_year: e.target.value })}
                                />
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 1 }} />
                        <Typography variant="overline" color="primary" fontWeight={800}>Acesso do Administrador</Typography>
                        <Alert icon={<SecurityIcon fontSize="inherit" />} severity="info">
                            Estas credenciais serão usadas pelo primeiro gestor da escola. O login pode ser feito com o e-mail ou com o usuário gerado automaticamente.
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="E-mail do Gestor"
                                    fullWidth
                                    variant="filled"
                                    value={newTenant.admin_email}
                                    onChange={(e) => setNewTenant({ ...newTenant, admin_email: e.target.value })}
                                    helperText={
                                        newTenant.admin_email.includes("@")
                                            ? `Usuário de login: ${newTenant.admin_email.split("@")[0]} (ou o e-mail completo)`
                                            : "Informe o e-mail do administrador da escola"
                                    }
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Senha Temporária"
                                    type="password"
                                    fullWidth
                                    variant="filled"
                                    value={newTenant.admin_password}
                                    onChange={(e) => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                                />
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                {createError && (
                    <Box px={4} pb={1}>
                        <Alert severity="error" onClose={() => setCreateError(null)}>{createError}</Alert>
                    </Box>
                )}
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={() => setOpenTenantDialog(false)} color="inherit" sx={{ fontWeight: 700 }} disabled={isCreating}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateTenant}
                        disabled={isCreating}
                        startIcon={isCreating ? <CircularProgress size={16} sx={{ color: 'white' }} /> : undefined}
                        sx={{ px: 4, fontWeight: 800, bgcolor: TEAL_COLOR, '&:hover': { bgcolor: '#0d9488' } }}
                    >
                        {isCreating ? "Provisionando..." : "Confirmar Provisionamento"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Edit */}
            <Dialog
                open={openEditDialog}
                onClose={() => setOpenEditDialog(false)}
                PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>Editar Instituição</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2, minWidth: 400 }}>
                        <TextField
                            label="Nome da Escola"
                            fullWidth
                            variant="filled"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                        <TextField
                            label="Domínio customizado"
                            fullWidth
                            variant="filled"
                            value={editData.domain}
                            onChange={(e) => setEditData({ ...editData, domain: e.target.value })}
                            placeholder="exemplo.com.br"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setOpenEditDialog(false)} color="inherit">Cancelar</Button>
                    <Button variant="contained" onClick={handleUpdateTenant} sx={{ px: 4, fontWeight: 800, bgcolor: TEAL_COLOR }}>Salvar Alterações</Button>
                </DialogActions>
            </Dialog>

            {/* Dialog Year */}
            <Dialog
                open={openYearDialog}
                onClose={() => setOpenYearDialog(false)}
                PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 900 }}>Novo Ano Letivo</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2, minWidth: 350 }}>
                        <TextField
                            label="Rótulo (ex: 2026)"
                            fullWidth
                            variant="filled"
                            autoFocus
                            value={newYearLabel}
                            onChange={(e) => setNewYearLabel(e.target.value)}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setOpenYearDialog(false)} color="inherit">Cancelar</Button>
                    <Button variant="contained" onClick={handleAddYear} sx={{ fontWeight: 800, bgcolor: TEAL_COLOR }}>Definir como Atual</Button>
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
