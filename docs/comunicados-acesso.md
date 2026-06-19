# Comunicados de Acesso por Turma

Este recurso gera um arquivo DOCX por turma com uma carta individual para cada
aluno/responsável, contendo as instruções de acesso ao ColaboraEdu.

## Quem pode gerar

Perfis autorizados:

- `admin`
- `super_admin`
- `coordenador`
- `diretor`
- `orientador`

Professores, alunos e responsáveis não têm permissão para gerar o arquivo.

## Como gerar pelo sistema

1. Acesse o sistema com um perfil autorizado.
2. Abra **Turmas**.
3. Clique em **Gerar comunicados de acesso**.
4. Selecione a turma.
5. Clique em **Baixar DOCX**.

O arquivo baixado terá uma página por aluno/responsável.

## Conteúdo da carta

Cada página informa:

- nome da escola;
- título `Comunicado de Acesso ao ColaboraEdu`;
- explicação breve dos benefícios do sistema;
- nome, matrícula, turma e turno do aluno;
- site de acesso `https://gestao.colaboraedu.cloud/login/aluno`;
- usuário do responsável no formato `resp_<matricula>`;
- senha temporária gerada no momento da emissão;
- aviso de troca obrigatória da senha no primeiro acesso.

## Comportamento de senha

A geração do DOCX redefine a senha temporária dos responsáveis da turma.

Para cada aluno ativo da turma, o sistema:

- cria a conta do responsável se ela ainda não existir;
- reaproveita a conta existente quando já houver `resp_<matricula>`;
- gera uma nova senha temporária;
- atualiza o hash da senha;
- marca `must_change_password=true`;
- ativa a conta.

Se um responsável já tinha senha própria, ela será substituída pela senha impressa
no DOCX. Por isso, o arquivo recém-gerado deve ser o documento entregue às famílias.

## Fluxo de primeiro acesso

1. O responsável acessa `https://gestao.colaboraedu.cloud/login/aluno`.
2. Seleciona a escola.
3. Informa o usuário `resp_<matricula>` e a senha temporária impressa.
4. Define uma nova senha.
5. Após a troca, é redirecionado automaticamente para o portal do responsável.

## API

Endpoint:

```http
GET /api/v1/exports/comunicados-acesso?turma=<turma>
```

Resposta:

- DOCX em anexo;
- auditoria registrada com turma, ano letivo, quantidade de alunos e usuário emissor.

## Validações realizadas

- Geração DOCX com uma página por aluno.
- Criação de responsável inexistente.
- Reset de senha de responsável existente.
- `must_change_password=true` após emissão.
- Redirecionamento do responsável para o portal após trocar senha.
- Bloqueio do endpoint para perfis não autorizados via RBAC.
