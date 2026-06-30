import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAssetValue } from "@/lib/calculations";
import { updateAssetSchema } from "@/lib/validation";

type RouteParams = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json({ ...asset, computedValue: getAssetValue(asset) });
  } catch (error) {
    console.error("GET /api/assets/[id]:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const existing = await prisma.asset.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateAssetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.value !== undefined && { value: data.value }),
        ...(data.bankName !== undefined && { bankName: data.bankName }),
        ...(data.accountType !== undefined && { accountType: data.accountType }),
        ...(data.symbol !== undefined && { symbol: data.symbol }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.currentPrice !== undefined && { currentPrice: data.currentPrice }),
        ...(data.fees !== undefined && { fees: data.fees }),
        ...(data.exchange !== undefined && { exchange: data.exchange }),
        ...(data.principal !== undefined && { principal: data.principal }),
        ...(data.interestRate !== undefined && { interestRate: data.interestRate }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.monthlyContribution !== undefined && {
          monthlyContribution: data.monthlyContribution,
        }),
      },
    });

    return NextResponse.json({ ...asset, computedValue: getAssetValue(asset) });
  } catch (error) {
    console.error("PUT /api/assets/[id]:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const existing = await prisma.asset.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/assets/[id]:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
