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

function sseChunk(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function handleChatCompletions(_req, res, body) {
  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-e2e-${created}`;

  if (body?.stream === true) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const words = REPLY.split(" ");
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
          usage: USAGE,
        });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      setTimeout(() => sendWord(index + 1), 20);
    };
    sendWord(0);
    return;
  }

  // Non-streaming fallback (e.g. side inference like compaction summarization).
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      id,
      object: "chat.completion",
      created,
      model: MODEL_ID,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: REPLY },
          finish_reason: "stop",
        },
      ],
      usage: USAGE,
    })
  );
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
