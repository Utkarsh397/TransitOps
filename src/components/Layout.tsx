import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Map, 
  Wrench, 
  CreditCard, 
  BarChart3, 
  LogOut,
  Moon,
  Sun,
  Search
} from 'lucide-react'
import { ErrorBanner } from './ErrorBanner'

export default function Layout() {
  const { user, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: string, id: string, label: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Navigation config based on role
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['fleet_manager', 'driver', 'safety_officer'] },
    { name: 'Vehicles', path: '/vehicles', icon: Truck, roles: ['fleet_manager', 'driver', 'safety_officer'] },
    { name: 'Drivers', path: '/drivers', icon: Users, roles: ['fleet_manager', 'driver', 'safety_officer'] },
    { name: 'Trips', path: '/trips', icon: Map, roles: ['fleet_manager', 'driver', 'safety_officer'] },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench, roles: ['fleet_manager'] },
    { name: 'Fuel & Expenses', path: '/fuel-expenses', icon: CreditCard, roles: ['fleet_manager'] },
    { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['fleet_manager'] },
  ]

  const visibleNavItems = navItems.filter(item => item.roles.includes(role || ''))

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const performSearch = async (query: string) => {
    setIsSearching(true)
    setError(null)
    try {
      const [{ data: vData, error: vErr }, { data: dData, error: dErr }] = await Promise.all([
        supabase.from('vehicles').select('id, registration_number, name_model').ilike('registration_number', `%${query}%`).limit(3),
        supabase.from('drivers').select('id, name, license_number').ilike('name', `%${query}%`).limit(3)
      ])

      if (vErr) throw vErr
      if (dErr) throw dErr

      const results: { type: string, id: string, label: string }[] = []
      if (vData) {
        vData.forEach(v => results.push({ type: 'vehicle', id: v.id, label: `${v.registration_number} (${v.name_model})` }))
      }
      if (dData) {
        dData.forEach(d => results.push({ type: 'driver', id: d.id, label: `${d.name} (${d.license_number})` }))
      }
      setSearchResults(results)
    } catch (err: any) {
      console.error("Search error", err)
      setError(err.message || 'Something went wrong')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result: { type: string, id: string }) => {
    setSearchQuery('')
    setSearchResults([])
    if (result.type === 'vehicle') navigate('/vehicles')
    if (result.type === 'driver') navigate('/drivers')
  }

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-200">
      
      {/* Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col transition-colors duration-200">
        <div className="h-16 flex items-center px-6 border-b">
          <Truck className="w-6 h-6 text-primary mr-2" />
          <span className="text-lg font-bold">TransitOps</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path)
              return (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className={`mr-3 w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase mr-3">
              {user?.email?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground uppercase">{role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button 
            variant="destructive"
            className="w-full flex items-center justify-center"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 transition-colors duration-200">
          
          <div className="relative w-96">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search vehicles, drivers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-transparent focus-visible:bg-background"
              />
            </div>
            {searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 py-2">
                {isSearching ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground">Searching...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(res)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span>{res.label}</span>
                      <span className="text-xs text-muted-foreground uppercase">{res.type}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-muted-foreground">No results found</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </header>
        <ErrorBanner message={error} />
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      
    </div>
  )
}
