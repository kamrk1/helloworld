/* Calculations – runs in browser */
const Calc = {
  monthsBetween(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
  },

  calculatePfMtm(asset) {
    const principal = asset.principal ?? 0;
    const annualRate = (asset.interestRate ?? 0) / 100;
    const monthlyRate = annualRate / 12;
    const monthlyContribution = asset.monthlyContribution ?? 0;
    if (!asset.startDate) return principal;
    const months = this.monthsBetween(asset.startDate, new Date());
    if (months === 0) return principal;
    if (monthlyRate === 0) return principal + monthlyContribution * months;
    const cp = principal * Math.pow(1 + monthlyRate, months);
    const cc = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    return cp + cc;
  },

  calculateEquityValue(asset) {
    const quantity = asset.quantity ?? 0;
    const price = asset.currentPrice ?? asset.purchasePrice ?? 0;
    const fees = asset.fees ?? 0;
    return Math.max(0, quantity * price - fees);
  },

  getAssetValue(asset) {
    if (asset.category === "PF") return this.calculatePfMtm(asset);
    if (asset.category === "EQUITY_INDIAN" || asset.category === "EQUITY_FOREIGN")
      return this.calculateEquityValue(asset);
    return asset.value ?? 0;
  },

  convertToInr(amount, currency, rates) {
    if (currency === "INR") return amount;
    return amount * (rates[currency] ?? 1);
  },

  async fetchExchangeRates() {
    const FALLBACK = { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 74, AED: 22.6, JPY: 0.55 };

    async function parseInrBase(data) {
      const raw = data?.rates;
      if (!raw) throw new Error("No rates");
      const rates = { INR: 1 };
      for (const [cur, rateFromInr] of Object.entries(raw)) {
        if (rateFromInr > 0) rates[cur] = 1 / rateFromInr;
      }
      return rates;
    }

    const sources = [
      "/api/fx-rates",
      "https://open.er-api.com/v6/latest/INR",
      "https://api.exchangerate-api.com/v4/latest/INR",
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        // /api/fx-rates returns rates object directly
        if (data.INR === 1 && data.SGD) return data;
        if (data.result && data.result !== "success") continue;
        return await parseInrBase(data);
      } catch { /* try next source */ }
    }

    return FALLBACK;
  },

  async buildSummary(assets, appConfig) {
    const CATEGORY_ORDER = ["CASH", "SAVINGS", "BANK_ACCOUNT", "PF", "EQUITY_INDIAN", "EQUITY_FOREIGN"];
    const rates = await this.fetchExchangeRates();
    const categoryMap = {};
    for (const cat of CATEGORY_ORDER) categoryMap[cat] = { totalInr: 0, assets: [] };

    let totalInr = 0;
    for (const asset of assets) {
      const value = this.getAssetValue(asset);
      const valueInr = this.convertToInr(value, asset.currency, rates);
      totalInr += valueInr;
    if (categoryMap[asset.category]) {
      categoryMap[asset.category].totalInr += valueInr;
      categoryMap[asset.category].assets.push({
        ...asset,
        computedValue: value,
        computedValueInr: valueInr,
      });
    }
    }

    const categories = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: appConfig.categoryLabels[cat] || cat,
      totalInr: categoryMap[cat].totalInr,
      count: categoryMap[cat].assets.length,
      assets: categoryMap[cat].assets,
    }));

    return {
      totalInr,
      categories,
      lastUpdated: new Date().toISOString(),
      baseCurrency: "INR",
      exchangeRates: rates,
    };
  },
};
