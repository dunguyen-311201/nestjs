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
    const route = PROXY_ROUTES.find(
      (r) => path === r.prefix || path.startsWith(`${r.prefix}/`),
    );
    if (!route) return null;
    return this.configService.get<string>(route.envKey) ?? route.defaultTarget;
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
      { method: req.method, headers: { ...req.headers, host: targetUrl.host } },
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
