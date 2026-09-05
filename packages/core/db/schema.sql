-- EU Store Guard — Neon Postgres. Los datos de producto viven en metafields de Shopify; aquí solo estado y evidencia.
create table store (id text primary key, shop_domain text unique not null, installed_at timestamptz default now(), plan text default 'scanner');
create table market (id serial primary key, store_id text references store(id) on delete cascade, country char(2) not null, storefront_locale text not null, unique(store_id, country, storefront_locale));
create table product (id text primary key, store_id text references store(id) on delete cascade, shopify_gid text not null, handle text, updated_at timestamptz);
create table requirement (code text primary key, level text check (level in ('STORE','STORE_MARKET','PRODUCT','PRODUCT_MARKET')), title text not null);
create table rule (id text primary key, requirement_code text references requirement(code), version int not null, effective_from date not null, definition jsonb not null, source_version text, unique(requirement_code, version));
create table official_asset (name text primary key, rule_id text references rule(id), locale text, sha256 char(64) not null, format text default 'SVG_RGB', source_version text not null, imported_at timestamptz default now());
create table status (id bigserial primary key, store_id text references store(id) on delete cascade, market_id int references market(id), product_id text references product(id), rule_id text references rule(id), status text not null check (status in ('NOT_APPLICABLE','NEEDS_INFORMATION','CONFIGURED','LIVE_VERIFIED','LIVE_PARTIAL','UNKNOWN')), reasons jsonb default '[]', updated_at timestamptz default now());
create table evidence (id bigserial primary key, at timestamptz not null default now(), store_id text, market char(2), locale text, product_id text, rule_id text, rule_version int, status text not null, reasons jsonb default '[]', asset_hash char(64));
create index on evidence (store_id, at desc);
-- Preparada, desactivada hasta fase DPP:
create table passport (id bigserial primary key, product_id text references product(id), payload jsonb, active boolean default false);
-- MarketActivation: estado regulatorio de una obligación derivada de Directiva por país, versionado.
create table market_activation (id serial primary key, regime text not null, country char(2) not null, status text not null check (status in ('VERIFIED_ACTIVE','VERIFIED_NOT_YET_ACTIVE','NOT_NOTIFIED','UNKNOWN')), national_source text, effective_from date, checked_at date not null, note text, unique(regime, country, checked_at));
alter table evidence add column technical_status text, add column activation_status text, add column activation_checked_at date, add column activation_national_source text, add column activation_snapshot_hash char(64);
