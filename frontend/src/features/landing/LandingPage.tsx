import { alpha } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InsightsIcon from "@mui/icons-material/Insights";
import SecurityIcon from "@mui/icons-material/Security";
import TimelineIcon from "@mui/icons-material/Timeline";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VerifiedIcon from "@mui/icons-material/Verified";
import SchoolIcon from "@mui/icons-material/School";
import FamilyRestroomIcon from "@mui/icons-material/FamilyRestroom";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PsychologyIcon from "@mui/icons-material/Psychology";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssessmentIcon from "@mui/icons-material/Assessment";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import type { ReactElement } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useAppSelector } from "../../app/hooks";

const bp = {
  teal: "#14b8a6",
  emerald: "#10b981",
  amber: "#f59e0b"
};

const statsAccents = [bp.teal, bp.emerald, bp.amber, bp.teal];

const stats = [
  { label: "Alunos monitorados", value: "3.240", detail: "Atualização automática por PDF", icon: <AutorenewIcon fontSize="small" /> },
  { label: "Alertas inteligentes", value: "+480", detail: "Riscos identificados por turno", icon: <NotificationsActiveIcon fontSize="small" /> },
  { label: "Tempo salvo", value: "72h/sem", detail: "Processos manuais eliminados", icon: <AccessTimeIcon fontSize="small" /> },
  { label: "Relatórios gerados", value: "+1.800", detail: "Exportações em CSV / PDF", icon: <AssessmentIcon fontSize="small" /> }
];

const workflows = [
  {
    title: "Importação guiada",
    description: "Arraste os boletins em PDF e deixe o motor de ingestão normalizar turmas, turnos e trimestres automaticamente.",
    icon: <TimelineIcon />,
    color: bp.teal
  },
  {
    title: "Diagnósticos instantâneos",
    description: "KPIs e gráficos cruzam notas, faltas e situação final para evidenciar alunos em risco em segundos.",
    icon: <InsightsIcon />,
    color: bp.emerald
  },
  {
    title: "Plano de ação colaborativo",
    description: "Coordenação, orientação e direção acessam o mesmo painel e registram decisões diretamente nos relatórios.",
    icon: <GroupsIcon />,
    color: bp.amber
  }
];

const audiences = [
  {
    role: "Administração",
    summary: "Configura usuários, perfis e acompanha ingestões em tempo real.",
    focus: ["Controle total de permissões", "Histórico de importações", "Exportação completa"],
    icon: <AdminPanelSettingsIcon />,
    color: bp.teal
  },
  {
    role: "Coordenação",
    summary: "Prioriza turmas críticas, compara trimestres e agenda intervenções.",
    focus: ["Mapa de calor de notas", "Alertas por disciplina", "Lista de alunos em risco"],
    icon: <SchoolIcon />,
    color: bp.emerald
  },
  {
    role: "Professores e Orientação",
    summary: "Recebem insights prontos para orientar alunos e responsáveis.",
    focus: ["Métricas por turma", "Evolução individual", "Notas e faltas consolidadas"],
    icon: <PsychologyIcon />,
    color: bp.amber
  }
];

const testimonials = [
  {
    name: "Silvana Castro",
    role: "Coordenadora Pedagógica",
    quote: "Antes levávamos dias para consolidar notas. Agora, em 10 minutos sabemos quais turmas precisam de reforço e acionamos a equipe com dados.",
    accent: bp.teal
  },
  {
    name: "Rafael Lima",
    role: "Diretor Acadêmico",
    quote: "O painel trouxe transparência para toda a liderança. As reuniões agora começam com KPIs e terminam com planos práticos.",
    accent: bp.emerald
  }
];

const proofPoints = [
  { label: "Autenticação segura", icon: <SecurityIcon />, color: bp.teal },
  { label: "Controle por perfis", icon: <VerifiedIcon />, color: bp.emerald },
  { label: "Integração com ingestão PDF", icon: <TrendingUpIcon />, color: bp.amber }
];

const fadeInUp = {
  "@keyframes fadeInUp": {
    from: { opacity: 0, transform: "translateY(28px)" },
    to: { opacity: 1, transform: "translateY(0)" }
  }
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector((state) => Boolean(state.auth.accessToken));
  const primaryCtaLabel = isAuthenticated ? "Ir para o painel" : "Entrar como administrador";
  const primaryCtaTarget = isAuthenticated ? "/app" : "/login";
  const studentCtaTarget = "/login?perfil=aluno";

  const chips = useMemo(() => ["Secretaria", "Coordenação", "Orientação", "Direção"], []);

  const handlePrimaryCta = () => navigate(primaryCtaTarget);
  const handleStudentCta = () => navigate(studentCtaTarget);

  return (
    <Box sx={{ bgcolor: "background.default" }}>

      {/* ─── HEADER ──────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          position: "sticky",
          top: 0,
          bgcolor: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          zIndex: 10,
          boxShadow: "0 1px 12px rgba(0,0,0,0.07)"
        }}
      >
        <Container sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box component="img" src="/colaboraedu4.png" alt="Colabora EDU" sx={{ height: 36 }} />
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                display: { xs: "none", md: "block" },
                background: `linear-gradient(90deg, ${bp.teal}, ${bp.emerald})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}
            >
              Inteligência acadêmica para decisões rápidas
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              onClick={handlePrimaryCta}
              sx={{
                borderRadius: 999,
                px: 3,
                background: `linear-gradient(90deg, ${bp.teal}, ${bp.emerald})`,
                boxShadow: `0 4px 16px ${alpha(bp.teal, 0.35)}`,
                "&:hover": { boxShadow: `0 6px 24px ${alpha(bp.teal, 0.5)}`, transform: "translateY(-1px)" },
                transition: "all 0.2s"
              }}
            >
              {primaryCtaLabel}
            </Button>
            <Button
              variant="outlined"
              onClick={handleStudentCta}
              sx={{ borderRadius: 999, px: 2.5, borderColor: bp.teal, color: bp.teal, "&:hover": { borderColor: bp.emerald, color: bp.emerald } }}
            >
              Acesso aluno/responsável
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          position: "relative",
          overflow: "hidden",
          py: { xs: 10, md: 14 },
          background: `
            radial-gradient(circle at 8% 20%, ${alpha(bp.teal, 0.18)}, transparent 40%),
            radial-gradient(circle at 92% 12%, ${alpha(bp.emerald, 0.14)}, transparent 45%),
            radial-gradient(circle at 50% 80%, ${alpha(bp.amber, 0.08)}, transparent 50%),
            linear-gradient(140deg, #040b1c 0%, #071838 60%, #051a12 100%)
          `
        }}
      >
        <Container>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              {/* Badge */}
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  px: 2,
                  py: 0.75,
                  mb: 3,
                  borderRadius: 999,
                  border: `1px solid ${alpha(bp.teal, 0.5)}`,
                  bgcolor: alpha(bp.teal, 0.08),
                  ...fadeInUp,
                  animation: "fadeInUp 0.5s ease both"
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: bp.teal, mr: 1, boxShadow: `0 0 8px ${bp.teal}` }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: bp.teal, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Plataforma colaboraEDU
                </Typography>
              </Box>

              {/* Title */}
              <Typography
                variant="h1"
                color="white"
                fontWeight={800}
                lineHeight={1.1}
                gutterBottom
                sx={{
                  fontSize: { xs: "2.25rem", md: "3rem" },
                  letterSpacing: "-0.02em",
                  ...fadeInUp,
                  animation: "fadeInUp 0.5s ease 0.1s both"
                }}
              >
                Inteligência em boletins para{" "}
                <Box
                  component="span"
                  sx={{
                    background: `linear-gradient(90deg, ${bp.teal}, ${bp.emerald})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                  }}
                >
                  lideranças educacionais.
                </Box>
              </Typography>

              {/* Subtitle */}
              <Typography
                variant="h6"
                color={alpha("#ffffff", 0.75)}
                fontWeight={400}
                maxWidth={520}
                mb={5}
                lineHeight={1.7}
                sx={{ ...fadeInUp, animation: "fadeInUp 0.5s ease 0.2s both" }}
              >
                Reúna ingestão automatizada, dashboards executivos e trilhas de ação em um único cockpit, pronto para decisões de secretaria, coordenação e direção.
              </Typography>

              {/* CTA Buttons */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                mb={5}
                sx={{ ...fadeInUp, animation: "fadeInUp 0.5s ease 0.3s both" }}
              >
                <Button
                  size="large"
                  variant="contained"
                  onClick={handlePrimaryCta}
                  sx={{
                    borderRadius: 999,
                    px: 4,
                    py: 1.5,
                    background: `linear-gradient(90deg, ${bp.teal}, ${bp.emerald})`,
                    boxShadow: `0 4px 24px ${alpha(bp.teal, 0.45)}`,
                    fontWeight: 700,
                    "&:hover": { transform: "translateY(-2px)", boxShadow: `0 8px 32px ${alpha(bp.teal, 0.6)}` },
                    transition: "all 0.2s"
                  }}
                >
                  {primaryCtaLabel}
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" })}
                  sx={{
                    borderRadius: 999, px: 4, py: 1.5,
                    color: "white", borderColor: alpha("#ffffff", 0.35),
                    "&:hover": { borderColor: alpha("#ffffff", 0.7), bgcolor: alpha("#ffffff", 0.06) }
                  }}
                >
                  Ver como funciona
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={handleStudentCta}
                  sx={{
                    borderRadius: 999, px: 4, py: 1.5,
                    color: alpha("#ffffff", 0.85),
                    borderColor: alpha(bp.emerald, 0.5),
                    bgcolor: alpha(bp.emerald, 0.06),
                    "&:hover": { borderColor: bp.emerald, bgcolor: alpha(bp.emerald, 0.12) }
                  }}
                >
                  Portal aluno/responsável
                </Button>
              </Stack>

              {/* Audience chips */}
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                gap={1}
                sx={{ ...fadeInUp, animation: "fadeInUp 0.5s ease 0.4s both" }}
              >
                {chips.map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    icon={<CheckCircleIcon style={{ color: bp.teal }} />}
                    sx={{ bgcolor: alpha("#ffffff", 0.08), color: "white", border: `1px solid ${alpha("#ffffff", 0.15)}`, fontWeight: 500 }}
                  />
                ))}
              </Stack>
            </Grid>

            {/* Hero card */}
            <Grid item xs={12} md={5} sx={{ ...fadeInUp, animation: "fadeInUp 0.5s ease 0.25s both" }}>
              <Card
                sx={{
                  p: 3,
                  background: alpha("#ffffff", 0.05),
                  backdropFilter: "blur(16px)",
                  borderRadius: 4,
                  border: `1px solid ${alpha("#ffffff", 0.15)}`,
                  boxShadow: `0 24px 64px ${alpha("#000000", 0.4)}`
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar src="/colaboraedu3.png" alt="Marca Colabora" sx={{ width: 56, height: 56 }} />
                    <Box>
                      <Typography color="white" fontWeight={700} fontSize="1rem">
                        Painel Consolidado 360º
                      </Typography>
                      <Typography color={alpha("#ffffff", 0.6)} variant="body2">
                        Matutino · Vespertino · Noturno
                      </Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ borderColor: alpha("#ffffff", 0.12) }} />
                  <Stack spacing={1.5}>
                    {proofPoints.map((item) => (
                      <Stack
                        key={item.label}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: alpha("#ffffff", 0.04),
                          border: `1px solid ${alpha(item.color, 0.2)}`
                        }}
                      >
                        <Avatar sx={{ bgcolor: alpha(item.color, 0.15), color: item.color, width: 36, height: 36 }}>
                          {item.icon as ReactElement}
                        </Avatar>
                        <Typography color="white" fontWeight={500} fontSize="0.9rem">{item.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── STATS ───────────────────────────────────────────────── */}
      <Container sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={3}>
          {stats.map((stat, i) => (
            <Grid item xs={12} sm={6} md={3} key={stat.label}>
              <Card
                sx={{
                  borderRadius: 3,
                  borderTop: `4px solid ${statsAccents[i]}`,
                  border: `1px solid`,
                  borderColor: "divider",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  transition: "transform 0.2s, boxShadow 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" },
                  ...fadeInUp,
                  animation: `fadeInUp 0.5s ease ${0.05 * i}s both`
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography
                    fontWeight={800}
                    sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, color: statsAccents[i], lineHeight: 1.1 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "text.secondary", display: "block", mt: 0.5 }}
                  >
                    {stat.label}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" mt={1.5}>
                    <Box sx={{ color: statsAccents[i], display: "flex", opacity: 0.7 }}>{stat.icon as ReactElement}</Box>
                    <Typography variant="body2" color="text.secondary">{stat.detail}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── WORKFLOW ─────────────────────────────────────────────── */}
      <Box
        component="section"
        id="workflow"
        sx={{ py: { xs: 6, md: 10 }, bgcolor: alpha(bp.teal, 0.03), borderTop: "1px solid", borderColor: "divider" }}
      >
        <Container>
          <Stack spacing={1} mb={6} alignItems="center" textAlign="center">
            <Typography
              variant="overline"
              fontWeight={700}
              sx={{ color: bp.teal, letterSpacing: "0.12em" }}
            >
              Fluxo integrado
            </Typography>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.01em">
              Do PDF bruto à decisão estratégica.
            </Typography>
            <Typography variant="body1" color="text.secondary" maxWidth={600}>
              Automatize ingestões, visualize tendências por turno e direcione ações específicas para cada ciclo acadêmico.
            </Typography>
          </Stack>

          <Grid container spacing={3} alignItems="stretch">
            {workflows.map((step, index) => (
              <Grid item xs={12} md={4} key={step.title}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 3,
                    borderTop: `4px solid ${step.color}`,
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "transform 0.2s, boxShadow 0.2s",
                    "&:hover": { transform: "translateY(-6px)", boxShadow: 4 }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Step number */}
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${step.color}, ${alpha(step.color, 0.6)})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 2,
                        boxShadow: `0 4px 12px ${alpha(step.color, 0.35)}`
                      }}
                    >
                      <Typography fontWeight={800} fontSize="1.1rem" color="white">{index + 1}</Typography>
                    </Box>
                    <Avatar
                      sx={{ bgcolor: alpha(step.color, 0.1), color: step.color, mb: 2, width: 44, height: 44 }}
                    >
                      {step.icon as ReactElement}
                    </Avatar>
                    <Typography variant="h6" fontWeight={700} gutterBottom letterSpacing="-0.01em">
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {step.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── AUDIENCES ───────────────────────────────────────────── */}
      <Container sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={1} mb={6} alignItems="center" textAlign="center">
          <Typography variant="overline" fontWeight={700} sx={{ color: bp.emerald, letterSpacing: "0.12em" }}>
            Para cada perfil
          </Typography>
          <Typography variant="h4" fontWeight={800} letterSpacing="-0.01em">
            A ferramenta certa para cada líder.
          </Typography>
        </Stack>
        <Grid container spacing={3}>
          {audiences.map((audience) => (
            <Grid item xs={12} md={4} key={audience.role}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "transform 0.2s, boxShadow 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 3 }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Avatar
                    sx={{ bgcolor: alpha(audience.color, 0.1), color: audience.color, width: 52, height: 52, mb: 2 }}
                  >
                    {audience.icon as ReactElement}
                  </Avatar>
                  <Box
                    sx={{
                      display: "inline-block",
                      px: 1.5,
                      py: 0.4,
                      mb: 1.5,
                      borderRadius: 999,
                      bgcolor: alpha(audience.color, 0.1),
                      color: audience.color,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    {audience.role}
                  </Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom letterSpacing="-0.01em">
                    {audience.summary}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {audience.focus.map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                        <CheckCircleIcon sx={{ color: audience.color, fontSize: 18 }} />
                        <Typography variant="body2" color="text.secondary">{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ─── TESTIMONIALS ─────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          py: { xs: 8, md: 12 },
          background: "linear-gradient(140deg, #0f172a 0%, #1e293b 100%)",
          borderTop: "1px solid",
          borderColor: alpha("#ffffff", 0.06)
        }}
      >
        <Container>
          <Stack spacing={1} mb={6} alignItems="center" textAlign="center">
            <Typography variant="overline" fontWeight={700} sx={{ color: bp.teal, letterSpacing: "0.12em" }}>
              Quem usa aprova
            </Typography>
            <Typography variant="h4" fontWeight={800} color="white" letterSpacing="-0.01em">
              Resultados reais em escolas reais.
            </Typography>
          </Stack>
          <Grid container spacing={3}>
            {testimonials.map((t) => (
              <Grid item xs={12} md={6} key={t.name}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 3,
                    bgcolor: alpha("#ffffff", 0.04),
                    border: "1px solid",
                    borderColor: alpha("#ffffff", 0.08),
                    borderLeft: `4px solid ${t.accent}`,
                    backdropFilter: "blur(8px)",
                    transition: "transform 0.2s",
                    "&:hover": { transform: "translateY(-4px)" }
                  }}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    <Typography
                      sx={{
                        fontSize: "5rem",
                        lineHeight: 0.7,
                        color: t.accent,
                        opacity: 0.35,
                        fontFamily: "Georgia, serif",
                        mb: 1,
                        display: "block"
                      }}
                    >
                      "
                    </Typography>
                    <Typography
                      variant="body1"
                      color={alpha("#ffffff", 0.85)}
                      lineHeight={1.75}
                      fontStyle="italic"
                      mb={3}
                    >
                      {t.quote}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        sx={{
                          background: `linear-gradient(135deg, ${t.accent}, ${alpha(t.accent, 0.6)})`,
                          color: "white",
                          fontWeight: 800,
                          width: 44,
                          height: 44
                        }}
                      >
                        {t.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography color="white" fontWeight={700} fontSize="0.95rem">{t.name}</Typography>
                        <Typography variant="body2" sx={{ color: alpha(t.accent, 0.85) }}>{t.role}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── CTA FINAL ───────────────────────────────────────────── */}
      <Box
        component="section"
        sx={{
          py: { xs: 8, md: 12 },
          background: "linear-gradient(140deg, #0a1628 0%, #0f2040 50%, #071a12 100%)"
        }}
      >
        <Container>
          <Stack spacing={1} mb={6} alignItems="center" textAlign="center">
            <Typography variant="overline" fontWeight={700} sx={{ color: alpha("#ffffff", 0.5), letterSpacing: "0.12em" }}>
              Acessos rápidos
            </Typography>
            <Typography variant="h4" fontWeight={800} color="white" letterSpacing="-0.01em">
              Escolha seu portal de entrada.
            </Typography>
          </Stack>
          <Grid container spacing={3} justifyContent="center">
            {/* Admin portal */}
            <Grid item xs={12} md={5}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  bgcolor: alpha("#ffffff", 0.04),
                  border: "1px solid",
                  borderColor: alpha("#ffffff", 0.1),
                  borderTop: `4px solid ${bp.teal}`,
                  transition: "transform 0.2s, boxShadow 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: `0 16px 48px ${alpha(bp.teal, 0.2)}` }
                }}
              >
                <CardContent sx={{ p: 3.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
                    <Avatar sx={{ bgcolor: alpha(bp.teal, 0.15), color: bp.teal, width: 52, height: 52 }}>
                      <SecurityIcon />
                    </Avatar>
                    <Box>
                      <Typography color="white" fontWeight={700} fontSize="1rem">Portal Administrativo</Typography>
                      <Typography variant="caption" color={alpha("#ffffff", 0.55)}>Gestores, secretaria e coordenação</Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.2} mb={3}>
                    {["Importações e usuários", "KPIs por turno e série", "Relatórios consolidados"].map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                        <CheckCircleIcon sx={{ color: bp.teal, fontSize: 18 }} />
                        <Typography variant="body2" color={alpha("#ffffff", 0.8)}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handlePrimaryCta}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      background: `linear-gradient(90deg, ${bp.teal}, ${bp.emerald})`,
                      boxShadow: `0 4px 16px ${alpha(bp.teal, 0.4)}`,
                      fontWeight: 700,
                      "&:hover": { boxShadow: `0 8px 24px ${alpha(bp.teal, 0.6)}` }
                    }}
                  >
                    {primaryCtaLabel}
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Student portal */}
            <Grid item xs={12} md={5}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  bgcolor: alpha("#ffffff", 0.04),
                  border: "1px solid",
                  borderColor: alpha("#ffffff", 0.1),
                  borderTop: `4px solid ${bp.emerald}`,
                  transition: "transform 0.2s, boxShadow 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: `0 16px 48px ${alpha(bp.emerald, 0.2)}` }
                }}
              >
                <CardContent sx={{ p: 3.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
                    <Avatar sx={{ bgcolor: alpha(bp.emerald, 0.15), color: bp.emerald, width: 52, height: 52 }}>
                      <SchoolIcon />
                    </Avatar>
                    <Box>
                      <Typography color="white" fontWeight={700} fontSize="1rem">Portal Aluno/Responsável</Typography>
                      <Typography variant="caption" color={alpha("#ffffff", 0.55)}>Acompanhe notas, faltas e mensagens</Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.2} mb={3}>
                    {["Visualização de boletins", "Linha do tempo de notificações", "Orientações personalizadas"].map((item) => (
                      <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                        <FamilyRestroomIcon sx={{ color: bp.emerald, fontSize: 18 }} />
                        <Typography variant="body2" color={alpha("#ffffff", 0.8)}>{item}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    variant="outlined"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleStudentCta}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      borderColor: bp.emerald,
                      color: bp.emerald,
                      fontWeight: 700,
                      "&:hover": { bgcolor: alpha(bp.emerald, 0.1), borderColor: bp.emerald }
                    }}
                  >
                    Acessar como aluno/responsável
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <Box
        component="footer"
        sx={{ py: 6, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}
      >
        <Container>
          <Grid container spacing={4} justifyContent="space-between">
            {/* Brand */}
            <Grid item xs={12} md={4}>
              <Stack spacing={1.5}>
                <Box component="img" src="/colaboraedu3.png" alt="Colabora EDU" sx={{ height: 40, width: "fit-content" }} />
                <Typography variant="body2" color="text.secondary" maxWidth={260} lineHeight={1.7}>
                  Plataforma de inteligência acadêmica para secretarias, coordenações e direções escolares.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  © {new Date().getFullYear()} ColaboraEDU — Todos os direitos reservados.
                </Typography>
              </Stack>
            </Grid>

            {/* Links */}
            <Grid item xs={6} md={3}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", display: "block", mb: 2 }}>
                Plataforma
              </Typography>
              <Stack spacing={1.2}>
                {["Política de Privacidade", "Termos de Uso", "Suporte técnico"].map((link) => (
                  <Typography key={link} variant="body2" color="text.secondary" sx={{ cursor: "pointer", "&:hover": { color: bp.teal } }}>
                    {link}
                  </Typography>
                ))}
              </Stack>
            </Grid>

            {/* Security badges */}
            <Grid item xs={6} md={4}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", display: "block", mb: 2 }}>
                Segurança
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(bp.teal, 0.1), color: bp.teal, width: 32, height: 32 }}>
                    <LockIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">Ambiente seguro e monitorado</Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(bp.emerald, 0.1), color: bp.emerald, width: 32, height: 32 }}>
                    <ShieldIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">Dados criptografados em trânsito</Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ bgcolor: alpha(bp.amber, 0.1), color: bp.amber, width: 32, height: 32 }}>
                    <VerifiedIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">Autenticação JWT + RBAC</Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};
