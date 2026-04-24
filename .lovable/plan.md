
# Plano Ponto Certo v1.1.2

## 1. Botão de batida manual (HomePage)
- Adicionar segundo botão circular menor ao lado do principal (ícone `Clock`/`Pencil`).
- Ao clicar, abre modal com `<input type="time">` pré-preenchido com hora atual.
- Confirma → usa `addPunch(user.id, ...)` com timestamp construído sobre a data de hoje + hora escolhida; tipo é alternado automaticamente (mesma lógica `nextType`).
- Refresh da lista após inserir.

## 2. Cálculo correto da "Próxima batida" (`useDB.ts`)
Nova função pura `calculateNextExpectedPunch(punches, defaultPunches, today)`:
- Considera **duração de cada intervalo** entre batidas padrão consecutivas (não soma offset acumulado fixo).
- Para o índice `n` da próxima batida:
  - Se não há batidas reais ainda → retorna `defaults[0]`.
  - Senão pega `lastReal = punches[n-1].timestamp`.
  - Calcula `intervalDuration = defaults[n] - defaults[n-1]` (em minutos, mesma data base).
  - **Trabalho** (entrada→saída): `next = lastReal + intervalDuration` (jornada desliza).
  - **Pausa** (saída→entrada): `next = lastReal + intervalDuration` (pausa fixa, não estica nem encolhe — mantém a duração padrão).
  - Em ambos os casos a duração padrão é preservada; o efeito é exatamente o pedido (atrasou 10min na entrada → saída atrasa 10min; atrasou 20min na saída do almoço → volta 20min depois mas almoço continua 1h10).
- Retorna `Date` ou `null` se já bateu todas.
- HomePage passa a usar essa função no badge "Próxima:".

## 3. Banco de horas com dias faltantes (`BankPage.tsx`)
- `buildRows`/`workedBalance` passam a iterar dia-a-dia desde **a data da primeira batida** até hoje.
- Para cada dia:
  - Se dia útil (`settings.workDays`): `expected = dailyHours`. Se sem batidas e sem ajuste → linha de "Falta" com saldo negativo.
  - Se não-útil: `expected = 0`.
  - Soma ajustes daquele dia (matching por `adjustments.date`).
- **Importante**: nada antes da primeira batida entra no cálculo (evita débito histórico falso).
- Botão "Marcar feriado/abono" em linhas vazias → abre modal pequeno com descrição (default "Feriado") → cria `adjustment` com `+dailyHours` naquela data específica (precisa permitir setar `date` no `add`; estendo `useAdjustments.add` para aceitar `date` opcional).
- Migração SQL **não necessária** (`adjustments.date` já é text e pode receber qualquer data).
- PDF/XLSX usam o mesmo `buildRows`, então automaticamente incluem os dias faltantes.
- Tudo envolvido em `useMemo` para performance.

## 4. Botão "Atualizar app" (SettingsPage — topo)
- Card no topo com botão `RefreshCw`.
- Ao clicar (com confirm): limpa `localStorage`, `sessionStorage`, `caches.keys()` + `caches.delete`, desregistra service workers, então `location.reload()` com cache-bust.
- Não toca dados do Supabase (eles persistem na nuvem).

## 5. Performance e versão
- `useMemo` em `buildRows` e totals do BankPage.
- `.limit(2000)` em `useAllPunches` e `useAdjustments` por segurança.
- Footer no `SettingsPage`: "Ponto Certo v1.1.2" centralizado, texto pequeno, mute.
- Constante `APP_VERSION = '1.1.2'` em arquivo novo `src/lib/version.ts` para reuso futuro.

## Arquivos a editar
- `src/hooks/useDB.ts` — `calculateNextExpectedPunch`, limits, `add(date?)`.
- `src/pages/HomePage.tsx` — botão manual + modal + uso da nova função.
- `src/pages/BankPage.tsx` — buildRows com dias faltantes, marcar feriado, useMemo.
- `src/pages/SettingsPage.tsx` — botão atualizar app + label de versão.
- `src/lib/version.ts` — novo, exporta APP_VERSION.

## Não será alterado
- Auth, onboarding gate, ajuste de relógio, exportações PDF/XLSX (lógica), InstallPrompt, schema do banco.
