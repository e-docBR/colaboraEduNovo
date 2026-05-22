import { NotificationBell } from "../ui/NotificationBell";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from "@mui/icons-material/Logout";
import LockResetIcon from "@mui/icons-material/LockReset";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Alert,
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  TextField,
  Typography
} from "@mui/material";
import { memo, MouseEvent, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout } from "../../features/auth/authSlice";
import { setAcademicYearId, setTenantId } from "../../features/app/appSlice";
import { useUploadPhotoMutation, useListAcademicYearsQuery, useListPublicTenantsQuery, useUpdateAcademicYearStatusMutation, api } from "../../lib/api";
import { ThemeToggle } from "./ThemeToggle";

const getInitials = (value?: string) =>
  value
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FR";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  super_admin: "Super Admin",
  coordenador: "Coordenador",
  professor: "Professor",
  aluno: "Aluno",
  diretor: "Diretor",
  orientador: "Orientador"
};

const TRIM_LABELS: Record<number, string> = { 1: "1º Trim.", 2: "2º Trim.", 3: "3º Trim." };
const TRIM_ADMIN_ROLES = new Set(["admin", "super_admin", "diretor", "coordenador"]);

const AcademicYearSelector = () => {
  const { data: years, isLoading } = useListAcademicYearsQuery();
  const currentYearId = useAppSelector((state) => state.app.academicYearId);
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const [updateYear] = useUpdateAcademicYearStatusMutation();

  const defaultId = years
    ? (years.find((y) => y.is_current)?.id || years[0]?.id)
    : null;

  useEffect(() => {
    if (!currentYearId && defaultId) {
      dispatch(setAcademicYearId(defaultId));
    }
  }, [currentYearId, defaultId, dispatch]);

  if (isLoading || !years || years.length === 0) return null;

  const selectedId = currentYearId || defaultId;
  const selectedYear = years.find((y) => y.id === selectedId);
  const trimestre = selectedYear?.trimestre_atual ?? 1;
  const canChangeTrimestre = user?.role && TRIM_ADMIN_ROLES.has(user.role);

  const handleYearChange = (newId: number) => {
    dispatch(setAcademicYearId(newId));
    dispatch(api.util.invalidateTags(["Dashboard", "Alunos", "Notas", "Turmas", "Comunicados", "Ocorrencias", "Uploads", "Graficos"]));
  };

  const handleTrimestreChange = async (newTrim: number) => {
    if (!selectedId) return;
    await updateYear({ yearId: selectedId, trimestre_atual: newTrim as 1 | 2 | 3 });
    dispatch(api.util.invalidateTags(["Dashboard", "Graficos"]));
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <TextField
        select
        size="small"
        value={selectedId ?? ""}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        sx={{ minWidth: 100, "& .MuiOutlinedInput-root": { fontSize: "0.875rem", fontWeight: 600 } }}
        SelectProps={{ native: true }}
      >
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}{year.is_current ? " (Atual)" : year.status === "closed" ? " (Encerrado)" : ""}
          </option>
        ))}
      </TextField>

      {canChangeTrimestre ? (
        <TextField
          select
          size="small"
          value={trimestre}
          onChange={(e) => handleTrimestreChange(Number(e.target.value))}
          title="Trimestre em andamento"
          sx={{
            minWidth: 105,
            "& .MuiOutlinedInput-root": {
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "primary.main",
            },
          }}
          SelectProps={{ native: true }}
        >
          <option value={1}>1º Trimestre</option>
          <option value={2}>2º Trimestre</option>
          <option value={3}>3º Trimestre</option>
        </TextField>
      ) : (
        <Box
          sx={{
            px: 1.5, py: 0.5,
            borderRadius: 1,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontSize: "0.8rem",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {TRIM_LABELS[trimestre]}
        </Box>
      )}
    </Box>
  );
};

const TenantSelector = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { data: tenants, isLoading } = useListPublicTenantsQuery();
  const currentTenantId = useAppSelector((state) => state.app.tenantId);
  const dispatch = useAppDispatch();

  if (user?.role !== "super_admin") return null;
  if (isLoading || !tenants || tenants.length === 0) return null;

  const selectedId = currentTenantId || tenants[0].id;

  return (
    <TextField
      select
      size="small"
      value={selectedId}
      onChange={(e) => {
        const newId = Number(e.target.value);
        dispatch(setTenantId(newId));
        dispatch(api.util.invalidateTags(["Dashboard", "Alunos", "Notas", "Turmas", "Comunicados", "Ocorrencias", "Uploads", "Graficos"]));
      }}
      sx={{
        minWidth: 150,
        "& .MuiOutlinedInput-root": {
          fontSize: "0.875rem",
          fontWeight: 600
        }
      }}
      SelectProps={{ native: true }}
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </TextField>
  );
};

const TopBarInner = ({ onMenuClick }: { onMenuClick?: () => void }) => {
  const user = useAppSelector((state) => state.auth.user);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchVal = searchParams.get("q") || "";
  const [localSearch, setLocalSearch] = useState(searchVal);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza estado local quando searchParams muda externamente (ex: navegação)
  useEffect(() => {
    setLocalSearch(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const isSearchPage = ["/app/alunos", "/app/turmas"].includes(location.pathname);
      if (isSearchPage) {
        if (value) {
          searchParams.set("q", value);
        } else {
          searchParams.delete("q");
        }
        setSearchParams(searchParams, { replace: true });
      } else if (value) {
        navigate(`/app/alunos?q=${encodeURIComponent(value)}`);
      }
    }, 300);
  };

  const menuOpen = Boolean(anchorEl);


  const showSearch = ["/app", "/app/", "/app/alunos", "/app/turmas"].includes(location.pathname);

  const [uploadPhoto] = useUploadPhotoMutation();
  const [photoSnackbar, setPhotoSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleChangePassword = () => {
    handleMenuClose();
    navigate("/alterar-senha");
  };
  const handleLogout = async () => {
    handleMenuClose();
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";
      await fetch(`${base}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
    } catch {
      // Best effort: local logout should continue even if the API is unavailable.
    }
    dispatch(logout());
    // A7: use env var so staging/dev don't redirect to production
    window.location.href = import.meta.env.VITE_LOGOUT_REDIRECT_URL ?? "/";
  };

  const handleAddPhoto = () => {
    handleMenuClose();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          await uploadPhoto(formData).unwrap();
          setPhotoSnackbar({ open: true, message: "Foto enviada! A imagem será atualizada em instantes.", severity: "success" });
        } catch {
          setPhotoSnackbar({ open: true, message: "Erro ao enviar foto. Tente novamente.", severity: "error" });
        }
      }
    };
    input.click();
  };



  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        mb: 3,
        pb: 2,
        borderBottom: "1px solid",
        borderColor: "divider"
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <IconButton
          color="inherit"
          onClick={onMenuClick}
          sx={{ display: { xs: "flex", md: "none" }, ml: -1 }}
        >
          <MenuIcon />
        </IconButton>

        {showSearch && (
          <TextField
            placeholder="Buscar alunos, turmas…"
            size="small"
            sx={{ maxWidth: { xs: 200, sm: 320 }, display: { xs: "none", sm: "flex" } }}
            value={localSearch}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={2}>
        {/* Tenant Selector (Super Admin only) */}
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <TenantSelector />
        </Box>

        {/* Academic Year Selector */}
        <Box sx={{ display: "block" }}>
          <AcademicYearSelector />
        </Box>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <Box
          display="flex"
          alignItems="center"
          gap={1.5}
          sx={{
            cursor: "pointer",
            px: { xs: 0.5, sm: 1.5 },
            py: 0.75,
            borderRadius: 1,
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "action.hover"
            }
          }}
          onClick={handleMenuOpen}
          aria-controls={menuOpen ? "user-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? "true" : undefined}
        >
          <Avatar
            src={user?.photo_url || undefined}
            sx={{
              width: 32,
              height: 32,
              bgcolor: "primary.main",
              fontSize: "0.875rem",
              fontWeight: 700
            }}
          >
            {getInitials(user?.username)}
          </Avatar>
          <Box textAlign="left" sx={{ display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" fontWeight={600} fontSize="0.875rem">
              {user?.username ?? "Usuário ativo"}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
              {ROLE_LABELS[user?.role?.toLowerCase() ?? ""] ?? "Perfil padrão"}
            </Typography>
          </Box>
        </Box>

        <Menu
          id="user-menu"
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 200,
                borderRadius: 1
              }
            }
          }}
        >
          <Box px={2} py={1.5}>
            <Typography variant="body2" fontWeight={600}>
              {user?.username ?? "Usuário"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.role ?? "Perfil padrão"}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleAddPhoto}>
            <ListItemIcon>
              <AddAPhotoIcon fontSize="small" />
            </ListItemIcon>
            Acrescentar foto
          </MenuItem>
          <MenuItem onClick={handleChangePassword}>
            <ListItemIcon>
              <LockResetIcon fontSize="small" />
            </ListItemIcon>
            Alterar senha
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Sair
          </MenuItem>
        </Menu>
      </Box>

      <Snackbar
        open={photoSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setPhotoSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={photoSnackbar.severity} onClose={() => setPhotoSnackbar((s) => ({ ...s, open: false }))}>
          {photoSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export const TopBar = memo(TopBarInner);
