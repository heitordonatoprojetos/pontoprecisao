# Ponto Precisão

Aplicativo para controle de batidas de ponto com foco em uso mobile.

## Build Android (APK)

O projeto usa Capacitor para empacotar o app web em Android.

### Fluxo local

1. Instale dependências:
   ```bash
   npm install
   ```
2. Gere o build web:
   ```bash
   npm run build
   ```
3. Sincronize com Android:
   ```bash
   npm run android:sync
   ```
4. Gere APK debug:
   ```bash
   npm run build:apk
   ```

APK gerado em:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Fluxo via GitHub Actions

Há um workflow em `.github/workflows/android-apk.yml` que gera automaticamente o APK (debug) e publica como artifact `app-debug`.


## Instalação do PWA no app

Ao abrir a Home, o app já exibe um card **Instalar aplicativo**.
- Se o navegador expuser o evento de instalação, o botão **Instalar** abre o prompt nativo.
- Se não expuser, o card orienta usar o menu do navegador ("Adicionar à tela inicial").

