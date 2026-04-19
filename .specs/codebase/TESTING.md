# Testing

## Framework & Commands

| Type | Framework | Command | When to use |
|---|---|---|---|
| Unit | Vitest + React Testing Library | `npm run test:unit` | Funcoes puras, utilitarios, validacoes, componentes com logica local e comportamento isolado |
| Integration | Vitest + Postgres de teste + Prisma | `npm run test:integration` | API routes, middleware, auth helpers, queries Prisma e fluxos server-side com DB real |
| E2E | Playwright | `npm run test:e2e` | Fluxos completos no browser, navegacao protegida, sign-in/sign-up, roundtrips principais |

**Quick gate** (roda em segundos, usado no PR): `npm run lint && npm run test:unit`
**Full gate** (roda tudo, usado antes de merge): `npm run lint && npm run test:unit && npm run test:integration && npm run test:e2e`

---

## Test Coverage Matrix

| Code Layer | Test Type | Notes |
|---|---|---|
| API routes (`app/api/**`) | Integration | Validar status codes, auth, parsing, ownership e efeitos reais no banco |
| Server actions | Integration | Testar no boundary do servidor; usar unit so quando houver logica pura extraida |
| React components (`app/**/*.tsx`) | Unit + E2E | Unit para estados locais e renderizacao condicional; E2E para fluxos reais e navegacao |
| Utility functions (`lib/**`) | Unit | Cobertura alta para helpers puros, serializers, formatadores, schemas e guards |
| `lib/auth.ts` especificamente | Integration | Wrapper de sessao — testado indiretamente via API routes; unit so para logica pura extraida |
| Prisma queries / DB access | Integration | Rodar contra Postgres real de teste; evitar mocks de Prisma como estrategia principal |
| Auth flows (sign-in, sign-up) | E2E + Integration | E2E cobre fluxo do usuario; integration cobre register route, session lookup e `GET /api/me` |
| Middleware | Integration + E2E | Integration para matcher/redirecionamento; E2E para confirmar comportamento real entre rotas |

---

## Parallelism Assessment

| Test Type | Parallel-Safe | Reason |
|---|---|---|
| Unit | Yes | Nao dependem de recursos compartilhados; devem rodar totalmente em paralelo |
| Integration | No | Compartilham banco e estado de infraestrutura; rodar em serie ou com isolamento forte por suite |
| E2E | No | Compartilham app, sessao e banco; paralelismo so depois de isolar dados e usuarios por worker |

---

## Test Environment

- **Local**: Next.js local + Postgres via Docker Compose na porta `5433`; testes de integration e E2E usam banco dedicado de teste (`schemr_test`), separado do banco de desenvolvimento (`schemr_dev`)
- **CI**: pipeline com Node LTS + servico Postgres; executar migrations antes de integration/E2E; Playwright roda contra app buildada (`next build && next start`)
- **DB isolation**: `DATABASE_URL` exclusivo para testes; reset por suite; dados criados por factories; nao reutilizar banco de desenvolvimento
- **Migrations de teste**: rodam automaticamente via `globalSetup` do Vitest antes das suites de integration — nao e um passo manual

---

## Notes

### Configuracao de runners

- `vitest.config.ts` unico com dois `projects`: `unit` e `integration`
  - `project: unit` — ambiente rapido, sem banco, sem globalSetup
  - `project: integration` — com globalSetup, aponta para `schemr_test`, paralelismo restrito (`singleFork`)
- `test:unit` → `vitest --project unit`
- `test:integration` → `vitest --project integration`
- `test:e2e` → `playwright test` contra app buildada (`next build && next start`)
- `test` → roda tudo

### Convencoes

- Unit tests devem evitar IO real, rede real e banco real
- Integration tests devem preferir recursos reais do sistema em vez de mocks pesados
- E2E deve cobrir apenas jornadas criticas; nao usar E2E para substituir unit/integration
- Cada bug corrigido em auth, API ou persistencia deve gerar pelo menos um teste no nivel mais barato que capture a regressao

### Dados de teste

- Usar factories para `User` e `Diagram`
- Evitar fixtures grandes e opacas
- Seed global so para dados realmente compartilhados e estaveis
