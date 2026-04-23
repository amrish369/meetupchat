-- Length limits to mitigate abuse on anonymous public inserts
alter table public.waitlist
  add constraint waitlist_email_len check (char_length(email) between 3 and 254),
  add constraint waitlist_source_len check (referral_source is null or char_length(referral_source) <= 100);

alter table public.reports
  add constraint reports_reporter_len check (char_length(reporter_session) between 8 and 64),
  add constraint reports_reported_len check (char_length(reported_session) between 8 and 64),
  add constraint reports_reason_len check (char_length(reason) between 2 and 50),
  add constraint reports_details_len check (details is null or char_length(details) <= 500);