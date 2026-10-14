// Tenants added from the back office, stored in DynamoDB (table: TENANTS_TABLE,
// partition key `slug`). Optional: with TENANTS_TABLE unset, only the TENANTS
// env var is used.
import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  ScanCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { isValidTenantSlug } from "./tenant";

export interface DbTenant {
  slug: string;
  name: string;
  createdAt: string;
}

// Each process re-reads the table at most this often. A tenant added on one
// compute instance is visible on the others within this window.
const CACHE_MS = 10_000;

const g = globalThis as typeof globalThis & {
  __tenantStore?: { client?: DynamoDBClient; at: number; tenants: DbTenant[]; inflight?: Promise<DbTenant[]> };
};
const state = (g.__tenantStore ??= { at: 0, tenants: [] });

function table(): string {
  return (process.env.TENANTS_TABLE ?? "").trim();
}

export function storeEnabled(): boolean {
  return table() !== "";
}

function client(): DynamoDBClient {
  state.client ??= new DynamoDBClient({ region: process.env.TENANTS_TABLE_REGION?.trim() || undefined });
  return state.client;
}

function fromItem(item: Record<string, AttributeValue>): DbTenant {
  return {
    slug: item.slug?.S ?? "",
    name: item.name?.S ?? "",
    createdAt: item.createdAt?.S ?? "",
  };
}

async function scanAll(): Promise<DbTenant[]> {
  const out: DbTenant[] = [];
  let startKey: Record<string, AttributeValue> | undefined;
  do {
    const res = await client().send(new ScanCommand({ TableName: table(), ExclusiveStartKey: startKey }));
    for (const item of res.Items ?? []) out.push(fromItem(item));
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return out.filter((t) => isValidTenantSlug(t.slug)).sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Cached list of DB tenants. Throws if the table can't be read. */
export async function listDbTenants(): Promise<DbTenant[]> {
  if (!storeEnabled()) return [];
  if (Date.now() - state.at < CACHE_MS) return state.tenants;
  state.inflight ??= scanAll()
    .then((tenants) => {
      state.tenants = tenants;
      state.at = Date.now();
      return tenants;
    })
    .finally(() => {
      state.inflight = undefined;
    });
  return state.inflight;
}

/** Returns false if the slug already exists. */
export async function addDbTenant(slug: string, name: string): Promise<boolean> {
  try {
    await client().send(
      new PutItemCommand({
        TableName: table(),
        Item: { slug: { S: slug }, name: { S: name }, createdAt: { S: new Date().toISOString() } },
        ConditionExpression: "attribute_not_exists(slug)",
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
  state.at = 0;
  return true;
}

export async function deleteDbTenant(slug: string): Promise<void> {
  await client().send(new DeleteItemCommand({ TableName: table(), Key: { slug: { S: slug } } }));
  state.at = 0;
}
