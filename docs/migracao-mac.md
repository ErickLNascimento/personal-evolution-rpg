# Migração do desenvolvimento para o Mac

Passo a passo para continuar o projeto num MacBook. O código vem do GitHub (repositório privado);
os segredos e as ferramentas são configurados à mão, uma vez.

## 1. Ferramentas

Instale o [Homebrew](https://brew.sh) e depois:

```bash
brew install node@22 git gh watchman python
brew install --cask docker              # testes SQL (scripts/db-test.sh)
npm install -g supabase                 # ou: brew install supabase/tap/supabase
```

- **Node:** o projeto pede Node 22 ou mais novo (`.nvmrc`).
- **iOS:** instale o **Xcode** pela App Store, abra uma vez para aceitar a licença e instalar os
  componentes, e rode `xcode-select --install`. O CocoaPods é instalado pelo Expo quando precisar.
- **Android (opcional):** Android Studio com o SDK. No Mac não precisa das variáveis
  `ANDROID_CMAKE_DIR` e `CMAKE_POLICY_VERSION_MINIMUM`: elas resolviam limites do Windows.
- **Sprites (opcional):** `python3 -m pip install Pillow brotli` para os geradores em `tools/sprites`.

## 2. Código

```bash
gh auth login                           # conta ErickLNascimento
gh repo clone ErickLNascimento/personal-evolution-rpg ~/Dev/LifeRpg
cd ~/Dev/LifeRpg
git switch evolucao-do-heroi            # branch de trabalho atual
npm install                             # também copia o canvaskit.wasm do Skia para o web
```

## 3. Segredos e contas

O arquivo `apps/mobile/.env.local` não vai para o git. Duas formas de recriar:

- **Copiar do Windows** (AirDrop ou pendrive): `C:\Dev\LifeRpg\apps\mobile\.env.local` para
  `~/Dev/LifeRpg/apps/mobile/.env.local`.
- **Baixar do EAS**, onde as mesmas variáveis já estão:
  ```bash
  cd apps/mobile
  npx eas-cli@latest login
  npx eas-cli@latest env:pull --environment preview
  ```

Depois, entre nas contas usadas pelo projeto:

```bash
npx eas-cli@latest login                # builds e atualizações (projeto já vinculado no app.json)
npx supabase login
npx supabase link --project-ref <ref do projeto>   # Supabase → Project Settings → General
```

O token do Sentry (`SENTRY_AUTH_TOKEN`) fica no EAS e só é usado nos builds da nuvem. Em builds
locais, desligue o envio dos mapas de código:

```bash
echo 'export SENTRY_DISABLE_AUTO_UPLOAD=true' >> ~/.zshrc
```

## 4. Conferir que está tudo certo

```bash
npm run check          # typecheck, lint e testes do domínio
npm run test:db        # testes SQL no Docker (abra o Docker Desktop antes)
```

## 5. Rodar o app

```bash
cd apps/mobile
npx expo start         # Expo Go no celular (QR code) ou no simulador (tecla i)
npx expo run:ios       # build de desenvolvimento no simulador do iPhone (gera apps/mobile/ios)
npx expo run:android   # idem no Android, com o emulador aberto
```

- O `npx expo run:ios` compila o app com todos os módulos nativos (Sentry, atualizações), ao
  contrário do Expo Go. A pasta `ios/` é gerada e fica fora do git.
- Builds de nuvem e atualizações continuam iguais: `npx eas-cli@latest build` e
  `npx eas-cli@latest update --channel preview --environment preview`.

### No seu iPhone, com o Apple ID grátis

Sem a conta paga, dá para instalar pelo cabo com o **Personal Team** do Xcode:

```bash
cd apps/mobile
npx expo run:ios --device              # escolha o iPhone conectado
```

- No Xcode (`ios/PersonalEvolutionRPG.xcworkspace` → Signing & Capabilities), escolha o seu
  Personal Team. No iPhone: Ajustes → Geral → VPN e Gerenciamento de Dispositivo → confiar no
  desenvolvedor.
- O Personal Team não aceita a capability **Push Notifications**. O plugin
  `plugins/withoutPushEntitlement` a remove nos builds locais (os lembretes são notificações
  locais e continuam funcionando); builds do EAS (`EAS_BUILD`) mantêm.
- O app instalado assim expira em 7 dias; rode o comando de novo para renovar.

## 6. App para iPhone de verdade (TestFlight)

Precisa de uma conta **Apple Developer** (US$ 99 por ano). Com ela:

```bash
cd apps/mobile
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

O EAS cria certificados e perfis de provisionamento na primeira vez.

## 7. O que fica no Windows

- A pasta `.idea/` (configuração do editor), que não está no git.
- `apps/mobile/android/`, gerada pelo Expo. No Mac ela é recriada pelo `npx expo prebuild` ou
  pelo `npx expo run:android`.
- As variáveis de ambiente do Windows (`ANDROID_CMAKE_DIR`, `CMAKE_POLICY_VERSION_MINIMUM`,
  `SENTRY_DISABLE_AUTO_UPLOAD`) e o plugin `withLocalCmake`, que no Mac não faz nada.
