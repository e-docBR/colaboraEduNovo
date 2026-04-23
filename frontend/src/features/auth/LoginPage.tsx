import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppDispatch } from "../../app/hooks";
import { setCredentials } from "./authSlice";
import { setTenantId } from "../app/appSlice";
import { useLoginMutation, useListPublicTenantsQuery } from "../../lib/api";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();

  const isStudentFlow = useMemo(() => {
    const perfil = searchParams.get("perfil")?.toLowerCase();
    return perfil === "aluno" || perfil === "responsavel";
  }, [searchParams]);

  const roleOptions = useMemo(
    () => {
      const adminRoles = [
        { value: "admin", label: "Administração" },
        { value: "coordenacao", label: "Coordenação" },
        { value: "orientacao", label: "Orientação" },
        { value: "professor", label: "Professor" },
        { value: "direcao", label: "Direção" }
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
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState(() => {
    const stored = readStorage("colabora.login.role", isStudentFlow ? "aluno" : "admin");
    return stored;
  });
  const [rememberMe, setRememberMe] = useState(() => readStorage("colabora.login.remember", "true") === "true");
  const [login, { isLoading }] = useLoginMutation();
  const { data: schools } = useListPublicTenantsQuery();
  const [selectedSchool, setSelectedSchool] = useState(() => readStorage("colabora.login.school", "central"));

  const resolveErrorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "status" in err) {
      const apiError = err as FetchBaseQueryError;
      const data = apiError.data as any;
      if (typeof data === "string") {
        return data;
      }

      // Handle Pydantic validation errors (422)
      if (data?.details && Array.isArray(data.details)) {
        return data.details.map((d: any) => `${d.message}`).join(", ");
      }

      if (data && typeof data === "object" && "error" in data) {
        return String(data.error || "Falha no login");
      }
      if ("error" in apiError && typeof apiError.error === "string") {
        if (apiError.error.toLowerCase().includes("fetch")) {
          return "Servidor indisponível. Verifique se o backend está ativo (porta 5000).";
        }
        return apiError.error;
      }
      if (typeof apiError.status === "number" && apiError.status >= 500) {
        return "Servidor indisponível. Tente novamente em instantes.";
      }
    }
    return err instanceof Error ? err.message : "Falha no login";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const response = await login({
        username,
        password,
        tenant_slug: selectedSchool !== "central" ? selectedSchool : undefined
      }).unwrap();
      dispatch(setCredentials(response));
      if (response.user?.tenant_id) {
        dispatch(setTenantId(response.user.tenant_id));
      }
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
    if (!optionExists && roleOptions.length > 0) {
      setSelectedRole(roleOptions[0].value);
    }
  }, [roleOptions, selectedRole]);

  useEffect(() => {
    if (schools && schools.length > 0) {
      const schoolSlugs = schools.map(s => s.slug);
      const isValid = schoolSlugs.includes(selectedSchool) || (!isStudentFlow && selectedSchool === "central");

      if (!isValid) {
        if (isStudentFlow) {
          setSelectedSchool(schools[0].slug);
        } else {
          setSelectedSchool("central");
        }
      }
    }
  }, [isStudentFlow, selectedSchool, schools]);

  const heroHighlights = [
    { label: "Integração automática", value: "PDF ➝ KPIs" },
    { label: "Perfis seguros", value: "JWT + RBAC" },
    { label: "Insights imediatos", value: "Alunos em risco" }
  ];

  const selectedRoleLabel = roleOptions.find((role) => role.value === selectedRole)?.label ?? "Perfil";

  return (
    <Box
      minHeight="100vh"
      sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main}0D, ${theme.palette.secondary.main}17)`
      }}
      display="flex"
      alignItems="center"
      px={2}
    >
      <Card
        sx={{
          maxWidth: theme.breakpoints.values.lg,
          width: "100%",
          margin: "0 auto",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: 24
        }}
      >
        <Grid container>
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              background: `linear-gradient(135deg, #040b1c 0%, #092247 50%, #0e2f66 100%)`,
              color: "white",
              p: { xs: 4, md: 6 },
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Box component="img" src="/colaboraedu4.png" alt="Colabora EDU" sx={{ height: 48 }} />
              <Typography variant="subtitle1" color="rgba(255,255,255,0.8)">
                Plataforma colaboraEDU
              </Typography>
            </Stack>
            <Stack spacing={2}>
              <Typography variant="h3" fontWeight={700} lineHeight={1.1}>
                Inteligência acadêmica segura para cada perfil de liderança.
              </Typography>
              <Typography variant="body1" color="rgba(255,255,255,0.8)">
                Escolha seu perfil, conecte-se com seu login institucional e acesse dashboards, ingestão automatizada e relatórios estratégicos.
              </Typography>
            </Stack>
            <Stack spacing={2}>
              {heroHighlights.map((item) => (
                <Stack
                  key={item.label}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    p: 2
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: "white"
                    }}
                  />
                  <Box>
                    <Typography variant="subtitle2" color="rgba(255,255,255,0.9)">
                      {item.label}
                    </Typography>
                    <Typography variant="body2" color="rgba(255,255,255,0.7)">
                      {item.value}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box component="img" src="/colaboraedu3.png" alt="Selo Colabora EDU" sx={{ height: 56 }} />
              <Typography variant="caption" color="rgba(255,255,255,0.7)">
                Dados seguros · Ambiente monitorado · Última atualização 12/2025
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              <Stack spacing={2} mb={3}>
                <Typography variant="h4" fontWeight={600}>
                  {isStudentFlow ? "Acesso aluno/responsável" : "Acesse sua conta"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isStudentFlow
                    ? "Escolha seu perfil e entre com as credenciais fornecidas pela escola."
                    : "Utilize seu usuário institucional. Em caso de dúvidas, contate suporte@colaboraedu.com."}
                </Typography>
              </Stack>
              <Stack component="form" gap={3} onSubmit={handleSubmit}>
                <FormControl fullWidth>
                  <InputLabel id="school-label">Escola / Unidade</InputLabel>
                  <Select
                    labelId="school-label"
                    label="Escola / Unidade"
                    value={
                      (selectedSchool === "central" && !isStudentFlow) || (schools?.some(s => s.slug === selectedSchool))
                        ? selectedSchool
                        : ""
                    }
                    displayEmpty
                    onChange={(event: SelectChangeEvent<string>) => setSelectedSchool(event.target.value as string)}
                  >
                    {!isStudentFlow && (
                      <MenuItem value="central">
                        <em>Central / Super Admin</em>
                      </MenuItem>
                    )}
                    {schools?.map((school) => (
                      <MenuItem key={school.slug} value={school.slug}>
                        {school.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Selecione a unidade que deseja acessar.
                  </FormHelperText>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="perfil-label">Perfil</InputLabel>
                  <Select
                    labelId="perfil-label"
                    label="Perfil"
                    value={selectedRole}
                    onChange={(event: SelectChangeEvent<string>) => setSelectedRole(event.target.value as string)}
                  >
                    {roleOptions.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Acesso preparado para {selectedRoleLabel.toLowerCase()}.
                  </FormHelperText>
                </FormControl>
                <TextField
                  label="Usuário"
                  fullWidth
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <TextField
                  label="Senha"
                  type="password"
                  fullWidth
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                  <FormControlLabel
                    control={<Checkbox checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />}
                    label="Lembrar-me"
                  />
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() => navigate("/esqueci-senha")}
                    sx={{ cursor: "pointer" }}
                  >
                    Esqueci minha senha
                  </Link>
                </Stack>
                {error && (
                  <Typography color="error" variant="body2">
                    {error}
                  </Typography>
                )}
                <Button type="submit" variant="contained" size="large" disabled={isLoading} sx={{ borderRadius: 999 }}>
                  {isLoading ? "Validando credenciais..." : "Entrar"}
                </Button>
                <Divider />
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  Ambiente protegido. Tentativas são monitoradas e notificadas para TI.
                </Typography>
              </Stack>
            </CardContent>
          </Grid>
        </Grid>
      </Card>
    </Box>
  );
};
