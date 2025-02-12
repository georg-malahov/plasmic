import { Config } from "@react-awesome-query-builder/antd";
import { ensure } from "../../common";
import { DEVFLAGS } from "../../devflags";
import { DATA_SOURCE_LOWER } from "../Labels";
import {
  AirtableDataSource,
  AIRTABLE_META,
  QueryBuilderAirtableConfig,
} from "./airtable-meta";
import { DataSourceMeta } from "./data-sources";
import { DynamoDbDataSource, DYNAMODB_META } from "./dynamodb-meta";
import { FakeDataSource, FAKE_META, QueryBuilderFakeConfig } from "./fake-meta";
import {
  GoogleSheetsDataSource,
  GOOGLE_SHEETS_META,
  QueryBuilderGoogleSheetsConfig,
} from "./google-sheets-meta";
import { GraphqlDataSource, GRAPHQL_META } from "./graphql-meta";
import { HttpDataSource, HTTP_META } from "./http-meta";
import {
  PlasmicCMSDataSource,
  PLASMIC_CMS_META,
  QueryBuilderPlasmicCMSConfig,
} from "./plasmic-cms-meta";
import {
  PostgresDataSource,
  POSTGRES_META,
  QueryBuilderPostgresConfig,
} from "./postgres-meta";
import {
  QueryBuilderSupabaseConfig,
  SupabaseDataSource,
  SUPABASE_META,
} from "./supabase-meta";
import {
  QueryBuilderTutorialDbConfig,
  TutorialDbDataSource,
  TUTORIALDB_META,
} from "./tutorialdb-meta";
import { ZapierDataSource, ZAPIER_META } from "./zapier-meta";

export type GenericDataSource =
  | AirtableDataSource
  | HttpDataSource
  | GraphqlDataSource
  | PlasmicCMSDataSource
  | SupabaseDataSource
  | PostgresDataSource
  | GoogleSheetsDataSource
  | ZapierDataSource
  | TutorialDbDataSource
  | DynamoDbDataSource
  | FakeDataSource;

const DATA_SOURCE_METAS = {
  airtable: AIRTABLE_META,
  http: HTTP_META,
  graphql: GRAPHQL_META,
  "plasmic-cms": PLASMIC_CMS_META,
  supabase: SUPABASE_META,
  postgres: POSTGRES_META,
  "google-sheets": GOOGLE_SHEETS_META,
  zapier: ZAPIER_META,
  tutorialdb: TUTORIALDB_META,
  fake: FAKE_META,
  dynamodb: DYNAMODB_META,
} as const;

export type DataSourceType = keyof typeof DATA_SOURCE_METAS;

export function getDataSourceMeta(type: string): DataSourceMeta {
  return ensure(
    DATA_SOURCE_METAS[type],
    () => `Unexpected ${DATA_SOURCE_LOWER} type ${type}`
  );
}

export function getAllPublicDataSourceMetas() {
  return getAllDataSourceMetas().filter(
    (meta) => !DEVFLAGS.hiddenDataSources.includes(meta.id)
  );
}

export function getAllDataSourceMetas() {
  return Object.values(DATA_SOURCE_METAS);
}

export function getAllDataSourceTypes() {
  return getAllDataSourceMetas().map((s) => s.id);
}

export const DATA_SOURCE_QUERY_BUILDER_CONFIG = {
  "plasmic-cms": QueryBuilderPlasmicCMSConfig,
  supabase: QueryBuilderSupabaseConfig,
  postgres: QueryBuilderPostgresConfig,
  airtable: QueryBuilderAirtableConfig,
  "google-sheets": QueryBuilderGoogleSheetsConfig,
  dynamodb: QueryBuilderGoogleSheetsConfig,
  tutorialdb: QueryBuilderTutorialDbConfig,
  fake: QueryBuilderFakeConfig,
};

export function getDataSourceQueryBuilderConfig(type: string): Config {
  return ensure(
    DATA_SOURCE_QUERY_BUILDER_CONFIG[type],
    () => `Unexpected ${DATA_SOURCE_LOWER} type ${type}`
  );
}
