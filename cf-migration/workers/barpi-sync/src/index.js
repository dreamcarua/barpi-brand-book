/* ============================================================
   barpi-sync Worker — MoySklad → Cloudflare D1
   Schedule: every hour (cron 0 * * * *)
   Manual: POST /sync?key=SYNC_API_KEY
   ============================================================ */

// MS API constants
const PAGE_SIZE = 100;
const MS_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Encoding': 'gzip',
  'Content-Type': 'application/json',
});

// Helper: fetch one entity page from MoySklad
async function fetchMS(env, path, params = {}) {
  const url = new URL(env.MS_BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { headers: MS_HEADERS(env.MOYSKLAD_TOKEN) });
  if (!r.ok) throw new Error(`MS ${path} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Helper: parse MS meta href to extract entity id
function metaId(meta) {
  if (!meta || !meta.href) return null;
  const parts = meta.href.split('/');
  return parts[parts.length - 1].split('?')[0];
}

// Update sync_state row
async function setSyncState(env, entity, count, err = null) {
  await env.DB.prepare(
    `UPDATE sync_state SET last_synced_at = datetime('now'), rows_synced = ?, last_error = ?, updated_at = datetime('now') WHERE entity = ?`
  ).bind(count, err, entity).run();
}

// ============================================================
// SYNC FUNCTIONS — one per MS entity
// ============================================================

async function syncProducts(env) {
  let offset = 0, total = 0;
  while (true) {
    const data = await fetchMS(env, '/entity/product', { limit: PAGE_SIZE, offset });
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_products (ms_id, ms_name, sku_id, unit_price, ms_path, ms_archived, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const batch = data.rows.map(p => stmt.bind(
      p.id, p.name || '', p.code || p.article || null,
      p.salePrices?.[0]?.value ? p.salePrices[0].value / 100 : null,
      p.pathName || '', p.archived ? 1 : 0, JSON.stringify(p)
    ));
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  await setSyncState(env, 'product', total);
  return total;
}

async function syncCounterparties(env) {
  let offset = 0, total = 0;
  while (true) {
    const data = await fetchMS(env, '/entity/counterparty', { limit: PAGE_SIZE, offset });
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_counterparties (ms_id, ms_name, ms_type, ms_phone, ms_email, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const batch = data.rows.map(c => stmt.bind(
      c.id, c.name || '', c.companyType || null,
      c.phone || null, c.email || null, JSON.stringify(c)
    ));
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  await setSyncState(env, 'counterparty', total);
  return total;
}

async function syncStores(env) {
  const data = await fetchMS(env, '/entity/store', { limit: PAGE_SIZE });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO moysklad_stores (ms_id, ms_name, raw_json, last_synced) VALUES (?, ?, ?, datetime('now'))`
  );
  await env.DB.batch((data.rows || []).map(s => stmt.bind(s.id, s.name || '', JSON.stringify(s))));
  await setSyncState(env, 'store', data.rows?.length || 0);
  return data.rows?.length || 0;
}

async function syncOrganizations(env) {
  const data = await fetchMS(env, '/entity/organization', { limit: PAGE_SIZE });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO moysklad_organizations (ms_id, ms_name, ms_inn, raw_json, last_synced) VALUES (?, ?, ?, ?, datetime('now'))`
  );
  await env.DB.batch((data.rows || []).map(o => stmt.bind(o.id, o.name || '', o.inn || null, JSON.stringify(o))));
  await setSyncState(env, 'organization', data.rows?.length || 0);
  return data.rows?.length || 0;
}

async function syncExpenseItems(env) {
  const data = await fetchMS(env, '/entity/expenseitem', { limit: PAGE_SIZE });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO moysklad_expense_items (ms_id, ms_name, raw_json, last_synced) VALUES (?, ?, ?, datetime('now'))`
  );
  await env.DB.batch((data.rows || []).map(i => stmt.bind(i.id, i.name || '', JSON.stringify(i))));
  await setSyncState(env, 'expenseitem', data.rows?.length || 0);
  return data.rows?.length || 0;
}

// Generic transactional entity sync (demand, paymentin, paymentout, etc.)
async function syncTransactionalEntity(env, entityName, path, tableName, extraColumns = {}) {
  let offset = 0, total = 0;
  // Get cursor for incremental sync
  const cursor = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind(entityName).first();
  const sinceFilter = cursor?.last_moment ? `moment>${cursor.last_moment.replace('T', ' ').slice(0, 19)}` : null;

  let lastMoment = cursor?.last_moment || null;

  while (true) {
    const params = { limit: PAGE_SIZE, offset, order: 'moment,asc' };
    if (sinceFilter) params.filter = sinceFilter;
    const data = await fetchMS(env, path, params);
    if (!data.rows || data.rows.length === 0) break;

    const cols = ['ms_id', 'ms_name', 'moment', 'sum_uah', ...Object.keys(extraColumns), 'raw_json', 'last_synced'];
    const placeholders = cols.map(() => '?').join(', ');
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders.replace(/\?$/, `datetime('now')`)})`
    );

    const batch = data.rows.map(row => {
      const values = [
        row.id,
        row.name || '',
        row.moment || null,
        row.sum ? row.sum / 100 : null,
        ...Object.values(extraColumns).map(fn => fn(row)),
        JSON.stringify(row),
      ];
      lastMoment = row.moment > (lastMoment || '') ? row.moment : lastMoment;
      return stmt.bind(...values);
    });
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Update cursor
  await env.DB.prepare(
    `UPDATE sync_state SET last_synced_at = datetime('now'), last_moment = ?, rows_synced = ?, updated_at = datetime('now') WHERE entity = ?`
  ).bind(lastMoment, total, entityName).run();
  return total;
}

async function syncDemand(env) {
  return syncTransactionalEntity(env, 'demand', '/entity/demand', 'moysklad_demand', {
    agent_ms_id: r => metaId(r.agent?.meta),
    store_ms_id: r => metaId(r.store?.meta),
    organization_ms_id: r => metaId(r.organization?.meta),
    positions_json: r => r.positions ? JSON.stringify(r.positions) : null,
  });
}

async function syncPayments(env) {
  return syncTransactionalEntity(env, 'paymentin', '/entity/paymentin', 'moysklad_payments', {
    agent_ms_id: r => metaId(r.agent?.meta),
  });
}

async function syncPaymentsOut(env) {
  return syncTransactionalEntity(env, 'paymentout', '/entity/paymentout', 'moysklad_payments_out', {
    agent_ms_id: r => metaId(r.agent?.meta),
    expense_item_id: r => metaId(r.expenseItem?.meta),
  });
}

async function syncSupplies(env) {
  return syncTransactionalEntity(env, 'supply', '/entity/supply', 'moysklad_supplies', {
    agent_ms_id: r => metaId(r.agent?.meta),
    store_ms_id: r => metaId(r.store?.meta),
    positions_json: r => r.positions ? JSON.stringify(r.positions) : null,
  });
}

async function syncCustomerOrders(env) {
  return syncTransactionalEntity(env, 'customerorder', '/entity/customerorder', 'moysklad_customer_orders', {
    state: r => r.state?.name || null,
    agent_ms_id: r => metaId(r.agent?.meta),
  });
}

async function syncPurchaseOrders(env) {
  return syncTransactionalEntity(env, 'purchaseorder', '/entity/purchaseorder', 'moysklad_purchase_orders', {
    state: r => r.state?.name || null,
    agent_ms_id: r => metaId(r.agent?.meta),
  });
}

async function syncReturns(env) {
  return syncTransactionalEntity(env, 'salesreturn', '/entity/salesreturn', 'moysklad_returns', {
    agent_ms_id: r => metaId(r.agent?.meta),
  });
}

async function syncLosses(env) {
  return syncTransactionalEntity(env, 'loss', '/entity/loss', 'moysklad_losses', {
    store_ms_id: r => metaId(r.store?.meta),
    reason: r => r.description || null,
  });
}

async function syncMoves(env) {
  return syncTransactionalEntity(env, 'move', '/entity/move', 'moysklad_moves', {
    from_store_ms_id: r => metaId(r.sourceStore?.meta),
    to_store_ms_id: r => metaId(r.targetStore?.meta),
  });
}

async function syncProcessingPlans(env) {
  const data = await fetchMS(env, '/entity/processingplan', { limit: PAGE_SIZE });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO moysklad_processing_plans (ms_id, ms_name, products_json, materials_json, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  );
  await env.DB.batch((data.rows || []).map(p => stmt.bind(
    p.id, p.name || '',
    JSON.stringify(p.products || []),
    JSON.stringify(p.materials || []),
    JSON.stringify(p),
  )));
  await setSyncState(env, 'processingplan', data.rows?.length || 0);
  return data.rows?.length || 0;
}

async function syncProcessingActs(env) {
  return syncTransactionalEntity(env, 'processing', '/entity/processing', 'moysklad_processing_acts', {
    plan_ms_id: r => metaId(r.processingPlan?.meta),
    materials_sum_uah: r => r.materialsSum ? r.materialsSum / 100 : null,
    products_qty: r => r.quantity || 0,
    store_ms_id: r => metaId(r.materialsStore?.meta),
  });
}

async function syncStockByStore(env) {
  // Stock is fetched via report/stock endpoint
  let offset = 0, total = 0;
  while (true) {
    const data = await fetchMS(env, '/report/stock/bystore', { limit: PAGE_SIZE, offset });
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_stock_by_store (store_ms_id, product_ms_id, stock_qty, in_transit, reserved, last_synced) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    );
    for (const item of data.rows) {
      const productId = metaId(item.meta);
      if (!productId) continue;
      const batch = (item.stockByStore || []).map(s => stmt.bind(
        metaId(s.meta), productId,
        s.stock || 0, s.inTransit || 0, s.reserve || 0,
      ));
      if (batch.length) await env.DB.batch(batch);
      total += batch.length;
    }
    if (data.rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  await setSyncState(env, 'stock_by_store', total);
  return total;
}

async function syncContracts(env) {
  const data = await fetchMS(env, '/entity/contract', { limit: PAGE_SIZE });
  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO moysklad_contracts (ms_id, ms_name, agent_ms_id, state, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  );
  await env.DB.batch((data.rows || []).map(c => stmt.bind(
    c.id, c.name || '', metaId(c.ownAgent?.meta), c.state?.name || null, JSON.stringify(c),
  )));
  await setSyncState(env, 'contract', data.rows?.length || 0);
  return data.rows?.length || 0;
}

// Aggregate demand → sales_sku fact table
async function rebuildSalesSku(env) {
  await env.DB.prepare(`DELETE FROM sales_sku`).run();
  // Pull all demand + positions, denormalize
  const demands = await env.DB.prepare(
    `SELECT ms_id, moment, agent_ms_id, sum_uah, positions_json FROM moysklad_demand WHERE positions_json IS NOT NULL`
  ).all();

  const stmt = env.DB.prepare(
    `INSERT INTO sales_sku (demand_ms_id, moment, agent_ms_id, product_ms_id, sku_id, qty, price_uah, sum_uah, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  let total = 0;
  const batches = [];
  for (const d of (demands.results || [])) {
    try {
      const pos = JSON.parse(d.positions_json);
      const rows = pos.rows || [];
      for (const p of rows) {
        const productId = metaId(p.assortment?.meta);
        // Lookup sku_id from products table
        const skuRow = await env.DB.prepare(`SELECT sku_id FROM moysklad_products WHERE ms_id = ?`).bind(productId).first();
        batches.push(stmt.bind(
          d.ms_id, d.moment, d.agent_ms_id, productId, skuRow?.sku_id || null,
          p.quantity || 0,
          p.price ? p.price / 100 : 0,
          (p.price && p.quantity) ? (p.price * p.quantity) / 100 : 0,
        ));
        total++;
        if (batches.length >= 100) {
          await env.DB.batch(batches.splice(0));
        }
      }
    } catch (e) {/* skip malformed */}
  }
  if (batches.length) await env.DB.batch(batches);
  return total;
}

// ============================================================
// MAIN SYNC RUNNER
// ============================================================

async function runFullSync(env) {
  const log = { started: new Date().toISOString(), results: {}, errors: {} };
  const steps = [
    ['products', syncProducts],
    ['counterparties', syncCounterparties],
    ['stores', syncStores],
    ['organizations', syncOrganizations],
    ['expense_items', syncExpenseItems],
    ['demand', syncDemand],
    ['payments', syncPayments],
    ['payments_out', syncPaymentsOut],
    ['supplies', syncSupplies],
    ['customer_orders', syncCustomerOrders],
    ['purchase_orders', syncPurchaseOrders],
    ['returns', syncReturns],
    ['losses', syncLosses],
    ['moves', syncMoves],
    ['processing_plans', syncProcessingPlans],
    ['processing_acts', syncProcessingActs],
    ['stock_by_store', syncStockByStore],
    ['contracts', syncContracts],
    ['sales_sku', rebuildSalesSku],
  ];
  for (const [name, fn] of steps) {
    try {
      log.results[name] = await fn(env);
    } catch (e) {
      log.errors[name] = e.message || String(e);
    }
  }
  log.finished = new Date().toISOString();
  return log;
}

// ============================================================
// FETCH HANDLER (manual trigger + status)
// ============================================================

export default {
  // Cron Trigger
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runFullSync(env));
  },

  // HTTP — manual trigger or status check
  async fetch(req, env) {
    const url = new URL(req.url);

    // GET / — status + last sync state
    if (req.method === 'GET' && url.pathname === '/') {
      const state = await env.DB.prepare(`SELECT entity, last_synced_at, rows_synced, last_error FROM sync_state ORDER BY entity`).all();
      return new Response(JSON.stringify({
        worker: 'barpi-sync',
        status: 'alive',
        d1: 'barpi-bible',
        cron: '0 * * * * (hourly)',
        sync_state: state.results || [],
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /sync — manual trigger (requires SYNC_API_KEY)
    if (req.method === 'POST' && url.pathname === '/sync') {
      const key = url.searchParams.get('key') || req.headers.get('X-Sync-Key');
      if (key !== env.SYNC_API_KEY) {
        return new Response('Forbidden', { status: 403 });
      }
      const log = await runFullSync(env);
      return new Response(JSON.stringify(log, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  },
};
