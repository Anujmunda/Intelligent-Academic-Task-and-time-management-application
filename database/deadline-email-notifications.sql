-- Run this in Supabase SQL Editor for existing projects.

CREATE TABLE IF NOT EXISTS public.deadline_email_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL DEFAULT 'deadline_24h_email',
    email_to TEXT,
    status TEXT CHECK (status IN ('sent', 'failed', 'skipped')) NOT NULL,
    error_message TEXT,
    provider_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (task_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_deadline_email_notifications_task_id
    ON public.deadline_email_notifications(task_id);

CREATE INDEX IF NOT EXISTS idx_deadline_email_notifications_status
    ON public.deadline_email_notifications(status);

ALTER TABLE public.deadline_email_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'deadline_email_notifications'
          AND policyname = 'Users can view own deadline email notifications'
    ) THEN
        CREATE POLICY "Users can view own deadline email notifications"
            ON public.deadline_email_notifications
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_deadline_email_notifications_updated_at'
    ) THEN
        CREATE TRIGGER update_deadline_email_notifications_updated_at
            BEFORE UPDATE ON public.deadline_email_notifications
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
