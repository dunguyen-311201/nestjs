export interface ProxyRoute {
  prefix: string;
  envKey: string;
  defaultTarget: string;
  pattern?: RegExp;
}

// Order matters: matched top-to-bottom by longest-first prefix match.
// One entry per downstream service's public REST surface.
export const PROXY_ROUTES: ProxyRoute[] = [
  {
    prefix: '/trips-assign',
    pattern: /^\/trips\/[^/]+\/assign$/,
    envKey: 'DISPATCHER_SERVICE_URL',
    defaultTarget: 'http://localhost:3007',
  },
  {
    prefix: '/orders',
    envKey: 'ORDER_SERVICE_URL',
    defaultTarget: 'http://localhost:3001',
  },
  {
    prefix: '/payments',
    envKey: 'ORDER_SERVICE_URL',
    defaultTarget: 'http://localhost:3001',
  },
  {
    prefix: '/tracking',
    envKey: 'TRACKING_SERVICE_URL',
    defaultTarget: 'http://localhost:3003',
  },
  {
    prefix: '/couriers',
    envKey: 'COURIER_SERVICE_URL',
    defaultTarget: 'http://localhost:3004',
  },
  {
    prefix: '/hubs',
    envKey: 'HUB_SERVICE_URL',
    defaultTarget: 'http://localhost:3005',
  },
  {
    prefix: '/trips',
    envKey: 'LINEHAUL_SERVICE_URL',
    defaultTarget: 'http://localhost:3006',
  },
  {
    prefix: '/legs',
    envKey: 'DISPATCHER_SERVICE_URL',
    defaultTarget: 'http://localhost:3007',
  },
];
