import { Alert, Box, Button, Drawer } from "@mui/material";
import { useState } from "react";

import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/navigation/Sidebar";
import { TopBar } from "../components/navigation/TopBar";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useGetMeQuery, useGetBillingStatusQuery, useCreateBillingCheckoutMutation } from "../lib/api";
import { updateUser } from "../features/auth/authSlice";

import { ChatWidget } from "../features/ai-chat/ChatWidget";

const BillingBanner = () => {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.is_admin || user?.role === "admin" || user?.role === "super_admin";
  const { data: billing } = useGetBillingStatusQuery(undefined, { skip: !isAdmin });
  const [createCheckout, { isLoading }] = useCreateBillingCheckoutMutation();

  if (!billing || billing.plano_ativo) return null;

  const handleClick = async () => {
    try {
      const result = await createCheckout().unwrap();
      window.location.href = result.url;
    } catch {
      // ignore
    }
  };

  return (
    <Alert
      severity="error"
      sx={{ borderRadius: 0, mb: 2 }}
      action={
        <Button color="error" size="small" onClick={handleClick} disabled={isLoading}>
          {isLoading ? "Aguarde..." : "Regularizar agora"}
        </Button>
      }
    >
      Plano inativo — o acesso a algumas funcionalidades pode estar bloqueado.
    </Alert>
  );
};

export const DashboardLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();

  const { data: userData } = useGetMeQuery(undefined, { skip: !user });
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (userData && JSON.stringify(userData) !== JSON.stringify(user)) {
      dispatch(updateUser(userData));
    }
  }, [userData, user, dispatch]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  if (user?.must_change_password) {
    return <Navigate to="/alterar-senha" state={{ from: location }} replace />;
  }
  // Redirect alunos to boletim; responsáveis to portal
  if (user?.role === "aluno" && location.pathname !== "/app/meu-boletim") {
    return <Navigate to="/app/meu-boletim" replace />;
  }
  if (user?.role === "responsavel" && location.pathname !== "/app/portal-responsavel") {
    return <Navigate to="/app/portal-responsavel" replace />;
  }

  return (
    <Box display="flex" minHeight="100vh" bgcolor="background.default">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: 240 }
        }}
      >
        <Sidebar mobile />
      </Drawer>

      <Box component="main" flex={1} p={{ xs: 2, md: 4 }} sx={{ height: "100vh", overflowY: "auto", overflowX: "hidden" }}>
        <TopBar onMenuClick={handleDrawerToggle} />
        <BillingBanner />
        <Outlet />
      </Box>
      {user?.role !== "aluno" && user?.role !== "responsavel" && <ChatWidget />}
    </Box>
  );
};

