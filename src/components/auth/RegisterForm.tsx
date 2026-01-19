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
import { ROLES, ROLE_LABELS, KryptonRole, DIRECT_ACCESS_EMAILS } from '@/lib/constants';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/* ---------------- SCHEMA ---------------- */

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  department: z.string().min(2),
  role: z.enum([
    'team_captain',
    'vice_captain',
    'strategist',
    'team_manager',
    'team_member',
  ]),
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  path: ['confirmPassword'],
  message: "Passwords don't match",
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

/* ---------------- COMPONENT ---------------- */

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

  const role = watch('role');

  /* ---------------- SUBMIT ---------------- */

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      const email = data.email.toLowerCase();
      const isDirect = DIRECT_ACCESS_EMAILS.includes(email);

      // /* 🔐 HASH PASSWORD (FOR DB CONSTRAINT ONLY) */
      // const hashedPassword = await bcrypt.hash(data.password, 10);

      if (isDirect) {
        // Direct auth signup
        const { error } = await supabase.auth.signUp({
          email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
              department: data.department,
              role: data.role,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        setIsDirectAccess(true);
        setIsSubmitted(true);
        toast({
          title: 'Account Created',
          description: 'You can now log in.',
        });
      } else {
        // Approval flow
        const { error } = await supabase
          .from('registration_requests')
          .insert({
            full_name: data.fullName,
            email,
            department: data.department,
            requested_role: data.role,
            password_hash: data.password, // ✅ Direct Password SUpaBase clears After approval
            status: 'pending',
          });

        if (error) throw error;

        setIsSubmitted(true);
        toast({
          title: 'Request Submitted',
          description: 'Your registration is awaiting TL or VC approval.',
        });

      }
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: e.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- SUCCESS SCREEN ---------------- */

  if (isSubmitted) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-10 text-center">
          {isDirectAccess ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold">Account Created</h3>
              <p className="text-muted-foreground mb-6">
                You can now log in.
              </p>
            </>
          ) : (
            <>
              <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold">Approval Pending</h3>
              <p className="text-muted-foreground mb-6">
                Your registration request is under review by the <strong>Team Captain</strong> or <strong>Vice Captain</strong>.
                You’ll be able to log in <em>once approval is completed</em>.
              </p>
            </>
          )}
          <Button onClick={onSwitchToLogin}>Go to Login</Button>
        </CardContent>
      </Card>
    );
  }

  /* ---------------- FORM ---------------- */

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Approval required</CardDescription>
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
            <Select value={role} onValueChange={(v) => setValue('role', v as KryptonRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ROLES).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
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

          <Button disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Access
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}