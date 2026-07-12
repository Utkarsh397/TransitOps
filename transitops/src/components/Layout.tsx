import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { LogOut, LayoutDashboard, Truck, Users, Route, Wrench, Fuel, BarChart3 } from 'lucide-react'
import { cn } from '../lib/utils'

export default function Layout() {
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Vehicles', path: '/vehicles', icon: Truck },
    { name: 'Drivers', path: '/drivers', icon: Users },
    { name: 'Trips', path: '/trips', icon: Route },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench, roles: ['fleet_manager'] },
    { name: 'Fuel & Expenses', path: '/fuel-expenses', icon: Fuel, roles: ['fleet_manager'] },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">TransitOps</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{role?.replace('_', ' ')}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Role check: if the item specifies allowed roles, check if user's role is included
            if (item.roles && role && !item.roles.includes(role)) return null

            const isActive = location.pathname.startsWith(item.path)
            const Icon = item.icon

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-indigo-700" : "text-gray-400")} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-4 text-sm text-gray-600 truncate px-2">
            {user?.email}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
