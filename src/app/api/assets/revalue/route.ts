import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAssetValue } from "@/lib/calculations";
import { revalueEquityAsset } from "@/lib/revaluation";
import { revalueSchema } from "@/lib/validation";
import type { RevaluationResult } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = revalueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { assetIds, category } = parsed.data;

    const where = {
      category: category
        ? category
        : { in: ["EQUITY_INDIAN" as const, "EQUITY_FOREIGN" as const] },
      ...(assetIds?.length ? { id: { in: assetIds } } : {}),
    };

    const assets = await prisma.asset.findMany({ where });

    const results: RevaluationResult[] = [];

    for (const asset of assets) {
      try {
        const previousPrice = asset.currentPrice;
        const { currentPrice, newValue } = await revalueEquityAsset(asset);

        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            currentPrice,
            value: newValue,
            lastRevaluedAt: new Date(),
          },
        });

        results.push({
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol ?? "",
          previousPrice,
          currentPrice,
          newValue,
          success: true,
        });
      } catch (err) {
        results.push({
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol ?? "",
          previousPrice: asset.currentPrice,
          currentPrice: asset.currentPrice ?? 0,
          newValue: getAssetValue(asset),
          success: false,
          error: err instanceof Error ? err.message : "Revaluation failed",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Revalued ${succeeded} asset(s)${failed ? `, ${failed} failed` : ""}`,
      results,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("POST /api/assets/revalue:", error);
    return NextResponse.json({ error: "Revaluation failed" }, { status: 500 });
  }
}
