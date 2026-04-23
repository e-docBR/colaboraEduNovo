import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForgotPasswordMutation } from "../../lib/api";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgotPassword({ email }).unwrap();
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
              Informe o e-mail cadastrado. Se ele existir, você receberá um link para criar uma nova senha.
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
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading || !email}
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
