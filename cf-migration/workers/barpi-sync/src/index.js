/* ============================================================
   barpi-sync Worker — MoySklad → Cloudflare D1
   Schedule: every hour (cron 0 * * * *)
   Manual: POST /sync?key=SYNC_API_KEY[&only=...][&all=1][&full=1]

   2026-08-26 COST FIX (D1 load reduction):
   - rebuildSalesSku() тепер ІНКРЕМЕНТАЛЬНИЙ (курсор у sync_state).
     Раніше кожну годину робив DELETE FROM sales_sku + повний реінсерт
     ~16k рядків × 4 індекси = ~130k rows written за прогін (≈2M/добу).
   - Повний ребілд sales_sku — раз на добу (03:00 UTC) або ?full=1.
   - Довідникові сутності (product/counterparty/store/...) — не частіше
     ніж раз на 12–24 год замість щогодини.
   - SELECT COUNT(*) на великих таблицях — тільки коли реально щось змінилось.
   ============================================================ */

// MS API constants
const PAGE_SIZE = 100;
const MS_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Encoding': 'gzip',
  'Content-Type': 'application/json',
  'User-Agent': 'barpi-sync/1.1 (+https://barpi.com.ua; vg@abrisart.com)',
  'Accept': 'application/json;charset=utf-8',
});

// Мінімальний інтервал між синхронізаціями, хвилин (по entity-слагу sync_state).
// Довідники змінюються рідко — немає сенсу тягнути їх щогодини.
const MIN_INTERVAL_MIN = {
  product: 720,
  counterparty: 720,
  store: 1440,
  organization: 1440,
  expenseitem: 1440,
  processingplan: 1440,
  contract: 720,
  stock_by_store: 240,
};
const DEFAULT_INTERVAL_MIN = 30;

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

// Оновити курсор транзакційної сутності.
// rows_synced перераховуємо тільки якщо реально приїхали нові рядки —
// інакше COUNT(*) на кожній таблиці кожну годину дає десятки тисяч rows read.
async function setCursorState(env, entity, tableName, lastMoment, changed) {
  if (changed) {
    const countRs = await env.DB.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).first();
    await env.DB.prepare(
      `UPDATE sync_state SET last_synced_at = datetime('now'), last_moment = ?, rows_synced = ?, last_error = NULL, updated_at = datetime('now') WHERE entity = ?`
    ).bind(lastMoment, countRs?.c || 0, entity).run();
  } else {
    await env.DB.prepare(
      `UPDATE sync_state SET last_synced_at = datetime('now'), last_moment = ?, last_error = NULL, updated_at = datetime('now') WHERE entity = ?`
    ).bind(lastMoment, entity).run();
  }
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
async function syncTransactionalEntity(env, entityName, path, tableName, extraColumns = {}, extraParams = {}) {
  let offset = 0, total = 0;
  // Get cursor for incremental sync
  const cursor = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind(entityName).first();
  const sinceFilter = cursor?.last_moment ? `moment>${cursor.last_moment.replace('T', ' ').slice(0, 19)}` : null;

  let lastMoment = cursor?.last_moment || null;

  while (true) {
    const params = { limit: PAGE_SIZE, offset, order: 'moment,asc', ...extraParams };
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

  await setCursorState(env, entityName, tableName, lastMoment, total > 0);
  return total;
}

async function syncDemand(env) {
  return syncTransactionalEntity(env, 'demand', '/entity/demand', 'moysklad_demand', {
    agent_ms_id: r => metaId(r.agent?.meta),
    store_ms_id: r => metaId(r.store?.meta),
    organization_ms_id: r => metaId(r.organization?.meta),
    positions_json: r => r.positions ? JSON.stringify(r.positions) : null,
  }, { expand: 'positions.assortment' });
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
  // FIX 2026-06-09: expand=positions.assortment, sum, store
  // Store positions_json with FULL position rows (price + quantity + assortment.meta).
  // Used by v_product_avg_cost view → v_production_efficiency.
  let offset = 0, total = 0;
  const cursor = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind('supply').first();
  const sinceFilter = cursor?.last_moment ? `moment>${cursor.last_moment.replace('T', ' ').slice(0, 19)}` : null;
  let lastMoment = cursor?.last_moment || null;
  while (true) {
    const params = { limit: 50, offset, order: 'moment,asc', expand: 'positions,positions.assortment,agent,store' };
    if (sinceFilter) params.filter = sinceFilter;
    const data = await fetchMS(env, '/entity/supply', params);
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_supplies (ms_id, ms_name, moment, sum_uah, agent_ms_id, store_ms_id, positions_json, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const batch = data.rows.map(r => {
      lastMoment = r.moment > (lastMoment || '') ? r.moment : lastMoment;
      // Compute supply sum from expanded positions if available (fallback: r.sum)
      let supplySum = null;
      const posRows = r.positions?.rows;
      if (Array.isArray(posRows) && posRows.length > 0) {
        supplySum = posRows.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.quantity) || 0)), 0) / 100;
      } else if (r.sum) {
        supplySum = r.sum / 100;
      }
      return stmt.bind(
        r.id,
        r.name || '',
        r.moment || null,
        supplySum,
        metaId(r.agent?.meta),
        metaId(r.store?.meta),
        JSON.stringify(r.positions || null),
        JSON.stringify(r),
      );
    });
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < 50) break;
    offset += 50;
  }
  await setCursorState(env, 'supply', 'moysklad_supplies', lastMoment, total > 0);
  return total;
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
  // FIX 2026-06-03: loss entity has sum=0 at root, real sum is in positions (price * quantity).
  let offset = 0, total = 0;
  const cursor = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind('loss').first();
  const sinceFilter = cursor?.last_moment ? `moment>${cursor.last_moment.replace('T', ' ').slice(0, 19)}` : null;
  let lastMoment = cursor?.last_moment || null;
  while (true) {
    const params = { limit: 50, offset, order: 'moment,asc', expand: 'positions,store' };
    if (sinceFilter) params.filter = sinceFilter;
    const data = await fetchMS(env, '/entity/loss', params);
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_losses (ms_id, ms_name, moment, sum_uah, store_ms_id, reason, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const batch = data.rows.map(r => {
      lastMoment = r.moment > (lastMoment || '') ? r.moment : lastMoment;
      let lossSum = null;
      const posRows = r.positions?.rows;
      if (Array.isArray(posRows) && posRows.length > 0) {
        lossSum = posRows.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.quantity) || 0)), 0) / 100;
      } else if (r.sum) {
        lossSum = r.sum / 100;
      }
      return stmt.bind(r.id, r.name || '', r.moment || null, lossSum, metaId(r.store?.meta), r.description || null, JSON.stringify(r));
    });
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < 50) break;
    offset += 50;
  }
  await setCursorState(env, 'loss', 'moysklad_losses', lastMoment, total > 0);
  return total;
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
  // FIX 2026-06-03: MS processing entity has no top-level materialsSum.
  // Use expand=materials,products and sum positions (price * quantity in kopecks).
  let offset = 0, total = 0;
  const cursor = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind('processing').first();
  const sinceFilter = cursor?.last_moment ? `moment>${cursor.last_moment.replace('T', ' ').slice(0, 19)}` : null;
  let lastMoment = cursor?.last_moment || null;

  while (true) {
    const params = { limit: 50, offset, order: 'moment,asc', expand: 'materials,products,materialsStore' };
    if (sinceFilter) params.filter = sinceFilter;
    const data = await fetchMS(env, '/entity/processing', params);
    if (!data.rows || data.rows.length === 0) break;
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_processing_acts (ms_id, plan_ms_id, moment, materials_sum_uah, products_qty, store_ms_id, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    );
    const batch = data.rows.map(r => {
      lastMoment = r.moment > (lastMoment || '') ? r.moment : lastMoment;
      // Compute materials sum from expanded positions (price in kopecks, quantity is decimal)
      let materialsSum = null;
      const matRows = r.materials?.rows;
      if (Array.isArray(matRows) && matRows.length > 0) {
        materialsSum = matRows.reduce((s, p) => s + ((Number(p.price) || 0) * (Number(p.quantity) || 0)), 0) / 100;
      }
      // Products quantity from positions
      let productsQty = 0;
      const prodRows = r.products?.rows;
      if (Array.isArray(prodRows) && prodRows.length > 0) {
        productsQty = prodRows.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
      } else {
        productsQty = Number(r.quantity) || 0;
      }
      return stmt.bind(
        r.id,
        metaId(r.processingPlan?.meta),
        r.moment || null,
        materialsSum,
        productsQty,
        metaId(r.materialsStore?.meta) || metaId(r.store?.meta),
        JSON.stringify(r),
      );
    });
    await env.DB.batch(batch);
    total += data.rows.length;
    if (data.rows.length < 50) break;
    offset += 50;
  }
  await setCursorState(env, 'processing', 'moysklad_processing_acts', lastMoment, total > 0);
  return total;
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
  const rows = data.rows || [];
  if (rows.length > 0) {
    const stmt = env.DB.prepare(
      `INSERT OR REPLACE INTO moysklad_contracts (ms_id, ms_name, agent_ms_id, state, raw_json, last_synced) VALUES (?, ?, ?, ?, ?, datetime('now'))`
    );
    await env.DB.batch(rows.map(c => stmt.bind(
      c.id, c.name || '', metaId(c.ownAgent?.meta), c.state?.name || null, JSON.stringify(c),
    )));
  }
  await setSyncState(env, 'contract', rows.length);
  return rows.length;
}

// ============================================================
// sales_sku — інкрементальна денормалізація demand → факт-таблиця
// ============================================================
const SALES_SKU_ENTITY = 'sales_sku';
const SALES_CHUNK = 200;

async function rebuildSalesSku(env, opts = {}) {
  const st = await env.DB.prepare(`SELECT last_moment FROM sync_state WHERE entity = ?`).bind(SALES_SKU_ENTITY).first();
  if (!st) {
    await env.DB.prepare(`INSERT OR IGNORE INTO sync_state (entity, rows_synced) VALUES (?, 0)`).bind(SALES_SKU_ENTITY).run();
  }
  // Повний ребілд: перший запуск після деплою, ?full=1, або нічний прогін.
  const full = opts.full === true || !st || !st.last_moment;

  let cursor = full ? null : st.last_moment;
  if (full) await env.DB.prepare(`DELETE FROM sales_sku`).run();

  // Pre-load product → sku_id map (1 query, no N+1)
  const productsRs = await env.DB.prepare(`SELECT ms_id, sku_id FROM moysklad_products`).all();
  const productMap = new Map();
  for (const p of (productsRs.results || [])) productMap.set(p.ms_id, p.sku_id);

  const ins = env.DB.prepare(
    `INSERT INTO sales_sku (demand_ms_id, moment, agent_ms_id, product_ms_id, sku_id, qty, price_uah, sum_uah, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const del = env.DB.prepare(`DELETE FROM sales_sku WHERE demand_ms_id = ?`);

  let total = 0;
  let maxMoment = cursor;

  while (true) {
    // Keyset-пагінація по індексу idx_demand_moment (без OFFSET — той давав O(n²) сканів).
    const rs = cursor
      ? await env.DB.prepare(
          `SELECT ms_id, moment, agent_ms_id, positions_json FROM moysklad_demand WHERE positions_json IS NOT NULL AND moment >= ? ORDER BY moment LIMIT ?`
        ).bind(cursor, SALES_CHUNK).all()
      : await env.DB.prepare(
          `SELECT ms_id, moment, agent_ms_id, positions_json FROM moysklad_demand WHERE positions_json IS NOT NULL ORDER BY moment LIMIT ?`
        ).bind(SALES_CHUNK).all();

    const rows = rs.results || [];
    if (rows.length === 0) break;

    // Спершу знімаємо старі позиції саме цих накладних (idempotent re-run),
    // потім вставляємо актуальні.
    let batch = rows.map(d => del.bind(d.ms_id));

    for (const d of rows) {
      if (d.moment && (!maxMoment || d.moment > maxMoment)) maxMoment = d.moment;
      try {
        const pos = JSON.parse(d.positions_json);
        for (const p of (pos.rows || [])) {
          const productId = metaId(p.assortment?.meta);
          batch.push(ins.bind(
            d.ms_id, d.moment, d.agent_ms_id, productId, productMap.get(productId) || null,
            p.quantity || 0,
            p.price ? p.price / 100 : 0,
            (p.price && p.quantity) ? (p.price * p.quantity) / 100 : 0,
          ));
          total++;
          if (batch.length >= 400) { await env.DB.batch(batch); batch = []; }
        }
      } catch (e) {/* skip malformed */}
    }
    if (batch.length) await env.DB.batch(batch);

    const chunkMax = rows[rows.length - 1].moment;
    if (rows.length < SALES_CHUNK) break;
    if (cursor && chunkMax === cursor) break; // усі moment однакові — виходимо, щоб не зациклитись
    cursor = chunkMax;
  }

  await env.DB.prepare(
    `UPDATE sync_state SET last_synced_at = datetime('now'), last_moment = COALESCE(?, last_moment), rows_synced = ?, last_error = NULL, updated_at = datetime('now') WHERE entity = ?`
  ).bind(maxMoment, total, SALES_SKU_ENTITY).run();

  return total;
}

// ============================================================
// MAIN SYNC RUNNER
// ============================================================

// name (log key) → entity слаг у sync_state
const NAME_TO_ENTITY = {
  products: 'product',
  counterparties: 'counterparty',
  stores: 'store',
  organizations: 'organization',
  expense_items: 'expenseitem',
  demand: 'demand',
  payments: 'paymentin',
  payments_out: 'paymentout',
  supplies: 'supply',
  customer_orders: 'customerorder',
  purchase_orders: 'purchaseorder',
  returns: 'salesreturn',
  losses: 'loss',
  moves: 'move',
  processing_plans: 'processingplan',
  processing_acts: 'processing',
  stock_by_store: 'stock_by_store',
  contracts: 'contract',
  sales_sku: null, // денормалізація — тепер інкрементальна, дешева
};

// Свіжі сутності — ті, що синкались раніше ніж MIN_INTERVAL_MIN тому.
async function getFreshEntities(env) {
  const rs = await env.DB.prepare(
    `SELECT entity, last_synced_at FROM sync_state WHERE last_synced_at IS NOT NULL AND (last_error IS NULL OR last_error = '')`
  ).all();
  const fresh = new Set();
  const now = Date.now();
  for (const r of (rs.results || [])) {
    const mins = MIN_INTERVAL_MIN[r.entity] ?? DEFAULT_INTERVAL_MIN;
    const ts = Date.parse(String(r.last_synced_at).replace(' ', 'T') + 'Z');
    if (!Number.isNaN(ts) && (now - ts) < mins * 60000) fresh.add(r.entity);
  }
  return fresh;
}

async function runFullSync(env, opts = {}) {
  const log = { started: new Date().toISOString(), results: {}, errors: {}, skipped: [] };
  const only = opts.only; // Set<entity-slug> or null
  const skipRecent = opts.skipRecent !== false; // default true
  const fresh = skipRecent ? await getFreshEntities(env) : new Set();

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
    const entity = NAME_TO_ENTITY[name];
    if (only && entity && !only.has(entity)) { log.skipped.push(name); continue; }
    if (entity && fresh.has(entity)) { log.skipped.push(name + ' (recent)'); continue; }
    try {
      log.results[name] = name === 'sales_sku'
        ? await fn(env, { full: opts.fullSalesSku === true })
        : await fn(env);
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
  // Cron Trigger — щогодини. Повний ребілд sales_sku раз на добу о 03:00 UTC.
  async scheduled(event, env, ctx) {
    const hourUTC = new Date(event.scheduledTime || Date.now()).getUTCHours();
    ctx.waitUntil(runFullSync(env, { fullSalesSku: hourUTC === 3 }));
  },

  // HTTP — manual trigger or status check
  async fetch(req, env) {
    const url = new URL(req.url);

    // GET / — status + last sync state
    if (req.method === 'GET' && url.pathname === '/') {
      const state = await env.DB.prepare(`SELECT entity, last_synced_at, rows_synced, last_error FROM sync_state ORDER BY entity`).all();
      return new Response(JSON.stringify({
        worker: 'barpi-sync',
        version: '1.1-cost-fix',
        status: 'alive',
        d1: 'barpi-bible',
        cron: '0 * * * * (hourly)',
        sales_sku: 'incremental (full rebuild daily at 03:00 UTC or ?full=1)',
        min_interval_min: MIN_INTERVAL_MIN,
        sync_state: state.results || [],
      }, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    // POST /sync — manual trigger (requires SYNC_API_KEY)
    if (req.method === 'POST' && url.pathname === '/sync') {
      const key = url.searchParams.get('key') || req.headers.get('X-Sync-Key');
      if (key !== env.SYNC_API_KEY) {
        return new Response('Forbidden', { status: 403 });
      }
      const onlyParam = url.searchParams.get('only');
      const allParam = url.searchParams.get('all');
      const fullParam = url.searchParams.get('full');
      const opts = {};
      if (onlyParam) opts.only = new Set(onlyParam.split(',').map(s => s.trim()).filter(Boolean));
      if (allParam === '1') opts.skipRecent = false;
      if (fullParam === '1') opts.fullSalesSku = true;
      const log = await runFullSync(env, opts);
      return new Response(JSON.stringify(log, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not Found', { status: 404 });
  },
};
