import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Truck, CheckCircle, Wrench, Activity, Clock, Users, PieChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      if (statusFilter && statusFilter !== 'ALL') vQuery = vQuery.eq('status', statusFilter)
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
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-full ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time fleet overview</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vehicle Type</Label>
            <Input 
              type="text" 
              placeholder="e.g. Van, Truck"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ON_TRIP">On Trip</SelectItem>
                <SelectItem value="IN_SHOP">In Shop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Region</Label>
            <Input 
              type="text" 
              placeholder="e.g. North"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-40"
            />
          </div>
          {(typeFilter || (statusFilter && statusFilter !== 'ALL') || regionFilter) && (
            <Button 
              variant="link"
              onClick={() => { setTypeFilter(''); setStatusFilter('ALL'); setRegionFilter(''); }}
              className="text-muted-foreground h-10"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading KPIs...</div>
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
            colorClass="bg-secondary text-secondary-foreground" 
          />
          <KpiCard 
            title="Drivers On Duty" 
            value={kpis.drivers_on_duty} 
            icon={Users} 
            colorClass="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" 
          />
        </div>
      ) : (
        <div className="flex justify-center py-12 text-destructive">Failed to load KPIs.</div>
      )}
    </div>
  )
}
