import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks (owner TEXT NOT NULL, target TEXT NOT NULL, PRIMARY KEY(owner,target));
    CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, PRIMARY KEY(a,b));
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);`);
  return {
    user: id => db.prepare('SELECT id,name FROM users WHERE id=?').get(id),
    saveUser: (id,name) => db.prepare('INSERT INTO users VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').run(id,name,Date.now()),
    blocked: (a,b) => !!db.prepare('SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)').get(a,b,b,a),
    block(a,b) {
      db.prepare('INSERT OR IGNORE INTO blocks VALUES (?,?)').run(a,b);
      db.prepare('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)').run(a,b,b,a);
    },
    friend: (a,b) => !!db.prepare('SELECT 1 FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)').get(a,b,b,a),
    addFriend(a,b) { const pair=[a,b].sort(); db.prepare('INSERT OR IGNORE INTO friends VALUES (?,?)').run(...pair); },
    friends: id => db.prepare('SELECT u.id,u.name FROM friends f JOIN users u ON u.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE f.a=? OR f.b=?').all(id,id,id),
    report: (id,a,b,reason) => db.prepare('INSERT INTO reports VALUES (?,?,?,?,?)').run(id,a,b,reason,Date.now()),
    reports: () => db.prepare('SELECT * FROM reports ORDER BY created DESC LIMIT 100').all(),
    close: () => db.close(),
  };
}

