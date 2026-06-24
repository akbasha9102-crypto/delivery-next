-- جدول رسائل الطلبات (تواصل بين الزبون والمطعم)
create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  restaurant_id uuid not null,
  sender text not null check (sender in ('customer', 'restaurant')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table order_messages enable row level security;

create policy "allow_read_order_messages" on order_messages
  for select using (true);

create policy "allow_insert_order_messages" on order_messages
  for insert with check (true);

create policy "allow_update_order_messages" on order_messages
  for update using (true);

create index if not exists order_messages_order_id_idx on order_messages(order_id);
create index if not exists order_messages_restaurant_unread_idx on order_messages(restaurant_id, is_read) where is_read = false;
