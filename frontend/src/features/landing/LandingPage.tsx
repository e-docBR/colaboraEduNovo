import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Grid2 as Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  alpha,
  SvgIcon,
  SvgIconProps,
  IconButton,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useScrollTrigger,
  useMediaQuery,
  useTheme,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BarChartIcon from '@mui/icons-material/BarChart';
import UploadIcon from '@mui/icons-material/Upload';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import CampaignIcon from '@mui/icons-material/Campaign';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import SecurityIcon from '@mui/icons-material/Security';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HistoryIcon from '@mui/icons-material/History';
import DomainIcon from '@mui/icons-material/Domain';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import HubIcon from '@mui/icons-material/Hub';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import LoginIcon from '@mui/icons-material/Login';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import { brand } from '../../theme/brandTokens';

/* ─── SVG Icons for modules (lightweight, no extra deps) ─── */
function ClassIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
    </SvgIcon>
  );
}

function GradesIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </SvgIcon>
  );
}

/* ─── Navigation anchors ─── */
const NAV_LINKS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Perfis', href: '#perfis' },
  { label: 'Segurança', href: '#seguranca' },
];

/* ─── Stat items for proof-of-value strip ─── */
const STATS = [
  { icon: <PeopleIcon sx={{ fontSize: 32, color: brand.azulPrincipal }} />, value: 'Alunos acompanhados', desc: 'Acompanhamento individual e coletivo do desempenho acadêmico' },
  { icon: <ClassIcon sx={{ fontSize: 32, color: brand.verde }} />, value: 'Turmas organizadas', desc: 'Gestão completa de turmas, horários e composição' },
  { icon: <AssessmentIcon sx={{ fontSize: 32, color: brand.dourado }} />, value: 'Relatórios gerados', desc: 'Relatórios detalhados para decisões pedagógicas' },
  { icon: <NotificationsActiveIcon sx={{ fontSize: 32, color: brand.azulApoio }} />, value: 'Alertas monitorados', desc: 'Ocorrências e alertas registrados em tempo real' },
];

/* ─── How the platform helps ─── */
const HELPS = [
  { icon: <HubIcon sx={{ fontSize: 28, color: brand.azulPrincipal }} />, title: 'Centraliza dados acadêmicos', desc: 'Todos os dados de alunos, turmas e notas em um único lugar, acessível de qualquer dispositivo.' },
  { icon: <TrendingUpIcon sx={{ fontSize: 28, color: brand.verde }} />, title: 'Acompanha desempenho e frequência', desc: 'Acompanhe de perto o desempenho e a frequência de cada aluno com indicadores claros.' },
  { icon: <CampaignIcon sx={{ fontSize: 28, color: brand.azulApoio }} />, title: 'Registra ocorrências e comunicados', desc: 'Registre ocorrências disciplinares e envie comunicados de forma rápida e organizada.' },
  { icon: <PsychologyIcon sx={{ fontSize: 28, color: brand.dourado }} />, title: 'Apoia intervenções pedagógicas', desc: 'Identifique alunos em risco e receba sugestões de intervenção com apoio de inteligência artificial.' },
  { icon: <AutoGraphIcon sx={{ fontSize: 28, color: brand.verde }} />, title: 'Gera relatórios para gestão', desc: 'Gere relatórios completos e personalizados para apoiar a gestão e as decisões estratégicas.' },
  { icon: <FamilyRestroomIcon sx={{ fontSize: 28, color: brand.azulPrincipal }} />, title: 'Aproxima escola, aluno e família', desc: 'Conecte escola, alunos e famílias com comunicação transparente e acessível.' },
];

/* ─── Access profiles ─── */
const PROFILES = [
  {
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 36, color: brand.azulPrincipal }} />,
    title: 'Gestão e Secretaria',
    benefits: ['Cadastro e organização de alunos e turmas', 'Emissão de relatórios institucionais', 'Controle de acessos por unidade escolar'],
  },
  {
    icon: <SupervisorAccountIcon sx={{ fontSize: 36, color: brand.verde }} />,
    title: 'Direção e Coordenação',
    benefits: ['Visão panorâmica do desempenho escolar', 'Acompanhamento de ocorrências e intervenções', 'Relatórios para tomadas de decisão'],
  },
  {
    icon: <SupportAgentIcon sx={{ fontSize: 36, color: brand.azulApoio }} />,
    title: 'Professores e Orientação',
    benefits: ['Lançamento de notas e frequência', 'Registro de ocorrências pedagógicas', 'Comunicação direta com famílias'],
  },
  {
    icon: <SchoolIcon sx={{ fontSize: 36, color: brand.dourado }} />,
    title: 'Alunos e Responsáveis',
    benefits: ['Acompanhamento de notas e boletim', 'Recebimento de comunicados da escola', 'Visualização de ocorrências e alertas'],
  },
];

/* ─── Platform modules ─── */
const MODULES = [
  { icon: <DashboardIcon />, label: 'Dashboard' },
  { icon: <PeopleIcon />, label: 'Alunos' },
  { icon: <ClassIcon />, label: 'Turmas' },
  { icon: <GradesIcon />, label: 'Notas' },
  { icon: <BarChartIcon />, label: 'Gráficos' },
  { icon: <AssessmentIcon />, label: 'Relatórios' },
  { icon: <UploadIcon />, label: 'Uploads' },
  { icon: <ManageAccountsIcon />, label: 'Usuários' },
  { icon: <CampaignIcon />, label: 'Comunicados' },
  { icon: <ReportProblemIcon />, label: 'Ocorrências' },
  { icon: <AutoAwesomeIcon />, label: 'Intervenções com IA' },
  { icon: <PersonIcon />, label: 'Portal do aluno' },
  { icon: <FamilyRestroomIcon />, label: 'Portal do responsável' },
];

/* ─── Security & governance ─── */
const SECURITY = [
  { icon: <AdminPanelSettingsIcon sx={{ fontSize: 28, color: brand.azulPrincipal }} />, title: 'Controle por perfis', desc: 'Cada usuário enxerga apenas o que sua função permite, garantindo privacidade e organização.' },
  { icon: <LockIcon sx={{ fontSize: 28, color: brand.verde }} />, title: 'Autenticação segura', desc: 'Acesso protegido por autenticação robusta, com validação de credenciais e sessões controladas.' },
  { icon: <DomainIcon sx={{ fontSize: 28, color: brand.azulApoio }} />, title: 'Escolas e tenants', desc: 'Dados organizados por unidade escolar com separação lógica entre instituições no mesmo ambiente.' },
  { icon: <HistoryIcon sx={{ fontSize: 28, color: brand.dourado }} />, title: 'Logs de auditoria', desc: 'Registro completo de ações realizadas na plataforma, rastreável para conformidade e segurança.' },
  { icon: <DomainIcon sx={{ fontSize: 28, color: brand.verde }} />, title: 'Dados por unidade escolar', desc: 'Cada escola mantém seus dados organizados e independentes, sem mistura de informações.' },
];

/* ═══════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════ */

const landingTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.azulPrincipal, dark: brand.azulEscuro, contrastText: brand.branco },
    secondary: { main: brand.verde },
    text: { primary: brand.grafite, secondary: brand.cinza500 },
    background: { default: brand.fundoClaroQuente, paper: brand.branco },
  },
  typography: {
    fontFamily: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiTypography: {
      styleOverrides: {
        root: { color: brand.grafite },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600, boxShadow: 'none' },
        containedPrimary: { backgroundColor: brand.azulPrincipal, '&:hover': { backgroundColor: brand.azulEscuro } },
      },
    },
  },
});

export const LandingPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  /* ─── Navigation handler ─── */
  const handleCTA = (path: string) => {
    if (path.startsWith('#')) {
      const el = document.querySelector(path);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(path);
    }
  };

  /* ═══════════════════════════
     HEADER
     ═══════════════════════════ */
  const renderHeader = () => (
    <AppBar
      position="fixed"
      elevation={trigger ? 2 : 0}
      sx={{
        bgcolor: trigger ? alpha(brand.branco, 0.97) : brand.branco,
        borderBottom: trigger ? `1px solid ${brand.cinza100}` : '1px solid transparent',
        backdropFilter: trigger ? 'blur(8px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Toolbar
          disableGutters
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: { xs: 60, md: 68 },
          }}
        >
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src="/colaboraedu-logo.png"
              alt="colaboraEDU"
              style={{ height: isMobile ? 36 : 44, width: 'auto', objectFit: 'contain' }}
            />
          </Box>

          {/* Desktop nav links */}
          {!isMobile && (
            <Stack direction="row" spacing={3} alignItems="center">
              {NAV_LINKS.map((link) => (
                <Typography
                  key={link.href}
                  component="a"
                  href={link.href}
                  sx={{
                    color: brand.grafite,
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    '&:hover': { color: brand.azulPrincipal },
                    transition: 'color 0.2s',
                  }}
                >
                  {link.label}
                </Typography>
              ))}
              <Button
                variant="contained"
                startIcon={<LoginIcon />}
                onClick={() => handleCTA('/login')}
                sx={{ ml: 1, bgcolor: brand.azulPrincipal, '&:hover': { bgcolor: brand.azulApoio } }}
              >
                Entrar
              </Button>
            </Stack>
          )}

          {/* Mobile: menu button + CTA */}
          {isMobile && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleCTA('/login')}
                sx={{ minHeight: 40, fontSize: '0.85rem', px: 2, bgcolor: brand.azulPrincipal, '&:hover': { bgcolor: brand.azulApoio } }}
              >
                Entrar
              </Button>
              <IconButton
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen(true)}
                sx={{ color: brand.grafite }}
              >
                <MenuIcon />
              </IconButton>
            </Stack>
          )}
        </Toolbar>
      </Container>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: { width: 260, bgcolor: brand.branco },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <List>
          {NAV_LINKS.map((link) => (
            <ListItem key={link.href} disablePadding>
              <ListItemButton
                component="a"
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{ fontWeight: 500, color: brand.grafite }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<LoginIcon />}
            onClick={() => handleCTA('/login')}
            sx={{ bgcolor: brand.azulPrincipal, '&:hover': { bgcolor: brand.azulApoio } }}
          >
            Entrar na plataforma
          </Button>
        </Box>
      </Drawer>
    </AppBar>
  );

  /* ═══════════════════════════
     HERO
     ═══════════════════════════ */
  const renderHero = () => (
    <Box
      id="hero"
      sx={{
        pt: { xs: 10, md: 14 },
        pb: { xs: 6, md: 10 },
        bgcolor: brand.fundoClaroQuente,
        minHeight: { xs: 'auto', md: '90vh' },
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(brand.azulPrincipal, 0.04)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          display: { xs: 'none', md: 'block' },
        }}
      />

      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, position: 'relative', zIndex: 1 }}>
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          {/* Text column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Chip
              label="Plataforma educacional"
              size="small"
              sx={{
                bgcolor: alpha(brand.azulPrincipal, 0.08),
                color: brand.azulPrincipal,
                fontWeight: 600,
                mb: 2,
                fontSize: '0.8rem',
              }}
            />
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: '2.2rem', sm: '2.8rem', md: '3.2rem' }, mb: 2 }}
            >
              <Box component="span" sx={{ color: brand.azulPrincipal }}>
                colabora
              </Box>
              <Box component="span" sx={{ color: brand.verde, fontWeight: 800 }}>
                EDU
              </Box>
            </Typography>
            <Typography
              variant="h4"
              sx={{
                color: brand.grafite,
                fontWeight: 500,
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                mb: 2,
                lineHeight: 1.5,
              }}
            >
              Gestão acadêmica, comunicação escolar e acompanhamento pedagógico em uma única plataforma.
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: brand.cinza500, mb: 4, fontSize: { xs: '0.95rem', sm: '1rem' }, maxWidth: 520 }}
            >
              Organize alunos, turmas, notas, ocorrências, comunicados e relatórios com dados claros para decisões rápidas.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: { xs: 4, md: 0 } }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                onClick={() => handleCTA('/login')}
                sx={{ px: 4, py: 1.5, fontSize: '1rem', bgcolor: brand.azulPrincipal, '&:hover': { bgcolor: brand.azulApoio } }}
              >
                Entrar na plataforma
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PersonOutlineOutlinedIcon />}
                onClick={() => handleCTA('/login/aluno')}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderColor: brand.verde,
                  color: brand.verde,
                  '&:hover': { borderColor: brand.verde, bgcolor: alpha(brand.verde, 0.06) },
                }}
              >
                Acesso aluno/responsável
              </Button>
            </Stack>
          </Grid>

          {/* Visual column — dashboard mockup */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                bgcolor: brand.branco,
                borderRadius: 2,
                border: `1px solid ${brand.cinza100}`,
                p: { xs: 2, md: 3 },
                boxShadow: '0 8px 32px rgba(10,60,160,0.08)',
                maxWidth: { xs: '100%', md: 560 },
                mx: 'auto',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '0.85rem', color: brand.azulPrincipal, fontWeight: 700 }}>
                  Dashboard Acadêmico
                </Typography>
                <Chip label="2025" size="small" sx={{ bgcolor: alpha(brand.azulPrincipal, 0.08), color: brand.azulPrincipal, fontSize: '0.7rem' }} />
              </Stack>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {[
                  { label: 'Alunos', val: '1.248', color: brand.azulPrincipal },
                  { label: 'Turmas', val: '42', color: brand.verde },
                  { label: 'Aprovados', val: '87%', color: brand.dourado },
                ].map((s) => (
                  <Grid size={{ xs: 4 }} key={s.label}>
                    <Box sx={{ bgcolor: alpha(s.color, 0.06), borderRadius: 1.5, p: 1.5, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: { xs: '1rem', sm: '1.2rem' }, fontWeight: 700, color: s.color }}>
                        {s.val}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: brand.cinza500 }}>
                        {s.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ px: 1 }}>
                <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ height: 80 }}>
                  {[45, 65, 55, 80, 70, 60, 90, 75, 85, 50, 72, 68].map((h, i) => (
                    <Box
                      key={i}
                      sx={{
                        flex: 1,
                        height: `${h}%`,
                        bgcolor: i === 6 ? brand.verde : alpha(brand.azulPrincipal, 0.2 + h / 300),
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  ))}
                </Stack>
                <Typography sx={{ fontSize: '0.6rem', color: brand.cinza500, mt: 0.5, textAlign: 'center' }}>
                  Desempenho mensal
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     PROOF OF VALUE
     ═══════════════════════════ */
  const renderStats = () => (
    <Box sx={{ py: { xs: 5, md: 7 }, bgcolor: brand.azulPrincipal }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 2, md: 4 }}>
          {STATS.map((stat, idx) => (
            <Grid size={{ xs: 6, md: 3 }} key={idx}>
              <Box
                sx={{
                  textAlign: 'center',
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  bgcolor: alpha(brand.branco, 0.08),
                  border: `1px solid ${alpha(brand.branco, 0.12)}`,
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'center' }}>
                  {React.cloneElement(stat.icon, { sx: { fontSize: 32, color: brand.branco } })}
                </Box>
                <Typography sx={{ color: brand.branco, fontWeight: 700, fontSize: { xs: '0.9rem', md: '1rem' }, mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography sx={{ color: alpha(brand.branco, 0.7), fontSize: { xs: '0.72rem', md: '0.8rem' }, lineHeight: 1.4 }}>
                  {stat.desc}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     HOW THE PLATFORM HELPS
     ═══════════════════════════ */
  const renderHowItHelps = () => (
    <Box id="plataforma" sx={{ py: { xs: 6, md: 10 }, bgcolor: brand.fundoClaroQuente }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Chip
            label="Como a plataforma ajuda"
            size="small"
            sx={{ bgcolor: alpha(brand.verde, 0.1), color: brand.verde, fontWeight: 600, mb: 2, fontSize: '0.8rem' }}
          />
          <Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', sm: '2rem', md: '2.2rem' }, mb: 1.5 }}>
            Tudo que sua escola precisa em um só lugar
          </Typography>
          <Typography variant="subtitle1" sx={{ maxWidth: 600, mx: 'auto', fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
            A colaboraEDU reúne as ferramentas essenciais para gestão acadêmica, acompanhamento pedagógico e comunicação escolar.
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 2, md: 3 }}>
          {HELPS.map((item, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  bgcolor: brand.branco,
                  border: `1px solid ${brand.cinza100}`,
                  borderRadius: '8px',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  '&:hover': { boxShadow: '0 4px 16px rgba(10,60,160,0.08)', transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Box sx={{ mb: 2 }}>{item.icon}</Box>
                  <Typography variant="h5" sx={{ fontWeight: 600, fontSize: { xs: '1rem', sm: '1.05rem' }, mb: 1, color: brand.grafite }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: brand.cinza500, lineHeight: 1.6, fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                    {item.desc}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     ACCESS PROFILES
     ═══════════════════════════ */
  const renderProfiles = () => (
    <Box id="perfis" sx={{ py: { xs: 6, md: 10 }, bgcolor: brand.branco }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Chip
            label="Perfis de acesso"
            size="small"
            sx={{ bgcolor: alpha(brand.azulPrincipal, 0.08), color: brand.azulPrincipal, fontWeight: 600, mb: 2, fontSize: '0.8rem' }}
          />
          <Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', sm: '2rem', md: '2.2rem' }, mb: 1.5 }}>
            Feito para cada perfil da escola
          </Typography>
          <Typography variant="subtitle1" sx={{ maxWidth: 600, mx: 'auto', fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
            Cada usuário tem acesso às funcionalidades certas para sua função, com dados organizados e seguros.
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 2, md: 3 }}>
          {PROFILES.map((profile, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  bgcolor: brand.branco,
                  border: `1px solid ${brand.cinza100}`,
                  borderRadius: '8px',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  '&:hover': { boxShadow: '0 4px 16px rgba(10,60,160,0.08)', transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Box sx={{ mb: 2 }}>{profile.icon}</Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.05rem', sm: '1.1rem' }, mb: 2, color: brand.grafite }}>
                    {profile.title}
                  </Typography>
                  <Stack spacing={1}>
                    {profile.benefits.map((b, bi) => (
                      <Stack key={bi} direction="row" spacing={1} alignItems="flex-start">
                        <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 18, color: brand.verde, mt: 0.3, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: brand.cinza500, lineHeight: 1.5, fontSize: { xs: '0.82rem', sm: '0.875rem' } }}>
                          {b}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     PLATFORM MODULES
     ═══════════════════════════ */
  const renderModules = () => (
    <Box id="recursos" sx={{ py: { xs: 6, md: 10 }, bgcolor: brand.fundoClaroQuente }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Chip
            label="Módulos da plataforma"
            size="small"
            sx={{ bgcolor: alpha(brand.dourado, 0.12), color: '#9A7E1C', fontWeight: 600, mb: 2, fontSize: '0.8rem' }}
          />
          <Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', sm: '2rem', md: '2.2rem' }, mb: 1.5 }}>
            Módulos completos para sua escola
          </Typography>
          <Typography variant="subtitle1" sx={{ maxWidth: 600, mx: 'auto', fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
            Da gestão ao acompanhamento pedagógico, cada módulo foi pensado para facilitar o dia a dia escolar.
          </Typography>
        </Box>

        {isMobile ? (
          <Stack spacing={1.5}>
            {MODULES.map((mod, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ bgcolor: brand.branco, borderRadius: '8px', p: 2, border: `1px solid ${brand.cinza100}` }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    bgcolor: alpha(brand.azulPrincipal, 0.06),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {React.cloneElement(mod.icon, { sx: { fontSize: 22, color: brand.azulPrincipal } })}
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.9rem', color: brand.grafite }}>
                  {mod.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Grid container spacing={2}>
            {MODULES.map((mod, idx) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={idx}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    bgcolor: brand.branco,
                    borderRadius: '8px',
                    p: 2,
                    border: `1px solid ${brand.cinza100}`,
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: '0 2px 8px rgba(10,60,160,0.06)' },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      bgcolor: alpha(brand.azulPrincipal, 0.06),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {React.cloneElement(mod.icon, { sx: { fontSize: 20, color: brand.azulPrincipal } })}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem', color: brand.grafite }}>
                    {mod.label}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     SECURITY & GOVERNANCE
     ═══════════════════════════ */
  const renderSecurity = () => (
    <Box id="seguranca" sx={{ py: { xs: 6, md: 10 }, bgcolor: brand.branco }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Chip
              label="Segurança e governança"
              size="small"
              sx={{ bgcolor: alpha(brand.verde, 0.1), color: brand.verde, fontWeight: 600, mb: 2, fontSize: '0.8rem' }}
            />
            <Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', sm: '2rem', md: '2.2rem' }, mb: 2 }}>
              Seus dados protegidos e organizados
            </Typography>
            <Typography variant="subtitle1" sx={{ mb: 4, fontSize: { xs: '0.95rem', sm: '1.05rem' }, maxWidth: 520 }}>
              A colaboraEDU foi projetada com segurança e governança de dados como prioridade. Cada informação é tratada com rigor e organização.
            </Typography>

            <Grid container spacing={2}>
              {SECURITY.map((item, idx) => (
                <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: alpha(brand.azulPrincipal, 0.06),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5, color: brand.grafite }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: brand.cinza500, lineHeight: 1.5, fontSize: '0.82rem' }}>
                        {item.desc}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Box
              sx={{
                bgcolor: alpha(brand.azulPrincipal, 0.03),
                borderRadius: 3,
                p: { xs: 3, md: 4 },
                border: `1px solid ${alpha(brand.azulPrincipal, 0.08)}`,
                textAlign: 'center',
              }}
            >
              <SecurityIcon sx={{ fontSize: 64, color: brand.azulPrincipal, mb: 2 }} />
              <Typography
                variant="h4"
                sx={{ fontSize: { xs: '1.2rem', md: '1.4rem' }, mb: 1, color: brand.azulPrincipal, fontWeight: 700 }}
              >
                Proteção em cada camada
              </Typography>
              <Typography variant="body2" sx={{ color: brand.cinza500, lineHeight: 1.6, maxWidth: 340, mx: 'auto' }}>
                Da autenticação ao armazenamento, cada etapa é projetada para manter seus dados seguros e acessíveis apenas para quem deve.
              </Typography>
              <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
                {['Autenticação', 'Autorização', 'Auditoria', 'Criptografia'].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{ bgcolor: alpha(brand.azulPrincipal, 0.08), color: brand.azulPrincipal, fontWeight: 500, fontSize: '0.75rem' }}
                  />
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     FINAL CTA
     ═══════════════════════════ */
  const renderFinalCTA = () => (
    <Box sx={{ py: { xs: 6, md: 10 }, bgcolor: brand.fundoClaroQuente }}>
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontSize: { xs: '1.7rem', sm: '2rem', md: '2.2rem' }, mb: 2 }}>
          Escolha seu portal de entrada
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: { xs: 4, md: 5 }, fontSize: { xs: '0.95rem', sm: '1.05rem' }, maxWidth: 480, mx: 'auto' }}>
          Acesse a plataforma com seu perfil ou entre como aluno ou responsável para acompanhar a vida escolar.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<AdminPanelSettingsIcon />}
            onClick={() => handleCTA('/login')}
            sx={{ px: { xs: 3, sm: 5 }, py: 2, fontSize: '1rem', width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 }, bgcolor: brand.azulPrincipal, '&:hover': { bgcolor: brand.azulApoio } }}
          >
            Portal Administrativo
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<SchoolIcon />}
            onClick={() => handleCTA('/login/aluno')}
            sx={{
              px: { xs: 3, sm: 5 },
              py: 2,
              fontSize: '1rem',
              width: { xs: '100%', sm: 'auto' },
              minWidth: { sm: 260 },
              borderColor: brand.verde,
              color: brand.verde,
              '&:hover': { borderColor: brand.verde, bgcolor: alpha(brand.verde, 0.06) },
            }}
          >
            Portal Aluno/Responsável
          </Button>
        </Stack>
      </Container>
    </Box>
  );

  /* ═══════════════════════════
     FOOTER
     ═══════════════════════════ */
  const renderFooter = () => (
    <Box component="footer" sx={{ py: { xs: 4, md: 5 }, bgcolor: brand.grafite, color: brand.branco }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 3, md: 4 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ mb: 2 }}>
              <img
                src="/colaboraedu-logo.png"
                alt="colaboraEDU"
                style={{ height: 36, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: alpha(brand.branco, 0.6), maxWidth: 320, lineHeight: 1.6, fontSize: '0.85rem' }}>
              Plataforma completa para gestão acadêmica, comunicação escolar e acompanhamento pedagógico. Transformando dados em decisões para a educação.
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="h6" sx={{ color: brand.branco, fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
              Plataforma
            </Typography>
            <Stack spacing={1}>
              {['Dashboard', 'Alunos', 'Turmas', 'Relatórios'].map((item) => (
                <Typography
                  key={item}
                  component="a"
                  href="#"
                  sx={{ color: alpha(brand.branco, 0.5), textDecoration: 'none', fontSize: '0.85rem', '&:hover': { color: brand.branco }, transition: 'color 0.2s' }}
                >
                  {item}
                </Typography>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <Typography variant="h6" sx={{ color: brand.branco, fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>
              Institucional
            </Typography>
            <Stack spacing={1}>
              {['Sobre nós', 'Contato', 'Política de privacidade', 'Termos de uso'].map((item) => (
                <Typography
                  key={item}
                  component="a"
                  href="#"
                  sx={{ color: alpha(brand.branco, 0.5), textDecoration: 'none', fontSize: '0.85rem', '&:hover': { color: brand.branco }, transition: 'color 0.2s' }}
                >
                  {item}
                </Typography>
              ))}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: alpha(brand.branco, 0.1), my: 3 }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'center', sm: 'flex-start' }}
          spacing={1}
        >
          <Typography variant="body2" sx={{ color: alpha(brand.branco, 0.4), fontSize: '0.8rem', textAlign: { xs: 'center', sm: 'left' } }}>
            © {new Date().getFullYear()} colaboraEDU. Todos os direitos reservados.
          </Typography>
          <Typography variant="body2" sx={{ color: alpha(brand.branco, 0.3), fontSize: '0.75rem' }}>
            Plataforma educacional
          </Typography>
        </Stack>
      </Container>
    </Box>
  );

  return (
    <ThemeProvider theme={landingTheme}>
      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: brand.fundoClaroQuente,
          overflowX: 'hidden',
          color: brand.grafite,
        }}
      >
        {renderHeader()}
        <Box sx={{ flex: 1 }}>
          {renderHero()}
          {renderStats()}
          {renderHowItHelps()}
          {renderProfiles()}
          {renderModules()}
          {renderSecurity()}
          {renderFinalCTA()}
        </Box>
        {renderFooter()}
      </Box>
    </ThemeProvider>
  );
};
