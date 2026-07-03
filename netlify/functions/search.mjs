import { searchSymbols, jsonResponse } from "./lib/yahoo.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  try {
    const params = event.queryStringParameters || {};
    const data = await searchSymbols(params.q || "", params.market || "");
    return jsonResponse(200, data);
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
}
