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
        faltas: string;
        situacao: string;
    }>({
        trimestre1: "",
        trimestre2: "",
        trimestre3: "",
        total: "",
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
                faltas: nota.faltas?.toString() ?? "0",
                situacao: nota.situacao ?? ""
            });
        }
    }, [nota]);

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
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

            // If user clears total input, assume they want auto-calc
            if (formData.total !== "") {
                payload.total = parse(formData.total);
            }

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
                            label="Total (Deixe vazio para auto-calc)"
                            type="number"
                            fullWidth
                            value={formData.total}
                            onChange={(e) => handleChange("total", e.target.value)}
                            inputProps={{ step: "0.1" }}
                            helperText="Soma dos trimestres"
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            label="Faltas"
                            type="number"
                            fullWidth
                            value={formData.faltas}
                            onChange={(e) => handleChange("faltas", e.target.value)}
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
                                <MenuItem value="">-</MenuItem>
                                <MenuItem value="APROVADO">Aprovado</MenuItem>
                                <MenuItem value="REPROVADO">Reprovado</MenuItem>
                                <MenuItem value="RECUPERACAO">Recuperação</MenuItem>
                                <MenuItem value="APCC">APCC</MenuItem>
                                <MenuItem value="AR">Apr. com Rec.</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                    * Campos vazios (exceto Total) serão salvos como "null".
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
