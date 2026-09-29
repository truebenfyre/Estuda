# Estuda

Estuda é um projeto acadêmico em Next.js para organizar missões de estudo, sessões de foco, progresso e recompensas pessoais. A interface funciona em desktop e celular.

A forma mais simples de explorar e desenvolver o projeto não exige uma conta Supabase.

## Começar a desenvolver

Requisitos: Node.js 22 a 26 e npm 10 ou mais recente. Se você usa `nvm`, execute `nvm use` nesta pasta.

```sh
npm ci
npm run dev:local
```

Abra http://127.0.0.1:3210/login e escolha **Entrar no modo local**. Alterações no código recarregam automaticamente. Não é necessário email nem senha.

O progresso local fica em `.local/student-state.json` e permanece depois de sair da conta ou reiniciar o servidor. O segredo da sessão e os dados são ignorados pelo Git. Todos os navegadores do computador usam o mesmo perfil local de teste. Não exponha esse servidor por túnel ou proxy.

Para testar a versão otimizada de produção localmente:

```sh
npm run build
npm run start:local
```

`npm start` e `npm run dev` executam o caminho normal do Supabase e não habilitam a entrada local de teste.

## Verificar uma mudança

```sh
npm test
npm run check
npm run build
```

Os testes cobrem regras de domínio, fluxos da interface, sessões locais assinadas e isolamento RLS em um PostgreSQL embutido. Os testes embutidos não provam que um projeto Supabase real foi configurado corretamente.

## Mapa do projeto

- `app/` contém rotas, ações de autenticação e APIs.
- `components/` contém a estrutura e as telas da aplicação.
- `lib/model.js` concentra o modelo de dados e as regras de estudo.
- `supabase/migrations/` contém o esquema do banco e as políticas RLS.
- `tests/` contém verificações de domínio, fluxo, sessão local e RLS.
- `docs/architecture.md` explica os caminhos dos dados e limites importantes.
- `AGENTS.md` orienta agentes de programação sobre regras e verificações a preservar.

## Conectar contas Supabase

Supabase é o caminho planejado para contas reais, mas o repositório não inclui um projeto configurado nem credenciais.

1. Crie ou selecione o projeto Supabase que pertencerá ao Estuda.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `APP_URL`. Uma chave `service_role` não é necessária nem utilizada.
3. Aplique `supabase/migrations/202609260001_student_states.sql` nesse projeto.
4. Habilite autenticação por email/senha e confirmação de email.
5. Autorize os redirecionamentos para `/auth/callback` e `/auth/callback?next=/recuperar-senha` na origem definida por `APP_URL`.
6. Antes do deploy, configure SMTP, o `APP_URL` HTTPS definitivo e as mesmas variáveis e URLs de redirecionamento na hospedagem.
7. Teste cadastro, confirmação de email, login, recuperação de senha, logout, persistência após recarga e isolamento entre duas contas reais.

A migração guarda um documento JSON versionado por usuário e aplica propriedade com RLS. As rotas de servidor verificam a sessão em vez de confiar em um identificador enviado pelo navegador. Dados antigos do navegador nunca são enviados automaticamente; a importação exige um destino vazio e confirmação explícita.

## Regras atuais do produto

- Uma missão concede 25 XP e 10 moedas na primeira conclusão.
- Reabrir, concluir novamente ou excluir uma missão não concede o prêmio outra vez.
- Cada nível exige 100 XP.
- Resgatar uma recompensa pessoal gasta moedas sem alterar XP ou nível.
- O timer registra sessões de foco, mas não valida o aprendizado nem concede XP.
- Conquistas são derivadas da atividade registrada.

Esses valores são provisórios e podem ser revisados de forma deliberada. Agendamento por data, sugestões prontas de missões, IA, ranking e recursos sociais não estão implementados.

A referência visual aprovada está preservada em `design/approved-reference.html`.
