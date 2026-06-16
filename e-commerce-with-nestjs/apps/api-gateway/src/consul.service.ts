import { Injectable } from '@nestjs/common';
import Consul from 'consul';

export interface ConsulServiceNode {
  ServiceAddress: string;
  ServicePort: number;
}

@Injectable()
export class ConsulService {
  private consul: Consul;

  constructor() {
    this.consul = new Consul({ host: 'localhost', port: 8500 });
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
