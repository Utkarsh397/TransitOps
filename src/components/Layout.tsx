import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabaseClient'
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

export default function Layout() {
  const { user, role, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: string, id: string, label: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)

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
    try {
      const [{ data: vData }, { data: dData }] = await Promise.all([
        supabase.from('vehicles').select('id, registration_number, name_model').ilike('registration_number', `%${query}%`).limit(3),
        supabase.from('drivers').select('id, name, license_number').ilike('name', `%${query}%`).limit(3)
      ])

      const results: { type: string, id: string, label: string }[] = []
      if (vData) {
        vData.forEach(v => results.push({ type: 'vehicle', id: v.id, label: `${v.registration_number} (${v.name_model})` }))
      }
      if (dData) {
        dData.forEach(d => results.push({ type: 'driver', id: d.id, label: `${d.name} (${d.license_number})` }))
      }
      setSearchResults(results)
    } catch (err) {
      console.error("Search error", err)
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
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-200">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mr-2" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">TransitOps</span>
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
                        ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <item.icon className={`mr-3 w-5 h-5 ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-400 dark:text-gray-500'}`} />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold uppercase mr-3">
              {user?.email?.[0] || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-transparent rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 transition-colors duration-200">
          
          <div className="relative w-96">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search vehicles, drivers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-transparent rounded-md focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white placeholder-gray-500 transition-colors"
              />
            </div>
            {searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-2">
                {isSearching ? (
                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Searching...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(res)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                    >
                      <span>{res.label}</span>
                      <span className="text-xs text-gray-400 uppercase">{res.type}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No results found</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      
    </div>
  )
}
