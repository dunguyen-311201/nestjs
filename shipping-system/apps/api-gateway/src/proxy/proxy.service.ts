import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import type { NextFunction, Request, Response } from 'express';
import { PROXY_ROUTES } from './proxy.config';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly configService: ConfigService) {}

  resolveTarget(path: string): string | null {
    const route = PROXY_ROUTES.find((r) => {
      if (r.pattern) {
        return r.pattern.test(path);
      }
      return path === r.prefix || path.startsWith(`${r.prefix}/`);
    });
    if (!route) return null;
    return this.configService.get<string>(route.envKey) ?? route.defaultTarget;
  }

  // x-user-id / x-session-id must only ever carry the gateway-verified
  // identity: client-sent values are stripped unconditionally so downstream
  // services can trust them without re-verifying the Clerk JWT.
  buildForwardHeaders(
    req: Request & {
      auth?: { userId: string; sessionId: string; role: string | null };
    },
    host: string,
  ): Record<string, string | string[] | undefined> {
    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host,
    };
    delete headers['x-user-id'];
    delete headers['x-session-id'];
    delete headers['x-user-role'];
    if (req.auth) {
      headers['x-user-id'] = req.auth.userId;
      headers['x-session-id'] = req.auth.sessionId;
      if (req.auth.role) {
        headers['x-user-role'] = req.auth.role;
      }
    }
    return headers;
  }

  forward(req: Request, res: Response, next: NextFunction): void {
    const target = this.resolveTarget(req.path);
    if (!target) {
      next();
      return;
    }

    const targetUrl = new URL(req.originalUrl, target);
    const proxyReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: this.buildForwardHeaders(req, targetUrl.host),
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err: Error) => {
      this.logger.error(`Upstream request to ${target} failed: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream service unavailable' });
      }
    });

    req.pipe(proxyReq);
  }
}
