/**
 * NotificationBell — reusable notification icon with badge count and dropdown preview.
 * Extracted from TopBar for standalone use in other layouts.
 *
 * Features:
 *  - Numeric badge (count of unread/active)
 *  - Dropdown with last 5 communications
 *  - Marks items as read on click (for students)
 *  - "Ver todas" link to /app/comunicados
 */
import NotificationsIcon from "@mui/icons-material/Notifications";
import CampaignIcon from "@mui/icons-material/Campaign";
import {
  Badge,
  Box,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
} from "@mui/material";
import { MouseEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";
import { useListComunicadosQuery, useMarkComunicadoReadMutation } from "../../lib/api";

export const NotificationBell = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const { data: comunicadosData } = useListComunicadosQuery();
  const comunicados = comunicadosData?.items;
  const [markRead] = useMarkComunicadoReadMutation();

  const isStudent = user?.role === "aluno";

  // Unread/active count — students see unread count, staff sees non-archived count
  const unreadCount = useMemo(() => {
    if (!comunicados) return 0;
    if (isStudent) return comunicados.filter((c) => !c.is_read && !c.arquivado).length;
    return comunicados.filter((c) => !c.arquivado).length;
  }, [comunicados, isStudent]);

  // Preview: last 5 active comunicados
  const preview = useMemo(() => {
    if (!comunicados) return [];
    return comunicados
      .filter((c) => !c.arquivado)
      .sort((a, b) => new Date(b.data_envio).getTime() - new Date(a.data_envio).getTime())
      .slice(0, 5);
  }, [comunicados]);

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleItemClick = async (id: number, isRead?: boolean) => {
    handleClose();
    if (isStudent && !isRead) {
      try { await markRead(id).unwrap(); } catch { /* silent */ }
    }
    navigate("/app/comunicados");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount} notificações` : "Notificações"}>
        <IconButton
          size="small"
          color="inherit"
          onClick={handleOpen}
          sx={{
            transition: "all 0.2s",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Badge
            badgeContent={unreadCount > 0 ? unreadCount : undefined}
            color="error"
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.65rem",
                fontWeight: 700,
                minWidth: 18,
                height: 18,
                animation: unreadCount > 0 ? "pulse 2s infinite" : "none",
                "@keyframes pulse": {
                  "0%": { transform: "scale(1)" },
                  "50%": { transform: "scale(1.15)" },
                  "100%": { transform: "scale(1)" },
                },
              },
            }}
          >
            <NotificationsIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              mt: 1,
              width: 340,
              maxHeight: 440,
              borderRadius: 3,
              overflow: "hidden",
            },
          },
        }}
      >
        {/* Header */}
        <Box
          px={2}
          py={1.5}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          sx={{ bgcolor: "background.default" }}
        >
          <Typography variant="subtitle2" fontWeight={800}>
            Comunicados
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} ${isStudent ? "não lido(s)" : "ativo(s)"}`}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
            />
          )}
        </Box>
        <Divider />

        {/* List */}
        <Box sx={{ maxHeight: 330, overflowY: "auto" }}>
          {preview.length > 0 ? (
            preview.map((c) => (
              <MenuItem
                key={c.id}
                onClick={() => handleItemClick(c.id, c.is_read)}
                sx={{
                  whiteSpace: "normal",
                  py: 1.5,
                  px: 2,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor:
                    isStudent && !c.is_read
                      ? "primary.light"
                      : "transparent",
                  "&:hover": { bgcolor: "action.hover" },
                  gap: 1.5,
                  alignItems: "flex-start",
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    bgcolor: isStudent && !c.is_read ? "primary.main" : "action.selected",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    mt: 0.3,
                  }}
                >
                  <CampaignIcon
                    fontSize="small"
                    sx={{ color: isStudent && !c.is_read ? "white" : "text.secondary" }}
                  />
                </Box>

                {/* Content */}
                <Box flex={1} minWidth={0}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography
                      variant="body2"
                      fontWeight={isStudent && !c.is_read ? 700 : 600}
                      noWrap
                      sx={{ maxWidth: 200 }}
                    >
                      {c.titulo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                      {formatDate(c.data_envio)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      lineHeight: 1.4,
                      mt: 0.3,
                    }}
                  >
                    {c.conteudo}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          ) : (
            <Box p={4} textAlign="center">
              <NotificationsIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Nenhum comunicado ativo
              </Typography>
            </Box>
          )}
        </Box>

        <Divider />
        <MenuItem
          onClick={() => { handleClose(); navigate("/app/comunicados"); }}
          sx={{ justifyContent: "center", py: 1.2 }}
        >
          <Typography variant="caption" color="primary.main" fontWeight={700}>
            Ver todos os comunicados →
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};
