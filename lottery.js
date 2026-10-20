export const MODE_NAMES = { weighted: '업종 통계 보정 추첨', uniform: '기업 균등 추첨' };

export function eligibleCompanies(companies, filters = {}) {
  return companies.filter(c => (!filters.district || c.district === filters.district) && (!filters.industry || c.industryCode === filters.industry));
}

// Industry marginals only. No fabricated establishment headcount or joint distribution.
export function buildDistribution(companies, stats, mode = 'weighted', filters = {}) {
  if (!['weighted', 'uniform'].includes(mode)) throw new Error('Unknown drawing mode');
  const seen = new Set();
  for (const c of companies) {
    if (!c.id || seen.has(c.id)) throw new Error(`Duplicate or missing company ID: ${c.id}`);
    seen.add(c.id);
  }
  const candidates = eligibleCompanies(companies, filters);
  if (mode === 'uniform') return candidates.map(company => ({ company, probability: 1 / candidates.length }));
  const counts = new Map();
  candidates.forEach(c => counts.set(c.industryCode, (counts.get(c.industryCode) || 0) + 1));
  const employment = new Map(stats.industries.filter(s => Number.isFinite(s.employees) && s.employees > 0).map(s => [s.code, s.employees]));
  const total = [...counts.keys()].reduce((sum, code) => sum + (employment.get(code) || 0), 0);
  if (!total) return [];
  return candidates.filter(c => employment.has(c.industryCode)).map(company => ({ company, probability: employment.get(company.industryCode) / total / counts.get(company.industryCode) }));
}

export function randomUnit() {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0] / 4294967296;
}

export function pick(distribution, rng = randomUnit) {
  if (!distribution.length) throw new Error('추첨할 기업이 없습니다. 필터를 변경해 주세요.');
  const unit = rng();
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error('RNG must return [0, 1)');
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.probability;
    if (unit < cumulative) return entry;
  }
  return distribution[distribution.length - 1];
}

export function readSavedState(storage, key, companies, version) {
  const fresh = { total: 0, history: [] };
  try {
    const raw = JSON.parse(storage.getItem(key));
    if (!raw || typeof raw !== 'object') return fresh;
    const known = new Set(companies.map(c => c.id));
    const total = Number.isSafeInteger(raw.total) && raw.total >= 0 ? raw.total : 0;
    const history = Array.isArray(raw.history) ? raw.history.filter(e => known.has(e.companyId) && e.version === version && ['weighted', 'uniform'].includes(e.mode) && Number.isFinite(e.probability) && e.probability > 0 && e.probability <= 1 && typeof e.at === 'string' && e.filters && typeof e.filters === 'object').slice(0, 20) : [];
    return { total, history };
  } catch { return fresh; }
}
