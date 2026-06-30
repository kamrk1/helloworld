import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAssetValue } from "@/lib/calculations";
import { createAssetSchema } from "@/lib/validation";

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({ orderBy: { updatedAt: "desc" } });
    const enriched = assets.map((asset) => ({
      ...asset,
      computedValue: getAssetValue(asset),
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createAssetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const asset = await prisma.asset.create({
      data: {
        name: data.name,
        category: data.category,
        currency: data.currency ?? "INR",
        notes: data.notes ?? null,
        value: data.value ?? 0,
        bankName: data.bankName ?? null,
        accountType: data.accountType ?? null,
        symbol: data.symbol ?? null,
        quantity: data.quantity ?? null,
        purchasePrice: data.purchasePrice ?? null,
        currentPrice: data.currentPrice ?? null,
        fees: data.fees ?? 0,
        exchange: data.exchange ?? null,
        principal: data.principal ?? null,
        interestRate: data.interestRate ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        monthlyContribution: data.monthlyContribution ?? null,
      },
    });

    return NextResponse.json({ ...asset, computedValue: getAssetValue(asset) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/assets:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
