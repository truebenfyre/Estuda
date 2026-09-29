# Arquitetura

## Caminhos de execução

A aplicação tem dois caminhos de dados por trás da mesma interface:

1. `components/router-app.jsx` escolhe o transporte a partir da conta verificada.
2. `components/study-app.jsx` renderiza a estrutura, as telas e os formulários.
3. `lib/model.js` valida o estado e aplica todas as transições de domínio.
4. A API escolhida recarrega o estado salvo, aplica a transição no servidor e retorna a nova revisão.

O teste local usa `app/api/local/*`, uma sessão assinada em cookie HttpOnly e `.local/student-state.json`. Ele só é habilitado por `scripts/local-server.mjs`, limitado ao loopback e indisponível na Vercel.

Contas reais usam cookies Supabase SSR, `app/api/state/route.ts` e `student_states`. A migração versionada habilita RLS para que cada usuário autenticado leia e altere apenas sua própria linha. O navegador nunca escolhe o identificador do usuário.

## Áreas principais

- `app/`: rotas Next.js, ações e callback de autenticação e APIs.
- `components/study-app.jsx`: interface atual e coordenação do cliente.
- `lib/model.js`: modelo versionado, validação, cálculos e regras de negócio.
- `lib/cloud.js`: transportes do cliente para as APIs local e Supabase.
- `lib/supabase/server.ts`: cliente Supabase no servidor e busca da conta verificada.
- `proxy.ts`: renovação de sessão e proteção das rotas privadas.
- `supabase/migrations/`: esquema reproduzível do banco e políticas RLS.
- `tests/`: testes de domínio, interface, sessão local e RLS em PostgreSQL isolado.
- `design/approved-reference.html`: referência visual preservada, fora do código executado pela aplicação.

## Estado e concorrência

Todo o estado do estudante é um documento JSON versionado. Cada cópia salva possui uma revisão numérica. Uma gravação envia a última revisão conhecida e falha com conflito se outra aba ou dispositivo tiver gravado antes. Os históricos de prêmios e resgates são registros imutáveis usados para impedir prêmios duplicados e preservar valores passados.

## Limites conhecidos

- Supabase está preparado, mas ainda não foi verificado com um projeto real.
- O modo local é um único perfil de teste compartilhado pelos navegadores do computador.
- `components/study-app.jsx` e `app/globals.css` são grandes; divida-os gradualmente quando uma mudança relacionada justificar a extração.
- Agendamento por data, sugestões prontas de missões, recursos sociais, ranking e IA estão fora do escopo atual.
