import { Elysia, t } from "elysia";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { RateLimiter } from "./rate-limiter";
import { isValidThaiMobile, isValidVoucherCode } from "./validation";
import type {
  Env,
  TmwApiResponse,
  RedeemResponse,
  ApiErrorResponse,
} from "./types";

let env: Env = { API_KEY: "" };
const rateLimiter = new RateLimiter(10, 60_000);

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { status: { code, message } };
}

function sanitizeTmwResponse(json: TmwApiResponse): RedeemResponse {
  if (json.status.code === "SUCCESS" && "data" in json && json.data) {
    const { data } = json as Extract<TmwApiResponse, { status: { code: "SUCCESS" } }>;
    return {
      status: { code: "SUCCESS", message: "success" },
      data: {
        voucher: {
          voucher_id: data.voucher.voucher_id,
          amount_baht: data.voucher.amount_baht,
          redeemed_amount_baht: data.voucher.redeemed_amount_baht,
          status: data.voucher.status,
        },
        owner_full_name: data.owner_profile.full_name,
        redeemer_mobile: data.redeemer_profile.mobile_number,
      },
    };
  }

  return { status: { code: json.status.code, message: json.status.message } };
}

function getCorsOrigin(request: Request): string {
  if (env.ALLOWED_ORIGINS === "*") return "*";

  const origin = request.headers.get("origin");
  if (!origin) return "";

  if (!env.ALLOWED_ORIGINS) return "*";

  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  return allowed.includes(origin) ? origin : "";
}

const app = new Elysia({ aot: false })
  .onAfterHandle(({ request, set }) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      set.headers[key] = value;
    }

    const corsOrigin = getCorsOrigin(request);
    if (corsOrigin) {
      set.headers["Access-Control-Allow-Origin"] = corsOrigin;
      set.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
      set.headers["Access-Control-Allow-Headers"] =
        "Content-Type, Authorization";
      set.headers["Access-Control-Max-Age"] = "86400";
      if (corsOrigin !== "*") set.headers["Vary"] = "Origin";
    }
  })
  .onBeforeHandle(({ request, set }) => {
    const ip = getClientIp(request);

    if (!rateLimiter.isAllowed(ip)) {
      set.status = 429;
      set.headers["Retry-After"] = "60";
      return errorResponse("RATE_LIMITED", "Too many requests, try again later");
    }
  })
  .options("/*", ({ set }) => {
    set.status = 204;
    return "";
  })
  .get("/", () => ({
    name: "tmw-redemption-worker",
    status: "ok",
  }))
  .post(
    "/redeem",
    async ({ body, request, set }) => {
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!env.API_KEY || !token || token !== env.API_KEY) {
        set.status = 401;
        return errorResponse("UNAUTHORIZED", "Invalid or missing API key");
      }

      const { mobile, code } = body;
      if (!isValidThaiMobile(mobile)) {
        set.status = 400;
        return errorResponse(
          "INVALID_MOBILE",
          "Must be a valid 10-digit Thai mobile number starting with 0"
        );
      }

      if (!isValidVoucherCode(code)) {
        set.status = 400;
        return errorResponse(
          "INVALID_CODE",
          "Voucher code must be 18-50 alphanumeric characters"
        );
      }
      const safeCode = encodeURIComponent(code);
      console.log(
        JSON.stringify({
          event: "redeem_request",
          mobile: `${mobile.slice(0, 3)}****${mobile.slice(7)}`,
          code_prefix: code.slice(0, 6),
          ip: getClientIp(request),
          timestamp: new Date().toISOString(),
        })
      );

      let response: Response;
      try {
        response = await fetch(
          `https://gift.truemoney.com/campaign/vouchers/${safeCode}/redeem`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            },
            body: JSON.stringify({ mobile }),
          }
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "upstream_fetch_error",
            error: err instanceof Error ? err.message : "Unknown error",
            timestamp: new Date().toISOString(),
          })
        );
        set.status = 502;
        return errorResponse("UPSTREAM_ERROR", "Failed to reach TrueMoney API");
      }

      const text = await response.text();
      let json: TmwApiResponse;
      try {
        json = JSON.parse(text) as TmwApiResponse;
      } catch {
        console.error(
          JSON.stringify({
            event: "upstream_parse_error",
            status: response.status,
            timestamp: new Date().toISOString(),
          })
        );
        set.status = 502;
        return errorResponse(
          "UPSTREAM_ERROR",
          "Invalid response from TrueMoney"
        );
      }
      console.log(
        JSON.stringify({
          event: "redeem_result",
          tmw_status: json.status.code,
          timestamp: new Date().toISOString(),
        })
      );
      if (json.status.code !== "SUCCESS") {
        set.status = response.status >= 400 ? response.status : 422;
      }

      return sanitizeTmwResponse(json);
    },
    {
      body: t.Object({
        mobile: t.String({ minLength: 10, maxLength: 10 }),
        code: t.String({ minLength: 18, maxLength: 50 }),
      }),
    }
  );

export default {
  fetch(request: Request, workerEnv: Env, _ctx: ExecutionContext): Response | Promise<Response> {
    env = workerEnv;
    return app.fetch(request);
  },
};
