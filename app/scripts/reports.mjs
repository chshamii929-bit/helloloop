import { createStore } from '../server/store.mjs';
import { resolve } from 'node:path';
const store=createStore(resolve(process.env.DATA_DIR||'.data','chitchat.sqlite'));
console.table(store.reports());store.close();

