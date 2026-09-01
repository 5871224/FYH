from pathlib import Path

path = Path('scripts/tmp_access_control_v2.py')
text = path.read_text(encoding='utf-8')

text = text.replace(
    '    sql = re.sub(r"\\baccess_role_groups\\b", "access_role_group_permissions", sql)\n    sql = sql.replace("idx_access_role_groups_group", "idx_access_role_group_permissions_group")\n',
    '    sql = sql.replace("idx_access_role_groups_group", "idx_access_role_group_permissions_group")\n'
)

text = text.replace(
    r'r"create table if not exists public\.access_roles \([\s\S]*?\n\);\n\ncreate table if not exists public\.access_role_group_permissions \([\s\S]*?\n\);"',
    r'r"create table if not exists public\.access_roles \([\s\S]*?\n\);\n\ncreate table if not exists public\.access_role_groups \([\s\S]*?\n\);"'
)
text = text.replace(
    r'r"insert into public\.access_role_group_permissions\(role_id,group_id\)[\s\S]*?on conflict do nothing;"',
    r'r"insert into public\.access_role_groups\(role_id,group_id\)[\s\S]*?on conflict do nothing;"'
)

text = text.replace(
    "  name text not null unique,\n  common_permissions text[] not null default '{}',\n  is_system boolean not null default false,",
    "  name text not null unique,\n  name_vi text,\n  common_permissions text[] not null default '{}',\n  is_system boolean not null default false,\n  sort_order integer not null default 1000000,"
)

old = '''    # No old permission names survive in runtime SQL. Migration strings above are inside dynamic SQL only.\n    sql = re.sub(r"'permission_settings'", "'settings'", sql)\n    sql = re.sub(r"'group_settings'", "'settings'", sql)\n    sql = re.sub(r"'member_settings'", "'schedule_manage'", sql)\n'''
new = '''    # Protect the one-time legacy-data conversion while runtime SQL is rewritten to the latest model.\n    migration_match = re.search(\n        r"-- 一次性資料轉換：[\\s\\S]*?drop table if exists public\\.access_role_groups;",\n        sql,\n    )\n    if not migration_match:\n        raise RuntimeError("access permission data migration block not found")\n    legacy_migration = migration_match.group(0)\n    migration_placeholder = "-- __ACCESS_CONTROL_V2_DATA_MIGRATION__"\n    sql = sql[:migration_match.start()] + migration_placeholder + sql[migration_match.end():]\n\n    sql = re.sub(r"'permission_settings'", "'settings'", sql)\n    sql = re.sub(r"'group_settings'", "'settings'", sql)\n    sql = re.sub(r"'member_settings'", "'schedule_manage'", sql)\n    sql = re.sub(r"\\baccess_role_groups\\b", "access_role_group_permissions", sql)\n    sql = sql.replace(migration_placeholder, legacy_migration)\n'''
if old not in text:
    raise SystemExit('permission rewrite block not found')
text = text.replace(old, new)

# Formal tests intentionally reject phase/v2 filenames. Keep the architecture
# regression test, but give it a permanent domain name.
text = text.replace(
    'write("tests/access-control-v2.test.js", source)',
    'write("tests/access-control-model.test.js", source)'
)

path.write_text(text, encoding='utf-8')
print('transformer corrections applied')
