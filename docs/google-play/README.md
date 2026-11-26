# Publicar no Google Play

Caminho: conta de desenvolvedor → teste fechado (12 testers por 14 dias, exigência para conta
pessoal nova) → pedido de acesso à produção → produção. A cobrança (Premium) entra antes da
produção; ver [docs/monetizacao.md](../monetizacao.md).

## 1. Conta de desenvolvedor (você)

1. Abra <https://play.google.com/console/signup> com a conta Google que vai ser dona do app.
2. Escolha **Pessoal** (ou **Organização**, se tiver CNPJ e número D-U-N-S: sem a regra dos 12 testers).
3. Pague a taxa única de US$ 25 e envie o documento para a verificação de identidade (leva de 1 a 3 dias).
4. Confirme um celular Android no app Play Console (a verificação pede).

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
