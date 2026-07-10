import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  alpha,
  Divider,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SchoolIcon from "@mui/icons-material/School";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DomainIcon from "@mui/icons-material/Domain";
import AssessmentIcon from "@mui/icons-material/Assessment";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import FaceIcon from "@mui/icons-material/Face";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import BusinessIcon from "@mui/icons-material/Business";

import { useAppDispatch } from "../../app/hooks";
import { setCredentials } from "./authSlice";
import { setTenantId } from "../app/appSlice";
import { useLoginMutation, useListPublicTenantsQuery } from "../../lib/api";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { brand } from "../../theme/brandTokens";

const SUPER_ADMIN_ACCESS = "__super_admin__";

/* ─── Admin portal right-panel content ─── */
const ADMIN_PROFILES = [
  {
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 22 }} />,
    title: "Gestão e Secretaria",
    desc: "Cadastro, organização e relatórios institucionais",
  },
  {
    icon: <SupervisorAccountIcon sx={{ fontSize: 22 }} />,
    title: "Direção e Coordenação",
    desc: "Visão panorâmica, ocorrências e decisões",
  },
  {
    icon: <SupportAgentIcon sx={{ fontSize: 22 }} />,
    title: "Professores e Orientação",
    desc: "Notas, frequência e comunicação com famílias",
  },
];

/* ─── Student portal right-panel content ─── */
const STUDENT_FEATURES = [
  {
    icon: <AssessmentIcon sx={{ fontSize: 22 }} />,
    title: "Notas e boletim",
    desc: "Acompanhe suas notas e boletim escolar atualizados.",
  },
  {
    icon: <NotificationsActiveIcon sx={{ fontSize: 22 }} />,
    title: "Comunicados da escola",
    desc: "Receba avisos e comunicados importantes em tempo real.",
  },
  {
    icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 22 }} />,
    title: "Ocorrências e alertas",
    desc: "Visualize ocorrências e alertas de forma transparente.",
  },
  {
    icon: <FaceIcon sx={{ fontSize: 22 }} />,
    title: "Frequência detalhada",
    desc: "Acompanhe a frequência nas aulas e a presença diária.",
  },
];

const loginTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.azulPrincipal, dark: brand.azulEscuro, contrastText: brand.branco },
    secondary: { main: brand.verde },
    text: { primary: brand.grafite, secondary: brand.cinza500 },
    background: { default: brand.fundoClaroQuente, paper: brand.branco },
  },
  typography: {
    fontFamily: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: { color: brand.grafite },
      },
    },
  },
});

export const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationMessage = (location.state as { message?: string } | null)?.message ?? null;

  const isStudentFlow = useMemo(() => {
    if (location.pathname === "/login/aluno") return true;
    const perfil = searchParams.get("perfil")?.toLowerCase();
    return perfil === "aluno" || perfil === "responsavel";
  }, [location.pathname, searchParams]);

  const readStorage = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    return localStorage.getItem(key) ?? fallback;
  };

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(() => readStorage("colabora.login.remember", "true") === "true");
  const [login, { isLoading }] = useLoginMutation();
  const { data: schools } = useListPublicTenantsQuery();
  const [selectedSchool, setSelectedSchool] = useState(() => {
    const stored = readStorage("colabora.login.school", "");
    return stored === "central" ? SUPER_ADMIN_ACCESS : stored;
  });

  const resolveErrorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "status" in err) {
      const apiError = err as FetchBaseQueryError;
      const data = apiError.data as any;
      if (typeof data === "string") return data;
      if (data?.details && Array.isArray(data.details)) {
        return data.details.map((d: any) => `${d.message}`).join(", ");
      }
      if (data && typeof data === "object" && "error" in data) return String(data.error || "Falha no login");
      if ("error" in apiError && typeof apiError.error === "string") {
        if (apiError.error.toLowerCase().includes("fetch")) return "Servidor indisponível. Verifique se o backend está ativo.";
        return apiError.error;
      }
      if (typeof apiError.status === "number" && apiError.status >= 500) return "Servidor indisponível. Tente novamente em instantes.";
    }
    return err instanceof Error ? err.message : "Falha no login";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isStudentFlow && !selectedSchool) {
      setError("Selecione a escola para acessar.");
      return;
    }
    try {
      const response = await login({
        username,
        password,
        tenant_slug: isStudentFlow || selectedSchool === SUPER_ADMIN_ACCESS ? undefined : selectedSchool || undefined,
      }).unwrap();
      dispatch(setCredentials(response));
      if (response.user?.tenant_id) dispatch(setTenantId(response.user.tenant_id));
      if (response.user?.must_change_password) {
        navigate("/alterar-senha", { replace: true });
      } else {
        navigate("/app");
      }
    } catch (err) {
      setError(resolveErrorMessage(err));
    }
  };

  useEffect(() => {
    localStorage.setItem("colabora.login.remember", rememberMe.toString());
    localStorage.setItem("colabora.login.school", selectedSchool);
    localStorage.removeItem("colabora.login.username");
  }, [rememberMe, selectedSchool]);

  useEffect(() => {
    if (schools && schools.length > 0) {
      const schoolSlugs = schools.map((s) => s.slug);
      if (!isStudentFlow && selectedSchool === SUPER_ADMIN_ACCESS) return;
      if (isStudentFlow) return;
      if (!schoolSlugs.includes(selectedSchool)) setSelectedSchool(schools[0].slug);
    }
  }, [isStudentFlow, selectedSchool, schools]);

  /* ─── Derived ─── */
  const accentColor = isStudentFlow ? brand.verde : brand.azulPrincipal;
  const panelBg = isStudentFlow ? brand.verde : brand.azulPrincipal;

  return (
    <ThemeProvider theme={loginTheme}>
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: brand.fundoClaroQuente,
        color: brand.grafite,
      }}
    >
      {/* ─── Top bar ─── */}
      <Box
        sx={{
          width: "100%",
          bgcolor: brand.branco,
          borderBottom: `1px solid ${brand.cinza100}`,
          py: 1.5,
        }}
      >
        <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, sm: 3 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box
              sx={{ cursor: "pointer", display: "flex", alignItems: "center" }}
              onClick={() => navigate("/")}
            >
              <img
                src="/colaboraedu-logo.png"
                alt="colaboraEDU"
                style={{ height: 80, width: 'auto', objectFit: 'contain' }}
              />
            </Box>
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/")}
              sx={{
                color: brand.cinza500,
                fontSize: "0.85rem",
                "&:hover": { color: brand.azulPrincipal },
              }}
            >
              Voltar ao site
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* ─── Main content ─── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 4, md: 6 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 960 }}>
          <Grid container spacing={{ xs: 0, md: 5 }} alignItems="stretch">
            {/* ─── Left: Login form ─── */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ maxWidth: 440, mx: "auto", width: "100%", py: { xs: 0, md: 2 } }}>
                {/* Badge */}
                <Chip
                  icon={isStudentFlow
                    ? <SchoolIcon sx={{ fontSize: "16px !important" }} />
                    : <LockIcon sx={{ fontSize: "16px !important" }} />
                  }
                  label={isStudentFlow ? "Portal Aluno / Responsável" : "Portal Administrativo"}
                  sx={{
                    bgcolor: alpha(accentColor, 0.08),
                    color: accentColor,
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    mb: 3,
                    "& .MuiChip-icon": { color: accentColor },
                  }}
                />

                {/* Brand title */}
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: "1.8rem", sm: "2.1rem" }, mb: 1, lineHeight: 1.2 }}
                >
                  <Box component="span" sx={{ color: brand.grafite }}>colabora</Box>
                  <Box component="span" sx={{ color: brand.azulPrincipal, fontWeight: 800 }}>EDU</Box>
                </Typography>

                <Typography variant="h4" sx={{ color: brand.grafite, fontWeight: 500, fontSize: { xs: "1rem", sm: "1.1rem" }, mb: 1 }}>
                  {isStudentFlow ? "Acesso do aluno e responsável" : "Acesso administrativo"}
                </Typography>

                <Typography variant="body1" sx={{ color: brand.cinza500, mb: 4, fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {isStudentFlow
                    ? "Acompanhe notas, frequência, comunicados e ocorrências. Tudo em um só lugar, de forma simples e acessível."
                    : "Entre com suas credenciais para acessar o painel de gestão, coordenação ou ensino."}
                </Typography>

                {/* Form */}
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <Stack spacing={2.5}>
                    {/* School selector — only for admin */}
                    {!isStudentFlow && (
                      <FormControl fullWidth>
                        <InputLabel id="school-label">Escola / Unidade</InputLabel>
                        <Select
                          labelId="school-label"
                          label="Escola / Unidade"
                          value={
                            selectedSchool === SUPER_ADMIN_ACCESS || schools?.some((s) => s.slug === selectedSchool)
                              ? selectedSchool
                              : ""
                          }
                          startAdornment={
                            <InputAdornment position="start">
                              <BusinessIcon fontSize="small" sx={{ color: brand.cinza500, ml: 0.5 }} />
                            </InputAdornment>
                          }
                          onChange={(event: SelectChangeEvent<string>) => {
                            setSelectedSchool(event.target.value);
                          }}
                          sx={{
                            borderRadius: 1.5,
                            bgcolor: brand.branco,
                            color: brand.grafite,
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: brand.cinza100, borderWidth: 2 },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: accentColor },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: accentColor },
                            "& .MuiInputLabel-root": { color: brand.cinza500 },
                            "& .MuiInputLabel-root.Mui-focused": { color: accentColor },
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                bgcolor: brand.branco,
                                border: `1px solid ${brand.cinza100}`,
                                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                                "& .MuiMenuItem-root": {
                                  color: brand.grafite,
                                  fontSize: "0.9rem",
                                  "&:hover": { bgcolor: alpha(accentColor, 0.06) },
                                  "&.Mui-selected": {
                                    bgcolor: alpha(accentColor, 0.08),
                                    "&:hover": { bgcolor: alpha(accentColor, 0.12) },
                                  },
                                },
                              },
                            },
                          }}
                        >
                          <MenuItem value={SUPER_ADMIN_ACCESS}>
                            <em>Central / Super Admin</em>
                          </MenuItem>
                          {schools?.map((school) => (
                            <MenuItem key={school.slug} value={school.slug}>{school.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    {/* Username field */}
                    <TextField
                      fullWidth
                      label={isStudentFlow ? "E-mail, CPF ou matrícula" : "E-mail ou usuário"}
                      type={isStudentFlow ? "text" : "email"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete={isStudentFlow ? "username" : "email"}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutlineOutlinedIcon sx={{ color: brand.cinza500, fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: brand.branco,
                          minHeight: 52,
                          color: brand.grafite,
                          "& fieldset": { borderColor: brand.cinza100, borderWidth: 2 },
                          "&:hover fieldset": { borderColor: accentColor },
                          "&.Mui-focused fieldset": { borderColor: accentColor },
                        },
                        "& .MuiInputLabel-root": { color: brand.cinza500 },
                        "& .MuiInputLabel-root.Mui-focused": { color: accentColor },
                      }}
                    />

                    {/* Password field */}
                    <TextField
                      fullWidth
                      label="Senha"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ color: brand.cinza500, fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                              sx={{ color: brand.cinza500 }}
                            >
                              {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 1.5,
                          bgcolor: brand.branco,
                          minHeight: 52,
                          color: brand.grafite,
                          "& fieldset": { borderColor: brand.cinza100, borderWidth: 2 },
                          "&:hover fieldset": { borderColor: accentColor },
                          "&.Mui-focused fieldset": { borderColor: accentColor },
                        },
                        "& .MuiInputLabel-root": { color: brand.cinza500 },
                        "& .MuiInputLabel-root.Mui-focused": { color: accentColor },
                      }}
                    />

                    {/* Remember + forgot */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: "wrap", gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            size="small"
                            sx={{ color: brand.cinza500, "&.Mui-checked": { color: accentColor } }}
                          />
                        }
                        label="Lembrar acesso"
                        sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem", color: brand.cinza500 } }}
                      />
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => navigate("/esqueci-senha")}
                        sx={{ fontSize: "0.85rem", color: accentColor, fontWeight: 500, cursor: "pointer" }}
                      >
                        Esqueci minha senha
                      </Link>
                    </Stack>

                    {/* Alerts */}
                    {locationMessage && (
                      <Alert severity="success" sx={{ borderRadius: 1.5, fontSize: "0.85rem" }}>
                        {locationMessage}
                      </Alert>
                    )}
                    {error && (
                      <Alert severity="error" sx={{ borderRadius: 1.5, fontSize: "0.85rem" }}>
                        {error}
                      </Alert>
                    )}

                    {/* Submit button */}
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      size="large"
                      disabled={isLoading || !username || !password}
                      startIcon={!isLoading && (isStudentFlow ? <SchoolIcon /> : <LockIcon />)}
                      sx={{
                        py: 1.5,
                        fontSize: "1rem",
                        mt: 0.5,
                        bgcolor: isLoading || !username || !password ? undefined : accentColor,
                        "&:hover": { bgcolor: isStudentFlow ? "#1e6b40" : brand.azulApoio },
                      }}
                    >
                      {isLoading ? "Entrando..." : isStudentFlow ? "Entrar no portal" : "Entrar no painel"}
                    </Button>
                  </Stack>
                </Box>

                {/* Portal switch */}
                <Box sx={{ mt: 4 }}>
                  <Divider sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: "0.78rem", color: brand.cinza500, px: 1 }}>
                      Outro tipo de acesso?
                    </Typography>
                  </Divider>
                  {isStudentFlow ? (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<AdminPanelSettingsIcon />}
                      onClick={() => navigate("/login")}
                      sx={{
                        borderColor: brand.azulPrincipal,
                        color: brand.azulPrincipal,
                        "&:hover": { borderColor: brand.azulPrincipal, bgcolor: alpha(brand.azulPrincipal, 0.06) },
                      }}
                    >
                      Portal Administrativo
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<SchoolIcon />}
                      onClick={() => navigate("/login/aluno")}
                      sx={{
                        borderColor: brand.verde,
                        color: brand.verde,
                        "&:hover": { borderColor: brand.verde, bgcolor: alpha(brand.verde, 0.06) },
                      }}
                    >
                      Portal Aluno / Responsável
                    </Button>
                  )}
                </Box>
              </Box>
            </Grid>

            {/* ─── Right: Info panel (desktop only) ─── */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: { xs: "none", md: "block" } }}>
              <Box
                sx={{
                  bgcolor: panelBg,
                  borderRadius: 3,
                  p: 4,
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 500,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {/* Decorative circles */}
                <Box sx={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(brand.branco, 0.06)} 0%, transparent 70%)`, pointerEvents: "none" }} />
                <Box sx={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(brand.branco, 0.08)} 0%, transparent 70%)`, pointerEvents: "none" }} />

                <Box sx={{ position: "relative", zIndex: 1 }}>
                  {/* Header icon + title */}
                  <Box sx={{ mb: 3 }}>
                    {isStudentFlow ? (
                      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        <FaceIcon sx={{ fontSize: 44, color: brand.branco }} />
                        <FamilyRestroomIcon sx={{ fontSize: 44, color: brand.branco }} />
                      </Stack>
                    ) : (
                      <SecurityIcon sx={{ fontSize: 48, color: brand.branco, mb: 2, display: "block" }} />
                    )}
                    <Typography variant="h3" sx={{ color: brand.branco, fontSize: "1.5rem", fontWeight: 700, mb: 1.5 }}>
                      {isStudentFlow ? "Acompanhe a vida escolar" : "Acesso seguro e protegido"}
                    </Typography>
                    <Typography sx={{ color: alpha(brand.branco, 0.75), fontSize: "0.95rem", lineHeight: 1.7, maxWidth: 360 }}>
                      {isStudentFlow
                        ? "Acesse notas, boletins, comunicados e ocorrências de forma simples. Tudo que alunos e responsáveis precisam para acompanhar o progresso escolar."
                        : "Cada perfil tem acesso apenas às funcionalidades da sua função. Seus dados são protegidos com autenticação segura e organizados por unidade escolar."}
                    </Typography>
                  </Box>

                  {/* Feature list */}
                  <Stack spacing={2}>
                    {(isStudentFlow ? STUDENT_FEATURES : ADMIN_PROFILES).map((item, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{
                          bgcolor: alpha(brand.branco, 0.1),
                          borderRadius: 2,
                          p: 2,
                          border: `1px solid ${alpha(brand.branco, 0.12)}`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            bgcolor: alpha(brand.branco, 0.15),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            color: brand.branco,
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: brand.branco, mb: 0.3 }}>
                            {item.title}
                          </Typography>
                          <Typography sx={{ fontSize: "0.78rem", color: alpha(brand.branco, 0.65), lineHeight: 1.4 }}>
                            {item.desc}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>

                  {/* Trust chips — admin only */}
                  {!isStudentFlow && (
                    <Stack direction="row" spacing={1} sx={{ mt: 4, flexWrap: "wrap", gap: 1 }}>
                      {[
                        { icon: <SecurityIcon sx={{ fontSize: 14 }} />, label: "Autenticação segura" },
                        { icon: <DomainIcon sx={{ fontSize: 14 }} />, label: "Dados por escola" },
                        { icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 14 }} />, label: "Controle por perfil" },
                      ].map((chip, idx) => (
                        <Chip
                          key={idx}
                          icon={chip.icon}
                          label={chip.label}
                          size="small"
                          sx={{
                            bgcolor: alpha(brand.branco, 0.12),
                            color: alpha(brand.branco, 0.85),
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            "& .MuiChip-icon": { color: alpha(brand.branco, 0.7) },
                          }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* ─── Footer ─── */}
      <Box sx={{ py: 3, bgcolor: brand.branco, borderTop: `1px solid ${brand.cinza100}` }}>
        <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, sm: 3 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography sx={{ fontSize: "0.8rem", color: brand.cinza500, textAlign: "center" }}>
              © {new Date().getFullYear()} colaboraEDU. Todos os direitos reservados.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Link href="#" underline="hover" sx={{ fontSize: "0.8rem", color: brand.cinza500 }}>
                Termos de uso
              </Link>
              <Link href="#" underline="hover" sx={{ fontSize: "0.8rem", color: brand.cinza500 }}>
                Privacidade
              </Link>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
    </ThemeProvider>
  );
};
