import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/* ---------------- SCHEMA ---------------- */

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

/* ---------------- COMPONENT ---------------- */

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  /* ---------------- SUBMIT ---------------- */

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const { data: authData, error } =
        await supabase.auth.signInWithPassword({
          email: data.email.toLowerCase(),
          password: data.password,
        });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Invalid email or password.',
        });
        return;
      }

      /* ---------- SAFETY CHECK ---------- */
      // User exists in auth, now verify profile exists (approved)
      const userId = authData.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        // Auth user exists but approval not completed
        await supabase.auth.signOut();

        toast({
          variant: 'destructive',
          title: 'Access Pending',
          description:
            'Your registration request is under review by the Team Captain or Vice Captain.You will be able to log in once approval is completed.',
        });
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });

      navigate('/grouping/home');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'Something went wrong.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-display">
          Welcome Back
        </CardTitle>
        <CardDescription>
          Sign in to access Krypton Space
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="your@email.com"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter your password"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sign In
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-primary hover:underline font-medium"
            >
              Create Account
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}