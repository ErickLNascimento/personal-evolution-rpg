# Publicar no Google Play

Caminho: conta de desenvolvedor → teste fechado (12 testers por 14 dias, exigência para conta
pessoal nova) → pedido de acesso à produção → produção. A cobrança (Premium) entra antes da
produção; ver [docs/monetizacao.md](../monetizacao.md).

## 1. Conta de desenvolvedor (você)

Status: **a fazer** (em espera desde 27/11/2026).

### Antes de começar: 3 decisões

**1. Conta pessoal ou de organização?**

| | Pessoal | Organização |
|---|---|---|
| O que precisa | Documento seu (RG ou CNH) | **CNPJ + número D-U-N-S** (pode levar até 30 dias) |
| Teste fechado obrigatório | **Sim: 12 testers por 14 dias seguidos** antes da produção | Não |
| Nome na loja | O que você escolher (ex.: "Ascenda") | Nome da empresa |

Sem CNPJ: **pessoal** (o relógio dos 14 dias começa logo). Com CNPJ: organização evita os 12
testers. Trocar depois não é simples: vira transferência de conta, e os grupos de teste não vão junto.

**2. Qual conta Google:** criar uma conta Gmail só para o app (ex.: `ascenda.app@gmail.com`), com
verificação em duas etapas. Ela é a dona do app; outras pessoas ganham acesso depois pelo Console.

**3. Nome e e-mail públicos:** o nome de desenvolvedor e o e-mail de contato aparecem na loja. Esse
e-mail substitui o `CONTATO_EMAIL` das páginas em `docs/site/` (passo 2).

### Passo a passo

1. Abrir <https://play.google.com/console/signup> com a conta Google escolhida.
2. Escolher **"Você mesmo"** (pessoal) ou **"Uma organização ou empresa"**.
3. Preencher nome de desenvolvedor, e-mail e telefone de contato (verificados por código), dados
   pessoais como no documento e endereço.
4. Responder às perguntas sobre experiência com Android e o tipo de app.
5. Pagar a **taxa única de US$ 25** (cartão).
6. **Verificação de identidade:** foto do documento (às vezes uma selfie). Costuma levar de alguns
   dias a uma semana.
7. **Verificação do aparelho:** instalar o app **Google Play Console** num Android e entrar com a
   mesma conta.

### Enquanto a verificação não sai: juntar os 12 testers

É o passo mais lento. Cada tester precisa:
- ter **conta Google** e um **Android**;
- aceitar o convite, instalar **pela Play** e manter o app instalado **14 dias seguidos**.

Os testers atuais do APK contam (migram para a versão da Play; os dados ficam na conta). Fazer uma
lista com os **e-mails Google** de cada um: é o que o Play Console pede (ou usar um Grupo do Google).

### Quando a conta for aprovada (comigo)

1. Gerar o AAB de produção e testar no Android antes.
2. Preencher os formulários do Console (passo 3 deste guia).
3. Ficha da loja com o nome final ([listing.md](listing.md)), capturas e recurso gráfico.
4. Publicar as páginas de privacidade e exclusão de conta com o e-mail certo (passo 2).

Fontes sobre a regra dos 12 testers:
[ajuda do Play Console](https://support.google.com/googleplay/android-developer/answer/14151465) ·
[Android Authority](https://www.androidauthority.com/google-play-app-testing-requirement-3510580) ·
[guia do Testers Community](https://www.testerscommunity.com/blog/google-play-developer-account-guide).
A regra vale para contas pessoais criadas depois de 13/11/2023; desde dezembro de 2024 são 12
testers (antes eram 20).

## 2. Páginas públicas (política e exclusão de conta)

A Play exige uma URL de política de privacidade e outra para pedir a exclusão de conta. As páginas
estão em `docs/site/`. Antes de publicar, troque `CONTATO_EMAIL` pelo e-mail de suporte que vai
aparecer na loja (pode ser um e-mail só para o app).

Publicar pelo GitHub Pages (o repositório é público):

```bash
gh api -X POST repos/ErickLNascimento/personal-evolution-rpg/pages \
  -f "source[branch]=master" -f "source[path]=/docs"
```

As páginas ficam em:
- <https://ericklnascimento.github.io/personal-evolution-rpg/site/privacidade.html>
- <https://ericklnascimento.github.io/personal-evolution-rpg/site/excluir-conta.html>

## 3. Criar o app no Play Console

**Todos os apps → Criar app**: nome `Personal Evolution RPG`, idioma padrão português (Brasil),
**App**, **Gratuito** (o Premium é compra dentro do app; um app gratuito não pode virar pago depois,
mas pode vender assinaturas).

### Painel → Configurar o app

| Seção | Resposta |
|---|---|
| Política de privacidade | URL de `privacidade.html` |
| Acesso ao app | "Todas ou algumas funcionalidades são restritas": crie uma conta de teste no app e informe e-mail e senha |
| Anúncios | Não, o app não contém anúncios |
| Classificação do conteúdo | Categoria "Utilitários, produtividade…" / sem violência, sem conteúdo sexual; tem interação entre usuários (amigos e grupos, sem chat livre) |
| Público-alvo | 13 anos ou mais (não marque faixas de crianças) |
| App de notícias | Não |
| Apps de saúde | Marque **Saúde e fitness → hábitos/bem-estar** e "diário de humor"; não é dispositivo médico |
| Segurança dos dados | Ver tabela abaixo |
| Apps do governo / Serviços financeiros | Não |
| Exclusão de conta | URL de `excluir-conta.html` |

### Segurança dos dados

Coleta de dados: **Sim**. Todos criptografados em trânsito. O usuário pode pedir exclusão: **Sim**.

| Tipo de dado | Coletado | Compartilhado | Finalidade | Opcional |
|---|---|---|---|---|
| Informações pessoais → E-mail | Sim | Não | Funcionalidade do app, gerenciamento da conta | Não |
| Informações pessoais → Nome | Sim | Não | Funcionalidade do app (nome no social) | Sim |
| Saúde e fitness → Informações de saúde (humor) | Sim | Não | Funcionalidade do app | Sim |
| Atividade no app → Interações no app (hábitos, missões) | Sim | Não | Funcionalidade do app | Não |
| Atividade no app → Outro conteúdo gerado pelo usuário (metas, feedback) | Sim | Não | Funcionalidade do app, análise | Sim |
| Informações e desempenho do app → Registros de falhas, Diagnóstico | Sim | Não | Análise | Não |

Os provedores de IA, o Supabase e o Sentry são **prestadores de serviço**: pelas regras da Play,
isso não conta como "compartilhamento".

### Ficha da loja (Presença na loja → Ficha principal)

Textos prontos em [listing.md](listing.md). Imagens:
- Ícone 512×512 (PNG): `apps/mobile/assets/icon.png` redimensionado.
- Recurso gráfico 1024×500.
- De 2 a 8 capturas de tela do celular (sugestão: Hoje com chefe, Herói/Perfil, Progresso, Fogueira, Desafios).

## 4. Build e envio

O perfil `production` do `eas.json` gera um AAB (formato da Play) no canal de atualizações
`production`. Em `apps/mobile`:

```bash
npx eas-cli@latest build --platform android --profile production
```

O **primeiro AAB precisa ser enviado à mão** (limitação da API do Google): baixe o `.aab` pelo
link do EAS e envie em **Testes → Teste fechado → Criar versão**. A chave de upload é gerenciada
pelo EAS; aceite a "Assinatura de apps do Google Play".

Para as próximas versões, envio automático:
1. Play Console → **Configuração → Acesso à API**: crie uma conta de serviço no Google Cloud com
   acesso de "Liberar apps", baixe a chave JSON.
2. Guarde fora do repositório e cadastre no EAS: `npx eas-cli@latest credentials` → Android →
   Google Service Account.
3. `npx eas-cli@latest submit --platform android --profile production --latest` (vai para o
   teste fechado como rascunho, conforme `eas.json`).

### Atualizações pela Play

Quem instalar pela Play recebe atualizações OTA do canal **production** (não do `preview` dos
testers do APK):

```bash
npx eas-cli@latest update --channel production --message "..."
```

Mudança nativa (pacote novo, plugin) exige build e versão nova na Play.

## 5. Teste fechado (14 dias)

1. **Testes → Teste fechado → Gerenciar faixa → Testadores**: crie uma lista de e-mails (contas
   Google) com pelo menos **12 pessoas**, ou use um Grupo do Google.
2. Envie o link de participação. Cada um precisa aceitar e **instalar pela Play**, e manter o app
   instalado durante 14 dias seguidos.
3. Os testers do APK atual podem migrar: desinstalem o APK e instalem pela Play (o app da Play tem
   outra assinatura, então não instala por cima). Os dados ficam na conta, nada se perde.
4. Depois dos 14 dias, **Painel → Solicitar acesso à produção** (perguntas sobre o teste e o
   feedback recebido). A análise leva até 7 dias.

## 6. Produção

Com o acesso liberado: **Produção → Criar versão** com o mesmo AAB (ou um novo), países (Brasil e
os demais), lançamento gradual de 20% → 100%.
