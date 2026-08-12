-- Performance Indexes Migration for Teams Krypton

-- Profiles & User Roles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Messenger Messages & Conversations
CREATE INDEX IF NOT EXISTS idx_messenger_messages_sender ON public.messenger_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_recipient ON public.messenger_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_group_id ON public.messenger_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_created_at ON public.messenger_messages(created_at DESC);

-- Grouping Notifications
CREATE INDEX IF NOT EXISTS idx_grouping_notifs_recipient ON public.grouping_notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grouping_notifs_sender ON public.grouping_notifications(sender_id, created_at DESC);

-- Grouping Sessions & Daily PS Entries (Calendar & Activities)
CREATE INDEX IF NOT EXISTS idx_grouping_sessions_user_date ON public.grouping_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ps_daily_entries_user_date ON public.ps_daily_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ps_daily_entries_created ON public.ps_daily_entries(created_at DESC);

-- Incharge Roster
CREATE INDEX IF NOT EXISTS idx_incharge_roster_date ON public.incharge_roster(date);
CREATE INDEX IF NOT EXISTS idx_incharge_roster_user ON public.incharge_roster(user_id);
