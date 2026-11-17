import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataType, newDb } from "pg-mem";
import request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ClockService } from "../src/common/clock.service";
import { ALL_ENTITIES } from "../src/entities";
import { SEED_PASSWORD, seed } from "../src/seed/seed";

/** "Today" in the e2e tests: a Monday with no public holidays in the following weeks. */
export const TODAY = "2026-06-01";

export const ADMIN = "admin@example.com";
export const MANAGER1 = "manager1@example.com"; // team A: employee1-4
export const MANAGER2 = "manager2@example.com"; // team B: employee5-8
export const employee = (n: number) => `employee${n}@example.com`;

export const ANNUAL = 1;
export const SICK = 2;
export const UNPAID = 3;

export interface ApiClient {
  get(url: string): request.Test;
  post(url: string, body?: object): request.Test;
  patch(url: string, body?: object): request.Test;
  put(url: string, body?: object): request.Test;
  delete(url: string): request.Test;
}

export interface TestApp {
  app: INestApplication;
  ds: DataSource;
  clock: ClockService;
  ids: { admin: number; manager1: number; manager2: number; employees: number[] };
  /** An HTTP client that is signed in as the given seeded user. */
  as(email: string): ApiClient;
  anonymous(): ApiClient;
  /** A client using a token the test obtained itself (for users created during the test). */
  withToken(token: string): ApiClient;
  close(): Promise<void>;
}

/**
 * Boots the real Nest app (real guards, validation and services) on an in-memory Postgres.
 * Row locks are a Postgres feature that pg-mem does not implement, so they are disabled here.
 */
export async function createTestApp(): Promise<TestApp> {
  process.env.JWT_SECRET = "test-secret";
  process.env.DB_ROW_LOCKS = "false";

  const db = newDb();
  db.public.registerFunction({
    name: "current_database",
    returns: DataType.text,
    implementation: () => "test",
  });
  db.public.registerFunction({
    name: "version",
    returns: DataType.text,
    implementation: () => "PostgreSQL 14.0",
  });
  const ds: DataSource = await db.adapters.createTypeormDataSource({
    type: "postgres",
    entities: ALL_ENTITIES,
    synchronize: false,
  });
  await ds.initialize();
  // pg-mem cannot run TypeORM's drop-all routine, but the database is brand new anyway.
  await ds.synchronize();

  const seeded = await seed(ds, { today: TODAY, passwordRounds: 4 });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(async () => ds)],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const clock = app.get(ClockService);
  clock.fixed = TODAY;

  const server = app.getHttpServer();
  const emails = [ADMIN, MANAGER1, MANAGER2, ...seeded.employees.map((_, i) => employee(i + 1))];
  const tokens = new Map<string, string>();
  for (const email of emails) {
    const res = await request(server).post("/auth/login").send({ email, password: SEED_PASSWORD });
    if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
    tokens.set(email, res.body.accessToken);
  }

  const client = (token?: string): ApiClient => {
    const auth = (t: request.Test) => (token ? t.set("Authorization", `Bearer ${token}`) : t);
    return {
      get: (url) => auth(request(server).get(url)),
      post: (url, body) => auth(request(server).post(url)).send(body),
      patch: (url, body) => auth(request(server).patch(url)).send(body),
      put: (url, body) => auth(request(server).put(url)).send(body),
      delete: (url) => auth(request(server).delete(url)),
    };
  };

  return {
    app,
    ds,
    clock,
    ids: {
      admin: seeded.admin.id,
      manager1: seeded.managers[0].id,
      manager2: seeded.managers[1].id,
      employees: seeded.employees.map((e) => e.id),
    },
    as: (email) => {
      const token = tokens.get(email);
      if (!token) throw new Error(`Unknown test user ${email}`);
      return client(token);
    },
    anonymous: () => client(),
    withToken: (token) => client(token),
    close: () => app.close(),
  };
}

/** Removes the seeded requests so a test starts from a known state. */
export async function clearRequests(ds: DataSource) {
  await ds.query("DELETE FROM leave_requests");
}
