
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ROLES,
  ROLE_LABELS,
  KryptonRole,
  DIRECT_ACCESS_EMAILS,
} from '@/lib/constants';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const registerSchema = z
  .object({
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    department: z.string().min(2).max(100),
    role: z.enum([
      'team_captain',
      'vice_captain',
      'strategist',
      'team_manager',
      'team_member',
    ]),
    password: z.string().min(6),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDirectAccess, setIsDirectAccess] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    const hasDirectAccess = DIRECT_ACCESS_EMAILS.includes(
      data.email.toLowerCase()
    );

    try {
      // 1️⃣ Create Auth User
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('User creation failed');

      // 2️⃣ ALWAYS create profile (CRITICAL FIX)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: data.fullName,
          email: data.email,
          department: data.department,
          role: hasDirectAccess ? data.role : null,
          status: hasDirectAccess ? 'ACTIVE' : 'PENDING_APPROVAL',
          phone_number: null,
        });

      if (profileError) throw profileError;

      // 3️⃣ Handle approval flow
      if (hasDirectAccess) {
        setIsDirectAccess(true);
        setIsSubmitted(true);
        toast({
          title: 'Account Created!',
          description: 'You can now log in with your credentials.',
        });
      } else {
        const { error: requestError } = await supabase
          .from('registration_requests')
          .insert({
            user_id: userId,
            full_name: data.fullName,
            email: data.email,
            department: data.department,
            requested_role: data.role,
            status: 'pending',
          });

        if (requestError) throw requestError;

        setIsSubmitted(true);
        toast({
          title: 'Request Submitted!',
          description:
            'Your registration is pending approval from Team Captain or Vice Captain.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.message || 'Something went wrong.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          {isDirectAccess ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Account Created!
              </h3>
              <p className="text-muted-foreground mb-6">
                You can now log in with your credentials.
              </p>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Request Submitted!
              </h3>
              <p className="text-muted-foreground mb-6">
                Your registration is pending approval from Team Captain or Vice
                Captain.
              </p>
            </>
          )}
          <Button onClick={onSwitchToLogin} className="w-full">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-display">
          Create Account
        </CardTitle>
        <CardDescription>
          Join Krypton Space
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input {...register('fullName')} />
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
          </div>

          <div>
            <Label>Department</Label>
            <Input {...register('department')} />
          </div>

          <div>
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) =>
                setValue('role', v as KryptonRole)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Password</Label>
            <Input type="password" {...register('password')} />
          </div>

          <div>
            <Label>Confirm Password</Label>
            <Input type="password" {...register('confirmPassword')} />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Request Access
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary font-medium"
            >
              Sign in
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}