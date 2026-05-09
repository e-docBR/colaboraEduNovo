import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForgotPasswordMutation, useListPublicTenantsQuery } from "../../lib/api";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const { data: tenants = [] } = useListPublicTenantsQuery();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tenantSlug) {
      setError("Selecione a escola antes de continuar.");
      return;
    }
    try {
      await forgotPassword({ email, tenant_slug: tenantSlug }).unwrap();
      setSent(true);
    } catch {
      setError("Ocorreu um erro ao enviar o e-mail. Tente novamente.");
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="background.default"
      px={2}
    >
      <Card sx={{ maxWidth: 420, width: "100%", borderRadius: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" mb={3}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <EmailIcon sx={{ color: "white", fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>
              Recuperar senha
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" mt={1}>
              Selecione sua escola e informe o e-mail cadastrado para receber o link de redefinição.
            </Typography>
          </Stack>

          {sent ? (
            <Stack spacing={2}>
              <Alert severity="success">
                E-mail enviado! Verifique sua caixa de entrada (e a pasta de spam).
              </Alert>
              <Button variant="outlined" fullWidth onClick={() => navigate("/login")}>
                Voltar ao login
              </Button>
            </Stack>
          ) : (
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              {tenants.length > 0 && (
                <FormControl fullWidth required>
                  <InputLabel>Escola</InputLabel>
                  <Select
                    value={tenantSlug}
                    label="Escola"
                    onChange={(e) => setTenantSlug(e.target.value)}
                  >
                    {tenants.map((t) => (
                      <MenuItem key={t.id} value={t.slug}>
                        {t.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                required
                autoFocus={tenants.length === 0}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading || !email || !tenantSlug}
                size="large"
              >
                {isLoading ? "Enviando…" : "Enviar link de recuperação"}
              </Button>
              <Link
                component="button"
                type="button"
                variant="body2"
                align="center"
                onClick={() => navigate("/login")}
                sx={{ cursor: "pointer" }}
              >
                Voltar ao login
              </Link>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
