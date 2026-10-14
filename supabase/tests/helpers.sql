create schema tests;
grant usage on schema tests to authenticated;

create function tests.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
end $$;

create function tests.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok   %  (%)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL % : expected an error', p_label;
end $$;

-- Runs a write and checks how many rows it changed (RLS hides rows silently).
create function tests.expect_rows(p_sql text, p_expected integer, p_label text) returns void language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  if v_count <> p_expected then
    raise exception 'FAIL % : expected % rows, got %', p_label, p_expected, v_count;
  end if;
  raise notice 'ok   %', p_label;
end $$;

create function tests.expect_value(p_query text, p_expected text, p_label text) returns void language plpgsql as $$
declare v_actual text;
begin
  execute p_query into v_actual;
  if v_actual is distinct from p_expected then
    raise exception 'FAIL % : expected %, got %', p_label, p_expected, v_actual;
  end if;
  raise notice 'ok   %', p_label;
end $$;

grant execute on all functions in schema tests to authenticated;
