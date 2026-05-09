import { FormEvent, useEffect, useMemo, useState } from "react";
import { usuarioSchema, getFieldErrors, type ZodFieldErrors } from "../../lib/schemas";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";

import { useAppSelector } from "../../app/hooks";
import {
  UsuarioAccount,
  useCreateUsuarioMutation,
  useDeleteUsuarioMutation,
  useListUsuariosQuery,
  useUpdateUsuarioMutation
} from "../../lib/api";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  orientador: "Orientador",
  professor: "Professor",
  diretor: "Diretor",
  aluno: "Aluno"
};

type UsuarioFormValues = {
  username: string;
  password?: string;
  role?: string;
  is_admin: boolean;
  aluno_id?: number | null;
  must_change_password: boolean;
};

const emptyFormState: UsuarioFormValues = {
  username: "",
  password: "",
  role: "",
  is_admin: false,
  aluno_id: null,
  must_change_password: true
};

export const UsuariosPage = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const isAdmin = Boolean(currentUser?.is_admin || currentUser?.role === "admin");
  const USERS_PER_PAGE = 50;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<UsuarioAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UsuarioAccount | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const filters = useMemo(
    () => ({
      page,
      per_page: USERS_PER_PAGE,
      q: search.trim() || undefined,
      role: roleFilter || undefined
    }),
    [page, search, roleFilter, USERS_PER_PAGE]
  );

  const { data, isFetching, isError } = useListUsuariosQuery(filters, {
    skip: !isAdmin
  });

  const [createUsuario, { isLoading: isCreating }] = useCreateUsuarioMutation();
  const [updateUsuario, { isLoading: isUpdating }] = useUpdateUsuarioMutation();
  const [deleteUsuario, { isLoading: isDeleting }] = useDeleteUsuarioMutation();

  const usuarios = data?.items ?? [];
  const pageMeta = data?.meta;
  const currentPerPage = pageMeta?.per_page ?? USERS_PER_PAGE;
  const totalPages = pageMeta ? Math.max(1, Math.ceil(pageMeta.total / currentPerPage)) : 1;

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUsuario(null);
    setFormError("");
  };

  const openCreateDialog = () => {
    setEditingUsuario(null);
    setDialogOpen(true);
  };

  const openEditDialog = (usuario: UsuarioAccount) => {
    setEditingUsuario(usuario);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: UsuarioFormValues) => {
    try {
      setFormError("");
      const basePayload = {
        username: values.username.trim(),
        role: values.role || undefined,
        is_admin: values.is_admin,
        aluno_id: values.aluno_id ?? null,
        must_change_password: values.must_change_password
      };
      if (editingUsuario) {
        await updateUsuario({
          id: editingUsuario.id,
          ...basePayload,
          ...(values.password ? { password: values.password } : {})
        }).unwrap();
      } else {
        if (!values.password) {
          setFormError("A senha é obrigatória para novos usuários.");
          return;
        }
        await createUsuario({ ...basePayload, password: values.password }).unwrap();
      }
      closeDialog();
    } catch (error) {
      setFormError("Não foi possível salvar o usuário. Verifique os dados e tente novamente.");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUsuario(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (error: any) {
      const msg = error?.data?.error ?? error?.data?.message ?? "Erro ao excluir usuário. Tente novamente.";
      setDeleteError(msg);
    }
  };

  if (!isAdmin) {
    return <Alert severity="warning">Apenas administradores podem acessar o cadastro de usuários.</Alert>;
  }

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems={{ md: "center" }}>
        <TextField
          label="Buscar por nome ou usuário"
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Perfil"
          select
          SelectProps={{ native: true, displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="">Todos</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </TextField>
        <Button variant="contained" color="primary" onClick={openCreateDialog} sx={{ minWidth: 180 }}>
          Novo Usuário
        </Button>
      </Stack>

      {isError && <Alert severity="error">Não foi possível carregar os usuários.</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" mb={2} gap={1}>
            <Typography variant="h6">Usuários</Typography>
            <Typography variant="body2" color="text.secondary">
              Página {pageMeta?.page ?? page} de {totalPages} · {currentPerPage} por página
            </Typography>
          </Stack>

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Usuário</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Perfil</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Administrador</TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>Aluno Vinculado</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Troca de Senha</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {isFetching && !usuarios.length ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : usuarios.length ? (
                  usuarios.map((usuario) => (
                    <TableRow key={usuario.id} hover>
                      <TableCell>
                        <Stack>
                          <Typography fontWeight={600}>{usuario.username}</Typography>
                          {usuario.role && (
                            <Typography variant="caption" color="text.secondary">
                              {usuario.role}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{usuario.role ? roleLabels[usuario.role] ?? usuario.role : "—"}</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                        <Chip label={usuario.is_admin ? "Sim" : "Não"} color={usuario.is_admin ? "success" : "default"} size="small" />
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                        {usuario.aluno ? (
                          <Stack spacing={0.25}>
                            <Typography fontWeight={600}>{usuario.aluno.nome}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {usuario.aluno.matricula} • {usuario.aluno.turma} • {usuario.aluno.turno}
                            </Typography>
                          </Stack>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                        <Chip
                          label={usuario.must_change_password ? "Obrigatório" : "Opcional"}
                          color={usuario.must_change_password ? "warning" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => openEditDialog(usuario)}>
                            Editar
                          </Button>
                          <Button size="small" color="error" onClick={() => setDeleteTarget(usuario)}>
                            Excluir
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>


          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="body2" color="text.secondary">
              Total: {pageMeta?.total ?? usuarios.length}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Anterior
              </Button>
              <Button
                variant="outlined"
                disabled={pageMeta ? pageMeta.page >= totalPages : usuarios.length === 0}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Próxima
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <UsuarioDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        initialData={editingUsuario}
        isSaving={isCreating || isUpdating}
        error={formError}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Excluir usuário</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tem certeza de que deseja excluir o usuário "{deleteTarget?.username}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button color="error" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!deleteError}
        autoHideDuration={5000}
        onClose={() => setDeleteError("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setDeleteError("")}>{deleteError}</Alert>
      </Snackbar>
    </Box>
  );
};

type UsuarioDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: UsuarioFormValues) => Promise<void>;
  initialData: UsuarioAccount | null;
  isSaving: boolean;
  error?: string;
};

// Modal centraliza criação/edição para manter a experiência consistente.
const UsuarioDialog = ({ open, onClose, onSubmit, initialData, isSaving, error }: UsuarioDialogProps) => {
  const [values, setValues] = useState<UsuarioFormValues>(emptyFormState);
  const [fieldErrors, setFieldErrors] = useState<ZodFieldErrors>({});

  useEffect(() => {
    if (!open) {
      setValues(emptyFormState);
      return;
    }
    if (initialData) {
      setValues({
        username: initialData.username,
        password: "",
        role: initialData.role ?? "",
        is_admin: initialData.is_admin,
        aluno_id: initialData.aluno_id ?? null,
        must_change_password: initialData.must_change_password
      });
    } else {
      setValues(emptyFormState);
    }
  }, [initialData, open]);

  const handleChange = (field: keyof UsuarioFormValues, value: string | number | boolean | null) => {
    setValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = usuarioSchema.safeParse({ username: values.username.trim(), role: values.role });
    if (!result.success) {
      setFieldErrors(getFieldErrors(result));
      return;
    }
    setFieldErrors({});
    const payload: UsuarioFormValues = {
      username: values.username.trim(),
      role: values.role || undefined,
      is_admin: values.is_admin,
      aluno_id: values.aluno_id ?? null,
      must_change_password: values.must_change_password
    };
    if (values.password) {
      payload.password = values.password;
    }
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? "Editar usuário" : "Novo usuário"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Usuário"
            value={values.username}
            onChange={(event) => handleChange("username", event.target.value)}
            required
            fullWidth
            error={!!fieldErrors.username}
            helperText={fieldErrors.username}
          />
          <TextField
            label="Senha"
            type="password"
            value={values.password ?? ""}
            onChange={(event) => handleChange("password", event.target.value)}
            helperText={initialData ? "Preencha apenas se desejar redefinir a senha." : undefined}
            fullWidth
          />
          <TextField
            label="Perfil"
            select
            SelectProps={{ native: true }}
            value={values.role ?? ""}
            onChange={(event) => handleChange("role", event.target.value)}
            fullWidth
          >
            <option value="">Selecione</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </TextField>
          <TextField
            label="ID do aluno vinculado"
            type="number"
            value={values.aluno_id ?? ""}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              handleChange("aluno_id", event.target.value === "" ? null : parsed);
            }}
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={values.is_admin} onChange={(_, checked) => handleChange("is_admin", checked)} />}
            label="Administrador"
          />
          <FormControlLabel
            control={
              <Switch
                checked={values.must_change_password}
                onChange={(_, checked) => handleChange("must_change_password", checked)}
              />
            }
            label="Obrigar troca de senha no próximo acesso"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
