# Ponto Certo v1.1.3

Implementação focada e cuidadosa: NÃO alterar lógica já estável (cálculo de jornada, banco de horas, batida deslizante, ajuste de relógio). Mudanças isoladas em arquivos específicos.

## 1. Edição mais abrangente no Diário

Em `src/pages/DailyPage.tsx`:

- No bloco de edição (que hoje só mostra `<input type="time">`), adicionar:
  - Um `<select>` para alterar o **tipo** (`Entrada` / `Saída`) da batida existente.
  - Mantém o input de horário.
  - Botão "Salvar" e "Cancelar".
- Estender `handleEdit` para também enviar o novo tipo. Como `updatePunch(id, timestamp)` em `useDB.ts` só aceita timestamp, vou adicionar um segundo parâmetro opcional:
  ```ts
  export async function updatePunch(id: string, timestamp: number, type?: 'in' | 'out')
  ```
  Se `type` for passado, inclui no `.update({...})`. Sem alterar nenhum chamador existente.

Nada mais é tocado nessa página.

## 2. Notificações sonoras de lembrete (PWA, baixa bateria)

### 2.1 Toggle nas Configurações

Em `src/pages/SettingsPage.tsx`, nova seção "Notificações de batida":
- Switch (ativar/desativar).
- Ao ativar pela 1ª vez: chamar `Notification.requestPermission()`. Se negado, mostra aviso.
- Persistência: salvar `notificationsEnabled: boolean` em `localStorage` (chave `pc:notifications`). É preferência do dispositivo, não da conta — assim cada celular controla o seu.
- Botão "Testar notificação" para o usuário validar som/permissão.

### 2.2 Agendamento "leve em recursos"

Criar `src/lib/punchReminder.ts` com um agendador simples baseado em `setTimeout` (1 timer ativo por vez, recalculado quando batidas/configurações mudam):

```text
calcula próxima batida esperada (mesma função calculateNextExpectedPunch
                                   já usada na HomePage)
       ↓
alvo = próximaBatida - 1 minuto
       ↓
se alvo > agora → agenda 1 setTimeout
       ↓
no disparo: dispara notificação + som,
            depois recalcula
```

Vantagens: zero polling, sem interval rodando, custo praticamente nulo.

### 2.3 Hook `usePunchReminder`

Novo hook chamado uma única vez no `App.tsx` (dentro do `AuthProvider`, só quando há usuário logado):
- Lê `notificationsEnabled` do localStorage.
- Usa `useTodayPunches()` + `useSettings()` para reagir a novas batidas / mudanças de configuração.
- Cancela o timer anterior e agenda o novo sempre que algo muda.
- Limpa o timer no unmount.

### 2.4 Notificação + som

- Notificação: tenta via Service Worker (`registration.showNotification`) para funcionar mesmo com o app em background no PWA. Fallback para `new Notification(...)`.
- Som: pequeno `data:audio/wav;base64,...` curto (beep) tocado via `new Audio(...).play()`. Sem dependência externa, sem arquivo em `public/`.
- Vibração leve (`navigator.vibrate([200, 100, 200])`) para dispositivos móveis.

### 2.5 Suporte offline (Service Worker)

O `vite-plugin-pwa` já gera SW com `autoUpdate`. Para que a notificação dispare mesmo offline, o `setTimeout` é local (JS na aba/PWA aberto). Vamos:
- Documentar para o usuário (texto curto na seção de Configurações): "As notificações funcionam enquanto o app estiver aberto em segundo plano. No iPhone é necessário instalar como PWA."
- Não vamos implementar Push API (exige servidor + assinatura) — fica fora do escopo desta versão.

## 3. Versionamento

Em `src/lib/version.ts`: bump para `1.1.3`. Sem outras alterações.

## Arquivos afetados

- `src/lib/version.ts` — bump
- `src/hooks/useDB.ts` — `updatePunch` ganha 3º parâmetro opcional `type` (mudança retrocompatível)
- `src/pages/DailyPage.tsx` — UI de edição inclui tipo
- `src/pages/SettingsPage.tsx` — seção "Notificações"
- `src/lib/punchReminder.ts` — **novo**: agendador + som + dispatch de notificação
- `src/hooks/usePunchReminder.ts` — **novo**: hook que escuta batidas/configs e reagenda
- `src/App.tsx` — chama o hook (1 linha) dentro da árvore autenticada

## O que NÃO será alterado

- `calculateWorkedMinutes`, `calculatePartialWorked`, `calculateNextExpectedPunch`
- Lógica do `BankPage` (banco de horas, dias faltantes, marcar feriado)
- `HomePage` (botão manual, exibição da próxima batida)
- Auth, Google login, onboarding, ajuste de relógio
- Service worker / PWA config (já está correto)

Posso prosseguir?
