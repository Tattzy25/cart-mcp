import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env {
  SHOPIFY_CART_MCP_ENDPOINT: string;
}

type UpstreamBody = {
  error?: string | { message?: string };
  result?: unknown;
};

function createServer(env: Env) {
  const server = new McpServer({
    name: "Cart-MCP",
    version: "1.0.0"
  });

  server.registerTool(
    "create_cart",
    {
      description:
        "Create a new cart with line items and optional buyer context. Use this tool when the buyer has selected products from the Catalog and you want to build a cart before starting checkout. The response includes a cart object with the merchant-assigned id, validated line items, estimated totals, and a continue_url that the buyer can use to pick up the cart on the merchant's storefront.",
      inputSchema: z.object({
        meta: z.any().optional(),
        cart: z.any().optional()
      })
    },
    async (arguments_) => {
      const upstreamResponse = await fetch(env.SHOPIFY_CART_MCP_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "tools/call",
          params: {
            name: "create_cart",
            arguments: arguments_
          }
        })
      });

      const upstreamBody = (await upstreamResponse.json()) as UpstreamBody;

      if (upstreamBody?.error) {
        const errorMessage =
          typeof upstreamBody.error === "string"
            ? upstreamBody.error
            : upstreamBody.error.message ?? JSON.stringify(upstreamBody.error);

        throw new Error(
          errorMessage
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(upstreamBody.result ?? null)
          }
        ],
        structuredContent: upstreamBody.result ?? null
      };
    }
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(() => createServer(env as Env))(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;