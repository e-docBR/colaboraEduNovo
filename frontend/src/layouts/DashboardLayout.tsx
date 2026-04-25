import { Box, Drawer } from "@mui/material";
import { useState } from "react";

import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/navigation/Sidebar";
import { TopBar } from "../components/navigation/TopBar";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useGetMeQuery } from "../lib/api";
import { updateUser } from "../features/auth/authSlice";

import { ChatWidget } from "../features/ai-chat/ChatWidget";

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
  if ((user?.role === "aluno" || user?.role === "responsavel") && location.pathname !== "/app/meu-boletim") {
    return <Navigate to="/app/meu-boletim" replace />;
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
        <Outlet />
      </Box>
      {user?.role !== "aluno" && user?.role !== "responsavel" && <ChatWidget />}
    </Box>
  );
};

