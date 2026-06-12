import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  CircularProgress,
  Snackbar,
  Alert,
  InputAdornment,
  Divider,
  IconButton
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import DeleteIcon from "@mui/icons-material/Delete";
import SchoolIcon from "@mui/icons-material/School";
import SettingsPhoneIcon from "@mui/icons-material/SettingsPhone";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  useGetEscolaSettingsQuery,
  useUpdateEscolaSettingsMutation,
  useUploadEscolaLogoMutation,
} from "../../lib/api";

// Helper function to format CNPJ: 12.345.678/0001-90
const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

// Helper function to format Phone: (11) 99999-9999 or (11) 9999-9999
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const EscolaConfigPage = () => {
  const { data: escolaData, isLoading, isError, refetch } = useGetEscolaSettingsQuery();
  const [updateEscola, { isLoading: isUpdating }] = useUpdateEscolaSettingsMutation();
  const [uploadLogo, { isLoading: isUploadingLogo }] = useUploadEscolaLogoMutation();

  // Local state for school config form
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [mediaAprovacao, setMediaAprovacao] = useState(50.0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Notification states
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappInstanceUrl, setWhatsappInstanceUrl] = useState("");
  const [whatsappInstanceToken, setWhatsappInstanceToken] = useState("");

  // Feedback notifications
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // Load data into local state when API query resolves
  useEffect(() => {
    if (escolaData) {
      setName(escolaData.name);
      const settings = escolaData.settings;
      setCnpj(settings.cnpj || "");
      setEndereco(settings.endereco || "");
      setTelefone(settings.telefone || "");
      setEmail(settings.email || "");
      setMediaAprovacao(settings.media_aprovacao);
      setLogoUrl(settings.logo_url || null);
      setWhatsappEnabled(settings.whatsapp_enabled);
      setEmailEnabled(settings.email_enabled);
      setWhatsappInstanceUrl(settings.whatsapp_instance_url || "");
      setWhatsappInstanceToken(settings.whatsapp_instance_token || "");
    }
  }, [escolaData]);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCNPJ(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side size validation (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({
        open: true,
        message: "O arquivo excede o tamanho máximo de 5MB.",
        severity: "error",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await uploadLogo(formData).unwrap();
      setLogoUrl(response.logo_url);
      setSnackbar({
        open: true,
        message: "Logotipo carregado com sucesso!",
        severity: "success",
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.data?.error || "Erro ao fazer upload do logotipo.",
        severity: "error",
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setSnackbar({ open: true, message: "O nome da escola é obrigatório.", severity: "error" });
      return;
    }

    if (mediaAprovacao < 0 || mediaAprovacao > 100) {
      setSnackbar({ open: true, message: "A média de aprovação deve estar entre 0 e 100.", severity: "error" });
      return;
    }

    try {
      await updateEscola({
        name: name.trim(),
        settings: {
          cnpj: cnpj.trim() || undefined,
          endereco: endereco.trim() || undefined,
          telefone: telefone.trim() || undefined,
          email: email.trim() || undefined,
          media_aprovacao: mediaAprovacao,
          logo_url: logoUrl,
          whatsapp_enabled: whatsappEnabled,
          email_enabled: emailEnabled,
          whatsapp_instance_url: whatsappInstanceUrl.trim() || undefined,
          whatsapp_instance_token: whatsappInstanceToken.trim() || undefined,
        },
      }).unwrap();

      setSnackbar({
        open: true,
        message: "Configurações salvas com sucesso!",
        severity: "success",
      });
      refetch();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.data?.error || "Erro ao salvar as configurações.",
        severity: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box my={4}>
        <Alert severity="error">Erro ao carregar as configurações da escola. Tente atualizar a página.</Alert>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSave} sx={{ pb: 6 }}>
      <Box mb={4} display="flex" justifyContent="between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: "-0.03em", color: "#0A2540", mb: 0.5 }}>
            Configurações da Escola
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie os dados institucionais, parâmetros pedagógicos e canais de comunicação da instituição.
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Dados Institucionais */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #E5E9F2" }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                <SchoolIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  Dados Institucionais
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nome da Escola"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Ex: Escola Municipal ColaboraEdu"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="CNPJ"
                    value={cnpj}
                    onChange={handleCnpjChange}
                    placeholder="00.000.000/0000-00"
                    inputProps={{ maxLength: 18 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Telefone de Contato"
                    value={telefone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    inputProps={{ maxLength: 15 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="E-mail de Contato"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="secretaria@escola.com"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Endereço"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Upload de Logo */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%", borderRadius: 3, boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #E5E9F2" }}>
            <CardContent sx={{ p: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Typography variant="subtitle1" fontWeight="bold" mb={2} textAlign="center">
                Logotipo da Escola
              </Typography>
              
              <Box
                sx={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  border: "2px dashed #CBD5E1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                  mb: 3,
                  backgroundColor: "#F8FAFC"
                }}
              >
                {logoUrl ? (
                  <>
                    <Box component="img" src={logoUrl} alt="Logo da Escola" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0,
                        transition: "opacity 0.2s",
                        "&:hover": { opacity: 1 }
                      }}
                    >
                      <IconButton onClick={handleRemoveLogo} sx={{ color: "#fff" }}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </>
                ) : (
                  <SchoolIcon sx={{ fontSize: 64, color: "#94A3B8" }} />
                )}
                {isUploadingLogo && (
                  <Box sx={{ position: "absolute", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.8)", width: "100%", height: "100%" }}>
                    <CircularProgress size={30} />
                  </Box>
                )}
              </Box>

              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCamera />}
                disabled={isUploadingLogo}
                size="small"
                sx={{ borderColor: "#CBD5E1", color: "#475569" }}
              >
                Selecionar Imagem
                <input type="file" hidden accept="image/*" onChange={handleLogoUpload} />
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" mt={1} textAlign="center">
                Formatos permitidos: JPG, PNG ou WebP (Máx. 5MB)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Configurações Acadêmicas */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: "100%", borderRadius: 3, boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #E5E9F2" }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                <SchoolIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  Parâmetros Acadêmicos
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Média de Aprovação Anual"
                    type="number"
                    value={mediaAprovacao}
                    onChange={(e) => setMediaAprovacao(parseFloat(e.target.value) || 0)}
                    InputProps={{
                      inputProps: { min: 0, max: 100, step: 0.1 },
                      endAdornment: <InputAdornment position="end">pontos</InputAdornment>
                    }}
                    helperText="Média necessária por disciplina para aprovação do aluno no relatório final (geralmente 50 ou 60)."
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Canais de Comunicação */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #E5E9F2" }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                <NotificationsIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  Canais de Notificação
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailEnabled}
                        onChange={(e) => setEmailEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="500">Notificações por E-mail</Typography>
                        <Typography variant="caption" color="text.secondary">Habilita o envio automático de avisos pedagógicos e comunicados por e-mail.</Typography>
                      </Box>
                    }
                    sx={{ mb: 2, display: "flex", alignItems: "flex-start" }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={whatsappEnabled}
                        onChange={(e) => setWhatsappEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="500">Notificações por WhatsApp</Typography>
                        <Typography variant="caption" color="text.secondary">Habilita o envio de ocorrências e boletins para o celular dos responsáveis.</Typography>
                      </Box>
                    }
                    sx={{ display: "flex", alignItems: "flex-start" }}
                  />
                </Grid>

                {whatsappEnabled && (
                  <Grid item xs={12} sx={{ mt: 2, pl: 2, borderLeft: "2px solid #E2E8F0" }}>
                    <Typography variant="subtitle2" fontWeight="bold" mb={2}>
                      Configurações Customizadas da Evolution API (Opcional)
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="URL da API WhatsApp"
                          value={whatsappInstanceUrl}
                          onChange={(e) => setWhatsappInstanceUrl(e.target.value)}
                          placeholder="https://api.evolution.com"
                          helperText="Deixe em branco para usar o servidor padrão da plataforma."
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Token de Acesso / API Token"
                          type="password"
                          value={whatsappInstanceToken}
                          onChange={(e) => setWhatsappInstanceToken(e.target.value)}
                          placeholder="Evolution Token"
                          size="small"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Ações */}
      <Box mt={4} display="flex" justifyContent="flex-end">
        <Button
          type="submit"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={isUpdating}
          size="large"
          sx={{
            backgroundColor: "#0A2540",
            px: 4,
            py: 1.5,
            borderRadius: 2.5,
            fontWeight: "bold",
            "&:hover": { backgroundColor: "#1E3A5F" }
          }}
        >
          {isUpdating ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </Box>

      {/* Toast feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
