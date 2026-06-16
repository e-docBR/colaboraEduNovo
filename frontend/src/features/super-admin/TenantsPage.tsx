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
    Alert,
    CircularProgress,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Slider
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SchoolIcon from "@mui/icons-material/School";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DomainIcon from "@mui/icons-material/Domain";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import SecurityIcon from "@mui/icons-material/Security";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WifiIcon from "@mui/icons-material/Wifi";
import SaveIcon from "@mui/icons-material/Save";

import { useState, useEffect } from "react";
import {
    useListTenantsQuery,
    useCreateTenantMutation,
    useAddAcademicYearToTenantMutation,
    useUpdateTenantMutation,
    useDeleteTenantMutation,
    useGetAISettingsQuery,
    useUpdateAISettingsMutation,
    useTestAISettingsMutation,
    useClearAIKeyMutation
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
    const [openAiDialog, setOpenAiDialog] = useState(false);
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
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

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

    const handleDeleteTenant = (id: number, name: string) => {
        setDeleteConfirm({ id, name });
    };

    const handleConfirmDeleteTenant = async () => {
        if (!deleteConfirm) return;
        const { id, name } = deleteConfirm;
        setDeleteConfirm(null);
        try {
            await deleteTenant(id).unwrap();
            setSnackbar({ open: true, message: `Escola "${name}" excluída.`, severity: "success" });
        } catch (e: any) {
            const msg = e?.data?.error ?? "Erro ao excluir escola. Verifique se há dados vinculados.";
            setSnackbar({ open: true, message: msg, severity: "error" });
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
                                        <Tooltip title="Configurar IA da Escola">
                                            <IconButton size="small" sx={{ color: TEAL_COLOR }} onClick={() => {
                                                setSelectedTenant(tenant);
                                                setOpenAiDialog(true);
                                            }}>
                                                <AutoAwesomeIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
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

            <Dialog open={deleteConfirm != null} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Excluir escola</DialogTitle>
                <DialogContent>
                    <Typography>Tem certeza que deseja excluir a escola <strong>"{deleteConfirm?.name}"</strong>? Esta ação é irreversível.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                    <Button onClick={handleConfirmDeleteTenant} color="error" variant="contained">Excluir</Button>
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

            <TenantAiDialog
                open={openAiDialog}
                onClose={() => setOpenAiDialog(false)}
                tenant={selectedTenant}
            />
        </Box>
    );
};

// ─── Componente de Configuração de IA por Escola ───────────────────────────────

interface TenantAiDialogProps {
  open: boolean;
  onClose: () => void;
  tenant: any;
}

const PROVIDER_LABELS: Record<string, { label: string; color: string; description: string; getUrl: string }> = {
  openai: {
    label: "OpenAI",
    color: "#10a37f",
    description: "GPT-4o, GPT-4o Mini. Requer chave da OpenAI Platform.",
    getUrl: "platform.openai.com",
  },
  anthropic: {
    label: "Anthropic",
    color: "#cc785c",
    description: "Claude 3.5 Haiku e Sonnet. Alta qualidade de raciocínio.",
    getUrl: "console.anthropic.com",
  },
  openrouter: {
    label: "OpenRouter",
    color: "#6366f1",
    description: "Acesse dezenas de modelos com uma única chave.",
    getUrl: "openrouter.ai/keys",
  },
  gemini: {
    label: "Google Gemini",
    color: "#4285f4",
    description: "Gemini 1.5 Flash e Pro. Requer chave do Google AI Studio.",
    getUrl: "aistudio.google.com",
  },
  deepseek: {
    label: "DeepSeek",
    color: "#4d6bfe",
    description: "DeepSeek-V3 e DeepSeek-R1. Modelos de alto desempenho.",
    getUrl: "platform.deepseek.com",
  },
  minimax: {
    label: "MiniMax",
    color: "#ff5a00",
    description: "MiniMax-M3 e MiniMax-M2.7. Alto desempenho para português.",
    getUrl: "platform.minimax.io",
  },
};

const TenantAiDialog = ({ open, onClose, tenant }: TenantAiDialogProps) => {
  const { data: settings, isLoading } = useGetAISettingsQuery(tenant?.id, { skip: !tenant || !open });
  const [updateSettings, { isLoading: isSaving }] = useUpdateAISettingsMutation();
  const [testConnection, { isLoading: isTesting }] = useTestAISettingsMutation();
  const [clearKey] = useClearAIKeyMutation();

  const [provider, setProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [aiName, setAiName] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || "openai");
      setModelName(settings.model_name || "gpt-4o-mini");
      setApiKey(settings.api_key_set ? "***configured***" : "");
      setAiName(settings.ai_name || "");
      setTemperature(settings.temperature ?? 0.4);
      setSystemPrompt(settings.system_prompt || "");
      setIsActive(settings.is_active || false);
      setTestResult(null);
    }
  }, [settings, open]);

  const availableModels = settings?.provider_models?.[provider] ?? [];

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const models = settings?.provider_models?.[newProvider] ?? [];
    if (models.length > 0) setModelName(models[0].id);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const keyToTest = apiKey.startsWith("***") ? "***" : apiKey;
      const result = await testConnection({
        provider,
        api_key: keyToTest,
        model_name: modelName,
        tenantId: tenant.id,
      }).unwrap();
      setTestResult(result);
    } catch (e: any) {
      setTestResult({
        ok: false,
        message: `❌ Erro: ${e?.data?.error ?? e?.status ?? "Falha de conexão"}`,
      });
    }
  };

  const handleSave = async () => {
    setSaveSuccess(false);
    const payload: any = {
      tenantId: tenant.id,
      is_active: isActive,
      provider,
      model_name: modelName,
      temperature,
      ai_name: aiName,
      system_prompt: systemPrompt,
    };
    if (apiKey && !apiKey.startsWith("***")) {
      payload.api_key = apiKey;
    }
    try {
      await updateSettings(payload).unwrap();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch {
      // tratado pelo RTK Query
    }
  };

  const handleClearKey = async () => {
    if (!confirm("Remover a API key da escola e desativar o assistente?")) return;
    await clearKey(tenant.id);
    setApiKey("");
    setIsActive(false);
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
      <DialogTitle sx={{ fontWeight: 950, pb: 1 }}>
        🤖 Configurar IA — {tenant.name}
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Provedor de IA */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>🔌 Provedor de IA</Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                {Object.entries(PROVIDER_LABELS).map(([key, info]) => (
                  <Chip
                    key={key}
                    label={info.label}
                    onClick={() => handleProviderChange(key)}
                    variant={provider === key ? "filled" : "outlined"}
                    sx={{
                      bgcolor: provider === key ? info.color : undefined,
                      color: provider === key ? "white" : undefined,
                      borderColor: info.color,
                      fontWeight: provider === key ? 700 : 400,
                      "&:hover": { bgcolor: `${info.color}22` },
                    }}
                  />
                ))}
              </Box>
              <Alert severity="info" sx={{ py: 0.5 }}>
                {PROVIDER_LABELS[provider]?.description}
              </Alert>
            </Box>

            {/* Modelo e API Key */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="tenant-model-select-label">Modelo</InputLabel>
                  <Select
                    labelId="tenant-model-select-label"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    label="Modelo"
                  >
                    {availableModels.map((m: any) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.label} ({m.id})
                      </MenuItem>
                    ))}
                    {modelName && !availableModels.some((m: any) => m.id === modelName) && (
                      <MenuItem value={modelName}>
                        {modelName} (Personalizado)
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="API Key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings?.api_key_set ? "••• chave salva" : "Cole a API key aqui"}
                  helperText={
                    settings?.api_key_set
                      ? "Chave configurada. Deixe em branco para manter a atual."
                      : `Obtenha em: ${PROVIDER_LABELS[provider]?.getUrl}`
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowKey((v) => !v)}>
                          {showKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            {/* Identidade */}
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Nome do Assistente"
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  placeholder={`AI ${tenant.name.split(" ")[0]}`}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box mt={1}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Temperatura: <Typography component="span" color="primary.main" fontWeight={700}>{temperature.toFixed(1)}</Typography>
                  </Typography>
                  <Slider
                    value={temperature}
                    onChange={(_, v) => setTemperature(v as number)}
                    min={0}
                    max={1}
                    step={0.1}
                    marks={[
                      { value: 0, label: "Preciso" },
                      { value: 0.5, label: "Equilibrado" },
                      { value: 1, label: "Criativo" },
                    ]}
                  />
                </Box>
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Instruções adicionais (opcional)"
              placeholder="Instruções extras de sistema para personalizar o comportamento do assistente"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Box>
                  <Typography fontWeight={600}>Assistente de IA ativo para esta escola</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Habilita o LLM para enriquecer as análises pedagógicas
                  </Typography>
                </Box>
              }
            />

            {testResult && (
              <Alert severity={testResult.ok ? "success" : "error"} onClose={() => setTestResult(null)}>
                {testResult.message}
              </Alert>
            )}
            {saveSuccess && (
              <Alert severity="success">Configurações salvas com sucesso!</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        {settings?.api_key_set && (
          <Button variant="outlined" color="error" onClick={handleClearKey}>
            Limpar Key
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={isTesting ? <CircularProgress size={14} /> : <WifiIcon />}
          onClick={handleTest}
          disabled={isTesting || isLoading || (!apiKey && !settings?.api_key_set)}
        >
          Testar Conexão
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />}
          sx={{ bgcolor: "#14b8a6", '&:hover': { bgcolor: '#0d9488' } }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};
