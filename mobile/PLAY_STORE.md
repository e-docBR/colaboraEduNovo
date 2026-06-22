# Play Store — ColaboraEdu Família

## Identidade

- Nome do app: ColaboraEdu Família
- Pacote Android: `cloud.colaboraedu.familia`
- Público inicial: alunos e responsáveis do Colégio Frei Ronaldo
- Distribuição inicial: teste interno/fechado

## Descrição curta

Acompanhe boletim, faltas, ocorrências e comunicados escolares pelo celular.

## Descrição completa

O ColaboraEdu Família aproxima escola, estudantes e responsáveis. Pelo aplicativo,
alunos e famílias podem consultar boletim escolar, faltas, ocorrências, recados
e informações importantes da vida escolar.

O acesso é individual e protegido por senha. No primeiro acesso, usuários com
senha temporária devem criar uma nova senha.

## Configuração de build

Antes de criar qualquer build remoto, configure a URL pública da API de teste:

```bash
cd mobile
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://sua-api-de-staging/api/v1
```

Para build de teste interno em APK:

```bash
npm run build:android:preview
```

Para gerar AAB de Play Store, configure explicitamente a API autorizada para a
publicação e execute:

```bash
npm run build:android:production
```

## Checklist antes do teste fechado

- Login de aluno com senha temporária.
- Login de responsável com usuário `resp_<matricula>`.
- Troca obrigatória de senha.
- Bloqueio de perfis administrativos.
- Visualização de boletim sem notas.
- Visualização de boletim com notas e faltas.
- Comunicados vazios e com mensagens.
- Ocorrências vazias e com registros.
- Logout.
- Sessão expirada e retorno ao login.
- Teste em pelo menos dois aparelhos Android.

## Materiais necessários para a loja

- Ícone final em alta resolução.
- Screenshots de login, início, boletim, registros e perfil.
- Política de privacidade publicada em URL pública.
- Conta Google Play Console.
- Lista de testadores internos/fechados.
