// Custom on purpose: the chat runs inside the Worker, so in-process
// AI SDK mocks can't reach it — this speaks the OpenAI-compatible wire format
// (`@ai-sdk/openai-compatible` POSTs `<baseURL>/chat/completions`, reads SSE
// `data:` chunks, and stops at `data: [DONE]`).
//
// Test-only: streams a fixed reply; never a real model. Started by Playwright's
// webServer array on a fixed port (see playwright.config.ts).
import { createServer } from "node:http";

const PORT = 8799;
const MODEL_ID = "e2e-fake-model";
const REPLY = "Hello from the e2e model.";
const USAGE = {
  prompt_tokens: 1,
  completion_tokens: REPLY.split(" ").length,
  total_tokens: REPLY.split(" ").length + 1,
};

// Approval spec contract (approval.spec.ts): a user message
// `e2e-update-product:<exact product name>` emits one update_product call.
// The follow-up request, which carries the tool result, gets APPROVAL_REPLY.
// Every other prompt stays the fixed hello reply. Price is minor units.
const APPROVAL_MARKER = "e2e-update-product:";
const APPROVAL_REPLY = "Updated the product.";
const APPROVAL_PRICE = 4242;

function textOf(message) {
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part === "object" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("");
}

function approvalProductName(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role !== "user") {
      continue;
    }
    const text = textOf(list[i]);
    const at = text.lastIndexOf(APPROVAL_MARKER);
    if (at === -1) {
      return null;
    }
    const name = text.slice(at + APPROVAL_MARKER.length).trim();
    return name || null;
  }
  return null;
}

function hasToolResult(messages) {
  return (
    Array.isArray(messages) &&
    messages.some((message) => message?.role === "tool")
  );
}

function sseChunk(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function usageFor(reply) {
  const completionTokens = reply.split(" ").length;
  return {
    prompt_tokens: 1,
    completion_tokens: completionTokens,
    total_tokens: completionTokens + 1,
  };
}

function streamWords(res, { id, created, reply, usage }) {
  const words = reply.split(" ");
  const sendWord = (index) => {
    const isLast = index === words.length;
    const delta = isLast ? {} : { content: `${words[index]} ` };
    sseChunk(res, {
      id,
      object: "chat.completion.chunk",
      created,
      model: MODEL_ID,
      choices: [
        {
          index: 0,
          delta,
          finish_reason: isLast ? "stop" : null,
        },
      ],
    });
    if (isLast) {
      // OpenAI-style trailing usage chunk (empty choices), then [DONE].
      sseChunk(res, {
        id,
        object: "chat.completion.chunk",
        created,
        model: MODEL_ID,
        choices: [],
        usage,
      });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    setTimeout(() => sendWord(index + 1), 20);
  };
  sendWord(0);
}

function streamToolCall(res, { id, created, productName }) {
  const argumentsJson = JSON.stringify({
    id: productName,
    data: { price: APPROVAL_PRICE },
  });
  sseChunk(res, {
    id,
    object: "chat.completion.chunk",
    created,
    model: MODEL_ID,
    choices: [
      {
        index: 0,
        delta: {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: "call_e2e_update",
              type: "function",
              function: {
                name: "update_product",
                arguments: argumentsJson,
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  });
  sseChunk(res, {
    id,
    object: "chat.completion.chunk",
    created,
    model: MODEL_ID,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "tool_calls",
      },
    ],
  });
  sseChunk(res, {
    id,
    object: "chat.completion.chunk",
    created,
    model: MODEL_ID,
    choices: [],
    usage: usageFor(argumentsJson),
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

function jsonCompletion(res, { id, created, reply, toolCall }) {
  res.writeHead(200, { "Content-Type": "application/json" });
  const message = toolCall
    ? {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_e2e_update",
            type: "function",
            function: {
              name: "update_product",
              arguments: JSON.stringify({
                id: toolCall,
                data: { price: APPROVAL_PRICE },
              }),
            },
          },
        ],
      }
    : { role: "assistant", content: reply };
  res.end(
    JSON.stringify({
      id,
      object: "chat.completion",
      created,
      model: MODEL_ID,
      choices: [
        {
          index: 0,
          message,
          finish_reason: toolCall ? "tool_calls" : "stop",
        },
      ],
      usage: usageFor(reply ?? toolCall ?? ""),
    })
  );
}

function handleChatCompletions(_req, res, body) {
  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-e2e-${created}`;
  const productName = approvalProductName(body?.messages);
  const toolDone = hasToolResult(body?.messages);
  const reply = toolDone ? APPROVAL_REPLY : REPLY;

  if (body?.stream === true) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    if (productName && !toolDone) {
      streamToolCall(res, { id, created, productName });
      return;
    }
    streamWords(res, {
      id,
      created,
      reply,
      usage: reply === REPLY ? USAGE : usageFor(reply),
    });
    return;
  }

  // Non-streaming fallback (e.g. side inference like compaction summarization).
  jsonCompletion(res, {
    id,
    created,
    reply,
    toolCall: productName && !toolDone ? productName : null,
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "invalid JSON body" } }));
        return;
      }
      handleChatCompletions(req, res, body);
    });
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: { message: `no route: ${req.method} ${url.pathname}` },
    })
  );
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-model] listening on http://127.0.0.1:${PORT}/v1`);
});
