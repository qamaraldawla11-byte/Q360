import { sql } from 'drizzle-orm';
import type postgres from 'postgres';

export interface SchemaFingerprint {
    generatedAt: string;
    tables: TableFingerprint[];
}

export interface TableFingerprint {
    schema: string;
    name: string;
    columns: ColumnFingerprint[];
    indexes: IndexFingerprint[];
}

export interface ColumnFingerprint {
    name: string;
    dataType: string;
    isNullable: boolean;
    defaultValue: string | null;
}

export interface IndexFingerprint {
    name: string;
    definition: string;
}

export interface FingerprintDiff {
    addedTables: string[];
    removedTables: string[];
    changedTables: TableChange[];
}

export interface TableChange {
    table: string;
    addedColumns: string[];
    removedColumns: string[];
    changedColumns: string[];
    addedIndexes: string[];
    removedIndexes: string[];
    changedIndexes: string[];
}

const normalizeDefault = (value: string | null): string | null => {
    if (value === null) return null;
    // Drop nextval/sequence defaults because sequence names vary across restores.
    if (value.startsWith('nextval(')) return '<sequence>';
    return value;
};

/**
 * Capture a deterministic schema fingerprint from a Postgres client.
 * The fingerprint includes tables, columns, and index definitions from the
 * public schema. It intentionally excludes volatile metadata such as OIDs,
 * sequence last values, and statistic counters.
 */
export const captureSchemaFingerprint = async (
    queryClient: postgres.Sql,
): Promise<SchemaFingerprint> => {
    const tablesResult = await queryClient`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;

    const tables: TableFingerprint[] = [];

    for (const tableRow of tablesResult) {
        const schema = String(tableRow.table_schema);
        const name = String(tableRow.table_name);

        const columnsResult = await queryClient`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = ${schema}
              AND table_name = ${name}
            ORDER BY ordinal_position
        `;

        const columns: ColumnFingerprint[] = columnsResult.map((columnRow) => ({
            name: String(columnRow.column_name),
            dataType: String(columnRow.data_type),
            isNullable: String(columnRow.is_nullable).toUpperCase() === 'YES',
            defaultValue: normalizeDefault(columnRow.column_default ? String(columnRow.column_default) : null),
        }));

        const indexesResult = await queryClient`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = ${schema}
              AND tablename = ${name}
            ORDER BY indexname
        `;

        const indexes: IndexFingerprint[] = indexesResult.map((indexRow) => ({
            name: String(indexRow.indexname),
            definition: String(indexRow.indexdef),
        }));

        tables.push({ schema, name, columns, indexes });
    }

    return {
        generatedAt: new Date().toISOString(),
        tables,
    };
};

const tableKey = (table: TableFingerprint): string => `${table.schema}.${table.name}`;

/**
 * Compare two schema fingerprints and return a structural diff.
 * The diff is deterministic and safe to log because it contains only object
 * names and definitions, not data or secrets.
 */
export const diffSchemaFingerprints = (
    before: SchemaFingerprint,
    after: SchemaFingerprint,
): FingerprintDiff => {
    const beforeMap = new Map(before.tables.map((table) => [tableKey(table), table]));
    const afterMap = new Map(after.tables.map((table) => [tableKey(table), table]));

    const beforeKeys = Array.from(beforeMap.keys()).sort();
    const afterKeys = Array.from(afterMap.keys()).sort();

    const addedTables = afterKeys.filter((key) => !beforeMap.has(key));
    const removedTables = beforeKeys.filter((key) => !afterMap.has(key));
    const commonTables = beforeKeys.filter((key) => afterMap.has(key));

    const changedTables: TableChange[] = commonTables.map((key) => {
        const beforeTable = beforeMap.get(key)!;
        const afterTable = afterMap.get(key)!;

        const beforeColumns = new Map(beforeTable.columns.map((column) => [column.name, column]));
        const afterColumns = new Map(afterTable.columns.map((column) => [column.name, column]));
        const beforeColumnNames = Array.from(beforeColumns.keys()).sort();
        const afterColumnNames = Array.from(afterColumns.keys()).sort();

        const addedColumns = afterColumnNames.filter((name) => !beforeColumns.has(name));
        const removedColumns = beforeColumnNames.filter((name) => !afterColumns.has(name));
        const commonColumns = beforeColumnNames.filter((name) => afterColumns.has(name));
        const changedColumns = commonColumns.filter((name) => {
            const beforeColumn = beforeColumns.get(name)!;
            const afterColumn = afterColumns.get(name)!;
            return (
                beforeColumn.dataType !== afterColumn.dataType ||
                beforeColumn.isNullable !== afterColumn.isNullable ||
                beforeColumn.defaultValue !== afterColumn.defaultValue
            );
        });

        const beforeIndexes = new Map(beforeTable.indexes.map((index) => [index.name, index]));
        const afterIndexes = new Map(afterTable.indexes.map((index) => [index.name, index]));
        const beforeIndexNames = Array.from(beforeIndexes.keys()).sort();
        const afterIndexNames = Array.from(afterIndexes.keys()).sort();

        const addedIndexes = afterIndexNames.filter((name) => !beforeIndexes.has(name));
        const removedIndexes = beforeIndexNames.filter((name) => !afterIndexes.has(name));
        const commonIndexes = beforeIndexNames.filter((name) => afterIndexes.has(name));
        const changedIndexes = commonIndexes.filter((name) => {
            const beforeIndex = beforeIndexes.get(name)!;
            const afterIndex = afterIndexes.get(name)!;
            return beforeIndex.definition !== afterIndex.definition;
        });

        return {
            table: key,
            addedColumns,
            removedColumns,
            changedColumns,
            addedIndexes,
            removedIndexes,
            changedIndexes,
        };
    }).filter((change) =>
        change.addedColumns.length > 0 ||
        change.removedColumns.length > 0 ||
        change.changedColumns.length > 0 ||
        change.addedIndexes.length > 0 ||
        change.removedIndexes.length > 0 ||
        change.changedIndexes.length > 0,
    );

    return {
        addedTables,
        removedTables,
        changedTables,
    };
};

/**
 * Serialize a fingerprint to a deterministic JSON string suitable for hashing
 * or diffing. Secrets and volatile metadata are excluded by design.
 */
export const serializeFingerprint = (fingerprint: SchemaFingerprint): string =>
    JSON.stringify(fingerprint, Object.keys(fingerprint).sort());
