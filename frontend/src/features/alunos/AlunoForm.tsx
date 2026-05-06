import { Alert, Box, Button, MenuItem, TextField, Divider, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { AlunoSummary } from "../../lib/api";

interface AlunoFormProps {
    initialData?: Partial<AlunoSummary>;
    onSubmit: (data: Partial<AlunoSummary>) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

const TURNOS = ["Matutino", "Vespertino", "Noturno"];

export const AlunoForm = ({ initialData, onSubmit, onCancel, isLoading }: AlunoFormProps) => {
    const [formData, setFormData] = useState<Partial<AlunoSummary>>({
        nome: "",
        matricula: "",
        turma: "",
        turno: "Matutino",
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let newValue = value;
        if (name === "telefones") {
            // Only apply mask if the user is typing standard digits
            // Allow deleting (backspace) without forcing formatting weirdly
            // Simple "as you type" mask logic
            const raw = value.replace(/\D/g, "");
            if (raw.length <= 11) {
                // If it looks like a single phone number, Format it
                if (raw.length > 2 && raw.length <= 6) {
                    newValue = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
                } else if (raw.length > 6 && raw.length <= 10) {
                    newValue = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
                } else if (raw.length > 10) {
                    newValue = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
                } else {
                    newValue = raw;
                }
            }
            // If larger (multiple phones), let it match default behavior or just raw
        }
        setFormData(prev => ({ ...prev, [name]: newValue }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
                margin="normal"
                required
                fullWidth
                label="Nome do Aluno"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                autoFocus
                size="small"
            />
            <TextField
                margin="normal"
                required
                fullWidth
                label="Matrícula"
                name="matricula"
                value={formData.matricula}
                onChange={handleChange}
                size="small"
            />
            <TextField
                margin="normal"
                required
                fullWidth
                label="Turma"
                name="turma"
                value={formData.turma}
                onChange={handleChange}
                size="small"
            />
            <TextField
                select
                margin="normal"
                required
                fullWidth
                label="Turno"
                name="turno"
                value={formData.turno}
                onChange={handleChange}
                size="small"
            >
                {TURNOS.map((option) => (
                    <MenuItem key={option} value={option}>
                        {option}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                select
                margin="normal"
                fullWidth
                label="Situação Especial"
                name="status"
                value={formData.status ?? ""}
                onChange={handleChange}
                size="small"
                helperText="Use apenas para alunos Inativos/Fora da escola"
            >
                <MenuItem value="">
                    <em>Ativo (Nenhum)</em>
                </MenuItem>
                <MenuItem value="Cancelado">Cancelado</MenuItem>
                <MenuItem value="Transferido">Transferido</MenuItem>
                <MenuItem value="Desistente">Desistente</MenuItem>
            </TextField>

            <Divider sx={{ my: 2 }}>Dados Pessoais</Divider>

            <Grid container spacing={2}>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Sexo"
                        name="sexo"
                        value={formData.sexo ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Data de Nascimento"
                        name="data_nascimento"
                        value={formData.data_nascimento ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Naturalidade"
                        name="naturalidade"
                        value={formData.naturalidade ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Endereço"
                        name="endereco"
                        value={formData.endereco ?? ""}
                        onChange={handleChange}
                        size="small"
                        multiline
                        rows={2}
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Zona"
                        name="zona"
                        value={formData.zona ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Telefones"
                        name="telefones"
                        value={formData.telefones ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Email"
                        name="email"
                        value={formData.email ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="CPF"
                        name="cpf"
                        value={formData.cpf ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="NIS"
                        name="nis"
                        value={formData.nis ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="INEP"
                        name="inep"
                        value={formData.inep ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Filiação"
                        name="filiacao"
                        value={formData.filiacao ?? ""}
                        onChange={handleChange}
                        size="small"
                        multiline
                        rows={2}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Situação no Ano Anterior"
                        name="situacao_anterior"
                        value={formData.situacao_anterior ?? ""}
                        onChange={handleChange}
                        size="small"
                    />
                </Grid>
            </Grid>

            <Divider sx={{ my: 2 }}>Contato do Responsável</Divider>

            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                <Typography variant="caption">
                    Preencha os campos abaixo para que as notificações de ocorrências sejam enviadas
                    diretamente ao pai/mãe/responsável, e não ao aluno.
                </Typography>
            </Alert>

            <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="Email do Responsável"
                        name="email_responsavel"
                        type="email"
                        value={formData.email_responsavel ?? ""}
                        onChange={handleChange}
                        size="small"
                        placeholder="email@exemplo.com"
                        helperText="Usado para envio de notificações por e-mail"
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        margin="normal"
                        fullWidth
                        label="WhatsApp do Responsável"
                        name="telefone_responsavel"
                        value={formData.telefone_responsavel ?? ""}
                        onChange={handleChange}
                        size="small"
                        placeholder="(73) 99999-9999"
                        helperText="Número com DDD — usado para envio de WhatsApp"
                    />
                </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                <Button onClick={onCancel}>
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={isLoading}
                >
                    {initialData?.id ? "Salvar Alterações" : "Criar Aluno"}
                </Button>
            </Box>
        </Box>
    );
};
