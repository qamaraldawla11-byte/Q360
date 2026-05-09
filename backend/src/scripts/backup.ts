/**
 * One OS - Automated SQLite Backup Script
 * 
 * Creates timestamped backups of the SQLite database.
 * Designed to run via cron job or Railway scheduled task.
 * 
 * Usage: npx tsx src/scripts/backup.ts
 * 
 * Environment variables:
 *   BACKUP_DIR - Directory to store backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Days to keep backups (default: 14)
 */

import { copyFileSync, mkdirSync, readdirSync, unlinkSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';

const DB_PATH = './data/one-os.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

function formatDate(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function createBackup(): string | null {
    // Ensure backup directory exists
    mkdirSync(BACKUP_DIR, { recursive: true });

    // Check if source database exists
    if (!existsSync(DB_PATH)) {
        console.error('❌ Database not found:', DB_PATH);
        return null;
    }

    const timestamp = formatDate(new Date());
    const backupName = `one-os-backup-${timestamp}.db`;
    const backupPath = join(BACKUP_DIR, backupName);

    try {
        // Copy the main database file
        copyFileSync(DB_PATH, backupPath);

        // Also copy WAL file if it exists (for consistency)
        const walPath = `${DB_PATH}-wal`;
        if (existsSync(walPath)) {
            copyFileSync(walPath, `${backupPath}-wal`);
        }

        const stats = statSync(backupPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ Backup created: ${backupName} (${sizeMB} MB)`);
        return backupPath;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        return null;
    }
}

function cleanOldBackups(): void {
    if (!existsSync(BACKUP_DIR)) return;

    const now = Date.now();
    const cutoffMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const files = readdirSync(BACKUP_DIR);
    let cleaned = 0;

    for (const file of files) {
        if (!file.startsWith('one-os-backup-')) continue;

        const filePath = join(BACKUP_DIR, file);
        const stats = statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > cutoffMs) {
            try {
                unlinkSync(filePath);
                cleaned++;
            } catch (e) {
                console.warn(`⚠️ Failed to delete old backup: ${file}`);
            }
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} old backup(s) (>${RETENTION_DAYS} days)`);
    }
}

function listBackups(): void {
    if (!existsSync(BACKUP_DIR)) {
        console.log('No backups found.');
        return;
    }

    const files = readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('one-os-backup-') && f.endsWith('.db'))
        .sort()
        .reverse();

    console.log(`\n📁 Available backups (${files.length}):`);
    for (const file of files.slice(0, 10)) {
        const stats = statSync(join(BACKUP_DIR, file));
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        const date = new Date(stats.mtime).toLocaleString();
        console.log(`   ${file} - ${sizeMB} MB - ${date}`);
    }
    if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more`);
    }
}

// Main execution
console.log('🔄 One OS Database Backup');
console.log(`   Source: ${DB_PATH}`);
console.log(`   Target: ${BACKUP_DIR}`);
console.log(`   Retention: ${RETENTION_DAYS} days`);
console.log('');

const backupPath = createBackup();
if (backupPath) {
    cleanOldBackups();
    listBackups();
    console.log('\n✅ Backup complete');
    process.exit(0);
} else {
    console.log('\n❌ Backup failed');
    process.exit(1);
}
