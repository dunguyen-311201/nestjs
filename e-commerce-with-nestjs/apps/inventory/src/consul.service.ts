import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Consul from 'consul';

export interface ConsulServiceNode {
  ServiceAddress: string;
  ServicePort: number;
}

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private consul: Consul;
  private readonly serviceId = 'inventory-service';

  constructor() {
    this.consul = new Consul({ host: 'localhost', port: 8500 });
  }

  async onModuleInit() {
    const serviceName = 'inventory-service';
    const serviceHost = 'localhost';
    const servicePort = 3002;

    try {
      await this.consul.agent.service.register({
        id: this.serviceId,
        name: serviceName,
        address: serviceHost,
        port: servicePort,
        check: {
          name: `${serviceName} health check`,
          http: `http://${serviceHost}:${servicePort}/health`,
          interval: '10s',
          timeout: '5s',
        },
      });
      console.log(`${serviceName} registered with Consul`);
    } catch (error) {
      console.error('Error registering service with Consul:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.consul.agent.service.deregister(this.serviceId);
      console.log(`${this.serviceId} deregistered from Consul`);
    } catch (error) {
      console.error('Error deregistering service from Consul:', error);
    }
  }

  async discoverService(
    serviceName: string,
  ): Promise<ConsulServiceNode[] | null> {
    try {
      const services = await this.consul.catalog.service.nodes(serviceName);
      return services as ConsulServiceNode[];
    } catch (error) {
      console.error('Error discovering service with Consul:', error);
      return null;
    }
  }
}
