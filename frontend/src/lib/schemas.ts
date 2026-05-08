import { z } from "zod";

const phoneRegex = /^(\(?\d{2}\)?[\s-]?)?(\d{4,5}[\s-]?\d{4})(\s*[,;/]\s*(\(?\d{2}\)?[\s-]?)?(\d{4,5}[\s-]?\d{4}))*$/;

export const alunoSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  matricula: z.string().min(1, "Matrícula é obrigatória").max(32, "Máximo 32 caracteres"),
  turma: z.string().min(1, "Turma é obrigatória"),
  turno: z.string().min(1, "Turno é obrigatório"),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  email_responsavel: z.string().email("E-mail do responsável inválido").or(z.literal("")).optional(),
  telefones: z.string().regex(phoneRegex, "Telefone inválido (use (DD) XXXXX-XXXX)").or(z.literal("")).optional(),
  telefone_responsavel: z.string().regex(phoneRegex, "Telefone inválido").or(z.literal("")).optional(),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido (use 000.000.000-00)").or(z.literal("")).optional(),
});

export const ocorrenciaSchema = z.object({
  aluno_id: z.number({ required_error: "Selecione um aluno" }).positive("Selecione um aluno"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  gravidade: z.string().min(1, "Gravidade é obrigatória"),
});

export const usuarioSchema = z.object({
  username: z
    .string()
    .min(3, "Usuário deve ter pelo menos 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9_.@-]+$/, "Apenas letras, números, '.', '_', '@' ou '-'"),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  role: z.string().min(1, "Perfil é obrigatório"),
  password: z.string().optional(),
});

export type ZodFieldErrors = Record<string, string>;

export function getFieldErrors(result: z.SafeParseError<unknown>): ZodFieldErrors {
  const errors: ZodFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as string;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
