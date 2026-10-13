export interface AppConfig {
  port: number;
  authHeader: string;
  seed: number;
  seedReferenceDate: Date;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const referenceDate = env.SEED_REFERENCE_DATE ? new Date(env.SEED_REFERENCE_DATE) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error(`SEED_REFERENCE_DATE ist kein gültiges Datum: ${env.SEED_REFERENCE_DATE}`);
  }
  return {
    port: Number(env.PORT ?? 3000),
    authHeader: (env.AUTH_HEADER ?? 'x-depotdesk-user').toLowerCase(),
    seed: Number(env.SEED ?? 42),
    seedReferenceDate: referenceDate,
  };
}
