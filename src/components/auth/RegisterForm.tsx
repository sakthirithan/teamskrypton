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
import { ROLES, ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    department: z.string().min(2, 'Department is required'),
    role: z.enum([
      'team_captain',
      'vice_captain',
      'strategist',
      'team_manager',
      'team_member',
    ]),
    password: z.string().min(6, 'Password must be at least 6 characters'),
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
  const [submitted, setSubmitted] = useState(false);
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

    try {
      /**
       * STEP 1 — Create AUTH user
       */
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });

      if (authError || !authData.user) {
        throw authError || new Error('Auth user creation failed');
      }

      /**
       * STEP 2 — Create registration request
       * IMPORTANT: status must match DB ENUM exactly
       */
      const { error: requestError } = await supabase
        .from('registration_requests')
        .insert({
          user_id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          department: data.department,
          requested_role: data.role,
          status: 'PENDING', // ✅ MUST MATCH DB ENUM
        });

      /**
       * STEP 3 — ROLLBACK if request insert fails
       */
      if (requestError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw requestError;
      }

      toast({
        title: 'Request Submitted',
        description:
          'Your registration is pending approval from Team Captain or Vice Captain.',
      });

      setSubmitted(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description:
          error?.message || 'Unable to submit registration request.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-10 text-center">
          <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Approval Pending</h3>
          <p className="text-muted-foreground mb-6">
            Your account is awaiting approval by Team Captain or Vice Captain.
          </p>
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
          Register to join Krypton Space
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input {...register('fullName')} />
            {errors.fullName && (
              <p className="text-sm text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label>Department</Label>
            <Input {...register('department')} />
            {errors.department && (
              <p className="text-sm text-destructive">
                {errors.department.message}
              </p>
            )}
          </div>

          <div>
            <Label>Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setValue('role', v as KryptonRole)}
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
            {errors.role && (
              <p className="text-sm text-destructive">
                {errors.role.message}
              </p>
            )}
          </div>

          <div>
            <Label>Password</Label>
            <Input type="password" {...register('password')} />
          </div>

          <div>
            <Label>Confirm Password</Label>
            <Input type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button className="w-full" disabled={isLoading}>
            {isLoading && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Request Access
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already registered?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary underline"
            >
              Sign in
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}