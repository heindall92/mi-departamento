// Valida data/activity.json contra data/activity.schema.json (requiere ajv y ajv-formats).
// Uso: node scripts/validate-activity.mjs   (NODE_PATH puede apuntar a donde estén instalados)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.AJV_FROM || import.meta.url);
const Ajv = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default || require('ajv-formats');
const root = new URL('..', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('data/activity.schema.json', root)));
const data = JSON.parse(readFileSync(new URL('data/activity.json', root)));
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
const ok = ajv.validate(schema, data);
if (!ok) { console.error(ajv.errors); process.exit(1); }
console.log('activity.json válido');
