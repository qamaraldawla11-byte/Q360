import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import type postgres from 'postgres';

/**
 * Baseline catalog service.
 *
 * Compares a live PostgreSQL catalog against the committed 0000 Drizzle
 * snapshot (plus the canonical 0001 Restaurant partial-unique indexes). It can
 * produce a strict equivalence report, a pre-reconcile drift report, and an
 * additive schema-reconcile SQL script.
 */

export interface CatalogColumn {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
}

export interface CatalogPrimaryKey {
    name: string;
    columns: string[];
}

export interface CatalogTable {
    name: string;
    columns: CatalogColumn[];
    primaryKey: CatalogPrimaryKey | null;
}

export interface CatalogUniqueConstraint {
    table: string;
    name: string;
    columns: string[];
}

export interface CatalogIndex {
    table: string;
    name: string;
    columns: string[];
    unique: boolean;
    method: string;
    predicate: string | null;
}

export interface Catalog {
    tables: CatalogTable[];
    uniqueConstraints: CatalogUniqueConstraint[];
    indexes: CatalogIndex[];
}

export interface CatalogDiff {
    kind:
        | 'unexpected_table'
        | 'missing_table'
        | 'unexpected_column'
        | 'missing_column'
        | 'column_drift'
        | 'primary_key_drift'
        | 'unexpected_unique_constraint'
        | 'missing_unique_constraint'
        | 'unexpected_index'
        | 'missing_index'
        | 'index_drift';
    table?: string;
    column?: string;
    constraint?: string;
    index?: string;
    expected?: unknown;
    actual?: unknown;
    message: string;
}

export interface VerificationReport {
    ok: boolean;
    mode: 'strict' | 'pre_reconcile';
    diffs: CatalogDiff[];
    timestamp: string;
}

export interface ReconcileSqlResult {
    sql: string;
    missingTables: string[];
    missingColumns: { table: string; column: string }[];
    missingUniqueConstraints: { table: string; name: string }[];
    missingIndexes: string[];
}

export interface DestructiveScanResult {
    safe: boolean;
    violations: { statement: string; reason: string }[];
}

const SCHEMA = 'public';

const normalizeType = (value: string): string => {
    const v = value.toLowerCase().trim();
    // Drizzle snapshots use the short "timestamp" form for timestamp without tz.
    if (v === 'timestamp without time zone') return 'timestamp';
    return v;
};

const normalizeDefault = (value: string | null): string | null => {
    if (value === null || value === undefined) return null;
    let v = String(value).trim();
    // Strip outer parentheses.
    while (v.startsWith('(') && v.endsWith(')')) {
        v = v.slice(1, -1).trim();
    }
    // Strip casts that Drizzle snapshots omit or normalize.
    v = v.replace(/::[\w\s]+(\([\d,]+\))?/gi, '');
    // Canonicalise now() variants.
    if (/^now\s*\(\s*\)$/i.test(v)) return 'now()';
    if (/^current_timestamp\s*$/i.test(v)) return 'now()';
    v = v.trim();
    if (v === '') return null;
    return v;
};

const loadSnapshot = async (snapshotPath: string): Promise<any> => {
    const content = await readFile(snapshotPath, 'utf8');
    return JSON.parse(content);
};

const snapshotColumnToCatalog = (col: any): CatalogColumn => {
    const def = col.default;
    let defaultSql: string | null = null;
    if (def === undefined || def === null) {
        defaultSql = null;
    } else if (typeof def === 'boolean') {
        defaultSql = def ? 'true' : 'false';
    } else if (typeof def === 'number') {
        defaultSql = String(def);
    } else {
        defaultSql = String(def);
    }
    return {
        name: col.name,
        type: normalizeType(col.type),
        nullable: !col.notNull,
        default: normalizeDefault(defaultSql),
    };
};

export const loadExpectedCatalog = async (options: {
    snapshot0000Path: string;
    snapshot0001Path?: string;
    additionalSnapshotPaths?: string[];
}): Promise<Catalog> => {
    const snap0 = await loadSnapshot(options.snapshot0000Path);
    const tables: CatalogTable[] = [];
    const uniqueConstraints: CatalogUniqueConstraint[] = [];
    const indexes: CatalogIndex[] = [];

    const tableEntries = Object.entries<any>(snap0.tables).sort(([a], [b]) => a.localeCompare(b));
    for (const [, t] of tableEntries) {
        const name = t.name;
        const columns = Object.values<any>(t.columns).map(snapshotColumnToCatalog);
        const pkCols = columns.filter((c) => {
            const src = Object.values<any>(t.columns).find((sc: any) => sc.name === c.name);
            return src?.primaryKey === true;
        });
        // PostgreSQL names the primary-key index <table>_pkey by default.
        const primaryKey: CatalogPrimaryKey | null = pkCols.length
            ? {
                  name: `${name}_pkey`,
                  columns: pkCols.map((c) => c.name),
              }
            : null;

        tables.push({ name, columns, primaryKey });

        for (const uc of Object.values<any>(t.uniqueConstraints || {})) {
            uniqueConstraints.push({
                table: name,
                name: uc.name,
                columns: uc.columns,
            });
        }

        for (const idx of Object.values<any>(t.indexes || {})) {
            indexes.push(snapshotIndexToCatalog(name, idx));
        }
    }

    if (options.snapshot0001Path) {
        const snap1 = await loadSnapshot(options.snapshot0001Path);
        for (const t of Object.values<any>(snap1.tables || {})) {
            for (const idx of Object.values<any>(t.indexes || {})) {
                indexes.push(snapshotIndexToCatalog(t.name, idx));
            }
        }
    }

    for (const snapshotPath of options.additionalSnapshotPaths ?? []) {
        const snap = await loadSnapshot(snapshotPath);
        for (const t of Object.values<any>(snap.tables || {})) {
            for (const idx of Object.values<any>(t.indexes || {})) {
                indexes.push(snapshotIndexToCatalog(t.name, idx));
            }
        }
    }

    // PostgreSQL exposes primary-key and unique-constraint indexes in pg_indexes.
    // Add them to the expected index set so they are not flagged as unexpected.
    const indexNames = new Set(indexes.map((i) => i.name));
    for (const table of tables) {
        if (table.primaryKey && !indexNames.has(table.primaryKey.name)) {
            indexes.push({
                table: table.name,
                name: table.primaryKey.name,
                columns: table.primaryKey.columns,
                unique: true,
                method: 'btree',
                predicate: null,
            });
            indexNames.add(table.primaryKey.name);
        }
    }
    for (const uc of uniqueConstraints) {
        if (!indexNames.has(uc.name)) {
            indexes.push({
                table: uc.table,
                name: uc.name,
                columns: uc.columns,
                unique: true,
                method: 'btree',
                predicate: null,
            });
            indexNames.add(uc.name);
        }
    }

    return { tables, uniqueConstraints, indexes };
};

const snapshotIndexToCatalog = (tableName: string, idx: any): CatalogIndex => {
    const columns = idx.columns.map((c: any) => String(c.expression));
    return {
        table: tableName,
        name: idx.name,
        columns,
        unique: !!idx.isUnique,
        method: idx.method || 'btree',
        predicate: idx.where ? normalizePredicate(String(idx.where)) : null,
    };
};

export const captureActualCatalog = async (sql: postgres.Sql): Promise<Catalog> => {
    const tablesResult = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${SCHEMA}
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;

    // Each table's column and primary-key queries are independent, and tables
    // are independent of one another. Run them in parallel to keep catalog
    // capture from becoming the sequential bottleneck in readiness probes.
    const tableNames = tablesResult.map((row) => String(row.table_name));
    const tables = await Promise.all(
        tableNames.map(async (name) => {
            const [columns, primaryKey] = await Promise.all([
                captureColumns(sql, name),
                capturePrimaryKey(sql, name),
            ]);
            return { name, columns, primaryKey };
        }),
    );

    const [uniqueConstraints, indexes] = await Promise.all([
        captureUniqueConstraints(sql),
        captureIndexes(sql),
    ]);

    return { tables, uniqueConstraints, indexes };
};

const captureColumns = async (sql: postgres.Sql, tableName: string): Promise<CatalogColumn[]> => {
    const rows = await sql.unsafe(
        `
        SELECT a.attname AS name,
               pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
               NOT a.attnotnull AS nullable,
               pg_get_expr(d.adbin, a.attrelid) AS default_value
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
          AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
        `,
        [SCHEMA, tableName],
    );

    return rows.map((r: any) => ({
        name: String(r.name),
        type: normalizeType(r.type),
        nullable: Boolean(r.nullable),
        default: normalizeDefault(r.default_value),
    }));
};

const capturePrimaryKey = async (sql: postgres.Sql, tableName: string): Promise<CatalogPrimaryKey | null> => {
    const rows = await sql.unsafe(
        `
        SELECT con.conname AS name,
               array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) AS columns
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
        WHERE n.nspname = $1 AND c.relname = $2 AND con.contype = 'p'
        GROUP BY con.conname
        `,
        [SCHEMA, tableName],
    );
    if (rows.length === 0) return null;
    return { name: String(rows[0].name), columns: rows[0].columns };
};

const captureUniqueConstraints = async (sql: postgres.Sql): Promise<CatalogUniqueConstraint[]> => {
    const rows = await sql.unsafe(
        `
        SELECT c.relname AS table_name,
               con.conname AS name,
               array_agg(a.attname ORDER BY array_position(con.conkey, a.attnum)) AS columns
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
        WHERE n.nspname = $1 AND con.contype = 'u'
        GROUP BY c.relname, con.conname
        ORDER BY c.relname, con.conname
        `,
        [SCHEMA],
    );
    return rows.map((r: any) => ({
        table: String(r.table_name),
        name: String(r.name),
        columns: r.columns,
    }));
};

const captureIndexes = async (sql: postgres.Sql): Promise<CatalogIndex[]> => {
    const rows = await sql`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = ${SCHEMA}
        ORDER BY tablename, indexname
    `;

    return rows.map((r: any) => parseIndexDef(String(r.tablename), String(r.indexname), String(r.indexdef)));
};

const parseIndexDef = (tableName: string, indexName: string, def: string): CatalogIndex => {
    const normalized = def.replace(/\s+/g, ' ').trim();
    const regex =
        /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([^"\s]+)"?\s+)?ON\s+(?:"?public"?\.)?"?([^"\s]+)"?\s+(?:USING\s+(\w+)\s+)?\(([^)]+)\)(?:\s+WHERE\s+(.+))?$/i;
    const match = regex.exec(normalized);
    if (!match) {
        return { table: tableName, name: indexName, columns: [], unique: false, method: 'btree', predicate: null };
    }
    const unique = Boolean(match[1]);
    const method = (match[4] || 'btree').toLowerCase();
    const colPart = match[5];
    const predicate = match[6] || null;
    const columns = colPart
        .split(',')
        .map((s) =>
            s
                .trim()
                .replace(/^public\./, '')
                .replace(/^"/, '')
                .replace(/"$/, '')
                .split(' ')[0],
        );

    return {
        table: tableName,
        name: indexName,
        columns,
        unique,
        method,
        predicate: predicate ? normalizePredicate(predicate) : null,
    };
};

const normalizePredicate = (predicate: string): string => {
    return predicate
        .replace(/\s+/g, ' ')
        .replace(/public\./g, '')
        .replace(/"([^"]+)"\."([^"]+)"/g, '"$2"')
        .replace(/"/g, '')
        .replace(/[()]/g, '')
        // PostgreSQL 16 may append type casts (e.g. ''::text) to string literals
        // in index predicates; these are semantically equivalent for catalog
        // comparison purposes.
        .replace(/::[\w]+(\([^)]*\))?/g, '')
        .trim();
};

export const compareCatalogs = (
    expected: Catalog,
    actual: Catalog,
    options: { mode?: 'strict' | 'pre_reconcile'; allowExtraIndexNames?: string[]; allowExtraTableNames?: string[] } = {},
): VerificationReport => {
    const mode = options.mode || 'strict';
    const allowExtraIndexes = new Set(options.allowExtraIndexNames || []);
    const allowExtraTables = new Set(options.allowExtraTableNames || []);
    const diffs: CatalogDiff[] = [];

    const expectedTables = new Map(expected.tables.map((t) => [t.name, t]));
    const actualTables = new Map(actual.tables.map((t) => [t.name, t]));

    for (const actualName of actualTables.keys()) {
        if (!expectedTables.has(actualName) && !allowExtraTables.has(actualName)) {
            diffs.push({
                kind: 'unexpected_table',
                table: actualName,
                message: `Unexpected table: ${actualName}`,
            });
        }
    }

    for (const [expectedName, expectedTable] of expectedTables) {
        const actualTable = actualTables.get(expectedName);
        if (!actualTable) {
            diffs.push({
                kind: 'missing_table',
                table: expectedName,
                message: `Missing table: ${expectedName}`,
            });
            continue;
        }

        const expectedCols = new Map(expectedTable.columns.map((c) => [c.name, c]));
        const actualCols = new Map(actualTable.columns.map((c) => [c.name, c]));

        for (const actualColName of actualCols.keys()) {
            if (!expectedCols.has(actualColName)) {
                diffs.push({
                    kind: 'unexpected_column',
                    table: expectedName,
                    column: actualColName,
                    message: `Unexpected column ${expectedName}.${actualColName}`,
                });
            }
        }

        for (const [colName, expectedCol] of expectedCols) {
            const actualCol = actualCols.get(colName);
            if (!actualCol) {
                diffs.push({
                    kind: 'missing_column',
                    table: expectedName,
                    column: colName,
                    message: `Missing column ${expectedName}.${colName}`,
                });
                continue;
            }
            if (
                actualCol.type !== expectedCol.type ||
                actualCol.nullable !== expectedCol.nullable ||
                actualCol.default !== expectedCol.default
            ) {
                diffs.push({
                    kind: 'column_drift',
                    table: expectedName,
                    column: colName,
                    expected: expectedCol,
                    actual: actualCol,
                    message: `Column drift ${expectedName}.${colName}: expected ${JSON.stringify(expectedCol)}, actual ${JSON.stringify(actualCol)}`,
                });
            }
        }

        const pkMatches =
            (expectedTable.primaryKey === null && actualTable.primaryKey === null) ||
            (expectedTable.primaryKey !== null &&
                actualTable.primaryKey !== null &&
                JSON.stringify(expectedTable.primaryKey.columns) === JSON.stringify(actualTable.primaryKey.columns));
        if (!pkMatches) {
            diffs.push({
                kind: 'primary_key_drift',
                table: expectedName,
                expected: expectedTable.primaryKey,
                actual: actualTable.primaryKey,
                message: `Primary key drift on ${expectedName}`,
            });
        }
    }

    const expectedUC = new Map(expected.uniqueConstraints.map((uc) => [`${uc.table}.${uc.name}`, uc]));
    const actualUC = new Map(actual.uniqueConstraints.map((uc) => [`${uc.table}.${uc.name}`, uc]));
    for (const key of actualUC.keys()) {
        if (!expectedUC.has(key)) {
            const uc = actualUC.get(key)!;
            diffs.push({
                kind: 'unexpected_unique_constraint',
                table: uc.table,
                constraint: uc.name,
                message: `Unexpected unique constraint ${key}`,
            });
        }
    }
    for (const key of expectedUC.keys()) {
        if (!actualUC.has(key)) {
            const uc = expectedUC.get(key)!;
            diffs.push({
                kind: 'missing_unique_constraint',
                table: uc.table,
                constraint: uc.name,
                message: `Missing unique constraint ${key}`,
            });
        }
    }

    const expectedIdx = new Map(expected.indexes.map((i) => [i.name, i]));
    const actualIdx = new Map(actual.indexes.map((i) => [i.name, i]));
    for (const [name, idx] of actualIdx) {
        if (!expectedIdx.has(name) && !allowExtraIndexes.has(name) && !allowExtraTables.has(idx.table)) {
            diffs.push({
                kind: 'unexpected_index',
                table: idx.table,
                index: name,
                message: `Unexpected index ${name}`,
            });
        }
    }
    for (const [name, expectedIdxItem] of expectedIdx) {
        const actualIdxItem = actualIdx.get(name);
        if (!actualIdxItem) {
            diffs.push({
                kind: 'missing_index',
                table: expectedIdxItem.table,
                index: name,
                message: `Missing index ${name}`,
            });
            continue;
        }
        if (
            JSON.stringify(expectedIdxItem.columns) !== JSON.stringify(actualIdxItem.columns) ||
            expectedIdxItem.unique !== actualIdxItem.unique ||
            expectedIdxItem.method.toLowerCase() !== actualIdxItem.method.toLowerCase() ||
            expectedIdxItem.predicate !== actualIdxItem.predicate
        ) {
            diffs.push({
                kind: 'index_drift',
                table: expectedIdxItem.table,
                index: name,
                expected: expectedIdxItem,
                actual: actualIdxItem,
                message: `Index drift ${name}`,
            });
        }
    }

    const relevantDiffs = diffs.filter((d) => {
        if (mode === 'pre_reconcile') {
            return !['missing_table', 'missing_column', 'missing_unique_constraint', 'missing_index'].includes(d.kind);
        }
        return true;
    });

    return {
        ok: relevantDiffs.length === 0,
        mode,
        diffs: relevantDiffs,
        timestamp: new Date().toISOString(),
    };
};

export const verifyCatalogEquivalence = async (
    sql: postgres.Sql,
    options: {
        snapshot0000Path: string;
        snapshot0001Path?: string;
        mode?: 'strict' | 'pre_reconcile';
        allowExtraTableNames?: string[];
    },
): Promise<VerificationReport> => {
    const expected = await loadExpectedCatalog(options);
    const actual = await captureActualCatalog(sql);
    const extraIndexNames = expected.indexes.filter((i) => i.predicate).map((i) => i.name);
    return compareCatalogs(expected, actual, {
        mode: options.mode || 'strict',
        allowExtraIndexNames: extraIndexNames,
        allowExtraTableNames: options.allowExtraTableNames,
    });
};

const parseMigrationSql = (content: string): { createTable: Map<string, string>; createIndex: Map<string, string> } => {
    const statements = content
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

    const createTable = new Map<string, string>();
    const createIndex = new Map<string, string>();

    for (const stmt of statements) {
        const singleLine = stmt.replace(/\s+/g, ' ').trim();
        const tableMatch = /CREATE TABLE\s+"?([^"\s]+)"?/i.exec(singleLine);
        if (tableMatch) {
            createTable.set(tableMatch[1], stmt);
            continue;
        }
        const indexMatch = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([^"\s]+)"?/i.exec(singleLine);
        if (indexMatch) {
            createIndex.set(indexMatch[1], stmt);
        }
    }

    return { createTable, createIndex };
};

const quoteId = (id: string): string => `"${id.replace(/"/g, '""')}"`;

const columnDefSql = (col: CatalogColumn): string => {
    const parts = [quoteId(col.name), col.type.toUpperCase()];
    if (col.default !== null) {
        parts.push(`DEFAULT ${col.default}`);
    }
    if (!col.nullable) {
        parts.push('NOT NULL');
    }
    return parts.join(' ');
};

export const generateAdditiveReconcileSql = async (
    sql: postgres.Sql,
    options: {
        snapshot0000Path: string;
        migration0000SqlPath: string;
    },
): Promise<ReconcileSqlResult> => {
    const expected = await loadExpectedCatalog({ snapshot0000Path: options.snapshot0000Path });
    const actual = await captureActualCatalog(sql);

    const migrationSql = await readFile(options.migration0000SqlPath, 'utf8');
    const { createTable, createIndex } = parseMigrationSql(migrationSql);

    const expectedTables = new Map(expected.tables.map((t) => [t.name, t]));
    const actualTables = new Map(actual.tables.map((t) => [t.name, t]));

    const statements: string[] = [];
    const missingTables: string[] = [];
    const missingColumns: { table: string; column: string }[] = [];
    const missingUniqueConstraints: { table: string; name: string }[] = [];
    const missingIndexes: string[] = [];

    for (const [tableName, expectedTable] of expectedTables) {
        const actualTable = actualTables.get(tableName);
        if (!actualTable) {
            const stmt = createTable.get(tableName);
            if (stmt) {
                statements.push(stmt);
                missingTables.push(tableName);
            }
            continue;
        }

        const actualCols = new Map(actualTable.columns.map((c) => [c.name, c]));
        for (const expectedCol of expectedTable.columns) {
            if (!actualCols.has(expectedCol.name)) {
                statements.push(`ALTER TABLE ${quoteId(tableName)} ADD COLUMN ${columnDefSql(expectedCol)};`);
                missingColumns.push({ table: tableName, column: expectedCol.name });
            }
        }
    }

    const expectedUC = new Map(expected.uniqueConstraints.map((uc) => [`${uc.table}.${uc.name}`, uc]));
    const actualUC = new Map(actual.uniqueConstraints.map((uc) => [`${uc.table}.${uc.name}`, uc]));
    for (const [key, uc] of expectedUC) {
        if (!actualUC.has(key)) {
            const table = quoteId(uc.table);
            const name = quoteId(uc.name);
            const cols = uc.columns.map(quoteId).join(', ');
            statements.push(`ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${cols});`);
            missingUniqueConstraints.push({ table: uc.table, name: uc.name });
        }
    }

    const expectedIdx = new Map(expected.indexes.map((i) => [i.name, i]));
    const actualIdx = new Map(actual.indexes.map((i) => [i.name, i]));
    for (const [name, idx] of expectedIdx) {
        if (!actualIdx.has(name)) {
            const stmt = createIndex.get(name);
            if (stmt) {
                statements.push(stmt);
                missingIndexes.push(name);
            }
        }
    }

    return {
        sql: statements.join('\n\n'),
        missingTables,
        missingColumns,
        missingUniqueConstraints,
        missingIndexes,
    };
};

export const scanSqlForDestructiveStatements = (sqlText: string): DestructiveScanResult => {
    // Normalize Drizzle breakpoint markers so they do not confuse the scanner.
    const cleaned = sqlText.replace(/-->\s*statement-breakpoint\s*/g, ' ');
    const statements = cleaned
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);

    const violations: { statement: string; reason: string }[] = [];

    for (const raw of statements) {
        const stmt = raw.replace(/\s+/g, ' ').toUpperCase();
        let reason: string | null = null;

        if (/\bDROP\b/.test(stmt)) reason = 'contains DROP';
        else if (/\bTRUNCATE\b/.test(stmt)) reason = 'contains TRUNCATE';
        else if (/\bDELETE\b/.test(stmt)) reason = 'contains DELETE';
        else if (/\bUPDATE\b/.test(stmt)) reason = 'contains UPDATE';
        else if (/\bINSERT\b/.test(stmt)) reason = 'contains INSERT';
        else if (/\bALTER\s+TABLE\b.*\bDROP\b/.test(stmt)) reason = 'contains ALTER TABLE ... DROP';
        else if (/\bALTER\s+TABLE\b.*\bALTER\s+COLUMN\b.*\bTYPE\b/.test(stmt)) reason = 'contains type conversion';
        else if (
            !/^\s*(CREATE\s+(TABLE|(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?)|ALTER\s+TABLE\s+\S+\s+ADD\s+(COLUMN|CONSTRAINT))/.test(
                stmt,
            )
        ) {
            reason = 'statement is not an approved additive DDL pattern';
        }

        if (reason) {
            violations.push({
                statement: raw.length > 200 ? raw.slice(0, 200) + '...' : raw,
                reason,
            });
        }
    }

    return { safe: violations.length === 0, violations };
};

export const hashFile = async (filePath: string): Promise<string> => {
    const bytes = await readFile(filePath);
    return createHash('sha256').update(bytes).digest('hex');
};

export const snapshotMigrationHash = async (migrationSqlPath: string): Promise<string> => {
    return hashFile(migrationSqlPath);
};

export const defaultSnapshotPaths = (baseDir?: string) => {
    const root = baseDir || process.cwd();
    return {
        snapshot0000Path: path.join(root, 'drizzle', 'meta', '0000_snapshot.json'),
        snapshot0001Path: path.join(root, 'drizzle', 'meta', '0001_snapshot.json'),
        migration0000SqlPath: path.join(root, 'drizzle', '0000_wave0_initial.sql'),
    };
};
