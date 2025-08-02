import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChartLine, 
  Handshake, 
  Undo, 
  Calendar, 
  BarChart3, 
  Users, 
  Settings,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = {
  admin: [
    { icon: ChartLine, label: 'navigation.dashboard', href: '/dashboard' },
    { icon: Handshake, label: 'navigation.deals', href: '/deals' },
    { icon: Undo, label: 'navigation.returns', href: '/returns' },
    { icon: Calendar, label: 'navigation.planning', href: '/planning' },
    { icon: BarChart3, label: 'navigation.analytics', href: '/analytics' },
    { icon: Users, label: 'navigation.managers', href: '/managers' },
    { icon: Settings, label: 'navigation.settings', href: '/settings' },
  ],
  manager: [
    { icon: ChartLine, label: 'navigation.dashboard', href: '/dashboard' },
    { icon: Handshake, label: 'navigation.deals', href: '/deals' },
    { icon: Calendar, label: 'navigation.planning', href: '/planning' },
    { icon: User, label: 'navigation.profile', href: '/profile' },
  ],
  financist: [
    { icon: BarChart3, label: 'navigation.analytics', href: '/analytics' },
    { icon: Handshake, label: 'navigation.deals', href: '/deals' },
    { icon: Undo, label: 'navigation.returns', href: '/returns' },
    { icon: Calendar, label: 'navigation.planning', href: '/planning' },
  ],
};

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const userInitials = user.fullName
    .split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('language', value);
  };

  return (
    <div className="bg-white shadow-lg w-64 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <ChartLine className="text-white h-5 w-5" />
          </div>
          <div className="ml-3">
            <h1 className="font-bold text-gray-900">{t('auth.platformTitle')}</h1>
            <p className="text-xs text-gray-500">{t(`roles.${user.role}`)}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-6">
        <div className="px-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {t('navigation.main')}
          </p>
        </div>

        <div className="mt-4 space-y-1">
          {navigationItems[user.role].map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center px-6 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {t(item.label)}
                </a>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Language Switcher */}
      <div className="p-6 border-t border-gray-200">
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ru">🇷🇺 Русский</SelectItem>
            <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
