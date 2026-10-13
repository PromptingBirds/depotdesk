import type {
  Depot,
  PartUsage,
  Priority,
  User,
  Vehicle,
  WorkOrder,
  WorkOrderStatus,
  WorkOrderType,
} from '../domain/types.js';
import { addDays, toDepotDate } from '../lib/dates.js';
import { chance, createRng, intBetween, pick, weighted, type Rng } from './prng.js';

/**
 * Generiert realistische Demo-Daten für Entwicklung und Tests.
 * Gleicher `seed` + gleiches `referenceDate` ergibt exakt dieselben Daten.
 */
export interface SeedOptions {
  seed: number;
  /** Stichtag: bis hierhin wird Historie erzeugt, danach liegen nur noch Fälligkeiten. */
  referenceDate: Date;
}

export interface SeedData {
  depots: Depot[];
  users: User[];
  vehicles: Vehicle[];
  workOrders: WorkOrder[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 650;

export const DEPOTS: Depot[] = [
  { code: 'MUC', name: 'Werk München', city: 'München' },
  { code: 'NUE', name: 'Werk Nürnberg', city: 'Nürnberg' },
  { code: 'AUG', name: 'Werk Augsburg', city: 'Augsburg' },
  { code: 'REG', name: 'Werk Regensburg', city: 'Regensburg' },
];

const ORDERS_PER_YEAR: Record<string, number> = { MUC: 4000, NUE: 2500, AUG: 1500, REG: 1000 };
const ADDITIONAL_TECHNICIANS: Record<string, number> = { MUC: 9, NUE: 6, AUG: 5, REG: 3 };

const FLEET: Record<string, { series: string; prefix: string; count: number }[]> = {
  MUC: [
    { series: 'ET 423', prefix: '423', count: 42 },
    { series: 'ET 440', prefix: '440', count: 18 },
  ],
  NUE: [
    { series: 'ET 442', prefix: '442', count: 28 },
    { series: 'VT 642', prefix: '642', count: 12 },
  ],
  AUG: [{ series: 'ET 440', prefix: '440', count: 22 }],
  REG: [
    { series: 'VT 642', prefix: '642', count: 10 },
    { series: 'ET 1440', prefix: '1440', count: 8 },
  ],
};

/** Feste Demo-Nutzer, zwischen denen man in der Oberfläche umschalten kann. */
export const DEMO_USERS: User[] = [
  { id: 'admin', name: 'Administration', email: 'admin@depotdesk.example', role: 'admin', depot: null },
  { id: 's.hoffmann', name: 'Sabine Hoffmann', email: 's.hoffmann@depotdesk.example', role: 'viewer', depot: null },
  { id: 'm.keller', name: 'Markus Keller', email: 'm.keller@depotdesk.example', role: 'dispatcher', depot: 'MUC' },
  { id: 'j.berger', name: 'Jonas Berger', email: 'j.berger@depotdesk.example', role: 'dispatcher', depot: 'NUE' },
  { id: 'l.wagner', name: 'Lena Wagner', email: 'l.wagner@depotdesk.example', role: 'dispatcher', depot: 'AUG' },
  { id: 't.schmid', name: 'Tobias Schmid', email: 't.schmid@depotdesk.example', role: 'dispatcher', depot: 'REG' },
  { id: 'p.nowak', name: 'Piotr Nowak', email: 'p.nowak@depotdesk.example', role: 'technician', depot: 'MUC' },
  { id: 'a.yilmaz', name: 'Ayşe Yılmaz', email: 'a.yilmaz@depotdesk.example', role: 'technician', depot: 'NUE' },
];

const FIRST_NAMES = [
  'Andreas', 'Katrin', 'Jörg', 'Fatma', 'Lukas', 'Sören', 'Marie', 'Dennis', 'Özlem', 'Florian',
  'Jana', 'Mehmet', 'Ines', 'Kai', 'Bärbel', 'Nikola', 'Sandra', 'Uwe', 'Ricarda', 'Timo',
];
const LAST_NAMES = [
  'Müller', 'Schneider', 'Fischer', 'Weiß', 'Krüger', 'Öztürk', 'Bauer', 'Hofmann', 'Schäfer', 'Koch',
  'Richter', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Hartmann', 'Lange', 'Kowalski', 'Jäger',
];

export const PART_CATALOG: Record<string, { description: string; unitPriceEur: number; maxQuantity: number }> = {
  'BB-4471': { description: 'Bremsbelag Scheibenbremse (Satz)', unitPriceEur: 412.5, maxQuantity: 4 },
  'BS-2210': { description: 'Bremsscheibe Ø 640 mm', unitPriceEur: 1890, maxQuantity: 2 },
  'MS-0815': { description: 'Magnetschienenbremse, Spule', unitPriceEur: 2340, maxQuantity: 1 },
  'GL-0303': { description: 'Gleitschutzsensor', unitPriceEur: 310, maxQuantity: 2 },
  'RS-1001': { description: 'Radsatz komplett (Tauschteil)', unitPriceEur: 18750, maxQuantity: 2 },
  'DI-0042': { description: 'Dichtungssatz Türantrieb', unitPriceEur: 38.9, maxQuantity: 3 },
  'TA-3310': { description: 'Türantrieb, Steuerplatine', unitPriceEur: 960, maxQuantity: 1 },
  'FG-6000': { description: 'Display Fahrgastinformation', unitPriceEur: 2150, maxQuantity: 1 },
  'SL-4020': { description: 'Schleifleiste Stromabnehmer', unitPriceEur: 185, maxQuantity: 2 },
  'WC-0099': { description: 'Füllstandssensor WC-Tank', unitPriceEur: 145, maxQuantity: 1 },
  'SC-5501': { description: 'Seitenscheibe Fahrgastraum', unitPriceEur: 1240, maxQuantity: 2 },
  'KU-9002': { description: 'Kupplungskopf, automatische Kupplung', unitPriceEur: 7420, maxQuantity: 1 },
  'SB-1100': { description: 'Sitzbezug (Stück)', unitPriceEur: 89, maxQuantity: 6 },
  'KL-7720': { description: 'Kältemittel R134a, 5 kg', unitPriceEur: 129.95, maxQuantity: 2 },
  'FI-1200': { description: 'Filtermatte Klimagerät', unitPriceEur: 24.1, maxQuantity: 4 },
};

interface OrderTemplate {
  weight: number;
  /** Titel mit passenden Beschreibungstexten */
  variants: { title: string; descriptions: string[] }[];
  parts: string[];
  hours: [number, number];
  priorities: [Priority, number][];
}

const TEMPLATES: Record<WorkOrderType, OrderTemplate> = {
  inspection: {
    weight: 30,
    variants: [
      {
        title: 'Fristarbeit F{level}',
        descriptions: [
          'Planmäßige Fristarbeit gemäß Instandhaltungsplan. Laufleistung bei Erstellung: {km} km.',
          'Fristarbeit inkl. Sichtprüfung Drehgestelle, Bremsanlage und Stromabnehmer.',
          '',
        ],
      },
      { title: 'Nachschau N', descriptions: ['Nachschau nach Instandhaltungsplan.', ''] },
      {
        title: 'Hauptuntersuchung',
        descriptions: ['Hauptuntersuchung, Fahrzeug für 3 Schichten eingeplant. Laufleistung: {km} km.'],
      },
    ],
    parts: ['FI-1200', 'BB-4471', 'SL-4020', 'DI-0042'],
    hours: [3, 16],
    priorities: [['low', 25], ['normal', 70], ['high', 5]],
  },
  brake_test: {
    weight: 18,
    variants: [
      {
        title: 'Bremsbelagwechsel Drehgestell {bogie}',
        descriptions: ['- Bremsbeläge Achse {axle} unter Verschleißgrenze\n- Bremsprobe nach Tausch dokumentieren'],
      },
      {
        title: 'Bremsprobe nach Instandsetzung',
        descriptions: ['Volle Bremsprobe nach Arbeiten an der Bremsanlage, Protokoll im Fahrzeugordner ablegen.'],
      },
      {
        title: 'Bremse zieht ungleichmäßig',
        descriptions: ['Meldung Tf: "Bremse zieht ungleichmäßig"; Fehlerspeicher auslesen.'],
      },
      {
        title: 'Gleitschutz-Fehlermeldung Achse {axle}',
        descriptions: ['Gleitschutz meldet sporadisch Fehler {code}. Sensor und Verkabelung prüfen, ggf. tauschen.'],
      },
      {
        title: 'Bremsscheibe tauschen Achse {axle}',
        descriptions: ['Riefen auf Bremsscheibe, Tiefe ca. {mm},{mmd} mm. Austausch empfohlen.'],
      },
      { title: 'Magnetschienenbremse prüfen', descriptions: ['Magnetschienenbremse senkt nicht vollständig ab.'] },
    ],
    parts: ['BB-4471', 'BS-2210', 'MS-0815', 'GL-0303'],
    hours: [2, 12],
    priorities: [['normal', 35], ['high', 45], ['critical', 20]],
  },
  wheelset: {
    weight: 8,
    variants: [
      {
        title: 'Flachstelle Radsatz {axle}',
        descriptions: [
          'Flachstelle ca. {len} mm, Messung {mm},{mmd} mm Tiefe.\nReprofilierung erforderlich, Radsatzdrehmaschine ab KW {kw} frei.',
          'Laufflächenschaden nach Schnellbremsung, siehe Meldung der Betriebszentrale.',
        ],
      },
      { title: 'Radsatz reprofilieren', descriptions: ['Reprofilierung nach Messung, Profil außerhalb Toleranz.'] },
      {
        title: 'Radsatztausch Achse {axle}',
        descriptions: ['Raddurchmesser nahe Grenzmaß. Radsatz tauschen und zur Aufarbeitung geben.'],
      },
    ],
    parts: ['RS-1001'],
    hours: [4, 20],
    priorities: [['normal', 30], ['high', 50], ['critical', 20]],
  },
  fault_repair: {
    weight: 28,
    variants: [
      {
        title: 'Türstörung Wagen {car}',
        descriptions: ['Meldung Tf: "Tür {door} schließt nicht vollständig"; Fehlercode {code}.', 'Türantrieb ruckelt beim Öffnen.'],
      },
      {
        title: 'Fahrgastinformation ausgefallen',
        descriptions: ['Display in Wagen {car} bleibt schwarz, Ansagen funktionieren.'],
      },
      { title: 'Störung Stromabnehmer', descriptions: ['Stromabnehmer hebt nur verzögert, Schleifleiste prüfen.'] },
      { title: 'WC außer Betrieb', descriptions: ['WC gesperrt, Füllstandssensor meldet dauerhaft "voll".'] },
      {
        title: 'Störmeldung Zugsicherung',
        descriptions: ['Störmeldung im Display, Fehlerspeicher auslesen und bewerten.'],
      },
    ],
    parts: ['DI-0042', 'TA-3310', 'FG-6000', 'SL-4020', 'WC-0099'],
    hours: [1, 8],
    priorities: [['low', 15], ['normal', 50], ['high', 30], ['critical', 5]],
  },
  damage: {
    weight: 9,
    variants: [
      {
        title: 'Graffiti entfernen',
        descriptions: ['Graffiti an Wagen {car} & {car2}, Fläche ca. {m2} m². Reinigung durch Fremdfirma.'],
      },
      {
        title: 'Seitenscheibe gesprungen',
        descriptions: ['Steinschlag, Scheibe in Wagen {car} gesprungen; Fahrzeug bis zum Tausch nur eingeschränkt einsetzbar.'],
      },
      {
        title: 'Anfahrschaden Kupplung',
        descriptions: ['Kupplung bei Rangierfahrt beschädigt. Schadensmeldung liegt vor (Nr. {code}).'],
      },
      { title: 'Vandalismus Sitzbezüge', descriptions: ['Sitzbezüge in Wagen {car} aufgeschlitzt, 6 Plätze gesperrt.'] },
    ],
    parts: ['SC-5501', 'KU-9002', 'SB-1100'],
    hours: [1, 14],
    priorities: [['low', 20], ['normal', 50], ['high', 25], ['critical', 5]],
  },
  hvac: {
    weight: 7,
    variants: [
      {
        title: 'Klimaanlage Fahrgastraum kühlt nicht',
        descriptions: ['Klimaanlage meldet Störung "HVAC-ERR {n}"; Kältemittel prüfen, ggf. nachfüllen (R134a).'],
      },
      { title: 'Heizung Führerstand ausgefallen', descriptions: ['Führerstandsheizung ohne Funktion, Sicherung bereits geprüft.'] },
      { title: 'Wartung Klimagerät', descriptions: ['Filtermatten tauschen, Kondensator reinigen.'] },
    ],
    parts: ['KL-7720', 'FI-1200'],
    hours: [1, 6],
    priorities: [['low', 20], ['normal', 55], ['high', 25]],
  },
};

/** Freitext-Nachträge, wie sie Disponent:innen in die Beschreibung tippen */
const ADDENDA = [
  '=> Folgeauftrag, Befund siehe Prüfprotokoll.',
  '+ 2 Std. Nacharbeit wegen fehlender Dichtung',
  'Rücksprache mit Fahrzeugtechnik erfolgt; Freigabe liegt vor.',
];

const TYPE_WEIGHTS = Object.entries(TEMPLATES).map(([type, t]) => [type as WorkOrderType, t.weight] as const);

export function generateSeedData({ seed, referenceDate }: SeedOptions): SeedData {
  const rng = createRng(seed);
  const users = [...DEMO_USERS, ...generateTechnicians(rng)];
  const vehicles = generateVehicles(rng, referenceDate);
  const workOrders = generateWorkOrders(rng, referenceDate, users, vehicles);
  return { depots: DEPOTS.map((d) => ({ ...d })), users, vehicles, workOrders };
}

function generateTechnicians(rng: Rng): User[] {
  const takenIds = new Set(DEMO_USERS.map((u) => u.id));
  const takenNames = new Set<string>();
  const technicians: User[] = [];
  for (const depot of DEPOTS) {
    for (let i = 0; i < ADDITIONAL_TECHNICIANS[depot.code]!; i++) {
      let first: string;
      let last: string;
      do {
        first = pick(rng, FIRST_NAMES);
        last = pick(rng, LAST_NAMES);
      } while (takenNames.has(`${first} ${last}`));
      takenNames.add(`${first} ${last}`);
      let id = `${asciiSlug(first).charAt(0)}.${asciiSlug(last)}`;
      for (let n = 2; takenIds.has(id); n++) id = `${asciiSlug(first).charAt(0)}.${asciiSlug(last)}${n}`;
      takenIds.add(id);
      technicians.push({
        id,
        name: `${first} ${last}`,
        email: `${id}@depotdesk.example`,
        role: 'technician',
        depot: depot.code,
      });
    }
  }
  return technicians;
}

function generateVehicles(rng: Rng, referenceDate: Date): Vehicle[] {
  const vehicles: Vehicle[] = [];
  for (const depot of DEPOTS) {
    for (const series of FLEET[depot.code]!) {
      // Gleiche Baureihe in zwei Werken bekommt getrennte Nummernkreise
      const offset = vehicles.filter((v) => v.series === series.series).length;
      for (let i = 1; i <= series.count; i++) {
        const number = `${series.prefix} ${String(offset + i).padStart(3, '0')}`;
        const ageDays = intBetween(rng, 2 * 365, 18 * 365);
        vehicles.push({
          id: `veh-${series.prefix}${String(offset + i).padStart(3, '0')}`,
          fleetNumber: number,
          series: series.series,
          depot: depot.code,
          mileageKm: Math.round((ageDays * intBetween(rng, 280, 620)) / 10) * 10,
          commissionedOn: toDepotDate(addDays(referenceDate, -ageDays)),
        });
      }
    }
  }
  return vehicles;
}

function generateWorkOrders(rng: Rng, referenceDate: Date, users: User[], vehicles: Vehicle[]): WorkOrder[] {
  const now = referenceDate.getTime();
  const historyStart = now - HISTORY_DAYS * DAY_MS;
  const drafts: Omit<WorkOrder, 'id'>[] = [];

  for (const depot of DEPOTS) {
    const depotVehicles = vehicles.filter((v) => v.depot === depot.code);
    const technicians = users.filter((u) => u.role === 'technician' && u.depot === depot.code);
    const dispatcher = users.find((u) => u.role === 'dispatcher' && u.depot === depot.code)!;
    const count = Math.round((ORDERS_PER_YEAR[depot.code]! * HISTORY_DAYS) / 365);

    for (let i = 0; i < count; i++) {
      const type = weighted(rng, TYPE_WEIGHTS);
      const template = TEMPLATES[type];
      const vehicle = pick(rng, depotVehicles);
      const variant = pick(rng, template.variants);
      let description = fill(rng, pick(rng, variant.descriptions), vehicle);
      if (chance(rng, 0.04)) description = [pick(rng, ADDENDA), description].filter(Boolean).join('\n');

      // Aufträge entstehen zu Werkszeiten (ca. 05:00 bis 17:00 UTC)
      const createdDay = Math.floor((historyStart + rng() * (now - historyStart)) / DAY_MS) * DAY_MS;
      const createdAt = Math.min(now - 60_000, createdDay + (5 + rng() * 12) * 60 * 60 * 1000);
      const leadDays = intBetween(rng, 2, 40);
      const dueDate = toDepotDate(new Date(createdAt + leadDays * DAY_MS));
      const daysUntilDue = (Date.parse(`${dueDate}T12:00:00Z`) - now) / DAY_MS;
      const status = pickStatus(rng, daysUntilDue);

      const worked = status === 'done' || status === 'in_progress' || status === 'waiting_parts';
      let plannedStart =
        status === 'open' ? null : startOfShift(createdAt + intBetween(rng, 0, Math.max(1, leadDays - 1)) * DAY_MS);
      // Begonnene Aufträge können nicht erst in der Zukunft eingeplant sein
      if (worked && plannedStart !== null && plannedStart > now) plannedStart = createdAt + 30 * 60 * 1000;
      const completedAt =
        status === 'done'
          ? Math.min(now - 60_000, Math.max(createdAt + 3_600_000, (plannedStart ?? createdAt) + rng() * 3 * DAY_MS))
          : null;
      const touchedAt = Math.min(now - 60_000, Math.max(createdAt, completedAt ?? 0, plannedStart ?? 0));

      drafts.push({
        title: fill(rng, variant.title, vehicle),
        description,
        type,
        priority: weighted(rng, template.priorities),
        status,
        depot: depot.code,
        vehicleId: vehicle.id,
        assigneeId: status === 'open' && !chance(rng, 0.1) ? null : pick(rng, technicians).id,
        createdBy: dispatcher.id,
        createdAt: new Date(createdAt).toISOString(),
        updatedAt: new Date(touchedAt).toISOString(),
        plannedStart: plannedStart === null ? null : new Date(plannedStart).toISOString(),
        completedAt: completedAt === null ? null : new Date(completedAt).toISOString(),
        dueDate,
        laborHours: worked ? laborHours(rng, template.hours, status === 'done' ? 1 : 0.5) : 0,
        parts: worked && chance(rng, 0.7) ? pickParts(rng, template.parts) : [],
      });
    }
  }

  // Auftragsnummern werden pro Jahr fortlaufend in Reihenfolge der Erstellung vergeben
  drafts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sequences = new Map<number, number>();
  return drafts.map((draft) => {
    const year = new Date(draft.createdAt).getUTCFullYear();
    const seq = (sequences.get(year) ?? 0) + 1;
    sequences.set(year, seq);
    return { id: formatWorkOrderId(year, seq), ...draft };
  });
}

export function formatWorkOrderId(year: number, seq: number): string {
  return `WO-${year}-${String(seq).padStart(6, '0')}`;
}

function pickStatus(rng: Rng, daysUntilDue: number): WorkOrderStatus {
  if (daysUntilDue < -60) {
    return weighted<WorkOrderStatus>(rng, [['done', 96], ['cancelled', 4]]);
  }
  if (daysUntilDue < -14) {
    return weighted<WorkOrderStatus>(rng, [['done', 93], ['cancelled', 4], ['in_progress', 1.5], ['waiting_parts', 1.5]]);
  }
  if (daysUntilDue < 0) {
    return weighted<WorkOrderStatus>(rng, [
      ['done', 60], ['cancelled', 3], ['in_progress', 17], ['waiting_parts', 10], ['planned', 6], ['open', 4],
    ]);
  }
  return weighted<WorkOrderStatus>(rng, [
    ['open', 28], ['planned', 32], ['in_progress', 18], ['waiting_parts', 9], ['done', 11], ['cancelled', 2],
  ]);
}

function pickParts(rng: Rng, candidates: string[]): PartUsage[] {
  const count = Math.min(candidates.length, intBetween(rng, 1, 3));
  const chosen = new Set<string>();
  while (chosen.size < count) chosen.add(pick(rng, candidates));
  return [...chosen].map((partNumber) => {
    const part = PART_CATALOG[partNumber]!;
    return {
      partNumber,
      description: part.description,
      quantity: intBetween(rng, 1, part.maxQuantity),
      unitPriceEur: part.unitPriceEur,
    };
  });
}

function laborHours(rng: Rng, [min, max]: [number, number], share: number): number {
  return Math.max(0.5, Math.round((min + rng() * (max - min)) * share * 2) / 2);
}

function startOfShift(timestamp: number): number {
  return Math.floor(timestamp / DAY_MS) * DAY_MS + 4 * 60 * 60 * 1000;
}

function fill(rng: Rng, text: string, vehicle: Vehicle): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    switch (key) {
      case 'km':
        return vehicle.mileageKm.toLocaleString('de-DE');
      case 'car':
        return String(intBetween(rng, 1, 3));
      case 'car2':
        return String(intBetween(rng, 4, 6));
      case 'door':
        return `${intBetween(rng, 1, 4)} ${pick(rng, ['links', 'rechts'])}`;
      case 'bogie':
        return String(intBetween(rng, 1, 4));
      case 'axle':
        return String(intBetween(rng, 1, 8));
      case 'code':
        return `${pick(rng, ['D', 'B', 'T', 'Z'])}-${intBetween(rng, 100, 899)}`;
      case 'mm':
        return String(intBetween(rng, 0, 2));
      case 'mmd':
        return String(intBetween(rng, 1, 9));
      case 'len':
        return String(intBetween(rng, 15, 60));
      case 'kw':
        return String(intBetween(rng, 1, 52));
      case 'm2':
        return String(intBetween(rng, 2, 40));
      case 'level':
        return String(intBetween(rng, 1, 3));
      case 'n':
        return String(intBetween(rng, 10, 99));
      default:
        return key;
    }
  });
}

function asciiSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
}
