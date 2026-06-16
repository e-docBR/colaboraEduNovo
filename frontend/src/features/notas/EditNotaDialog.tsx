import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useUpdateNotaMutation, AlunoNota } from "../../lib/api";

interface EditNotaDialogProps {
    open: boolean;
    onClose: () => void;
    nota: AlunoNota | null;
    onError?: (msg: string) => void;
}

export const EditNotaDialog = ({ open, onClose, nota, onError }: EditNotaDialogProps) => {
    const [updateNota, { isLoading }] = useUpdateNotaMutation();
    const [formData, setFormData] = useState<{
        trimestre1: string;
        trimestre2: string;
        trimestre3: string;
        total: string;
        recuperacao: string;
        conselho_de_classe: string;
        faltas: string;
        situacao: string;
    }>({
        trimestre1: "",
        trimestre2: "",
        trimestre3: "",
        total: "",
        recuperacao: "",
        conselho_de_classe: "",
        faltas: "",
        situacao: ""
    });

    useEffect(() => {
        if (nota) {
            setFormData({
                trimestre1: nota.trimestre1?.toString() ?? "",
                trimestre2: nota.trimestre2?.toString() ?? "",
                trimestre3: nota.trimestre3?.toString() ?? "",
                total: nota.total?.toString() ?? "",
                recuperacao: nota.recuperacao?.toString() ?? "",
                conselho_de_classe: nota.conselho_de_classe?.toString() ?? "",
                faltas: nota.faltas?.toString() ?? "0",
                situacao: nota.situacao ?? ""
            });
        }
    }, [nota]);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            // Limpa o total ao editar qualquer trimestre para forçar recálculo automático no backend
            if (field === "trimestre1" || field === "trimestre2" || field === "trimestre3") {
                next.total = "";
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!nota) return;
        try {
            const payload: any = { id: nota.id };

            const parse = (v: string) => (v === "" ? null : parseFloat(v));
            const parseIntVal = (v: string) => (v === "" ? null : parseInt(v, 10));

            // Only include total if user explicitly wants to override or edited it
            // For now, let's send what is in the form. If user clears it, sending null lets backend recalc if logic permits, 
            // but backend logic says "if total not in updates". 
            // Strategy: if total field is empty string, send null? 
            // Backend says: if "total" NOT in keys, calc. If "total" IS in keys, use value.
            // So if user wants auto-calc, we shouldn't send 'total' key?
            // Let's assume if user leaves total blank, we don't send it.

            if (formData.trimestre1 !== "") payload.trimestre1 = parse(formData.trimestre1);
            if (formData.trimestre2 !== "") payload.trimestre2 = parse(formData.trimestre2);
            if (formData.trimestre3 !== "") payload.trimestre3 = parse(formData.trimestre3);

            // Se total vazio → backend auto-calcula como soma dos trimestres
            if (formData.total !== "") {
                payload.total = parse(formData.total);
            }

            if (formData.recuperacao !== "") payload.recuperacao = parse(formData.recuperacao);
            if (formData.conselho_de_classe !== "") payload.conselho_de_classe = parse(formData.conselho_de_classe);
            if (formData.faltas !== "") payload.faltas = parseIntVal(formData.faltas);
            if (formData.situacao !== "") payload.situacao = formData.situacao;

            await updateNota(payload).unwrap();
            onClose();
        } catch (error: any) {
            const msg = error?.data?.error ?? "Erro ao salvar nota. Tente novamente.";
            if (onError) onError(msg);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Editar Nota - {nota?.disciplina}</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={4}>
                        <TextField
                            label="1º Trimestre"
                            type="number"
                            fullWidth
                            value={formData.trimestre1}
                            onChange={(e) => handleChange("trimestre1", e.target.value)}
                            inputProps={{ step: "0.1" }}
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <TextField
                            label="2º Trimestre"
                            type="number"
                            fullWidth
                            value={formData.trimestre2}
                            onChange={(e) => handleChange("trimestre2", e.target.value)}
                            inputProps={{ step: "0.1" }}
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <TextField
                            label="3º Trimestre"
                            type="number"
                            fullWidth
                            value={formData.trimestre3}
                            onChange={(e) => handleChange("trimestre3", e.target.value)}
                            inputProps={{ step: "0.1" }}
                        />
                    </Grid>

                    <Grid item xs={6}>
                        <TextField
                            label="Total de Pontos (vazio = auto)"
                            type="number"
                            fullWidth
                            value={formData.total}
                            onChange={(e) => handleChange("total", e.target.value)}
                            inputProps={{ step: "0.1", min: 0, max: 100 }}
                            helperText={formData.total === "" ? "Será recalculado (T1 + T2 + T3)" : "T1 + T2 + T3 (0–100)"}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            label="Faltas"
                            type="number"
                            fullWidth
                            value={formData.faltas}
                            onChange={(e) => handleChange("faltas", e.target.value)}
                            inputProps={{ min: 0 }}
                        />
                    </Grid>

                    <Grid item xs={6}>
                        <TextField
                            label="Recuperação (0–100)"
                            type="number"
                            fullWidth
                            value={formData.recuperacao}
                            onChange={(e) => handleChange("recuperacao", e.target.value)}
                            inputProps={{ step: "0.1", min: 0, max: 100 }}
                            helperText="Prova de recuperação"
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            label="Conselho de Classe (0–100)"
                            type="number"
                            fullWidth
                            value={formData.conselho_de_classe}
                            onChange={(e) => handleChange("conselho_de_classe", e.target.value)}
                            inputProps={{ step: "0.1", min: 0, max: 100 }}
                            helperText="Nota aprovada pelo conselho"
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel>Situação</InputLabel>
                            <Select
                                value={formData.situacao}
                                label="Situação"
                                onChange={(e) => handleChange("situacao", e.target.value)}
                            >
                                <MenuItem value="">— automática —</MenuItem>
                                <MenuItem value="APR">APR — Aprovado</MenuItem>
                                <MenuItem value="REP">REP — Reprovado</MenuItem>
                                <MenuItem value="REC">REC — Em Recuperação</MenuItem>
                                <MenuItem value="APCC">ACC — Aprovado por Conselho</MenuItem>
                                <MenuItem value="AR">AR — Aprovado com Restrição</MenuItem>
                                <MenuItem value="EMC">EMC — Em Curso</MenuItem>
                                <MenuItem value="EMR">EMR — Em Regime de Recuperação</MenuItem>
                                <MenuItem value="AFC">AFC — Apr. Frequência Compensada</MenuItem>
                                <MenuItem value="TRN">TRN — Transferido</MenuItem>
                                <MenuItem value="ABA">ABA — Abandono</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                    * Situação "automática": calculada pelo sistema ao salvar Recuperação/Conselho.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSave} variant="contained" disabled={isLoading}>
                    Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
};
