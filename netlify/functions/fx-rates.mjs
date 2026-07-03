/* Proxy FX rates for Netlify (avoids CORS issues in browser) */
const FALLBACK = { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 74, AED: 22.6, JPY: 0.55 };

function parseInrBase(data) {
  const raw = data?.rates;
  if (!raw) throw new Error("No rates");
  const rates = { INR: 1 };
  for (const [cur, rateFromInr] of Object.entries(raw)) {
    if (rateFromInr > 0) rates[cur] = 1 / rateFromInr;
  }
  return rates;
}

export async function handler() {
  const sources = [
    "https://open.er-api.com/v6/latest/INR",
    "https://api.exchangerate-api.com/v4/latest/INR",
  ];
  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.result && data.result !== "success") continue;
      const rates = parseInrBase(data);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" },
        body: JSON.stringify(rates),
      };
    } catch { /* try next */ }
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(FALLBACK),
  };
}
