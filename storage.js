/* Local storage – browser database */
const Storage = {
  KEY: "networth-data",

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { config: { baseCurrency: "INR", lastUpdated: null }, assets: [] };
  },

  save(data) {
    data.config = data.config || {};
    data.config.lastUpdated = new Date().toISOString();
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  getAssets() {
    return this.load().assets;
  },

  setAssets(assets) {
    const data = this.load();
    data.assets = assets;
    this.save(data);
  },

  create(asset) {
    const data = this.load();
    const now = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      ...asset,
      createdAt: now,
      updatedAt: now,
    };
    data.assets.unshift(record);
    this.save(data);
    return record;
  },

  update(id, patch) {
    const data = this.load();
    const idx = data.assets.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Asset not found");
    data.assets[idx] = { ...data.assets[idx], ...patch, id, updatedAt: new Date().toISOString() };
    this.save(data);
    return data.assets[idx];
  },

  delete(id) {
    const data = this.load();
    data.assets = data.assets.filter((a) => a.id !== id);
    this.save(data);
  },

  exportJson() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJson(json) {
    const parsed = JSON.parse(json);
    if (!parsed.assets || !Array.isArray(parsed.assets)) throw new Error("Invalid backup file");
    this.save(parsed);
    return parsed.assets.length;
  },
};
