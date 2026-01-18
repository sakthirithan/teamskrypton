import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLES, ROLE_LABELS, KryptonRole, DIRECT_ACCESS_EMAILS, EMAIL_DOMAIN } from '@/lib/constants';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emailDomainPattern = new RegExp(`^[a-zA-Z0-9._%+-]+${EMAIL_DOMAIN.replace('.', '\\.')}$`);

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').refine(
    (email) => emailDomainPattern.test(email),
    `Email must end with ${EMAIL_DOMAIN}`
  ),
  department: z.string().min(2, 'Department is required').max(100),
  role: z.enum(['team_captain', 'vice_captain', 'strategist', 'team_manager', 'team_member']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
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
    
    // Check if email is in direct access list
    const hasDirectAccess = DIRECT_ACCESS_EMAILS.includes(data.email.toLowerCase());
    
    try {
      if (hasDirectAccess) {
        // Direct signup for special emails
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              department: data.department,
              role: data.role,
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              variant: 'destructive',
              title: 'Registration Failed',
              description: 'An account with this email already exists.',
            });
          } else {
            throw error;
          }
          return;
        }

        // Mark as direct access user
        setIsDirectAccess(true);
        setIsSubmitted(true);
        toast({
          title: 'Account Created!',
          description: 'You can now log in with your credentials.',
        });
      } else {
        // Submit to registration_requests for approval
        const { error } = await supabase
          .from('registration_requests')
          .insert({
            full_name: data.fullName,
            email: data.email,
            department: data.department,
            requested_role: data.role,
            password_hash: data.password, // Note: In production, hash this
            status: 'pending',
          });

        if (error) {
          if (error.message.includes('duplicate')) {
            toast({
              variant: 'destructive',
              title: 'Request Already Exists',
              description: 'A registration request with this email already exists.',
            });
          } else {
            throw error;
          }
          return;
        }

        setIsSubmitted(true);
        toast({
          title: 'Request Submitted!',
          description: 'Your registration is pending approval from Team Captain or Vice Captain.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto animate-fade-in">
        <CardContent className="pt-8 pb-8 text-center">
          {isDirectAccess ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Account Created!</h3>
              <p className="text-muted-foreground mb-6">
                You can now log in with your credentials.
              </p>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Request Submitted!</h3>
              <p className="text-muted-foreground mb-6">
                Your registration is pending approval from Team Captain or Vice Captain.
                You'll receive an email once your request is reviewed.
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
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-display">Create Account</CardTitle>
        <CardDescription>
          Join Krypton Space - Your team accountability platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Enter your full name"
              {...register('fullName')}
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g., Computer Science"
              {...register('department')}
              className={errors.department ? 'border-destructive' : ''}
            />
            {errors.department && (
              <p className="text-sm text-destructive">{errors.department.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as KryptonRole)}
            >
              <SelectTrigger className={errors.role ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([key, value]) => (
                  <SelectItem key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Access
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
