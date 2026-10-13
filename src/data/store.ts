import type { AuditAction, AuditEntry, Depot, User, Vehicle, WorkOrder } from '../domain/types.js';
import { formatWorkOrderId, generateSeedData, type SeedOptions } from './seed.js';

/**
 * In-Memory-Datenhaltung (siehe docs/adr/0001-in-memory-datenhaltung.md).
 * Alle Zugriffe laufen über diese Klasse, damit ein späterer Wechsel auf eine Datenbank
 * nur hier Auswirkungen hat.
 */
export class Store {
  private readonly depots: Depot[];
  private readonly users = new Map<string, User>();
  private readonly vehicles = new Map<string, Vehicle>();
  private readonly workOrders = new Map<string, WorkOrder>();
  private readonly audit: AuditEntry[] = [];
  private readonly sequences = new Map<number, number>();

  constructor(data: { depots: Depot[]; users: User[]; vehicles: Vehicle[]; workOrders: WorkOrder[] }) {
    this.depots = data.depots;
    for (const user of data.users) this.users.set(user.id, user);
    for (const vehicle of data.vehicles) this.vehicles.set(vehicle.id, vehicle);
    for (const order of data.workOrders) {
      this.workOrders.set(order.id, order);
      const [, year, seq] = order.id.split('-');
      this.sequences.set(Number(year), Math.max(this.sequences.get(Number(year)) ?? 0, Number(seq)));
    }
  }

  static seeded(options: SeedOptions): Store {
    return new Store(generateSeedData(options));
  }

  listDepots(): Depot[] {
    return [...this.depots];
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  listUsers(): User[] {
    return [...this.users.values()];
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.get(id);
  }

  listVehicles(): Vehicle[] {
    return [...this.vehicles.values()];
  }

  getWorkOrder(id: string): WorkOrder | undefined {
    return this.workOrders.get(id);
  }

  listWorkOrders(): WorkOrder[] {
    return [...this.workOrders.values()];
  }

  nextWorkOrderId(year: number): string {
    const seq = (this.sequences.get(year) ?? 0) + 1;
    this.sequences.set(year, seq);
    return formatWorkOrderId(year, seq);
  }

  saveWorkOrder(order: WorkOrder): WorkOrder {
    this.workOrders.set(order.id, order);
    return order;
  }

  appendAudit(entry: { at: string; userId: string; action: AuditAction; entityId: string; details: Record<string, unknown> }): AuditEntry {
    const saved = { id: this.audit.length + 1, ...entry };
    this.audit.push(saved);
    return saved;
  }

  listAudit(): AuditEntry[] {
    return [...this.audit];
  }
}
