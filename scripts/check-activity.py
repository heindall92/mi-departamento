#!/usr/bin/env python3
"""Comprobación sin dependencias de data/activity.json (la validación completa
contra el JSON Schema está en scripts/validate-activity.mjs)."""
import json, re, sys
act_path, office_path = (sys.argv[1:3] + [None, None])[:2]
act = json.load(open(act_path or 'data/activity.json'))
office = json.load(open(office_path or 'data/office.json'))
ids = {a['id'] for r in office['rooms'] for a in r['agents']}
err = []
if not re.match(r'^1\.\d+\.\d+$', str(act.get('schemaVersion', ''))): err.append('schemaVersion debe ser 1.x.y')
if act.get('source') not in ('simulated', 'live'): err.append('source debe ser simulated o live')
for k, v in act.get('agents', {}).items():
    if k not in ids: err.append(f'agents: id desconocido {k}')
    if v.get('state') not in ('working', 'needs_you', 'review'): err.append(f'agents.{k}: state no válido')
for it in act.get('reviewQueue', []):
    if it.get('agent') not in ids: err.append(f"reviewQueue {it.get('id')}: agente desconocido")
    if it.get('kind') not in ('approval', 'review'): err.append(f"reviewQueue {it.get('id')}: kind no válido")
for h in act.get('handoffs', []):
    if h.get('from') not in ids or h.get('to') not in ids: err.append(f"handoffs {h.get('id')}: agente desconocido")
for r in act.get('routines', []):
    if r.get('agent') not in ids: err.append(f"routines {r.get('id')}: agente desconocido")
    if r.get('animation') not in ('sunrise', 'coins', 'bell', 'hearts', 'radar', 'scan', 'gear'): err.append(f"routines {r.get('id')}: animation no válida")
if err:
    print('\n'.join(err)); sys.exit(1)
print('activity.json coherente con office.json')
