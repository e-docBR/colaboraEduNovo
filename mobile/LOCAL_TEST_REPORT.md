# Relatorio Local — App Android Familia

Data: 2026-06-22

## Escopo

Validacao local do app Android ColaboraEdu Familia antes de qualquer envio para
producao ou Play Store. Nenhum deploy de producao foi executado nesta etapa.

## Ambiente usado

- Projeto: `mobile/`
- Expo SDK: `54.0.0`
- Android package: `cloud.colaboraedu.familia`
- API local usada no export: `http://10.0.2.2:5000/api/v1`
- Tenant local usado no export: `colegio-frei-ronaldo`

## Correcoes aplicadas

- Fixada a arvore de dependencias do React Native em `0.81.5`.
- Fixado `@react-native/virtualized-lists` em `0.81.5`.
- Removida a instalacao transiente de React Native `0.86.0`, que fazia o
  `expo export --platform android` falhar em `VirtualViewNativeComponent.js`.
- Aplicado `npm audit fix` sem `--force`, corrigindo a vulnerabilidade alta de
  `undici`.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `npm ls react-native --prefix mobile` | OK: somente `react-native@0.81.5` |
| `make validate-mobile` | OK |
| `npm run lint --prefix mobile` | OK |
| `npx expo config --type public` | OK |
| `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1 EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo npx expo export --platform android --output-dir /tmp/colaboraedu-mobile-export` | OK |
| `npm audit --audit-level=moderate --prefix mobile` | Pendente: 40 moderadas |

## Observacoes do export Android

O export local concluiu e gerou os arquivos em
`/tmp/colaboraedu-mobile-export`. O Expo exibiu a mensagem
`Something prevented Expo from exiting, forcefully exiting now.`, mas o comando
retornou codigo `0` e o bundle Android foi gerado.

## Auditoria de dependencias

Depois do `npm audit fix` sem `--force`, a vulnerabilidade alta de `undici` foi
corrigida. Restaram 40 vulnerabilidades moderadas transitivas em pacotes do
ecossistema Expo/React Native.

Nao foi executado `npm audit fix --force`, porque o npm indicou mudancas
quebraveis:

- `js-yaml`: correcao forcada tentaria instalar `react-native@0.86.0`.
- `uuid`: correcao forcada tentaria instalar `expo@46.0.21`.

Essas mudancas quebrariam a versao atual do app e reintroduziriam o erro de
bundle Android. A resolucao segura deve ser feita em uma futura atualizacao
planejada do Expo/React Native, nao por `--force`.

## Proximos passos locais

1. Subir API local ou staging com massa de teste de aluno/responsavel.
2. Rodar o app em emulador ou celular Android com
   `EXPO_PUBLIC_API_URL` apontando para API acessivel pelo aparelho.
3. Executar o roteiro de `QA_TEST_PLAN.md`.
4. Gerar APK interno via EAS somente com URL de staging, nunca localhost.
5. Instalar APK em pelo menos dois aparelhos Android e registrar evidencias.
6. Enviar para producao ou Play Store apenas apos aprovacao explicita.
