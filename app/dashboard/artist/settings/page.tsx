import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { User, Lock, Mail } from "lucide-react"

export default function SettingsPage() {
  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Настройки</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-azure" />
                Личная информация
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Имя</Label>
                  <Input id="name" defaultValue="Артист Первый" className="bg-gray-800 border-gray-700 text-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="artist1@example.com"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>

                <Button className="w-full bg-azure hover:bg-azure-dark text-black">Сохранить изменения</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-azure" />
                Изменить пароль
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Текущий пароль</Label>
                  <Input id="current-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Новый пароль</Label>
                  <Input id="new-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                  <Input id="confirm-password" type="password" className="bg-gray-800 border-gray-700 text-white" />
                </div>

                <Button className="w-full bg-azure hover:bg-azure-dark text-black">Обновить пароль</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-azure" />
                Уведомления
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-notifications" className="flex-1">
                    Email уведомления
                  </Label>
                  <input
                    type="checkbox"
                    id="email-notifications"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-azure focus:ring-azure"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-release" className="flex-1">
                    Новые релизы
                  </Label>
                  <input
                    type="checkbox"
                    id="new-release"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-azure focus:ring-azure"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-report" className="flex-1">
                    Новые отчеты
                  </Label>
                  <input
                    type="checkbox"
                    id="new-report"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-azure focus:ring-azure"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="new-payment" className="flex-1">
                    Новые выплаты
                  </Label>
                  <input
                    type="checkbox"
                    id="new-payment"
                    defaultChecked
                    className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-azure focus:ring-azure"
                  />
                </div>

                <Button className="w-full bg-azure hover:bg-azure-dark text-black">Сохранить настройки</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
