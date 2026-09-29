# Orientações para agentes no Estuda

Estuda é uma aplicação educacional em Next.js. Mantenha o código compreensível para um estudante de computação que está aprendendo com apoio de IA.

Antes de alterar o código, leia `README.md` e `docs/architecture.md`. Preserve estas regras, salvo decisão explícita do responsável pelo projeto:

- uma missão concede 25 XP e 10 moedas somente na primeira conclusão;
- reabrir, concluir novamente ou excluir uma missão nunca concede o prêmio outra vez;
- gastar moedas nunca altera XP ou nível;
- o timer registra foco, mas nunca comprova estudo nem concede XP;
- dados do teste local e contas Supabase permanecem separados;
- dados antigos do navegador só são importados após confirmação explícita.

Use `npm run dev:local` para desenvolvimento normal sem Supabase. Não exponha o servidor local por túnel ou proxy. Não adicione um bypass de autenticação em produção.

Execute `npm test`, `npm run check` e `npm run build` antes de entregar uma mudança. Diga claramente quando o comportamento Supabase foi apenas simulado ou testado em PostgreSQL isolado, sem um projeto real.

Prefira mudanças pequenas e legíveis. `components/study-app.jsx` é grande: extraia partes coesas quando uma funcionalidade as tocar naturalmente; evite uma reescrita ampla apenas para reorganizar arquivos.
