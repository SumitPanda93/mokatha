// Client-side helpers for Stripe Checkout flows

const API_BASE = "/api";

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Payment failed");
  }
  return res.json();
}

/** Redirects browser to Stripe Checkout for a creator tip */
export async function startTipCheckout(opts: {
  payerId: string;
  recipientId: string;
  priceId: string;
  postId?: string;
  successPath?: string;
  cancelPath?: string;
}) {
  const { url } = await post("/payments/tip", opts);
  window.location.href = url;
}

/** Redirects browser to Stripe Checkout to unlock a story */
export async function startUnlockCheckout(opts: {
  payerId: string;
  recipientId: string;
  postId: string;
  priceId: string;
  successPath?: string;
  cancelPath?: string;
}) {
  const { url } = await post("/payments/unlock", opts);
  window.location.href = url;
}

/** Redirects browser to Stripe Checkout for a premium Mehfil ticket */
export async function startMehfilTicketCheckout(opts: {
  payerId: string;
  recipientId: string;
  mehfilId: string;
  priceId: string;
  successPath?: string;
  cancelPath?: string;
}) {
  const { url } = await post("/payments/mehfil-ticket", opts);
  window.location.href = url;
}

/** Fetch creator earnings summary */
export async function fetchEarnings(userId: string) {
  const res = await fetch(`${API_BASE}/payments/earnings/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch earnings");
  return res.json() as Promise<{
    available: number;
    pending: number;
    tips: number;
    unlocks: number;
    mehfil: number;
    withdrawn: number;
    recentTransactions: any[];
  }>;
}

/** Submit a withdrawal request */
export async function requestWithdrawal(userId: string, amount: number, method: string) {
  return post("/payments/withdraw", { userId, amount, method });
}

/** Fetch all Stripe products with their prices */
export async function fetchStripeProducts() {
  const res = await fetch(`${API_BASE}/payments/products`);
  if (!res.ok) throw new Error("Failed to fetch products");
  const { data } = await res.json();
  return data as Array<{
    id: string;
    name: string;
    description: string;
    metadata: Record<string, string>;
    prices: Array<{ id: string; unit_amount: number; currency: string }>;
  }>;
}
