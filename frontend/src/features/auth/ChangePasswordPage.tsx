import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout, updateUser } from "./authSlice";
import { useChangePasswordMutation } from "../../lib/api";

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Pelo menos uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Pelo menos um número", test: (p: string) => /[0-9]/.test(p) },
];

const validatePassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));

export const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const resolveErrorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "data" in err) {
      const data = (err as FetchBaseQueryError).data as any;
      if (typeof data === "string") return data;

      // Handle Pydantic validation errors (422)
      if (data?.details && Array.isArray(data.details)) {
        return data.details.map((d: any) => `${d.message}`).join(", ");
      }

      if (data && typeof data === "object" && "error" in data) {
        return String(data.error || "Falha ao alterar senha");
      }
    }
    return err instanceof Error ? err.message : "Falha ao alterar senha";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setTouched(true);
    if (!validatePassword(newPassword)) {
      setError("A nova senha não atende aos requisitos de segurança.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A nova senha e a confirmação não conferem.");
      return;
    }
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword }).unwrap();
      setSuccess(true);
      dispatch(
        updateUser(
          user
            ? {
              ...user,
              must_change_password: false
            }
            : undefined
        )
      );
      navigate("/app", { replace: true });
    } catch (err) {
      setError(resolveErrorMessage(err));
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const handleCancel = () => {
    navigate("/app");
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isForced = user.must_change_password;

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
        <CardContent>
          <Typography variant="h5" fontWeight={600} mb={1}>
            {isForced ? "Atualize sua senha" : "Alterar senha"}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {isForced
              ? "Por segurança, você precisa definir uma nova senha antes de acessar a plataforma."
              : "Preencha os campos abaixo para definir uma nova senha."}
          </Typography>
          <Stack component="form" gap={2} onSubmit={handleSubmit}>
            <TextField
              label="Senha atual"
              type="password"
              fullWidth
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <TextField
              label="Nova senha"
              type="password"
              fullWidth
              required
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setTouched(true); }}
              error={touched && !validatePassword(newPassword)}
            />
            {(touched || newPassword.length > 0) && (
              <Stack gap={0.5} sx={{ pl: 0.5 }}>
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(newPassword);
                  return (
                    <Stack key={rule.label} direction="row" alignItems="center" gap={0.75}>
                      {ok
                        ? <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: "text.disabled" }} />}
                      <Typography variant="caption" color={ok ? "success.main" : "text.secondary"}>
                        {rule.label}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            )}
            <TextField
              label="Confirmar nova senha"
              type="password"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">Senha alterada com sucesso!</Alert>}
            <Stack direction="row" gap={2}>
              <Button type="submit" variant="contained" fullWidth disabled={isLoading}>
                {isLoading ? "Salvando…" : "Salvar senha"}
              </Button>
              {isForced ? (
                <Button variant="text" fullWidth onClick={handleLogout}>
                  Sair
                </Button>
              ) : (
                <Button variant="text" fullWidth onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
