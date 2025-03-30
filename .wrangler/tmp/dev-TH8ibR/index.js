var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-xLzfkl/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
function getDateRangeFilter(searchParams) {
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  let whereClause = [];
  let bindValues = [];
  if (startDate) {
    whereClause.push("entry_date >= ?");
    bindValues.push(startDate);
  }
  if (endDate) {
    whereClause.push("entry_date <= ?");
    bindValues.push(endDate);
  }
  return { whereClause, bindValues };
}
__name(getDateRangeFilter, "getDateRangeFilter");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (path.startsWith("/api/")) {
      if (path === "/api/log-entry" && request.method === "POST") {
        const data = await request.json();
        console.log("Received log entry:", JSON.stringify(data));
        try {
          const now = /* @__PURE__ */ new Date();
          const entry_date = now.toISOString().split("T")[0];
          const year = now.getUTCFullYear();
          const month = now.getUTCMonth() + 1;
          const date = new Date(now.getTime());
          date.setUTCHours(0, 0, 0, 0);
          date.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
          const week = Math.ceil(((date.getTime() - new Date(date.getUTCFullYear(), 0, 1).getTime()) / 864e5 + 1) / 7);
          const day = now.getUTCDate();
          const stmt = await env.DB.prepare(
            "INSERT INTO entries (entry_type, price, entry_date, entry_timestamp, year, month, week, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(data.entry_type, data.price, entry_date, now.toISOString(), year, month, week, day);
          const result = await stmt.run();
          console.log("D1 database entry created:", JSON.stringify(result));
          return new Response(JSON.stringify({ success: true }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Failed to log entry:", error);
          return new Response(JSON.stringify({
            error: "Failed to log entry",
            message: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
      if (path === "/api/summary" && request.method === "GET") {
        console.log("Handling summary request");
        try {
          try {
            const tableCheck = await env.DB.prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'"
            ).all();
            console.log("Table check results:", JSON.stringify(tableCheck));
            if (!tableCheck.results || tableCheck.results.length === 0) {
              console.warn("The entries table does not exist in the database");
              return new Response(JSON.stringify({
                error: "Table does not exist",
                message: "The entries table has not been created yet"
              }), {
                status: 404,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                }
              });
            }
          } catch (tableCheckError) {
            console.error("Error checking table existence:", tableCheckError);
          }
          const countStmt = await env.DB.prepare("SELECT COUNT(*) as count FROM entries");
          const countResult = await countStmt.first();
          console.log("Total entries count:", countResult ? countResult.count : 0);
          const params = new URL(request.url).searchParams;
          const filterDate = params.get("date");
          const filterYear = params.get("year");
          const filterMonth = params.get("month");
          const filterWeek = params.get("week");
          const filterDay = params.get("day");
          let query = "SELECT entry_type, COUNT(*) as count, SUM(price) as total_value, AVG(price) as average_price FROM entries";
          let whereClause = [];
          let bindValues = [];
          const dateRangeFilter = getDateRangeFilter(params);
          whereClause = [...whereClause, ...dateRangeFilter.whereClause];
          bindValues = [...bindValues, ...dateRangeFilter.bindValues];
          if (filterDate) {
            whereClause.push("entry_date = ?");
            bindValues.push(filterDate);
          }
          if (filterYear) {
            whereClause.push("year = ?");
            bindValues.push(parseInt(filterYear));
          }
          if (filterMonth) {
            whereClause.push("month = ?");
            bindValues.push(parseInt(filterMonth));
          }
          if (filterWeek) {
            whereClause.push("week = ?");
            bindValues.push(parseInt(filterWeek));
          }
          if (filterDay) {
            whereClause.push("day = ?");
            bindValues.push(parseInt(filterDay));
          }
          if (whereClause.length > 0) {
            query += " WHERE " + whereClause.join(" AND ");
          }
          query += " GROUP BY entry_type";
          const stmt = await env.DB.prepare(query);
          const results = bindValues.length > 0 ? await stmt.bind(...bindValues).all() : await stmt.all();
          console.log("Summary results:", JSON.stringify(results));
          return new Response(JSON.stringify({
            success: true,
            meta: {
              filtered: whereClause.length > 0,
              start_date: params.get("start_date"),
              end_date: params.get("end_date")
            },
            results: results.results
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        } catch (error) {
          console.error("Failed to fetch summary:", error);
          return new Response(JSON.stringify({
            error: "Failed to fetch summary",
            message: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
      if (path === "/api/daily-summary" && request.method === "GET") {
        try {
          const searchParams = new URL(request.url).searchParams;
          const { whereClause, bindValues } = getDateRangeFilter(searchParams);
          let query = "SELECT entry_date, SUM(price) as daily_total, COUNT(*) as entry_count FROM entries";
          if (whereClause.length > 0) {
            query += " WHERE " + whereClause.join(" AND ");
          }
          query += " GROUP BY entry_date ORDER BY entry_date DESC";
          const stmt = await env.DB.prepare(query);
          const results = bindValues.length > 0 ? await stmt.bind(...bindValues).all() : await stmt.all();
          return new Response(JSON.stringify({
            success: true,
            meta: {
              filtered: whereClause.length > 0,
              start_date: searchParams.get("start_date"),
              end_date: searchParams.get("end_date")
            },
            results: results.results
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        } catch (error) {
          console.error("Failed to fetch daily summary:", error);
          return new Response(JSON.stringify({
            error: "Failed to fetch daily summary",
            message: error.message,
            details: "There was an error filtering or retrieving the daily summary data"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
      if (path === "/api/weekly-summary" && request.method === "GET") {
        try {
          const searchParams = new URL(request.url).searchParams;
          const { whereClause, bindValues } = getDateRangeFilter(searchParams);
          let query = "SELECT year, week, SUM(price) as weekly_total, COUNT(*) as entry_count FROM entries";
          if (whereClause.length > 0) {
            query += " WHERE " + whereClause.join(" AND ");
          }
          query += " GROUP BY year, week ORDER BY year DESC, week DESC";
          const stmt = await env.DB.prepare(query);
          const results = bindValues.length > 0 ? await stmt.bind(...bindValues).all() : await stmt.all();
          return new Response(JSON.stringify({
            success: true,
            meta: {
              filtered: whereClause.length > 0,
              start_date: searchParams.get("start_date"),
              end_date: searchParams.get("end_date")
            },
            results: results.results
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        } catch (error) {
          console.error("Failed to fetch weekly summary:", error);
          return new Response(JSON.stringify({
            error: "Failed to fetch weekly summary",
            message: error.message,
            details: "There was an error filtering or retrieving the weekly summary data"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
      if (path === "/api/monthly-summary" && request.method === "GET") {
        try {
          const searchParams = new URL(request.url).searchParams;
          const { whereClause, bindValues } = getDateRangeFilter(searchParams);
          let query = "SELECT year, month, SUM(price) as monthly_total, COUNT(*) as entry_count FROM entries";
          if (whereClause.length > 0) {
            query += " WHERE " + whereClause.join(" AND ");
          }
          query += " GROUP BY year, month ORDER BY year DESC, month DESC";
          const stmt = await env.DB.prepare(query);
          const results = bindValues.length > 0 ? await stmt.bind(...bindValues).all() : await stmt.all();
          return new Response(JSON.stringify({
            success: true,
            meta: {
              filtered: whereClause.length > 0,
              start_date: searchParams.get("start_date"),
              end_date: searchParams.get("end_date")
            },
            results: results.results
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-cache"
            }
          });
        } catch (error) {
          console.error("Failed to fetch monthly summary:", error);
          return new Response(JSON.stringify({
            error: "Failed to fetch monthly summary",
            message: error.message,
            details: "There was an error filtering or retrieving the monthly summary data"
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }
      return new Response("Not Found", { status: 404 });
    }
    console.log(`Non-API route requested: ${path}, returning 404 to let Pages handle it`);
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
};

// ../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-xLzfkl/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../.nvm/versions/node/v22.12.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-xLzfkl/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
