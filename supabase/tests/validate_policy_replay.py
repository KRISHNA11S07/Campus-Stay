"""Offline PostgreSQL parsing and policy-catalog simulation; no DB connections."""
import re
import subprocess
from pathlib import Path

from pglast import parse_sql, parse_plpgsql
from pglast.stream import RawStream

ROOT = Path(__file__).resolve().parents[2]
BASE = '737a409'
def stream(stmt):
    return RawStream()(stmt)


def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT).decode('utf-8')


def policy_statements(sql):
    return [parse_sql(m.group())[0].stmt for m in re.finditer(
        r'^\s*CREATE POLICY\s+.*?;', sql, flags=re.S | re.M)]


def is_drop_policy(stmt):
    return type(stmt).__name__ == 'DropStmt' and stmt.removeType.name == 'OBJECT_POLICY'


def other_statements(sql):
    return [stream(s.stmt) for s in parse_sql(sql)
            if type(s.stmt).__name__ not in ('CreatePolicyStmt', 'DoStmt')
            and not is_drop_policy(s.stmt)]


def create(stmt, catalog):
    key = (stmt.table.schemaname, stmt.table.relname, stmt.policy_name)
    if key in catalog:
        raise RuntimeError(f'42710: policy {key} already exists')
    catalog[key] = stream(stmt)


def apply(sql, catalog):
    for raw in parse_sql(sql):
        stmt = raw.stmt
        kind = type(stmt).__name__
        if kind == 'CreatePolicyStmt':
            create(stmt, catalog)
        elif is_drop_policy(stmt):
            for obj in stmt.objects:
                catalog.pop(tuple(s.sval for s in obj), None)
        elif kind == 'DoStmt':
            # All migration DO blocks use one IF NOT EXISTS catalog guard.
            block = parse_plpgsql(stream(stmt))[0]['PLpgSQL_function']['action']
            body = block['PLpgSQL_stmt_block']['body']
            condition = body[0]['PLpgSQL_stmt_if']
            query = condition['cond']['PLpgSQL_expr']['query']
            assert query.startswith('NOT EXISTS'), query
            filters = dict(re.findall(r"(schemaname|tablename|policyname)\s*=\s*'([^']+)'", query))
            assert 'policyname' in filters
            exists = any(all(dict(zip(('schemaname', 'tablename', 'policyname'), k))[col] == val
                             for col, val in filters.items()) for k in catalog)
            if not exists:
                for action in condition['then_body']:
                    inner = action['PLpgSQL_stmt_execsql']['sqlstmt']['PLpgSQL_expr']['query']
                    parsed = parse_sql(inner)[0].stmt
                    assert type(parsed).__name__ == 'CreatePolicyStmt'
                    create(parsed, catalog)


paths = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
sources = {p.name: p.read_text(encoding='utf-8') for p in paths}
sql_count = do_count = function_count = policy_count = 0
for path in paths:
    sql = sources[path.name]
    # New forward migrations have no historical blob. For 001-011 compare
    # every policy except the reviewed authorization changes.
    historical = int(path.name.split('_')[0]) <= 11
    if historical:
        before = original(path.relative_to(ROOT).as_posix())
        if path.name.startswith('006'):
            try:
                parse_sql(before)
            except Exception as exc:
                assert 'syntax error' in str(exc)
            else:
                raise AssertionError('Expected invalid legacy 006 syntax')
            assert not policy_statements(sql), '006 must not recreate legacy policies'
        else:
            reviewed = {'bookings_insert_student_request', 'reviews_insert_eligible_student',
                        'inquiries_select_owner', 'inquiries_update_owner', 'inquiries_insert_student'}
            old = {x.policy_name: stream(x) for x in policy_statements(before)}
            new = {x.policy_name: stream(x) for x in policy_statements(sql)}
            assert old.keys() == new.keys()
            assert all(new[k] == old[k] for k in old if k not in reviewed), path.name
            if path.name == '005_kit_only.sql':
                assert [stream(s.stmt) for s in parse_sql(sql)] == ['SELECT 1'], '005 must remain a no-op'
            if path.name[:3] in {'001','003','004','007','008','009'}:
                assert other_statements(before) == other_statements(sql), path.name
    for s in parse_sql(sql):
        sql_count += 1
        kind = type(s.stmt).__name__
        if kind == 'DoStmt':
            parse_plpgsql(stream(s.stmt))
            do_count += 1
        elif kind == 'CreateFunctionStmt':
            language = next((o.arg.sval for o in s.stmt.options if o.defname == 'language'), '')
            if language == 'plpgsql':
                parse_plpgsql(stream(s.stmt))
                function_count += 1
    policy_count += len(policy_statements(sql))
    print('PASS:', path.name, 'parsed')

baseline = original('supabase/migrations/002_rls.sql')
catalog = {}
apply(baseline, catalog)
try:
    apply(baseline, catalog)
except RuntimeError as exc:
    assert 'profiles_select_own' in str(exc)
    print('PASS: original 002 replay reproduces', exc)
else:
    raise AssertionError('Expected original 002 replay to fail')

catalog = {('unrelated', 'profiles', 'profiles_select_own'): 'sentinel'}
for name, sql in sources.items():
    if int(name.split('_')[0]) <= 11:
        apply(sql, catalog)
first = catalog.copy()
for name, sql in sources.items():
    if int(name.split('_')[0]) <= 11:
        apply(sql, catalog)
assert catalog == first and ('unrelated','profiles','profiles_select_own') in catalog
print('PASS: policy-only 001-011 fresh application and complete replay match, unrelated policy retained')
for name in ('002_rls.sql', '010_inquiries_reports.sql', '011_listing_lifecycle.sql'):
    apply(sources[name], catalog)
    once = catalog.copy()
    apply(sources[name], catalog)
    assert catalog == once
    print('PASS:', name, 'individual policy replay')
assert not any(k[2].startswith('Anyone can view') for k in first)
assert not any(k[2] == 'Public can view property media' for k in first)
print(f'PASS: {sql_count} SQL statements, {do_count} DO blocks, {function_count} PL/pgSQL function bodies, {policy_count} policy definitions')
print('LIMIT: offline parser and catalog simulation only; no SQL executed against a database.')
