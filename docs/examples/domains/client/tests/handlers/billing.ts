import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8080";

const PLAN_FIXTURES = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Free",
    slug: "free",
    stripe_price_id: "",
    amount: 0,
    currency: "usd",
    interval: "month" as const,
    features: { basic_access: true },
    limits: { max_members: 3 },
    is_active: true,
    display_order: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Pro",
    slug: "pro",
    stripe_price_id: "price_pro_monthly",
    amount: 2999,
    currency: "usd",
    interval: "month" as const,
    features: { basic_access: true, analytics: true, api_access: true },
    limits: { max_members: 10, max_places: 100 },
    is_active: true,
    display_order: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Enterprise",
    slug: "enterprise",
    stripe_price_id: "price_ent_monthly",
    amount: 9999,
    currency: "usd",
    interval: "month" as const,
    features: {
      basic_access: true,
      analytics: true,
      api_access: true,
      priority_support: true,
    },
    limits: { max_members: 50, max_places: 1000 },
    is_active: true,
    display_order: 2,
  },
];

const SUBSCRIPTION_FIXTURE = {
  id: null,
  team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "free" as const,
  plan: PLAN_FIXTURES[0],
  stripe_subscription_id: null,
  stripe_customer_id: null,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  created_at: null,
  updated_at: null,
};

export const billingHandlers = [
  // GET /billing/plans — list plans
  http.get(`${BASE}/billing/plans`, () => {
    return HttpResponse.json(PLAN_FIXTURES);
  }),

  // GET /billing/subscription/:teamId — get subscription
  http.get(`${BASE}/billing/subscription/:teamId`, ({ params }) => {
    return HttpResponse.json({
      ...SUBSCRIPTION_FIXTURE,
      team_id: params.teamId,
    });
  }),

  // POST /billing/checkout — create checkout session
  http.post(`${BASE}/billing/checkout`, () => {
    return HttpResponse.json({
      checkout_url: "https://checkout.stripe.com/c/pay/cs_test_mock",
      session_id: "cs_test_mock_session",
    });
  }),

  // POST /billing/portal — create portal session
  http.post(`${BASE}/billing/portal`, () => {
    return HttpResponse.json({
      portal_url: "https://billing.stripe.com/p/session/mock_portal",
    });
  }),

  // POST /billing/webhook — stripe webhook
  http.post(`${BASE}/billing/webhook`, () => {
    return HttpResponse.json({ status: "ok" });
  }),
];

export { PLAN_FIXTURES, SUBSCRIPTION_FIXTURE };
