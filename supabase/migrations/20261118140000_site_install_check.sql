-- When "Check installation" last found the tracking code on the site's
-- homepage. Lets the setup steps track "code installed" separately from
-- "a crawler has visited". Owners already have update rights on their sites.
alter table public.sites add column install_verified_at timestamptz;
