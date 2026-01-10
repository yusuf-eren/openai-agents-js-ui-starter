import { openai } from '@ai-sdk/openai';
import { Agent, tool, setDefaultOpenAIKey } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { z } from 'zod';

const model = aisdk(openai('gpt-4o'));

setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

/* -------------------------
   Mock data
-------------------------- */
const MOCK_PRODUCTS = [
  {
    id: 'p_1',
    title: 'Classic T Shirt',
    price: 19.99,
    currency: 'USD',
    stock: 42,
  },
  { id: 'p_2', title: 'Denim Jeans', price: 59.9, currency: 'USD', stock: 12 },
  { id: 'p_3', title: 'Sneakers', price: 89.0, currency: 'USD', stock: 7 },
];

const MOCK_ORDERS: Record<string, any> = {
  '1001': {
    orderId: '1001',
    status: 'in_transit',
    carrier: 'UPS',
    etaISO: '2026-01-13T12:00:00Z',
    trackingUrl: 'https://tracking.example/UPS/1001',
    items: [{ productId: 'p_2', qty: 1 }],
  },
  '1002': {
    orderId: '1002',
    status: 'delivered',
    carrier: 'DHL',
    etaISO: '2026-01-05T12:00:00Z',
    trackingUrl: 'https://tracking.example/DHL/1002',
    items: [{ productId: 'p_1', qty: 2 }],
  },
};

/* -------------------------
   Sales tools
-------------------------- */
const searchProducts = tool({
  name: 'search_products',
  description:
    'Search products by query and optional price range. Returns mock products.',
  parameters: z.object({
    query: z.string().min(1),
    priceMin: z.number().nullable().optional(),
    priceMax: z.number().nullable().optional(),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  async execute({ query, priceMin, priceMax, limit }) {
    const q = query.toLowerCase();
    const filtered = MOCK_PRODUCTS.filter((p) => {
      if (!p.title.toLowerCase().includes(q)) return false;
      if (typeof priceMin === 'number' && p.price < priceMin) return false;
      if (typeof priceMax === 'number' && p.price > priceMax) return false;
      return true;
    }).slice(0, limit);

    return {
      results: filtered,
      total: filtered.length,
    };
  },
});

const createDiscountCode = tool({
  name: 'create_discount_code',
  description:
    'Create a discount code (mock). Returns a fake code and summary.',
  parameters: z.object({
    code: z.string().min(3),
    percentOff: z.number().min(1).max(90),
  }),
  async execute({ code, percentOff, minimumPurchase }) {
    return {
      ok: true,
      discount: {
        code: code.toUpperCase(),
        percentOff,
        minimumPurchase: minimumPurchase ?? null,
      },
    };
  },
});

const getOrderStatus = tool({
  name: 'get_order_status',
  description: 'Get order status and tracking info (mock).',
  parameters: z.object({
    orderId: z.string().min(1),
  }),
  async execute({ orderId }) {
    const found = MOCK_ORDERS[orderId];
    if (!found) {
      return {
        found: false,
        orderId,
        message: 'Order not found in mock store.',
      };
    }
    return { found: true, ...found };
  },
});

const createReturnRequest = tool({
  name: 'create_return_request',
  description: 'Create a return request for an order (mock).',
  parameters: z.object({
    orderId: z.string().min(1),
    reason: z.enum(['wrong_size', 'damaged', 'changed_mind', 'other']),
    notes: z.string().nullable().optional(),
  }),
  async execute({ orderId, reason, items, notes }) {
    return {
      ok: true,
      returnId: `r_${Math.random().toString(16).slice(2)}`,
      orderId,
      reason,
      items,
      notes: notes ?? null,
      status: 'created',
    };
  },
});

const createSupportTicket = tool({
  name: 'create_support_ticket',
  description: 'Create a support ticket (mock).',
  parameters: z.object({
    subject: z.string().min(3),
    message: z.string().min(5),
    email: z.string().nullable().optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),
  async execute({ subject, message, email, priority }) {
    return {
      ok: true,
      ticketId: `t_${Date.now()}`,
      subject,
      message,
      email: email ?? null,
      priority,
      status: 'open',
    };
  },
});

/* -------------------------
   Agents
-------------------------- */
const SalesAgent = new Agent({
  name: 'SalesAgent',
  model,
  instructions: `
You are a sales agent.
Use tools when needed:
- search_products for product discovery
- create_discount_code to create promo codes
Be concise and practical.
`,
  handoffDescription: 'This agent specializes in sales and product discovery.E REQUEST.',
  tools: [searchProducts, createDiscountCode],
});

const OrderSupportAgent = new Agent({
  name: 'OrderSupportAgent',
  model,
  instructions: `
You are an order support agent.
Use tools when needed:
- get_order_status for tracking and status
- create_return_request for returns
Ask for orderId if missing.
`,
  tools: [getOrderStatus, createReturnRequest],
});

const SupportAgent = new Agent({
  name: 'SupportAgent',
  model,
  instructions: `
You are a general support agent.
Use create_support_ticket if the user needs follow up or issue tracking.
Keep it short and clear.
`,
  tools: [createSupportTicket],
});

export const RoutingAgent = new Agent({
  name: 'RoutingAgent',
  model,
  instructions: `
Route the user to the best specialist agent.

Rules:
- Sales questions about products, pricing, discounts, purchasing guidance -> SalesAgent
- Order questions: tracking, delivery, refunds, returns, order problems -> OrderSupportAgent
- Anything else -> SupportAgent

Do not answer the user directly.
Always hand off to exactly one agent.
`,
});

RoutingAgent.handoffs = [SalesAgent, OrderSupportAgent, SupportAgent];
SalesAgent.handoffs = [OrderSupportAgent, SupportAgent];
OrderSupportAgent.handoffs = [SupportAgent, SalesAgent];
SupportAgent.handoffs = [SalesAgent, OrderSupportAgent];

/* Example:
console.log(await handleUserMessage("Do you have jeans under $70?"));
console.log(await handleUserMessage("Where is my order 1001?"));
console.log(await handleUserMessage("I want to report a bug on checkout"));
*/
