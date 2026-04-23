import { Avatar, Box, Divider, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import PeopleIcon from "@mui/icons-material/People";
import ClassIcon from "@mui/icons-material/Class";
import ArticleIcon from "@mui/icons-material/Article";
import InsightsIcon from "@mui/icons-material/Insights";
import TableViewIcon from "@mui/icons-material/TableView";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import NotificationsIcon from "@mui/icons-material/Notifications";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { useAppSelector } from "../../app/hooks";

const appBasePath = "/app";

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const staffNavItems = [
  { label: "Dashboard", icon: <DashboardIcon />, path: appBasePath },
  { label: "Alunos", icon: <PeopleIcon />, path: `${appBasePath}/alunos` },
  { label: "Turmas", icon: <ClassIcon />, path: `${appBasePath}/turmas` },
  { label: "Notas", icon: <TableViewIcon />, path: `${appBasePath}/notas` },
  { label: "Gráficos", icon: <InsightsIcon />, path: `${appBasePath}/graficos` },
  { label: "Relatórios", icon: <ArticleIcon />, path: `${appBasePath}/relatorios` }
];

const alunoNavItems = [{ label: "Meu Boletim", icon: <PeopleIcon />, path: `${appBasePath}/meu-boletim` }];

export const Sidebar = ({ mobile }: { mobile?: boolean }) => {
  const user = useAppSelector((state) => state.auth.user);
  const isAluno = user?.role === "aluno";
  const isAdmin = Boolean(user?.is_admin || user?.role === "admin");

  const items = useMemo(() => {
    if (isAluno) return alunoNavItems;
    const base = [...staffNavItems];

    if (user?.role === "super_admin") {
      base.push({ label: "Escolas (SaaS)", icon: <DashboardIcon />, path: `${appBasePath}/admin/escolas` });
    }

    if (user?.role === "admin" || user?.role === "super_admin") {
      base.splice(1, 0, { label: "Usuários", icon: <ManageAccountsIcon />, path: `${appBasePath}/usuarios` });
    }

    if (isAdmin) {
      base.push({ label: "Uploads", icon: <UploadFileIcon />, path: `${appBasePath}/uploads` });
      base.push({ label: "Audit Logs", icon: <ArticleIcon />, path: `${appBasePath}/audit-logs` });
    }

    if (isAdmin || user?.role === "professor" || user?.role === "orientador" || user?.role === "diretor") {
      base.push({ label: "Visão Professor", icon: <InsightsIcon />, path: `${appBasePath}/professor` });
    }

    if (isAdmin || user?.role === "coordenador") {
      base.push({ label: "Intervenções IA", icon: <AutoFixHighIcon />, path: `${appBasePath}/ia/intervencoes-em-lote` });
    }

    base.splice(1, 0, { label: "Comunicados", icon: <NotificationsIcon />, path: `${appBasePath}/comunicados` });
    base.splice(2, 0, { label: "Ocorrências", icon: <WarningAmberIcon />, path: `${appBasePath}/ocorrencias` });

    return base;
  }, [isAluno, isAdmin, user?.role]);

  return (
    <Box
      component="aside"
      sx={{
        width: 240,
        flexShrink: 0,
        height: "100%",
        borderRight: mobile ? "none" : "1px solid",
        borderColor: "divider",
        background: (theme) => theme.palette.mode === "light"
          ? "#ffffff"
          : `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
        color: (theme) => theme.palette.text.primary,
        display: mobile ? "flex" : { xs: "none", md: "flex" },
        flexDirection: "column",
        p: 2
      }}
    >

      <Box display="flex" alignItems="center" gap={1.5} mb={3} px={1}>
        <Avatar
          sx={{
            bgcolor: "primary.main",
            width: 36,
            height: 36,
            fontSize: "0.875rem",
            fontWeight: 700
          }}
        >
          {getInitials(user?.tenant_name || "FR")}
        </Avatar>
        <Box flex={1}>
          <Typography
            fontWeight={700}
            fontSize="0.9375rem"
            lineHeight={1.3}
            color="text.primary"
          >
            {user?.tenant_name || "Plataforma Colabora"}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            fontSize="0.75rem"
          >
            Gerenciamento Acadêmico
          </Typography>
        </Box>
      </Box>

      <List sx={{ flex: 1, px: 1 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              px: 1.5,
              py: 1,
              minHeight: 40,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&.active": {
                backgroundColor: "primary.main",
                color: "#ffffff",
                "& .MuiListItemIcon-root": {
                  color: "#ffffff"
                },
                "& .MuiListItemText-primary": {
                  color: "#ffffff"
                },
                "&:hover": {
                  backgroundColor: "primary.dark"
                }
              },
              "&:hover": {
                backgroundColor: (theme) => theme.palette.mode === "light"
                  ? "rgba(20, 184, 166, 0.04)"
                  : "rgba(20, 184, 166, 0.08)"
              }

            }}
          >
            <ListItemIcon
              sx={{
                color: "inherit",
                minWidth: 36,
                "& svg": {
                  fontSize: "1.25rem"
                }
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: "0.875rem",
                fontWeight: 500
              }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      <Box px={2}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontSize="0.6875rem"
        >
          v2.0.0 — 2025
        </Typography>
      </Box>
    </Box>
  );
};
