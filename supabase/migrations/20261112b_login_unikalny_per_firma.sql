-- Login ma być unikalny w obrębie firmy (a nie globalnie), żeby dwie firmy mogły mieć użytkownika "jan".
alter table public.profiles drop constraint if exists profiles_login_key;
alter table public.profiles add constraint profiles_firma_login_key unique (firma_id, login);
