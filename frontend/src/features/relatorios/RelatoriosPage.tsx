import { Box, Card, CardActionArea, Typography, useTheme, Chip, Stack, TextField, InputAdornment, Tab, Tabs } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowForward, Search } from "@mui/icons-material";
import { useState, useMemo } from "react";
import { RELATORIOS, RelatorioDefinition } from "./config";

// Variant colors mapping based on school-branded premium palette
const getVariantColor = (variant: string, theme: any) => {
  const colors: Record<string, string> = {
    primary: "#0A2540",   // Azul Imperial / Profundo
    secondary: "#64748B", // Slate
    success: "#10B981",   // Verde Esmeralda / Sucesso
    warning: "#F59E0B",   // Bronze Quente / Atenção
    danger: "#EF4444",    // Coral / Perigo
    info: "#06B6D4",      // Ciano
  };
  return colors[variant] || theme.palette.primary.main;
};

const CATEGORIES_LABELS: Record<string, string> = {
  all: "Todos",
  alertas: "Alertas & Riscos",
  desempenho: "Desempenho",
  estatisticas: "Estatísticas & Gráficos",
};

export const RelatoriosPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");

  const filteredRelatorios = useMemo(() => {
    return RELATORIOS.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedTab === "all" || item.category === selectedTab;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedTab]);

  return (
    <Box sx={{ minHeight: "100vh", pb: 5 }}>
      {/* Header - Styled with a premium subtitle and alignment */}
      <Box mb={4} display="flex" flexDirection={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={2}>
        <Box>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{
              letterSpacing: "-0.03em",
              color: "#0A2540",
              mb: 0.5
            }}
          >
            Central de Relatórios
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
            Monitore o progresso escolar do Colégio Frei Ronaldo. Use dados e insights preditivos para apoiar decisões pedagógicas.
          </Typography>
        </Box>

        {/* Search Bar */}
        <TextField
          size="small"
          placeholder="Buscar relatório..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            minWidth: { xs: "100%", md: 300 },
            backgroundColor: "background.paper",
            borderRadius: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              "& fieldset": { borderColor: "rgba(0,0,0,0.08)" },
              "&:hover fieldset": { borderColor: "rgba(0,0,0,0.15)" },
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: "text.secondary", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Tabs Filter */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={selectedTab}
          onChange={(_, val) => setSelectedTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": {
              fontWeight: 700,
              textTransform: "none",
              fontSize: "0.9rem",
              color: "text.secondary",
              minHeight: 48,
            },
            "& .Mui-selected": {
              color: "#0A2540 !important",
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "#0A2540",
              height: 3,
              borderRadius: "3px 3px 0 0",
            }
          }}
        >
          <Tab label="Todos" value="all" />
          <Tab label="Alertas & Riscos" value="alertas" />
          <Tab label="Desempenho" value="desempenho" />
          <Tab label="Estatísticas & Gráficos" value="estatisticas" />
        </Tabs>
      </Box>

      {/* Grid Layout */}
      {filteredRelatorios.length === 0 ? (
        <Box textAlign="center" py={8} sx={{ backgroundColor: "rgba(0,0,0,0.01)", borderRadius: 3, border: "2px dashed rgba(0,0,0,0.06)" }}>
          <Typography color="text.secondary" fontWeight={600}>
            Nenhum relatório encontrado para os critérios selecionados.
          </Typography>
        </Box>
      ) : (
        <Box
          display="grid"
          gap={3}
          gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
          sx={{
            "& > div": {
              height: "100%",
            }
          }}
        >
          {filteredRelatorios.map((relatorio) => (
            <ReportCard key={relatorio.slug} relatorio={relatorio} />
          ))}
        </Box>
      )}
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
        border: "1px solid rgba(0, 0, 0, 0.06)",
        borderRadius: 3,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(135deg, #ffffff 0%, #fcfdfe 100%)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 12px 28px -8px ${accentColor}18`,
          borderColor: accentColor,
          "& .icon-box": {
            backgroundColor: accentColor,
            color: "white",
            transform: "scale(1.05) rotate(2deg)"
          },
          "& .arrow-icon": {
            opacity: 1,
            transform: "translateX(2px)"
          }
        }
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/app/relatorios/${relatorio.slug}`)}
        sx={{
          height: "100%",
          p: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          alignContent: "stretch"
        }}
      >
        <Box width="100%">
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
            <Box
              className="icon-box"
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                backgroundColor: `${accentColor}08`,
                color: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: `1px solid ${accentColor}15`
              }}
            >
              <relatorio.icon sx={{ fontSize: 22 }} />
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={CATEGORIES_LABELS[relatorio.category]}
                size="small"
                sx={{
                  height: 20,
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  backgroundColor: "rgba(0,0,0,0.03)",
                  color: "text.secondary",
                  border: "none"
                }}
              />
              <Chip
                label={relatorio.type?.toUpperCase()}
                size="small"
                sx={{
                  height: 20,
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  backgroundColor: `${accentColor}08`,
                  color: accentColor,
                  border: `1px solid ${accentColor}20`
                }}
              />
            </Stack>
          </Box>

          <Typography
            variant="h6"
            fontWeight={800}
            fontSize="1.15rem"
            gutterBottom
            sx={{
              letterSpacing: "-0.01em",
              color: "#0A2540",
              lineHeight: 1.3
            }}
          >
            {relatorio.title}
          </Typography>

          <Typography
            variant="body2"
            fontSize="0.85rem"
            color="text.secondary"
            sx={{
              lineHeight: 1.6,
              mb: 2.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              height: 40
            }}
          >
            {relatorio.description}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: "auto", color: accentColor, fontWeight: 700 }}>
          <Typography variant="button" fontSize="0.75rem" color="inherit" sx={{ letterSpacing: "0.05em" }}>
            Visualizar dados
          </Typography>
          <ArrowForward
            className="arrow-icon"
            sx={{
              fontSize: 16,
              opacity: 0.8,
              transform: "translateX(-2px)",
              transition: "all 0.3s ease"
            }}
          />
        </Stack>
      </CardActionArea>
    </Card>
  );
};
