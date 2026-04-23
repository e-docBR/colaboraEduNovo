import React, { useEffect } from "react";
import {
    Box,
    Card,
    Typography,
    Stack,
    Chip,
    Avatar,
    Skeleton,
    Grid2 as Grid,
    useTheme,
    Tooltip
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import { useGetBulkInterventionsMutation } from "../../lib/api";

interface AIInterventionBoardProps {
    studentIds: number[];
}

export const AIInterventionBoard: React.FC<AIInterventionBoardProps> = ({ studentIds }) => {
    const theme = useTheme();
    const [trigger, { data, isLoading }] = useGetBulkInterventionsMutation();

    useEffect(() => {
        if (studentIds.length > 0) {
            trigger({ student_ids: studentIds });
        }
    }, [studentIds, trigger]);

    if (isLoading) {
        return (
            <Box mt={4}>
                <Typography variant="h6" display="flex" alignItems="center" gap={1} mb={2}>
                    <AutoFixHighIcon color="primary" /> Gerando Insights Pedagógicos...
                </Typography>
                <Grid container spacing={2}>
                    {[1, 2, 3].map((i) => (
                        <Grid size={{ xs: 12, md: 4 }} key={i}>
                            <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    const interventions = data?.results || [];

    if (interventions.length === 0) return null;

    return (
        <Box mt={6}>
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "12px",
                        bgcolor: theme.palette.primary.main + "20",
                        display: "flex",
                        alignItems: "center"
                    }}
                >
                    <AutoFixHighIcon color="primary" />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.01em" }}>
                        Ações Pedagógicas Inteligentes
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Sugestões baseadas em heurística e desempenho IA
                    </Typography>
                </Box>
            </Stack>

            <Grid container spacing={2}>
                {interventions.map((student: any) => (
                    student.interventions.map((action: any, idx: number) => (
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} key={`${student.id}-${idx}`}>
                            <Card
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    p: 2.5,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 3,
                                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                                    position: "relative",
                                    overflow: "hidden",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        borderColor: theme.palette.primary.main + "50",
                                        transform: "translateY(-4px)",
                                        boxShadow: "0 12px 24px -10px rgba(0,0,0,0.15)",
                                    }
                                }}
                            >
                                {/* Priority Indicator — backend returns "HIGH"/"MEDIUM"/"LOW" */}
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        width: "4px",
                                        height: "100%",
                                        bgcolor: action.priority === "HIGH" ? "error.main" :
                                                 action.priority === "MEDIUM" ? "warning.main" : "info.main"
                                    }}
                                />

                                <Stack spacing={1.5}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Typography variant="caption" fontWeight={700} color="primary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                            {action.title}
                                        </Typography>
                                        <Tooltip title={action.priority}>
                                            {action.priority === "HIGH" ? <ErrorIcon color="error" fontSize="small" /> :
                                             action.priority === "MEDIUM" ? <WarningIcon color="warning" fontSize="small" /> :
                                             <InfoIcon color="info" fontSize="small" />}
                                        </Tooltip>
                                    </Stack>

                                    <Typography variant="body2" color="text.primary" fontWeight={500} sx={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: 1.5
                                    }}>
                                        {action.description}
                                    </Typography>

                                    <Box mt="auto" pt={2}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Avatar sx={{ width: 24, height: 24, fontSize: "0.75rem", bgcolor: theme.palette.primary.main }}>
                                                {student.nome[0]}
                                            </Avatar>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                {student.nome.split(' ')[0]}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                </Stack>
                            </Card>
                        </Grid>
                    ))
                )).flat()}
            </Grid>
        </Box>
    );
};
