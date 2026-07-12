import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Play, CheckCircle, XCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { ErrorBanner } from '../components/ErrorBanner'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const tripSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  destination: z.string().min(1, 'Destination is required'),
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  driver_id: z.string().min(1, 'Driver is required'),
  cargo_weight: z.number().min(0, 'Cargo weight must be >= 0'),
  planned_distance: z.number().min(1, 'Distance must be > 0'),
})

type TripFormValues = z.infer<typeof tripSchema>

export default function Trips() {
  const { role } = useAuth()
  const [trips, setTrips] = useState<any[]>([])
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [finalOdometer, setFinalOdometer] = useState<number | ''>('')
  const [fuelConsumed, setFuelConsumed] = useState<number | ''>('')

  const { items: sortedTrips, requestSort, sortConfig } = useSortableData(trips)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: { cargo_weight: 0, planned_distance: 0 }
  })

  const watchVehicleId = watch('vehicle_id')
  const watchCargoWeight = watch('cargo_weight')
  
  const selectedVehicle = availableVehicles.find(v => v.id === watchVehicleId)
  const isCargoOverweight = selectedVehicle && watchCargoWeight > selectedVehicle.max_load_capacity

  useEffect(() => {
    fetchTrips()
    if (showCreateModal) {
      fetchAvailableResources()
    }
  }, [showCreateModal])

  const fetchTrips = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          vehicles ( registration_number, name_model ),
          drivers ( name, license_number )
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTrips(data || [])
    } catch (err: any) {
      console.error('Error fetching trips:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableResources = async () => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        supabase.from('vehicles').select('id, registration_number, name_model, max_load_capacity').eq('status', 'AVAILABLE'),
        supabase.from('drivers').select('id, name, license_number').eq('status', 'AVAILABLE').gt('license_expiry', today)
      ])
      if (vehiclesRes.error) throw vehiclesRes.error
      if (driversRes.error) throw driversRes.error

      setAvailableVehicles(vehiclesRes.data || [])
      setAvailableDrivers(driversRes.data || [])
    } catch (err: any) {
      console.error('Error fetching resources:', err)
      setError(err.message || 'Something went wrong')
    }
  }

  const mapRpcError = (errMsg: string) => {
    if (errMsg.includes('VEHICLE_NOT_AVAILABLE')) return 'Vehicle no longer available'
    if (errMsg.includes('DRIVER_NOT_AVAILABLE')) return 'Driver no longer available'
    if (errMsg.includes('DRIVER_LICENSE_EXPIRED')) return "Driver's license is expired"
    if (errMsg.includes('CARGO_EXCEEDS_CAPACITY')) return 'Cargo weight exceeds vehicle capacity'
    if (errMsg.includes('TRIP_NOT_DISPATCHED')) return 'Trip is not in dispatched state'
    return errMsg
  }

  const onCreateTrip = async (data: TripFormValues) => {
    if (isCargoOverweight) return
    try {
      setSubmitError(null)
      const { error } = await supabase.from('trips').insert({ ...data, status: 'DRAFT' })
      if (error) throw error
      setShowCreateModal(false)
      reset()
      fetchTrips()
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create trip')
    }
  }

  const handleDispatch = async (tripId: string) => {
    try {
      const { error } = await supabase.rpc('dispatch_trip', { p_trip_id: tripId })
      if (error) throw error
      fetchTrips()
    } catch (err: any) {
      alert(`Dispatch failed: ${mapRpcError(err.message)}`)
    }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showCompleteModal || finalOdometer === '' || fuelConsumed === '') return
    try {
      const { error } = await supabase.rpc('complete_trip', { 
        p_trip_id: showCompleteModal,
        p_final_odometer: Number(finalOdometer),
        p_fuel_consumed: Number(fuelConsumed)
      })
      if (error) throw error
      setShowCompleteModal(null)
      setFinalOdometer('')
      setFuelConsumed('')
      fetchTrips()
    } catch (err: any) {
      alert(`Complete failed: ${mapRpcError(err.message)}`)
    }
  }

  const handleCancel = async (tripId: string) => {
    if (!confirm('Are you sure you want to cancel this trip?')) return
    try {
      const { error } = await supabase.rpc('cancel_trip', { p_trip_id: tripId })
      if (error) throw error
      fetchTrips()
    } catch (err: any) {
      alert(`Cancel failed: ${mapRpcError(err.message)}`)
    }
  }

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'secondary'
      case 'DISPATCHED': return 'default'
      case 'COMPLETED': return 'default'
      case 'CANCELLED': return 'destructive'
      default: return 'outline'
    }
  }

  const renderSortableHeader = (label: string, key: string) => {
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => requestSort(key)}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortConfig?.key === key && (
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          )}
        </div>
      </TableHead>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage trip dispatches and completions</p>
        </div>
      </div>
      <ErrorBanner message={error} />
      <div className="mb-6 flex justify-end">
        {(role === 'fleet_manager' || role === 'driver') && (
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" />
              New Trip
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Trip (Draft)</DialogTitle>
              </DialogHeader>
              
              {submitError && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="create-trip-form" onSubmit={handleSubmit(onCreateTrip)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input id="source" {...register('source')} placeholder="e.g. Warehouse A" />
                    {errors.source && <p className="text-sm text-destructive">{errors.source.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Destination</Label>
                    <Input id="destination" {...register('destination')} placeholder="e.g. Hub B" />
                    {errors.destination && <p className="text-sm text-destructive">{errors.destination.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_id">Vehicle</Label>
                    <select 
                      id="vehicle_id" 
                      {...register('vehicle_id')} 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select a vehicle</option>
                      {availableVehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number} ({v.name_model}) - Max {v.max_load_capacity}kg</option>
                      ))}
                    </select>
                    {errors.vehicle_id && <p className="text-sm text-destructive">{errors.vehicle_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_id">Driver</Label>
                    <select 
                      id="driver_id" 
                      {...register('driver_id')} 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select a driver</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.license_number})</option>
                      ))}
                    </select>
                    {errors.driver_id && <p className="text-sm text-destructive">{errors.driver_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo_weight">Cargo Weight (kg)</Label>
                    <Input id="cargo_weight" type="number" {...register('cargo_weight', { valueAsNumber: true })} />
                    {errors.cargo_weight && <p className="text-sm text-destructive">{errors.cargo_weight.message}</p>}
                    {isCargoOverweight && (
                      <p className="text-sm text-destructive font-medium">Warning: Exceeds vehicle capacity of {selectedVehicle?.max_load_capacity}kg</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planned_distance">Planned Distance (km)</Label>
                    <Input id="planned_distance" type="number" {...register('planned_distance', { valueAsNumber: true })} />
                    {errors.planned_distance && <p className="text-sm text-destructive">{errors.planned_distance.message}</p>}
                  </div>
                </div>
              </form>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" form="create-trip-form" disabled={isSubmitting || !!isCargoOverweight}>
                  {isSubmitting ? 'Saving...' : 'Create Trip Draft'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHeader('Route', 'source')}
              {renderSortableHeader('Vehicle & Driver', 'vehicle_id')}
              {renderSortableHeader('Cargo & Dist.', 'cargo_weight')}
              {renderSortableHeader('Status', 'status')}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading trips...</TableCell>
              </TableRow>
            ) : sortedTrips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No trips found.</TableCell>
              </TableRow>
            ) : (
              sortedTrips.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.source}</div>
                    <div className="text-sm text-muted-foreground">to {t.destination}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.vehicles?.registration_number}</div>
                    <div className="text-sm text-muted-foreground">{t.drivers?.name}</div>
                  </TableCell>
                  <TableCell>
                    <div>{t.cargo_weight} kg</div>
                    <div className="text-sm text-muted-foreground">{t.planned_distance} km</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(t.status) as any}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {t.status === 'DRAFT' && (
                      <Button variant="secondary" size="sm" onClick={() => handleDispatch(t.id)} className="gap-1">
                        <Play className="w-3 h-3" /> Dispatch
                      </Button>
                    )}
                    {t.status === 'DISPATCHED' && (
                      <>
                        <Button variant="default" size="sm" onClick={() => setShowCompleteModal(t.id)} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <CheckCircle className="w-3 h-3" /> Complete
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleCancel(t.id)} className="gap-1">
                          <XCircle className="w-3 h-3" /> Cancel
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!showCompleteModal} onOpenChange={(open) => !open && setShowCompleteModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Trip</DialogTitle>
          </DialogHeader>
          <form id="complete-trip-form" onSubmit={handleComplete} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="final_odometer">Final Odometer</Label>
              <Input 
                id="final_odometer"
                type="number" 
                required 
                value={finalOdometer} 
                onChange={e => setFinalOdometer(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuel_consumed">Fuel Consumed (Liters)</Label>
              <Input 
                id="fuel_consumed"
                type="number" 
                required 
                value={fuelConsumed}
                onChange={e => setFuelConsumed(e.target.value ? Number(e.target.value) : '')}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteModal(null)} type="button">
              Cancel
            </Button>
            <Button type="submit" form="complete-trip-form" className="bg-green-600 hover:bg-green-700 text-white">
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
