import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ChartLine, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { t, i18n } = useTranslation();
  const { login, isLoading } = useAuth();
  const [language, setLanguage] = useState(i18n.language);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    const success = await login(data.username, data.password);
    if (!success) {
      form.setError('password', { message: 'Invalid credentials' });
    }
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    i18n.changeLanguage(value);
    localStorage.setItem('language', value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-blue-700">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
            <ChartLine className="text-white h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('auth.platformTitle')}
          </h1>
          <p className="text-gray-600">
            {t('auth.platformSubtitle')}
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.login')}
              </Label>
              <Input
                type="text"
                placeholder={t('auth.login')}
                {...form.register('username')}
                className="w-full"
                disabled={isLoading}
              />
              {form.formState.errors.username && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </Label>
              <Input
                type="password"
                placeholder={t('auth.password')}
                {...form.register('password')}
                className="w-full"
                disabled={isLoading}
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="rememberMe"
                  {...form.register('rememberMe')}
                  disabled={isLoading}
                />
                <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                  {t('auth.rememberMe')}
                </Label>
              </div>
              
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                  <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('auth.loginButton')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
