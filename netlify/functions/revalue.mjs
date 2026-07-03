import { revalueAssets, jsonResponse } from "./lib/yahoo.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    let targets = body.assets || [];
    if (body.assetIds?.length) {
      targets = targets.filter((a) => body.assetIds.includes(a.id));
    }
    targets = targets.filter((a) => a.category === "EQUITY_INDIAN" || a.category === "EQUITY_FOREIGN");
    const data = await revalueAssets(targets);
    return jsonResponse(200, data);
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
}
