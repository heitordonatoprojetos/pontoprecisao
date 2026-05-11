# Plano — devX © 2026 - v.1.2.0

## 1. FAB principal e secundários (um pouco maiores)
Em `src/pages/HomePage.tsx` (apenas bloco mobile FAB):
- FAB principal: `h-20 w-20` → `h-24 w-24`; ícone `h-8 w-8` → `h-10 w-10`.
- Botões secundários (Direta / Editar horário): `h-12 w-12` → `h-14 w-14`; ícone `h-6 w-6` → `h-7 w-7`; padding do "pill" `px-5 py-3.5` → `px-6 py-4`; texto `text-sm` (ok).
- Sem mexer no layout desktop (`lg:` permanece intacto).

## 2. Lógica do indicador da última batida (sinal pelo impacto no saldo)
Hoje `lastPunchDelta = actual - expected` e exibe `+` para atrasado (vermelho) / `−` para adiantado (verde). Isso está correto para batidas de **entrada** (atrasar = ruim para saldo), mas **incorreto para batidas de saída**: sair antes do previsto reduz o tempo trabalhado, então deve mostrar `−` (vermelho); sair depois do previsto aumenta o saldo, então `+` (verde).

Nova regra unificada (sinal = impacto no saldo):
- Batida do tipo `in` (entrada/retorno): `delta = expectedMs - actualMs` (chegar antes = +, chegar atrasado = −).
- Batida do tipo `out` (saída): `delta = actualMs - expectedMs` (sair depois = +, sair antes = −).
- Cor: `> 0` verde (`text-success`), `< 0` vermelho (`text-destructive`), `0` neutro (`text-muted-foreground`).
- Formato continua `+N`, `−N`, `±0` (em minutos).

Aplicar em `lastPunchDelta` no `HomePage.tsx` (afeta tanto desktop quanto mobile, pois a variável é compartilhada).

## 3. Transições entre páginas + swipe para trocar de aba (mobile)
- Adicionar wrapper `AnimatedRoutes` em `src/App.tsx` usando `framer-motion` (`AnimatePresence mode="wait"`) ao redor de `<Routes>`, com `location` e `key={location.pathname}`.
- Cada página renderiza dentro de um `motion.div` com `initial/animate/exit` (fade + slide horizontal sutil, ~180ms, `ease-out`). Para evitar tocar em todos os pages, criar um componente `PageTransition` simples e envolver cada `element` na rota.
- Swipe entre abas (apenas mobile, `lg:hidden`): novo hook `useSwipeNavigation` em `src/hooks/useSwipeNavigation.ts` ouvindo `touchstart`/`touchend` no `<main>`/wrapper. Threshold ~60px horizontal, ratio horizontal:vertical > 1.5, ignorar se alvo está em input/select/textarea/`[data-no-swipe]`.
- Ordem das abas (mesma de `BottomNav`): `/ → /diario → /mensal → /banco → /config`. Swipe esquerda avança, direita volta. Direção informa o sentido da animação de saída/entrada.
- Hook ativado no `AppRoutes`. Não interfere no desktop (early return se `window.innerWidth >= 1024`).

## 4. Performance e correções
- Memoizar `dateLabel`/`timeLabel` por minuto: derivar da string `HH:MM` do `now`; já é OK pois `now` muda a cada segundo. Pequena melhoria: comparar string anterior para evitar re-render desnecessário do label de data (apenas quando muda o dia).
- `usePunchesByDate`/`useAllPunches`/`useAdjustments`: adicionar guard `if (!user) return;` antes do `setLoading(false)` (já existe, mas garantir estados).
- `BottomNav`: trocar `transition-colors` por `transition-all` continua leve; sem mudança significativa.
- Lazy-load das rotas pesadas com `React.lazy` + `Suspense` (fallback spinner já existente): `DailyPage`, `MonthlyPage`, `BankPage`, `SettingsPage`. Mantém `HomePage` eager (rota inicial).
- Remover o segundo bloco "Última batida:" duplicado no mobile (`HomePage.tsx` linhas ~309-314) — ele repete a informação já mostrada no chip novo. (Confirmar com usuário antes? — é melhoria de UI consistente com o que ele pediu antes; mantemos para não duplicar info.)

## 5. Versionamento → `devX © 2026 - v.1.2.0`
Atualizar:
- `src/lib/version.ts`: `APP_VERSION = '1.2.0'`, `APP_NAME = 'devX © 2026'`.
- `public/version.json`: `{ "version": "1.2.0" }`.
- Verificar/atualizar referências em `index.html` (title/meta), `public/manifest.json` (name/short_name se contém versão), `README.md` se mencionar versão. Trocar qualquer "HLDEV" remanescente por "devX".
- O `UpdateBanner` já dispara automaticamente via `useVersionCheck` ao detectar nova versão no `version.json` — usuário será notificado.

## Arquivos a editar
- `src/pages/HomePage.tsx` (FAB sizes + lastPunchDelta logic + remover duplicata)
- `src/App.tsx` (AnimatedRoutes + lazy + hook swipe)
- `src/hooks/useSwipeNavigation.ts` (novo)
- `src/components/PageTransition.tsx` (novo)
- `src/lib/version.ts`
- `public/version.json`
- `index.html`, `public/manifest.json`, `README.md` (rename HLDEV → devX onde aplicável)

## Riscos / cuidados
- Swipe não pode interferir com scroll vertical nem com inputs (date/time pickers em BankPage/DailyPage). Threshold + verificação de alvo + `[data-no-swipe]` mitigam.
- Animação de página não deve causar flash em rotas com fetch — usar `mode="wait"` curto (180ms) e fallback de Suspense já existente.
- Nada no layout desktop é alterado.
