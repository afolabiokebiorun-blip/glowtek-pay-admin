-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create enum for transaction status
create type transaction_status as enum ('pending', 'success', 'failed', 'processing');

-- Create enum for payout status
create type payout_status as enum ('pending', 'sent', 'failed');

-- Create enum for payment processor
create type payment_processor as enum ('paystack', 'monnify', 'chapa');

-- Create enum for currency
create type currency_code as enum ('NGN', 'USD', 'GHS', 'KES', 'ZAR');

-- Create enum for user roles
create type app_role as enum ('admin', 'merchant');

-- Merchants table (extends auth.users)
create table public.merchants (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  email text unique not null,
  phone text,
  is_verified boolean default false,
  is_suspended boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);

-- API Keys table
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade not null,
  key_hash text not null unique,
  key_prefix text not null,
  is_active boolean default true,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Transactions table
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade not null,
  reference text unique not null,
  amount integer not null,
  currency currency_code default 'NGN',
  processor payment_processor not null,
  status transaction_status default 'pending',
  processor_reference text,
  payment_url text,
  callback_url text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Wallets table
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid unique references public.merchants(id) on delete cascade not null,
  balance integer default 0 check (balance >= 0),
  currency currency_code default 'NGN',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payouts table
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade not null,
  amount integer not null,
  status payout_status default 'pending',
  reference text unique not null,
  bank_account jsonb,
  processed_at timestamptz,
  created_at timestamptz default now()
);

-- Webhook endpoints table
create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade not null,
  url text not null,
  secret text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Activity logs table
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.merchants enable row level security;
alter table public.user_roles enable row level security;
alter table public.api_keys enable row level security;
alter table public.transactions enable row level security;
alter table public.wallets enable row level security;
alter table public.payouts enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.activity_logs enable row level security;

-- Security definer function to check roles
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- RLS Policies for merchants
create policy "Merchants can view their own profile"
  on public.merchants for select
  using (auth.uid() = id);

create policy "Merchants can update their own profile"
  on public.merchants for update
  using (auth.uid() = id);

create policy "Admins can view all merchants"
  on public.merchants for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update all merchants"
  on public.merchants for update
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
create policy "Users can view their own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for api_keys
create policy "Merchants can view their own API keys"
  on public.api_keys for select
  using (merchant_id = auth.uid());

create policy "Merchants can insert their own API keys"
  on public.api_keys for insert
  with check (merchant_id = auth.uid());

create policy "Merchants can update their own API keys"
  on public.api_keys for update
  using (merchant_id = auth.uid());

-- RLS Policies for transactions
create policy "Merchants can view their own transactions"
  on public.transactions for select
  using (merchant_id = auth.uid());

create policy "Merchants can insert their own transactions"
  on public.transactions for insert
  with check (merchant_id = auth.uid());

create policy "Admins can view all transactions"
  on public.transactions for select
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for wallets
create policy "Merchants can view their own wallet"
  on public.wallets for select
  using (merchant_id = auth.uid());

create policy "Admins can view all wallets"
  on public.wallets for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update all wallets"
  on public.wallets for update
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payouts
create policy "Merchants can view their own payouts"
  on public.payouts for select
  using (merchant_id = auth.uid());

create policy "Merchants can request payouts"
  on public.payouts for insert
  with check (merchant_id = auth.uid());

create policy "Admins can view all payouts"
  on public.payouts for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update payouts"
  on public.payouts for update
  using (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for webhook_endpoints
create policy "Merchants can manage their own webhooks"
  on public.webhook_endpoints for all
  using (merchant_id = auth.uid());

-- RLS Policies for activity_logs
create policy "Merchants can view their own activity logs"
  on public.activity_logs for select
  using (merchant_id = auth.uid());

create policy "Admins can view all activity logs"
  on public.activity_logs for select
  using (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-create merchant profile and wallet
create or replace function public.handle_new_merchant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.merchants (id, business_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'New Business'),
    new.email
  );
  
  insert into public.wallets (merchant_id)
  values (new.id);
  
  insert into public.user_roles (user_id, role)
  values (new.id, 'merchant');
  
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_merchant();

-- Trigger to update timestamps
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger merchants_updated_at
  before update on public.merchants
  for each row execute function public.update_updated_at();

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.update_updated_at();

create trigger wallets_updated_at
  before update on public.wallets
  for each row execute function public.update_updated_at();

-- Indexes for performance
create index idx_transactions_merchant_id on public.transactions(merchant_id);
create index idx_transactions_reference on public.transactions(reference);
create index idx_transactions_status on public.transactions(status);
create index idx_api_keys_merchant_id on public.api_keys(merchant_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);
create index idx_payouts_merchant_id on public.payouts(merchant_id);
create index idx_activity_logs_merchant_id on public.activity_logs(merchant_id);