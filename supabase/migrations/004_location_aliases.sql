-- Outlet aliases for AI outlet auto-detection (branch codes, Chinese names,
-- address fragments, postal codes). Extend per outlet as new invoice formats
-- appear — no code change needed.
alter table locations add column aliases text[] not null default '{}';

update locations set aliases = array['wld', 'woodlands', '兀兰', '738343']
  where name = 'Woodlands 兀兰' and active;

update locations set aliases = array['chinese garden', '裕华园', 'boon lay way', '609959']
  where name = 'Chinese Garden 裕华园' and active;
