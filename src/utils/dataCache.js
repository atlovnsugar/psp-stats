// src/utils/dataCache.js
const cache = new Map();

export async function fetchJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const data = await response.json();
  cache.set(url, data);
  return data;
}

export function clearCache() {
  cache.clear();
}