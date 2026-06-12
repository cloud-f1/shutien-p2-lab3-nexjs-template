import { http, HttpResponse } from "msw";
import { createCrudHandlers } from "../helpers/createHandlers";

const BASE = "http://localhost:8080";

const PORTFOLIO_FIXTURES = [
  {
    id: "aaaa1111-1111-1111-1111-111111111111",
    name: "Growth Portfolio",
    description: "High-growth properties",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    place_count: 2,
    total_value: "1600000.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "aaaa2222-2222-2222-2222-222222222222",
    name: "Income Portfolio",
    description: null,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    place_count: 0,
    total_value: "0.00",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

const PP_FIXTURE = {
  portfolio_id: "aaaa1111-1111-1111-1111-111111111111",
  place_id: "11111111-1111-1111-1111-111111111111",
  purchase_price: "1000000.00",
  current_value: "1200000.00",
  gain_loss: "200000.00",
  notes: null,
  added_at: "2026-01-01T00:00:00Z",
  place: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test Place A",
    address: "123 Test St",
    description: "A test place",
    latitude: 25.033,
    longitude: 121.565,
    category: "residential",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
};

// Base CRUD handlers for portfolio list/getById/update/remove
const baseHandlers = createCrudHandlers("/portfolios", PORTFOLIO_FIXTURES);

// Override POST to return all required fields
const createHandler = http.post(`${BASE}/portfolios`, async ({ request }) => {
  const body = (await request.json()) as Record<string, unknown>;
  return HttpResponse.json(
    {
      id: crypto.randomUUID(),
      description: null,
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      place_count: 0,
      total_value: "0.00",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    },
    { status: 201 },
  );
});

// Sub-resource handlers for portfolio places
const listPlacesHandler = http.get(`${BASE}/portfolios/:portfolioId/places`, () => {
  return HttpResponse.json([PP_FIXTURE]);
});

const addPlaceHandler = http.post(
  `${BASE}/portfolios/:portfolioId/places`,
  async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const purchasePrice = parseFloat((body.purchase_price as string) ?? "0");
    const currentValue = parseFloat((body.current_value as string) ?? "0");
    const gainLoss = (currentValue - purchasePrice).toFixed(2);
    return HttpResponse.json(
      {
        ...PP_FIXTURE,
        ...body,
        gain_loss: gainLoss,
        added_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  },
);

const updatePlaceHandler = http.patch(
  `${BASE}/portfolios/:portfolioId/places/:placeId`,
  async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const merged = { ...PP_FIXTURE, ...body };
    const purchasePrice = parseFloat(merged.purchase_price as string);
    const currentValue = parseFloat(merged.current_value as string);
    return HttpResponse.json({
      ...merged,
      gain_loss: (currentValue - purchasePrice).toFixed(2),
    });
  },
);

const removePlaceHandler = http.delete(
  `${BASE}/portfolios/:portfolioId/places/:placeId`,
  () => {
    return new HttpResponse(null, { status: 204 });
  },
);

// Portfolio detail handler (returns full detail shape with embedded places)
const PORTFOLIO_DETAIL_FIXTURE = {
  ...PORTFOLIO_FIXTURES[0],
  total_purchase: "1500000.00",
  gain_loss: "100000.00",
  gain_loss_pct: "6.67",
  places: [PP_FIXTURE],
};

const portfolioDetailHandler = http.get(`${BASE}/portfolios/:portfolioId`, ({ params }) => {
  // If requesting the first fixture, return detail shape
  if (params.portfolioId === PORTFOLIO_FIXTURES[0].id) {
    return HttpResponse.json(PORTFOLIO_DETAIL_FIXTURE);
  }
  // For the second fixture, return empty detail
  const fixture = PORTFOLIO_FIXTURES.find((f) => f.id === params.portfolioId);
  if (fixture) {
    return HttpResponse.json({
      ...fixture,
      total_purchase: "0.00",
      gain_loss: "0.00",
      gain_loss_pct: null,
      places: [],
    });
  }
  return HttpResponse.json({ detail: "Not found" }, { status: 404 });
});

// Analytics handler
const analyticsHandler = http.get(
  `${BASE}/portfolios/:portfolioId/analytics`,
  () => {
    return HttpResponse.json({
      portfolio_id: "aaaa1111-1111-1111-1111-111111111111",
      total_value: "1600000.00",
      total_purchase: "1500000.00",
      gain_loss: "100000.00",
      gain_loss_pct: "6.67",
      place_count: 2,
      category_allocation: [
        { category: "residential", count: 1, value: "1200000.00", percentage: "75.00" },
        { category: "commercial", count: 1, value: "400000.00", percentage: "25.00" },
      ],
      top_performers: [
        {
          place_id: "11111111-1111-1111-1111-111111111111",
          place_name: "Test Place A",
          purchase_price: "1000000.00",
          current_value: "1200000.00",
          gain_loss: "200000.00",
          gain_loss_pct: "20.00",
        },
      ],
    });
  },
);

export const portfolioHandlers = [
  createHandler,
  ...baseHandlers.filter((h) => {
    const info = h.info as { method?: string; path?: string };
    // Remove generic POST and GET /:id handlers (we override both)
    if (info.method === "POST" && info.path === `${BASE}/portfolios`) return false;
    if (info.method === "GET" && info.path === `${BASE}/portfolios/:id`) return false;
    return true;
  }),
  portfolioDetailHandler,
  listPlacesHandler,
  addPlaceHandler,
  updatePlaceHandler,
  removePlaceHandler,
  analyticsHandler,
];

export { PORTFOLIO_FIXTURES, PORTFOLIO_DETAIL_FIXTURE, PP_FIXTURE };
