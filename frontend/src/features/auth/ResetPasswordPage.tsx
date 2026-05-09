import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useResetPasswordMutation } from "../../lib/api";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const resolveError = (err: unknown): string => {
    if (err && typeof err === "object" && "data" in err) {
      const data = (err as any).data;
      if (data?.error) return String(data.error);
    }
    return "Erro ao redefinir senha. O link pode ter expirado.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmação não conferem.");
      return;
    }
    if (!token) {
      setError("Link inválido. Solicite um novo link de recuperação.");
      return;
    }

    try {
      await resetPassword({ token, new_password: newPassword }).unwrap();
      setSuccess(true);
    } catch (err) {
      setError(resolveError(err));
    }
  };

  if (!token) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" px={2}>
        <Card sx={{ maxWidth: 420, width: "100%", borderRadius: 6 }}>
          <CardContent sx={{ p: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              Link de recuperação inválido ou ausente.
            </Alert>
            <Button variant="outlined" fullWidth onClick={() => navigate("/esqueci-senha")}>
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
              <LockResetIcon sx={{ color: "white", fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700}>
              Nova senha
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" mt={1}>
              Crie uma senha segura com pelo menos 8 caracteres, uma letra maiúscula e um número.
            </Typography>
          </Stack>

          {success ? (
            <Stack spacing={2}>
              <Alert severity="success">
                Senha redefinida com sucesso! Você já pode fazer login.
              </Alert>
              <Button variant="contained" fullWidth size="large" onClick={() => navigate("/login")}>
                Ir para o login
              </Button>
            </Stack>
          ) : (
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <TextField
                label="Nova senha"
                type="password"
                fullWidth
                required
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Mínimo 8 caracteres, 1 maiúscula e 1 número"
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                fullWidth
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={isLoading || !newPassword || !confirmPassword}
                size="large"
              >
                {isLoading ? "Salvando…" : "Redefinir senha"}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
