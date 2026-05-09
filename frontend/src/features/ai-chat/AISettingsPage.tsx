/**
 * Página de configuração do assistente de IA educacional.
 * Acessível apenas para admin e super_admin.
 *
 * Permite:
 * - Escolher o provider (OpenAI, Anthropic, OpenRouter, Gemini)
 * - Selecionar o modelo
 * - Configurar API key
 * - Personalizar nome do assistente (herda nome da instituição se vazio)
 * - Ajustar temperatura e prompt de sistema extra
 * - Testar a conexão antes de salvar
 */
import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SaveIcon from "@mui/icons-material/Save";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WifiIcon from "@mui/icons-material/Wifi";

import {
  useGetAISettingsQuery,
  useUpdateAISettingsMutation,
  useTestAISettingsMutation,
  useClearAIKeyMutation,
} from "../../lib/api";

const PROVIDER_LABELS: Record<string, { label: string; color: string; description: string }> = {
  openai: {
    label: "OpenAI",
    color: "#10a37f",
    description: "GPT-4o, GPT-4o Mini. Requer chave da OpenAI Platform.",
  },
  anthropic: {
    label: "Anthropic",
    color: "#cc785c",
    description: "Claude 3.5 Haiku e Sonnet. Alta qualidade de raciocínio.",
  },
  openrouter: {
    label: "OpenRouter",
    color: "#6366f1",
    description: "Acesse dezenas de modelos (incluindo gratuitos) com uma única chave.",
  },
  gemini: {
    label: "Google Gemini",
    color: "#4285f4",
    description: "Gemini 1.5 Flash e Pro. Requer chave do Google AI Studio.",
  },
};

export default function AISettingsPage() {
  const { data: settings, isLoading } = useGetAISettingsQuery();
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
    }
  }, [settings]);

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
      }).unwrap();
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ ok: false, message: e?.data?.message ?? "Erro ao testar conexão." });
    }
  };

  const handleSave = async () => {
    setSaveSuccess(false);
    const payload: any = {
      is_active: isActive,
      provider,
      model_name: modelName,
      temperature,
      ai_name: aiName,
      system_prompt: systemPrompt,
    };
    // Só envia a key se foi alterada
    if (apiKey && !apiKey.startsWith("***")) {
      payload.api_key = apiKey;
    }
    try {
      await updateSettings(payload).unwrap();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // erro tratado pelo RTK Query
    }
  };

  const handleClearKey = async () => {
    if (!confirm("Remover a API key e desativar o assistente de IA?")) return;
    await clearKey();
    setApiKey("");
    setIsActive(false);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  const providerInfo = PROVIDER_LABELS[provider];
  const displayName = aiName.trim() || `AI ${settings?.tenant_name?.split(" ")[0] ?? "ColaboraEdu"}`;

  return (
    <Box maxWidth={760} mx="auto" py={3} px={2}>
      {/* Cabeçalho */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <SmartToyIcon sx={{ color: "primary.main", fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Configuração do Assistente de IA
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure o LLM que potencializa o assistente{" "}
            <strong>{displayName}</strong>
          </Typography>
        </Box>
        <Box ml="auto">
          <Chip
            icon={isActive && settings?.api_key_set ? <CheckCircleIcon /> : <ErrorIcon />}
            label={isActive && settings?.api_key_set ? "Ativo" : "Inativo"}
            color={isActive && settings?.api_key_set ? "success" : "default"}
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Card: Identidade */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            🤖 Identidade do Assistente
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                label="Nome do Assistente"
                placeholder={`AI ${settings?.tenant_name?.split(" ")[0] ?? "ColaboraEdu"}`}
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                helperText={
                  aiName.trim()
                    ? `O assistente será chamado de "${aiName.trim()}"`
                    : `Se vazio, usará "${displayName}" (baseado no nome da instituição)`
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="O assistente herda o nome da sua instituição se este campo ficar vazio">
                        <HelpOutlineIcon fontSize="small" color="action" />
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                }}
              >
                <AutoAwesomeIcon sx={{ color: "primary.main" }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Prévia
                  </Typography>
                  <Typography fontWeight={700} fontSize="0.9rem">
                    {displayName}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Instruções adicionais (opcional)"
            placeholder="Ex: Sempre sugira intervenção quando notas estiverem abaixo de 60. Foque em turmas do 9º ano."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            helperText="Instruções extras para personalizar o comportamento do assistente."
            sx={{ mt: 2 }}
          />
        </CardContent>
      </Card>

      {/* Card: Provider */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            🔌 Provider de IA
          </Typography>

          {/* Seleção de provider */}
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

          {providerInfo && (
            <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
              {providerInfo.description}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {/* Atalhos rápidos — modelos sugeridos */}
                {availableModels.length > 0 && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Sugestões de modelos</InputLabel>
                    <Select
                      value={availableModels.find((m: any) => m.id === modelName) ? modelName : ""}
                      onChange={(e) => { if (e.target.value) setModelName(e.target.value); }}
                      label="Sugestões de modelos"
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        <em>Selecionar da lista...</em>
                      </MenuItem>
                      {availableModels.map((m: any) => (
                        <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {/* Campo livre sempre editável */}
                <TextField
                  fullWidth
                  label="ID do modelo"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder={
                    provider === "openrouter" ? "ex: google/gemma-3-27b-it:free"
                    : provider === "openai" ? "ex: gpt-4o-mini"
                    : provider === "anthropic" ? "ex: claude-3-5-haiku-20241022"
                    : "ex: gemini-1.5-flash"
                  }
                  helperText="Selecione da lista acima ou digite o ID exato do modelo"
                />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="API Key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.api_key_set ? "••• chave salva" : "Cole sua API key aqui"}
                helperText={
                  settings?.api_key_set
                    ? "Chave configurada. Deixe em branco para manter a atual."
                    : `Obtenha em: ${
                        provider === "openai"
                          ? "platform.openai.com"
                          : provider === "anthropic"
                          ? "console.anthropic.com"
                          : provider === "openrouter"
                          ? "openrouter.ai/keys"
                          : "aistudio.google.com"
                      }`
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

          {/* Temperatura */}
          <Box mt={2}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Temperatura:{" "}
              <Typography component="span" color="primary.main" fontWeight={700}>
                {temperature.toFixed(1)}
              </Typography>
              <Tooltip title="0 = respostas consistentes e determinísticas | 1 = respostas criativas e variadas. Recomendado: 0.3–0.5 para análises educacionais.">
                <HelpOutlineIcon fontSize="small" sx={{ ml: 0.5, verticalAlign: "middle", color: "action.active" }} />
              </Tooltip>
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
              sx={{ maxWidth: 400 }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Card: Ativar + Botões */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
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
                  <Typography fontWeight={600}>
                    {isActive ? "Assistente de IA ativo" : "Assistente de IA inativo"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isActive
                      ? "O LLM será usado para enriquecer as análises"
                      : "Funcionará apenas com análises baseadas em regras"}
                  </Typography>
                </Box>
              }
            />

            <Box display="flex" gap={1} flexWrap="wrap">
              {settings?.api_key_set && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={handleClearKey}
                >
                  Remover Key
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={isTesting ? <CircularProgress size={14} /> : <WifiIcon />}
                onClick={handleTest}
                disabled={isTesting || (!apiKey && !settings?.api_key_set)}
              >
                Testar Conexão
              </Button>
              <Button
                variant="contained"
                startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={isSaving}
              >
                Salvar
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Feedback */}
      {testResult && (
        <Alert
          severity={testResult.ok ? "success" : "error"}
          icon={testResult.ok ? <CheckCircleIcon /> : <ErrorIcon />}
          sx={{ mb: 2 }}
          onClose={() => setTestResult(null)}
        >
          {testResult.message}
        </Alert>
      )}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>
          Configuração salva com sucesso!
        </Alert>
      )}

      {/* Informações sobre roles */}
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        👥 Acesso ao Assistente
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        O assistente de IA é exibido apenas para os seguintes perfis:
      </Typography>
      <Box display="flex" gap={1} flexWrap="wrap">
        {["Administrador", "Super Admin", "Direção", "Coordenação", "Orientação"].map((role) => (
          <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
        ))}
      </Box>
    </Box>
  );
}
