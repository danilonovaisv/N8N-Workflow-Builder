# Slack Approval Workflow

Workflow n8n para sistema de aprovação interativo via Slack.

## Arquitetura

```
┌──────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Trigger Request │────▶│  Send to Slack    │────▶│ Respond Success │
│  (Webhook POST)  │     │  (with buttons)   │     │                 │
└──────────────────┘     └───────────────────┘     └─────────────────┘

┌──────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ Slack Interaction│────▶│  Parse Payload    │────▶│ Check Decision  │
│    (Webhook)     │     │                   │     │    (IF node)    │
└──────────────────┘     └───────────────────┘     └────────┬────────┘
                                                            │
                                          ┌─────────────────┴─────────────────┐
                                          ▼                                   ▼
                                   ┌──────────────┐                   ┌──────────────┐
                                   │   Aprovado   │                   │  Rejeitado   │
                                   │  (Executa)   │                   │   (Cancela)  │
                                   └──────────────┘                   └──────────────┘
```

## Configuração no Slack

### 1. Criar um Slack App

1. Acesse https://api.slack.com/apps
2. Clique em "Create New App" > "From scratch"
3. Dê um nome e selecione o workspace

### 2. Configurar Incoming Webhook

1. No menu lateral, clique em "Incoming Webhooks"
2. Ative a opção "Activate Incoming Webhooks"
3. Clique em "Add New Webhook to Workspace"
4. Selecione o canal e autorize
5. Copie a URL do webhook (ex: `https://hooks.slack.com/services/XXX/YYY/ZZZ`)

### 3. Configurar Interatividade (Importante!)

1. No menu lateral, clique em "Interactivity & Shortcuts"
2. Ative "Interactivity"
3. Em "Request URL", coloque a URL do seu n8n webhook:
   ```
   https://seu-n8n.com/webhook/slack-interaction
   ```
4. Salve as alterações

## Como Usar

### 1. Iniciar uma Solicitação de Aprovação

Faça um POST para o webhook de início:

```bash
curl -X POST https://seu-n8n.com/webhook/start-approval \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "REQ-001",
    "routine_name": "Backup do Banco de Dados",
    "description": "Executa backup completo do PostgreSQL",
    "requester": "Sistema de Monitoramento"
  }'
```

### 2. Mensagem no Slack

O usuário receberá uma mensagem assim:

```
🔔 Solicitação de Aprovação
───────────────────────────
Rotina: Backup do Banco de Dados
Descrição: Executa backup completo do PostgreSQL
Solicitante: Sistema de Monitoramento
ID: REQ-001

[✅ Aprovar] [❌ Rejeitar]
```

### 3. Resposta do Usuário

Quando o usuário clicar em um botão:
- **Aprovar**: Executa o node "Execute Routine" e atualiza a mensagem
- **Rejeitar**: Executa o node "Handle Rejection" e atualiza a mensagem

## Personalização

### Adicionar Lógica de Execução

No node "Execute Routine", adicione sua lógica:

```javascript
// Exemplo: chamar uma API externa
const response = await $http.request({
  method: 'POST',
  url: 'https://sua-api.com/executar-rotina',
  body: {
    routine_id: $json.request_id
  }
});

return [{
  json: {
    ...$input.first().json,
    execution_result: response,
    execution_status: 'completed'
  }
}];
```

### Adicionar Timeout para Aprovação

Você pode adicionar um workflow separado com timer para expirar aprovações pendentes.

### Notificações Adicionais

Adicione nodes para enviar email ou outras notificações após aprovação/rejeição.

## Uso Programático

```typescript
import { 
  createSlackApprovalWorkflow, 
  createApprovalMessage 
} from './lib/slack/slack-approval-workflow';

// Criar workflow completo
const workflow = createSlackApprovalWorkflow({
  webhookUrl: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
  workflowName: 'Meu Workflow de Aprovação',
  approvalPath: 'minha-aprovacao',
  interactionPath: 'slack-callback',
  timezone: 'America/Sao_Paulo'
});

// Criar mensagem de aprovação para enviar via HTTP
const message = createApprovalMessage({
  request_id: 'REQ-001',
  routine_name: 'Deploy para Produção',
  description: 'Atualização da versão 2.0.0',
  requester: 'CI/CD Pipeline'
});
```

## Webhook URL

Substitua `YOUR_SLACK_WEBHOOK_URL` no workflow pela URL do webhook do seu Slack App:
```
https://hooks.slack.com/services/TXXXXX/BXXXXX/XXXXXXXXXXXXXXX
```

## Troubleshooting

### Botões não funcionam
- Verifique se a "Interactivity" está ativada no Slack App
- Confirme que a Request URL está correta e acessível publicamente

### Mensagem não é atualizada após clique
- O `response_url` do Slack expira após 30 minutos
- Verifique os logs do n8n para erros

### Erro 401 no webhook
- Regenere o webhook URL no Slack App
- Atualize a URL no workflow
