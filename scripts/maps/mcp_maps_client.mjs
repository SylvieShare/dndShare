// Credentials belong in the environment; neither tokens nor signed URLs are logged.
export async function mapTool(name, args = {}) {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) throw new Error("MCP_AUTH_TOKEN is required");
  const response = await fetch(
    process.env.DNDSHARE_MCP_URL || "https://dndshare.ru/mcp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error || data.result?.isError)
    throw new Error(
      `${name}: ${data.error?.message || data.result.content?.find((c) => c.type === "text")?.text || "MCP request failed"}`,
    );
  if (data.result?.structuredContent)
    return data.result.structuredContent.result;
  const text = data.result?.content?.find((c) => c.type === "text")?.text;
  return text ? JSON.parse(text) : data.result;
}
