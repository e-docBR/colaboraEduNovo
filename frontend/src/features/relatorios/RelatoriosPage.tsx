import { Box, Card, CardActionArea, Typography, useTheme, Chip, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowForward } from "@mui/icons-material";
import { RELATORIOS, RelatorioDefinition } from "./config";

// Variant colors mapping based on tokens or semantic intent
const getVariantColor = (variant: string, theme: any) => {
  const colors: Record<string, string> = {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    danger: theme.palette.error.main,
    info: theme.palette.info.main,
  };
  return colors[variant] || theme.palette.primary.main;
};

export const RelatoriosPage = () => {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      {/* Header - Compact */}
      <Box mb={3}>
        <Typography
          variant="h3"
          fontWeight={800}
          sx={{
            letterSpacing: "-0.02em",
            color: "text.primary",
            mb: 0.5
          }}
        >
          Relatórios
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
          Monitore o desempenho acadêmico, identifique riscos e tome decisões baseadas em dados
        </Typography>
      </Box>

      {/* Grid Layout - Compact */}
      <Box
        display="grid"
        gap={2}
        gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        sx={{
          "& > div": {
            height: "100%",
          }
        }}
      >
        {RELATORIOS.map((relatorio) => (
          <ReportCard key={relatorio.slug} relatorio={relatorio} />
        ))}
      </Box>
    </Box>
  );
};

const ReportCard = ({ relatorio }: { relatorio: RelatorioDefinition }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const accentColor = getVariantColor(relatorio.variant, theme);

  return (
    <Card
      elevation={0}
      sx={{
        gridColumn: {
          md: relatorio.span ? `span ${relatorio.span}` : "span 1",
          xs: "span 1"
        },
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
        position: "relative",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 8px 24px -8px ${accentColor}20`,
          borderColor: accentColor,
          "& .icon-box": {
            backgroundColor: accentColor,
            color: "white",
            transform: "scale(1.05)"
          },
          "& .arrow-icon": {
            opacity: 1,
            transform: "translateX(0)"
          }
        }
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/app/relatorios/${relatorio.slug}`)}
        sx={{ height: "100%", p: 2.5, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <Box width="100%">
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box
              className="icon-box"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                backgroundColor: `${accentColor}10`,
                color: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              <relatorio.icon fontSize="medium" />
            </Box>

            <Chip
              label={relatorio.type?.toUpperCase()}
              size="small"
              sx={{
                height: 20,
                fontWeight: 600,
                fontSize: "0.625rem",
                backgroundColor: "transparent",
                border: `1px solid ${theme.palette.divider}`,
                color: "text.secondary"
              }}
            />
          </Box>

          <Typography variant="h6" fontWeight={700} fontSize="1.125rem" gutterBottom sx={{ letterSpacing: "-0.01em" }}>
            {relatorio.title}
          </Typography>

          <Typography variant="body2" fontSize="0.875rem" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2 }}>
            {relatorio.description}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1, color: accentColor, fontWeight: 600 }}>
          <Typography variant="button" fontSize="0.75rem" color="inherit">
            Visualizar
          </Typography>
          <ArrowForward
            className="arrow-icon"
            sx={{
              fontSize: 16,
              opacity: 0.6,
              transform: "translateX(-4px)",
              transition: "all 0.2s ease"
            }}
          />
        </Stack>
      </CardActionArea>
    </Card>
  );
};
