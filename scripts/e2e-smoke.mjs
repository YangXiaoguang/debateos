import { createCanvas } from "@napi-rs/canvas";

const base = process.env.APP_URL || "http://127.0.0.1:3000";
const email = process.env.E2E_EMAIL || "admin@debateos.local";
const password = process.env.E2E_PASSWORD || "debateos123";

async function request(path, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(base + path, {
    ...init,
    headers,
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { response, setCookie, json };
}

function readCookie(setCookie) {
  return setCookie
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function assertSuccess(label, payload) {
  if (!payload.response.ok || !payload.json?.success) {
    throw new Error(`${label} failed: ${JSON.stringify(payload.json)}`);
  }
}

function createSimplePdf(text) {
  const stream = `BT\n/F1 18 Tf\n40 90 Td\n(${text.replace(/[()\\]/g, "\\$&")}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 160] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function createOcrSamplePng(text) {
  const canvas = createCanvas(500, 180);
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 500, 180);
  context.fillStyle = "#111827";
  context.font = "bold 32px sans-serif";
  context.fillText(text, 28, 92);
  context.font = "20px sans-serif";
  context.fillText("model governance and debate context", 28, 132);
  return canvas.toBuffer("image/png");
}

async function waitForSessionCompletion(sessionId, cookie) {
  const response = await fetch(`${base}/api/v1/debates/${sessionId}/stream`, {
    headers: { cookie },
  });

  if (!response.ok || !response.body) {
    throw new Error(`stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let combined = "";
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    const chunk = await reader.read();
    if (chunk.done) break;
    combined += decoder.decode(chunk.value, { stream: true });
    if (combined.includes("event: SESSION_COMPLETED")) {
      break;
    }
  }

  try {
    await reader.cancel();
  } catch {}

  return combined;
}

async function main() {
  const signIn = await request("/api/v1/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertSuccess("sign-in", signIn);

  const cookie = readCookie(signIn.setCookie);

  const session = await request("/api/v1/auth/session", {}, cookie);
  assertSuccess("session", session);

  const modelsResult = await request("/api/v1/models", {}, cookie);
  assertSuccess("models", modelsResult);
  const models = modelsResult.json.data;
  const mockModel = models.find((item) => item.transport === "mock") || models[0];
  const usableModel =
    models.find((item) => item.transport !== "mock" && item.credentialStatus !== "missing") || mockModel;

  const modelProbe = await request(`/api/v1/models/${mockModel.id}/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }, cookie);
  assertSuccess("model-test", modelProbe);

  const agentA = await request("/api/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Mock Strategist",
      description: "偏结构化、强调执行路径。",
      modelId: mockModel?.id,
      systemPrompt: "你是一名重视执行和风险约束的结构化辩手。",
      stylePrompt: "结构化、冷静、强调落地",
      stanceTags: ["执行", "风控"],
    }),
  }, cookie);
  assertSuccess("agentA", agentA);

  const agentB = await request("/api/v1/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Visionary Builder",
      description: "偏创新和增长，但要给出收敛路径。",
      modelId: usableModel?.id,
      systemPrompt: "你是一名偏创新增长导向的辩手，但必须给出可执行路径。",
      stylePrompt: "锋利、前瞻、保留约束条件",
      stanceTags: ["创新", "增长"],
    }),
  }, cookie);
  assertSuccess("agentB", agentB);

  const topic = await request("/api/v1/topics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "是否应先建设统一 Agent 模型管理平台",
      description: "团队正在搭建多 Agent 辩论系统，需要决定是先投入模型治理层，还是先扩展功能层。",
      extraContext: "目标是在 6 周内交付一个对外演示版，同时保证后续能扩展多模型。",
      outputRequirements: "请给出胜者、理由、关键分歧与建议动作。",
      maxRounds: 4,
      winnerRule: "hybrid",
    }),
  }, cookie);
  assertSuccess("topic", topic);

  const form = new FormData();
  form.append(
    "files",
    new File(
      [
        "背景材料：\n1. 当前系统已接入 mock provider。\n2. 目标是支持多模型并可由管理员统一配置。\n3. 评估标准包括交付速度、扩展性、维护成本与可解释性。",
      ],
      "context.txt",
      { type: "text/plain" }
    )
  );
  form.append(
    "files",
    new File([createSimplePdf("PDF governance signal")], "brief.pdf", { type: "application/pdf" })
  );
  form.append(
    "files",
    new File([createOcrSamplePng("OCR SIGNAL")], "ocr-signal.png", { type: "image/png" })
  );

  const attachmentResponse = await fetch(`${base}/api/v1/topics/${topic.json.data.id}/attachments`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });
  const attachments = await attachmentResponse.json();
  if (!attachmentResponse.ok || !attachments.success) {
    throw new Error(`attachments failed: ${JSON.stringify(attachments)}`);
  }

  const debate = await request("/api/v1/debates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topicId: topic.json.data.id,
      agentIds: [agentA.json.data.id, agentB.json.data.id],
    }),
  }, cookie);
  assertSuccess("debate", debate);

  const start = await request(`/api/v1/debates/${debate.json.data.id}/start`, { method: "POST" }, cookie);
  assertSuccess("start", start);

  const streamPreview = await waitForSessionCompletion(debate.json.data.id, cookie);

  const result = await request(`/api/v1/debates/${debate.json.data.id}/result`, {}, cookie);
  assertSuccess("result", result);

  const judgeReport = result.json.data.artifacts.find((item) => item.artifactType === "judge_report");

  console.log(
    JSON.stringify(
      {
        viewer: session.json.data,
        modelCount: models.length,
        modelProbe: modelProbe.json.data,
        attachmentCount: attachments.data.length,
        attachmentStatuses: attachments.data.map((item) => ({
          fileName: item.fileName,
          method: item.extractionMethod,
          status: item.extractionStatus,
          hasText: Boolean(item.extractedText),
        })),
        debateId: debate.json.data.id,
        debateStatus: result.json.data.session.status,
        winnerAgentId: result.json.data.session.winnerAgentId,
        scoreBreakdownCount: judgeReport?.content?.score_breakdown?.length ?? 0,
        streamPreview: streamPreview.split("\n").filter(Boolean).slice(0, 16),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
