import { IconButton, Tooltip } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useColorMode } from "../../theme";

export const ThemeToggle = () => {
    const { mode, toggleTheme } = useColorMode();

    return (
        <Tooltip title={mode === "light" ? "Ativar modo escuro" : "Ativar modo claro"}>
            <IconButton
                onClick={toggleTheme}
                size="small"
                sx={{
                    transition: "all 0.2s",
                    "&:hover": {
                        bgcolor: "action.hover"
                    }
                }}
            >
                {mode === "light" ? (
                    <DarkModeIcon fontSize="small" />
                ) : (
                    <LightModeIcon fontSize="small" />
                )}
            </IconButton>
        </Tooltip>
    );
};

