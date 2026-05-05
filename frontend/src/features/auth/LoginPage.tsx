import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Avatar
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import PersonIcon from "@mui/icons-material/Person";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BusinessIcon from "@mui/icons-material/Business";
import BadgeIcon from "@mui/icons-material/Badge";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ShieldIcon from "@mui/icons-material/Shield";
import InsightsIcon from "@mui/icons-material/Insights";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SchoolIcon from "@mui/icons-material/School";
import LockIcon from "@mui/icons-material/Lock";
import VerifiedIcon from "@mui/icons-material/Verified";

import { useAppDispatch } from "../../app/hooks";
import { setCredentials } from "./authSlice";
import { setTenantId } from "../app/appSlice";
import { useLoginMutation, useListPublicTenantsQuery } from "../../lib/api";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

const teal = "#14b8a6";
const emerald = "#10b981";
const amber = "#f59e0b";

export const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationMessage = (location.state as { message?: string } | null)?.message ?? null;

  const isStudentFlow = useMemo(() => {
    const perfil = searchParams.get("perfil")?.toLowerCase();
    return perfil === "aluno" || perfil === "responsavel";
  }, [searchParams]);

  const roleOptions = useMemo(
    () => {
      const adminRoles = [
        { value: "admin", label: "Administração" },
        { value: "coordenador", label: "Coordenação" },
        { value: "orientador", label: "Orientação" },
        { value: "professor", label: "Professor" },
        { value: "diretor", label: "Direção" }
      ];
      const studentRoles = [
        { value: "aluno", label: "Aluno" },
        { value: "responsavel", label: "Responsável" }
      ];
      return isStudentFlow ? studentRoles : adminRoles;
    },
    [isStudentFlow]
  );

  const readStorage = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    return localStorage.getItem(key) ?? fallback;
  };

  const [username, setUsername] = useState(() => readStorage("colabora.login.username", ""));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState(() => {
    const stored = readStorage("colabora.login.role", isStudentFlow ? "aluno" : "admin");
    return stored;
  });
  const [rememberMe, setRememberMe] = useState(() => readStorage("colabora.login.remember", "true") === "true");
  const [login, { isLoading }] = useLoginMutation();
  const { data: schools } = useListPublicTenantsQuery();
  const [selectedSchool, setSelectedSchool] = useState(() => readStorage("colabora.login.school", ""));

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
        if (apiError.error.toLowerCase().includes("fetch")) return "Servidor indisponível. Verifique se o backend está ativo (porta 5000).";
        return apiError.error;
      }
      if (typeof apiError.status === "number" && apiError.status >= 500) return "Servidor indisponível. Tente novamente em instantes.";
    }
    return err instanceof Error ? err.message : "Falha no login";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedSchool) {
      setError("Selecione a escola para acessar.");
      return;
    }
    try {
      const response = await login({
        username,
        password,
        tenant_slug: selectedSchool
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
    if (rememberMe) {
      localStorage.setItem("colabora.login.username", username);
    } else {
      localStorage.removeItem("colabora.login.username");
    }
  }, [rememberMe, username]);

  useEffect(() => {
    localStorage.setItem("colabora.login.role", selectedRole);
    localStorage.setItem("colabora.login.remember", rememberMe.toString());
    localStorage.setItem("colabora.login.school", selectedSchool);
  }, [selectedRole, rememberMe, selectedSchool]);

  useEffect(() => {
    const optionExists = roleOptions.some((role) => role.value === selectedRole);
    if (!optionExists && roleOptions.length > 0) setSelectedRole(roleOptions[0].value);
  }, [roleOptions, selectedRole]);

  useEffect(() => {
    if (schools && schools.length > 0) {
      const schoolSlugs = schools.map(s => s.slug);
      if (!schoolSlugs.includes(selectedSchool)) setSelectedSchool(schools[0].slug);
    }
  }, [selectedSchool, schools]);

  const heroHighlights = [
    { label: "Integração automática", value: "PDF → KPIs", icon: <UploadFileIcon />, color: teal },
    { label: "Perfis seguros", value: "JWT + RBAC", icon: <ShieldIcon />, color: emerald },
    { label: "Insights imediatos", value: "Alunos em risco", icon: <InsightsIcon />, color: amber }
  ];

  const selectedRoleLabel = roleOptions.find((role) => role.value === selectedRole)?.label ?? "Perfil";

  return (
    <Box
      minHeight="100vh"
      sx={{
        position: "relative",
        background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a2818 100%)",
        display: "flex",
        alignItems: "center",
        px: 2,
        py: { xs: 4, md: 2 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${alpha(teal, 0.13)} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          pointerEvents: "none"
        }
      }}
    >
      <Card
        sx={{
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
          position: "relative"
        }}
      >
        <Grid container>
          {/* ─── LEFT PANEL (dark) ─────────────────────────────── */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              background: "linear-gradient(150deg, #040b1c 0%, #092247 55%, #0e2f66 100%)",
              color: "white",
              p: { xs: 4, md: 5 },
              display: { xs: "none", md: "flex" },
              flexDirection: "column",
              gap: 4,
              position: "relative",
              "&::after": {
                content: '""',
                position: "absolute",
                top: 0,
                right: 0,
                width: 1,
                height: "100%",
                bgcolor: alpha("#ffffff", 0.06)
              }
            }}
          >
            {/* Logo */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box component="img" src="/colaboraedu4.png" alt="Colabora EDU" sx={{ height: 40 }} />
              <Typography variant="subtitle2" color={alpha("#ffffff", 0.7)} fontWeight={500}>
                Plataforma colaboraEDU
              </Typography>
            </Stack>

            {/* Headline */}
            <Stack spacing={2}>
              <Typography variant="h4" fontWeight={800} lineHeight={1.15} letterSpacing="-0.02em">
                Inteligência acadêmica segura para cada{" "}
                <Box
                  component="span"
                  sx={{
                    background: `linear-gradient(90deg, ${teal}, ${emerald})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  perfil de liderança.
                </Box>
              </Typography>
              <Typography variant="body2" color={alpha("#ffffff", 0.65)} lineHeight={1.7}>
                Escolha seu perfil, conecte-se com seu login institucional e acesse dashboards, ingestão automatizada e relatórios estratégicos.
              </Typography>
            </Stack>

            {/* Feature highlights */}
            <Stack spacing={1.5}>
              {heroHighlights.map((item) => (
                <Stack
                  key={item.label}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{
                    bgcolor: alpha("#ffffff", 0.05),
                    border: `1px solid ${alpha(item.color, 0.25)}`,
                    borderRadius: 2,
                    p: 2
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: alpha(item.color, 0.18),
                      color: item.color,
                      width: 40,
                      height: 40
                    }}
                  >
                    {item.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" color={alpha("#ffffff", 0.9)} fontWeight={600}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: alpha(item.color, 0.85) }}>
                      {item.value}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            {/* Security seal */}
            <Box sx={{ mt: "auto" }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2, borderRadius: 2, bgcolor: alpha("#ffffff", 0.04), border: `1px solid ${alpha("#ffffff", 0.08)}` }}>
                <Avatar sx={{ bgcolor: alpha(teal, 0.15), color: teal, width: 36, height: 36 }}>
                  <LockIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <VerifiedIcon sx={{ fontSize: 14, color: teal }} />
                    <Typography variant="caption" color={alpha("#ffffff", 0.8)} fontWeight={600}>
                      Dados seguros · Ambiente monitorado
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color={alpha("#ffffff", 0.45)}>
                    Última atualização {new Date().getFullYear()}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Grid>

          {/* ─── RIGHT PANEL (form) ─────────────────────────────── */}
          <Grid item xs={12} md={6}>
            <CardContent sx={{ p: { xs: 3, md: 5 }, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>

              {/* Mobile logo header (visible only on xs) */}
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                mb={3}
                sx={{ display: { xs: "flex", md: "none" } }}
              >
                <Box component="img" src="/colaboraedu4.png" alt="Colabora EDU" sx={{ height: 32 }} />
                <Typography variant="subtitle2" color="text.secondary">Plataforma colaboraEDU</Typography>
              </Stack>

              {/* Form header */}
              <Stack alignItems="flex-start" spacing={2} mb={4}>
                <Avatar
                  sx={{
                    width: 52,
                    height: 52,
                    background: `linear-gradient(135deg, ${teal}, ${emerald})`,
                    boxShadow: `0 4px 16px ${alpha(teal, 0.35)}`
                  }}
                >
                  {isStudentFlow ? <SchoolIcon /> : <AdminPanelSettingsIcon />}
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={800} letterSpacing="-0.01em">
                    {isStudentFlow ? "Acesso aluno/responsável" : "Acesse sua conta"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {isStudentFlow
                      ? "Entre com as credenciais fornecidas pela escola."
                      : "Utilize seu usuário institucional. Dúvidas? suporte@colaboraedu.com"}
                  </Typography>
                </Box>
              </Stack>

              {/* Form */}
              <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
                <FormControl fullWidth>
                  <InputLabel id="school-label">Escola / Unidade</InputLabel>
                  <Select
                    labelId="school-label"
                    label="Escola / Unidade"
                    value={schools?.some(s => s.slug === selectedSchool) ? selectedSchool : ""}
                    displayEmpty
                    startAdornment={
                      <InputAdornment position="start">
                        <BusinessIcon fontSize="small" sx={{ color: "text.disabled", ml: 0.5 }} />
                      </InputAdornment>
                    }
                    onChange={(event: SelectChangeEvent<string>) => setSelectedSchool(event.target.value as string)}
                  >
                    {schools?.map((school) => (
                      <MenuItem key={school.slug} value={school.slug}>{school.name}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Selecione a unidade que deseja acessar.</FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="perfil-label">Perfil</InputLabel>
                  <Select
                    labelId="perfil-label"
                    label="Perfil"
                    value={selectedRole}
                    startAdornment={
                      <InputAdornment position="start">
                        <BadgeIcon fontSize="small" sx={{ color: "text.disabled", ml: 0.5 }} />
                      </InputAdornment>
                    }
                    onChange={(event: SelectChangeEvent<string>) => setSelectedRole(event.target.value as string)}
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Acesso preparado para {selectedRoleLabel.toLowerCase()}.</FormHelperText>
                </FormControl>

                <TextField
                  label="Usuário"
                  fullWidth
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon fontSize="small" sx={{ color: "text.disabled" }} />
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" sx={{ color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                  <FormControlLabel
                    control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} sx={{ color: teal, "&.Mui-checked": { color: teal } }} />}
                    label={<Typography variant="body2">Lembrar-me</Typography>}
                  />
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() => navigate("/esqueci-senha")}
                    sx={{ cursor: "pointer", color: teal, fontSize: "0.875rem" }}
                  >
                    Esqueci minha senha
                  </Link>
                </Stack>

                {locationMessage && (
                  <Alert severity="success" sx={{ borderRadius: 2, fontSize: "0.875rem" }}>
                    {locationMessage}
                  </Alert>
                )}
                {error && (
                  <Alert
                    severity="error"
                    sx={{ borderRadius: 2, fontSize: "0.875rem" }}
                  >
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  sx={{
                    borderRadius: 2,
                    py: 1.6,
                    fontWeight: 700,
                    fontSize: "1rem",
                    background: `linear-gradient(90deg, ${teal}, ${emerald})`,
                    boxShadow: `0 4px 20px ${alpha(teal, 0.4)}`,
                    "&:hover": {
                      boxShadow: `0 8px 28px ${alpha(teal, 0.6)}`,
                      transform: "translateY(-1px)"
                    },
                    "&:disabled": {
                      background: "action.disabledBackground"
                    },
                    transition: "all 0.2s"
                  }}
                >
                  {isLoading ? "Validando credenciais..." : "Entrar"}
                </Button>

                {/* Security footer */}
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ pt: 1 }}>
                  <LockOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                  <Typography variant="caption" color="text.disabled" textAlign="center">
                    Ambiente protegido. Tentativas são monitoradas e notificadas para TI.
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Grid>
        </Grid>
      </Card>
    </Box>
  );
};
