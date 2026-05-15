/**
 * Slack Approval Workflow Generator
 * Creates n8n workflows for interactive Slack approval flows
 */

import type { IWorkflowData, INode, IConnections } from "../n8n-schema/workflow-schema"

export interface SlackApprovalConfig {
  webhookUrl: string
  workflowName?: string
  approvalPath?: string
  interactionPath?: string
  timezone?: string
}

export interface ApprovalRequest {
  request_id: string
  routine_name: string
  description?: string
  requester?: string
  metadata?: Record<string, any>
}

/**
 * Generates a complete n8n workflow for Slack approval flows
 */
export function createSlackApprovalWorkflow(config: SlackApprovalConfig): IWorkflowData {
  const {
    webhookUrl,
    workflowName = "Slack Approval Workflow",
    approvalPath = "start-approval",
    interactionPath = "slack-interaction",
    timezone = "America/Sao_Paulo",
  } = config

  const nodes: INode[] = [
    {
      id: "trigger-approval",
      name: "Start Approval Request",
      type: "n8n-nodes-base.webhook",
      position: [250, 300],
      typeVersion: 1,
      parameters: {
        httpMethod: "POST",
        path: approvalPath,
        responseMode: "responseNode",
        options: {},
      },
    },
    {
      id: "send-slack-message",
      name: "Send Slack Approval Request",
      type: "n8n-nodes-base.httpRequest",
      position: [500, 300],
      typeVersion: 4,
      parameters: {
        url: webhookUrl,
        method: "POST",
        sendBody: true,
        specifyBody: "json",
        jsonBody: createSlackMessageBody(),
        options: {},
      },
    },
    {
      id: "respond-approval-sent",
      name: "Respond Approval Sent",
      type: "n8n-nodes-base.respondToWebhook",
      position: [750, 300],
      typeVersion: 1,
      parameters: {
        respondWith: "json",
        responseBody:
          '={{ { "success": true, "message": "Approval request sent", "request_id": $json.request_id } }}',
      },
    },
    {
      id: "slack-interaction-webhook",
      name: "Slack Interaction Webhook",
      type: "n8n-nodes-base.webhook",
      position: [250, 550],
      typeVersion: 1,
      parameters: {
        httpMethod: "POST",
        path: interactionPath,
        responseMode: "responseNode",
        options: {},
      },
    },
    {
      id: "parse-slack-payload",
      name: "Parse Slack Payload",
      type: "n8n-nodes-base.code",
      position: [500, 550],
      typeVersion: 2,
      parameters: {
        jsCode: createParsePayloadCode(),
      },
    },
    {
      id: "check-approval",
      name: "Check Approval Decision",
      type: "n8n-nodes-base.if",
      position: [750, 550],
      typeVersion: 1,
      parameters: {
        conditions: {
          boolean: [
            {
              value1: "={{ $json.approved }}",
              value2: true,
            },
          ],
        },
      },
    },
    {
      id: "execute-routine",
      name: "Execute Routine",
      type: "n8n-nodes-base.code",
      position: [1000, 450],
      typeVersion: 2,
      parameters: {
        jsCode: createExecuteRoutineCode(),
      },
    },
    {
      id: "update-slack-approved",
      name: "Update Slack - Approved",
      type: "n8n-nodes-base.httpRequest",
      position: [1250, 450],
      typeVersion: 4,
      parameters: {
        url: "={{ $json.response_url }}",
        method: "POST",
        sendBody: true,
        specifyBody: "json",
        jsonBody: createApprovedMessageBody(),
        options: {},
      },
    },
    {
      id: "handle-rejection",
      name: "Handle Rejection",
      type: "n8n-nodes-base.code",
      position: [1000, 650],
      typeVersion: 2,
      parameters: {
        jsCode: createHandleRejectionCode(),
      },
    },
    {
      id: "update-slack-rejected",
      name: "Update Slack - Rejected",
      type: "n8n-nodes-base.httpRequest",
      position: [1250, 650],
      typeVersion: 4,
      parameters: {
        url: "={{ $json.response_url }}",
        method: "POST",
        sendBody: true,
        specifyBody: "json",
        jsonBody: createRejectedMessageBody(),
        options: {},
      },
    },
    {
      id: "respond-to-slack",
      name: "Respond to Slack",
      type: "n8n-nodes-base.respondToWebhook",
      position: [1500, 550],
      typeVersion: 1,
      parameters: {
        respondWith: "text",
        responseBody: "",
      },
    },
  ]

  const connections: IConnections = {
    "Start Approval Request": {
      main: [[{ node: "Send Slack Approval Request", type: "main", index: 0 }]],
    },
    "Send Slack Approval Request": {
      main: [[{ node: "Respond Approval Sent", type: "main", index: 0 }]],
    },
    "Slack Interaction Webhook": {
      main: [[{ node: "Parse Slack Payload", type: "main", index: 0 }]],
    },
    "Parse Slack Payload": {
      main: [[{ node: "Check Approval Decision", type: "main", index: 0 }]],
    },
    "Check Approval Decision": {
      main: [
        [{ node: "Execute Routine", type: "main", index: 0 }],
        [{ node: "Handle Rejection", type: "main", index: 0 }],
      ],
    },
    "Execute Routine": {
      main: [[{ node: "Update Slack - Approved", type: "main", index: 0 }]],
    },
    "Handle Rejection": {
      main: [[{ node: "Update Slack - Rejected", type: "main", index: 0 }]],
    },
    "Update Slack - Approved": {
      main: [[{ node: "Respond to Slack", type: "main", index: 0 }]],
    },
    "Update Slack - Rejected": {
      main: [[{ node: "Respond to Slack", type: "main", index: 0 }]],
    },
  }

  return {
    name: workflowName,
    active: false,
    nodes,
    connections,
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true,
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all",
      executionTimeout: 300,
      timezone,
    },
    tags: ["slack", "approval", "workflow", "interactive"],
  }
}

function createSlackMessageBody(): string {
  return `={{ JSON.stringify({
  "text": "Aprovação necessária para: " + $json.routine_name,
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🔔 Solicitação de Aprovação"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Rotina:* " + $json.routine_name + "\\n*Descrição:* " + ($json.description || "N/A") + "\\n*Solicitante:* " + ($json.requester || "Sistema") + "\\n*ID:* " + $json.request_id
      }
    },
    {
      "type": "actions",
      "block_id": "approval_actions_" + $json.request_id,
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "✅ Aprovar"
          },
          "style": "primary",
          "action_id": "approve_routine",
          "value": $json.request_id
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "❌ Rejeitar"
          },
          "style": "danger",
          "action_id": "reject_routine",
          "value": $json.request_id
        }
      ]
    }
  ]
}) }}`
}

function createParsePayloadCode(): string {
  return `// Parse Slack interaction payload
const payload = JSON.parse($input.first().json.body.payload || '{}');

const action = payload.actions?.[0] || {};
const user = payload.user || {};
const message = payload.message || {};

return [{
  json: {
    action_id: action.action_id,
    request_id: action.value,
    user_id: user.id,
    user_name: user.name,
    approved: action.action_id === 'approve_routine',
    response_url: payload.response_url,
    original_message: message,
    timestamp: new Date().toISOString()
  }
}];`
}

function createExecuteRoutineCode(): string {
  return `// Execute the approved routine
const requestId = $input.first().json.request_id;
const userName = $input.first().json.user_name;

// Add your routine execution logic here
console.log(\`Routine \${requestId} approved by \${userName}\`);

return [{
  json: {
    ...$input.first().json,
    execution_status: 'completed',
    executed_at: new Date().toISOString()
  }
}];`
}

function createHandleRejectionCode(): string {
  return `// Log the rejection
const requestId = $input.first().json.request_id;
const userName = $input.first().json.user_name;

console.log(\`Routine \${requestId} rejected by \${userName}\`);

return [{
  json: {
    ...$input.first().json,
    rejection_status: 'rejected',
    rejected_at: new Date().toISOString()
  }
}];`
}

function createApprovedMessageBody(): string {
  return `={{ JSON.stringify({
  "replace_original": true,
  "text": "✅ Rotina aprovada e executada",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "✅ *Rotina Aprovada*\\n\\n*ID:* " + $json.request_id + "\\n*Aprovado por:* " + $json.user_name + "\\n*Data:* " + $json.executed_at
      }
    }
  ]
}) }}`
}

function createRejectedMessageBody(): string {
  return `={{ JSON.stringify({
  "replace_original": true,
  "text": "❌ Rotina rejeitada",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "❌ *Rotina Rejeitada*\\n\\n*ID:* " + $json.request_id + "\\n*Rejeitado por:* " + $json.user_name + "\\n*Data:* " + $json.rejected_at
      }
    }
  ]
}) }}`
}

/**
 * Creates a simple Slack message for sending approval requests via HTTP
 */
export function createApprovalMessage(request: ApprovalRequest): object {
  return {
    text: `Aprovação necessária para: ${request.routine_name}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔔 Solicitação de Aprovação",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Rotina:* ${request.routine_name}\n*Descrição:* ${request.description || "N/A"}\n*Solicitante:* ${request.requester || "Sistema"}\n*ID:* ${request.request_id}`,
        },
      },
      {
        type: "actions",
        block_id: `approval_actions_${request.request_id}`,
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Aprovar",
            },
            style: "primary",
            action_id: "approve_routine",
            value: request.request_id,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ Rejeitar",
            },
            style: "danger",
            action_id: "reject_routine",
            value: request.request_id,
          },
        ],
      },
    ],
  }
}
