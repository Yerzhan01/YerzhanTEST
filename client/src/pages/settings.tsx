import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, User, Bell, Shield, Globe, Save } from 'lucide-react';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Profile settings
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // System settings
  const [systemSettings, setSystemSettings] = useState({
    language: i18n.language,
    emailNotifications: true,
    pushNotifications: false,
    darkMode: false,
    autoSave: true,
    sessionTimeout: '24', // hours
  });

  const handleProfileSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement profile update API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: 'Профиль обновлен',
        description: 'Ваши данные успешно сохранены',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Не удалось сохранить изменения',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSystemSave = async () => {
    setIsLoading(true);
    try {
      // Save language setting
      i18n.changeLanguage(systemSettings.language);
      localStorage.setItem('language', systemSettings.language);
      
      // TODO: Implement other system settings save
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: 'Настройки сохранены',
        description: 'Системные настройки успешно обновлены',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: 'Экспорт данных',
      description: 'Функция экспорта данных будет реализована в следующих версиях',
      variant: 'default',
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.settings')}
        subtitle="Настройки системы и профиля"
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Настройки профиля
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="fullName">ФИО</Label>
                <Input
                  id="fullName"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Введите полное имя"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Изменение пароля</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="currentPassword">Текущий пароль</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={profileData.currentPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Введите текущий пароль"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">Новый пароль</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={profileData.newPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Введите новый пароль"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={profileData.confirmPassword}
                    onChange={(e) => setProfileData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Повторите новый пароль"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleProfileSave} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Сохранить профиль
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="mr-2 h-5 w-5" />
              Системные настройки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="language" className="flex items-center">
                    <Globe className="mr-2 h-4 w-4" />
                    Язык интерфейса
                  </Label>
                  <Select
                    value={systemSettings.language}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                      <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sessionTimeout">Время сессии (часы)</Label>
                  <Select
                    value={systemSettings.sessionTimeout}
                    onValueChange={(value) => setSystemSettings(prev => ({ ...prev, sessionTimeout: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 час</SelectItem>
                      <SelectItem value="8">8 часов</SelectItem>
                      <SelectItem value="24">24 часа</SelectItem>
                      <SelectItem value="168">1 неделя</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="mr-2 h-4 w-4" />
                    <Label htmlFor="emailNotifications">Email уведомления</Label>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={systemSettings.emailNotifications}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, emailNotifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="pushNotifications">Push уведомления</Label>
                  <Switch
                    id="pushNotifications"
                    checked={systemSettings.pushNotifications}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, pushNotifications: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autoSave">Автосохранение</Label>
                  <Switch
                    id="autoSave"
                    checked={systemSettings.autoSave}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, autoSave: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="darkMode">Темная тема</Label>
                  <Switch
                    id="darkMode"
                    checked={systemSettings.darkMode}
                    onCheckedChange={(checked) => setSystemSettings(prev => ({ ...prev, darkMode: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSystemSave} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Сохранить настройки
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security & Data */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Безопасность и данные
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Резервное копирование</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Создание резервной копии всех данных системы
                  </p>
                  <Button variant="outline" size="sm">
                    Создать резервную копию
                  </Button>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Экспорт данных</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Экспорт всех данных в различных форматах
                  </p>
                  <Button variant="outline" size="sm" onClick={handleExportData}>
                    Экспортировать данные
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Журнал активности</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Просмотр журнала действий пользователей в системе
                </p>
                <Button variant="outline" size="sm">
                  Открыть журнал
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>Информация о системе</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-700">Версия системы</p>
                <p className="text-gray-600">v1.0.0</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Последнее обновление</p>
                <p className="text-gray-600">{new Date().toLocaleDateString('ru-RU')}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700">Статус системы</p>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-600">Работает стабильно</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
