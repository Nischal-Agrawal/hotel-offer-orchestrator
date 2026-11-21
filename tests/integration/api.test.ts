import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/app.js';
import { supplierState } from '../../src/suppliers/supplierState.js';

describe('API Integration Tests', () => {
  const app = createApp();

  beforeEach(() => {
    supplierState.reset();
  });

  it('GET /supplierA/hotels?city=delhi returns Supplier A Delhi hotels', async () => {
    const res = await request(app).get('/supplierA/hotels?city=delhi');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((h: { city: string }) => h.city === 'delhi')).toBe(true);
  });

  it('GET /supplierB/hotels?city=delhi returns Supplier B Delhi hotels', async () => {
    const res = await request(app).get('/supplierB/hotels?city=delhi');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((h: { city: string }) => h.city === 'delhi')).toBe(true);
  });

  it('POST /admin/suppliers/:supplier/status controls supplier health and fault injection', async () => {
    const disableRes = await request(app)
      .post('/admin/suppliers/supplierA/status')
      .send({ healthy: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.healthy).toBe(false);

    const aRes = await request(app).get('/supplierA/hotels?city=delhi');
    expect(aRes.status).toBe(503);
    expect(aRes.body.error).toBe('Supplier temporarily unavailable');

    const bRes = await request(app).get('/supplierB/hotels?city=delhi');
    expect(bRes.status).toBe(200);

    const enableRes = await request(app)
      .post('/admin/suppliers/supplierA/status')
      .send({ healthy: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.healthy).toBe(true);

    const aResRestored = await request(app).get('/supplierA/hotels?city=delhi');
    expect(aResRestored.status).toBe(200);
  });

  it('GET /admin/suppliers/status returns status of both suppliers', async () => {
    const res = await request(app).get('/admin/suppliers/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('supplierA');
    expect(res.body).toHaveProperty('supplierB');
  });

  it('GET /api/hotels validates query parameters', async () => {
    const res1 = await request(app).get('/api/hotels');
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBe('Validation Error');

    const res2 = await request(app).get('/api/hotels?city=delhi&minPrice=-10');
    expect(res2.status).toBe(400);

    const res3 = await request(app).get('/api/hotels?city=delhi&minPrice=9000&maxPrice=3000');
    expect(res3.status).toBe(400);
    expect(res3.body.details[0].message).toContain('minPrice');
  });

  it('Echoes or generates X-Request-Id header on all responses', async () => {
    const customReqId = 'test-request-id-12345';
    const res = await request(app)
      .get('/supplierA/hotels')
      .set('X-Request-Id', customReqId);
    expect(res.headers['x-request-id']).toBe(customReqId);

    const autoRes = await request(app).get('/supplierA/hotels');
    expect(autoRes.headers['x-request-id']).toBeDefined();
    expect(autoRes.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('GET /api/hotels?city=delhi aggregates, deduplicates, and caches best offers', async () => {
    const res = await request(app).get('/api/hotels?city=delhi');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const holtin = res.body.find((h: { name: string }) => h.name.toLowerCase() === 'holtin');
    expect(holtin).toBeDefined();
    expect(holtin.price).toBe(5340);
    expect(holtin.supplier).toBe('Supplier B');

    const radison = res.body.find((h: { name: string }) => h.name.toLowerCase() === 'radison');
    expect(radison).toBeDefined();
    expect(radison.price).toBe(5900);
    expect(radison.supplier).toBe('Supplier A');

    const names = res.body.map((h: { name: string }) => h.name.toLowerCase());
    expect(names.length).toBe(new Set(names).size);

    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].price).toBeGreaterThanOrEqual(res.body[i - 1].price);
    }
  });

  it('GET /api/hotels?city=delhi&minPrice=5000&maxPrice=6000 uses Redis price filtering', async () => {
    await request(app).get('/api/hotels?city=delhi');

    const res = await request(app).get('/api/hotels?city=delhi&minPrice=5000&maxPrice=6000');
    expect(res.status).toBe(200);
    expect(res.headers['x-cache-status']).toBe('HIT');
    expect(res.body.length).toBe(2);
    expect(res.body.every((h: { price: number }) => h.price >= 5000 && h.price <= 6000)).toBe(true);
    expect(res.body.map((h: { name: string }) => h.name)).toEqual(['Holtin', 'Radison']);
  });

  it('GET /api/hotels supports pagination with limit and offset query parameters', async () => {
    await request(app).get('/api/hotels?city=delhi');

    const page1 = await request(app).get('/api/hotels?city=delhi&limit=2&offset=0');
    expect(page1.status).toBe(200);
    expect(page1.body).toHaveLength(2);

    const page2 = await request(app).get('/api/hotels?city=delhi&limit=2&offset=2');
    expect(page2.status).toBe(200);
    expect(page2.body).toHaveLength(2);

    // Verify disjoint sets across pages
    const names1 = page1.body.map((h: { name: string }) => h.name);
    const names2 = page2.body.map((h: { name: string }) => h.name);
    expect(names1.some((n: string) => names2.includes(n))).toBe(false);
  });

  it('GET /api/hotels?city=unknowncity returns 200 with empty array []', async () => {
    const res = await request(app).get('/api/hotels?city=unknowncity');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('Gracefully falls back when one supplier is down and records degraded header', async () => {
    await request(app).post('/admin/suppliers/supplierA/status').send({ healthy: false });

    const res = await request(app).get('/api/hotels?city=delhi&refresh=true');
    expect(res.status).toBe(200);
    expect(res.headers['x-degraded-suppliers']).toContain('Supplier A');
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((h: { supplier: string }) => h.supplier === 'Supplier B')).toBe(true);

    await request(app).post('/admin/suppliers/supplierA/status').send({ healthy: true });
  });

  it('GET /metrics exposes Prometheus metrics endpoint', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('hotel_');
  });

  it('GET /docs.json exposes OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths).toHaveProperty('/api/hotels');
  });

  it('GET / serves the interactive recruiter UI dashboard', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Hotel Offer Orchestrator');
    expect(res.text).toContain('Search Hotels');
  });
});
