-- Add task_deletion_reason to approval_type enum
ALTER TYPE public.approval_type ADD VALUE IF NOT EXISTS 'task_deletion_reason';