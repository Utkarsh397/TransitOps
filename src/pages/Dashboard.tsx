import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Truck, CheckCircle, Wrench, Activity, Clock, Users, PieChart } from 'lucide-react'

export default function Dashboard() {
  const [kpis, setKpis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  useEffect(() => {
    fetchKpis()
    
    // Supabase Realtime subscription on trips table
    const channel = supabase.channel('public:trips')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        (payload) => {
          console.log('Realtime update on trips:', payload)
          fetchKpis()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [typeFilter, statusFilter, regionFilter])

  const fetchKpis = async () => {
    try {
      // Don't set loading to true on background refresh to avoid flashing
      if (!kpis) setLoading(true)
      const hasFilters = typeFilter || statusFilter || regionFilter

      if (!hasFilters) {
        // Query the view directly
        const { data, error } = await supabase.from('v_fleet_kpis').select('*').single()
        if (error) {
           console.error("View error (might not exist yet):", error)
           await computeManualKpis(false)
        } else {
           setKpis(data)
        }
      } else {
        await computeManualKpis(true)
      }
    } catch (err) {
      console.error('Error fetching KPIs:', err)
    } finally {
      setLoading(false)
    }
  }

  const computeManualKpis = async (applyFilters: boolean) => {
    let vQuery = supabase.from('vehicles').select('id, status, type, region')
    if (applyFilters) {
      if (typeFilter) vQuery = vQuery.eq('type', typeFilter)
      if (statusFilter) vQuery = vQuery.eq('status', statusFilter)
      if (regionFilter) vQuery = vQuery.eq('region', regionFilter)
    }
    
    const [vehRes, tripsRes, driversRes] = await Promise.all([
      vQuery,
      supabase.from('trips').select('id, status, vehicle_id'),
      supabase.from('drivers').select('id, status')
    ])

    const vehicles = vehRes.data || []
    const allTrips = tripsRes.data || []
    const allDrivers = driversRes.data || []

    const validVehicleIds = new Set(vehicles.map(v => v.id))
    const relevantTrips = applyFilters ? allTrips.filter(t => validVehicleIds.has(t.vehicle_id)) : allTrips

    const active_vehicles = vehicles.filter(v => v.status !== 'RETIRED').length
    const available_vehicles = vehicles.filter(v => v.status === 'AVAILABLE').length
    const vehicles_in_maintenance = vehicles.filter(v => v.status === 'IN_SHOP').length
    const on_trip_vehicles = vehicles.filter(v => v.status === 'ON_TRIP').length
    
    const active_trips = relevantTrips.filter(t => t.status === 'DISPATCHED').length
    const pending_trips = relevantTrips.filter(t => t.status === 'DRAFT').length
    const drivers_on_duty = allDrivers.filter(d => d.status === 'ON_TRIP').length

    const fleet_utilization_pct = active_vehicles > 0 
      ? Number(((on_trip_vehicles / active_vehicles) * 100).toFixed(1)) 
      : 0

    setKpis({
      active_vehicles,
      available_vehicles,
      vehicles_in_maintenance,
      active_trips,
      pending_trips,
      drivers_on_duty,
      fleet_utilization_pct
    })
  }

  const KpiCard = ({ title, value, icon: Icon, colorClass }: { title: string, value: string | number, icon: any, colorClass: string }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4 transition-colors">
      <div className={`p-3 rounded-full ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time fleet overview</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-end transition-colors">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Vehicle Type</label>
          <input 
            type="text" 
            placeholder="e.g. Van, Truck"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="block w-40 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Status</label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-40 pl-3 pr-10 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:text-white"
          >
            <option value="">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="IN_SHOP">In Shop</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Region</label>
          <input 
            type="text" 
            placeholder="e.g. North"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="block w-40 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
          />
        </div>
        {(typeFilter || statusFilter || regionFilter) && (
          <button 
            onClick={() => { setTypeFilter(''); setStatusFilter(''); setRegionFilter(''); }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline px-2 py-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-500 dark:text-gray-400">Loading KPIs...</div>
      ) : kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="Active Vehicles" 
            value={kpis.active_vehicles} 
            icon={Truck} 
            colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" 
          />
          <KpiCard 
            title="Available Vehicles" 
            value={kpis.available_vehicles} 
            icon={CheckCircle} 
            colorClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
          />
          <KpiCard 
            title="Vehicles in Maint." 
            value={kpis.vehicles_in_maintenance} 
            icon={Wrench} 
            colorClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" 
          />
          <KpiCard 
            title="Fleet Utilization" 
            value={`${kpis.fleet_utilization_pct}%`} 
            icon={PieChart} 
            colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" 
          />
          <KpiCard 
            title="Active Trips" 
            value={kpis.active_trips} 
            icon={Activity} 
            colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" 
          />
          <KpiCard 
            title="Pending Trips" 
            value={kpis.pending_trips} 
            icon={Clock} 
            colorClass="bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400" 
          />
          <KpiCard 
            title="Drivers On Duty" 
            value={kpis.drivers_on_duty} 
            icon={Users} 
            colorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" 
          />
        </div>
      ) : (
        <div className="flex justify-center py-12 text-red-500">Failed to load KPIs.</div>
      )}
    </div>
  )
}
