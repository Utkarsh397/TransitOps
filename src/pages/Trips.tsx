import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { Plus, X, Play, CheckCircle, XCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

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
    } catch (err) {
      console.error('Error fetching trips:', err)
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
    } catch (err) {
      console.error('Error fetching resources:', err)
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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'DISPATCHED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'COMPLETED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const renderSortableHeader = (label: string, key: string) => {
    return (
      <th 
        scope="col" 
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={() => requestSort(key)}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortConfig?.key === key && (
            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          )}
        </div>
      </th>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trips</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage trip dispatches and completions</p>
        </div>
        {(role === 'fleet_manager' || role === 'driver') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Trip
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {renderSortableHeader('Route', 'source')}
                {renderSortableHeader('Vehicle & Driver', 'vehicle_id')}
                {renderSortableHeader('Cargo & Dist.', 'cargo_weight')}
                {renderSortableHeader('Status', 'status')}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading trips...</td></tr>
              ) : sortedTrips.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No trips found.</td></tr>
              ) : (
                sortedTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{t.source}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">to {t.destination}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{t.vehicles?.registration_number}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t.drivers?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{t.cargo_weight} kg</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t.planned_distance} km</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {t.status === 'DRAFT' && (
                        <>
                          <button onClick={() => handleDispatch(t.id)} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md">
                            <Play className="w-3 h-3" /> Dispatch
                          </button>
                        </>
                      )}
                      {t.status === 'DISPATCHED' && (
                        <>
                          <button onClick={() => setShowCompleteModal(t.id)} className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md">
                            <CheckCircle className="w-3 h-3" /> Complete
                          </button>
                          <button onClick={() => handleCancel(t.id)} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md">
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mt-10 mb-10 overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Trip (Draft)</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {submitError && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-md border border-red-100 dark:border-red-800 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="create-trip-form" onSubmit={handleSubmit(onCreateTrip)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source</label>
                    <input {...register('source')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. Warehouse A" />
                    {errors.source && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.source.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
                    <input {...register('destination')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. Hub B" />
                    {errors.destination && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.destination.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle</label>
                    <select {...register('vehicle_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">Select a vehicle</option>
                      {availableVehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number} ({v.name_model}) - Max {v.max_load_capacity}kg</option>
                      ))}
                    </select>
                    {errors.vehicle_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicle_id.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Driver</label>
                    <select {...register('driver_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">Select a driver</option>
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.license_number})</option>
                      ))}
                    </select>
                    {errors.driver_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.driver_id.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cargo Weight (kg)</label>
                    <input type="number" {...register('cargo_weight', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {errors.cargo_weight && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cargo_weight.message}</p>}
                    {isCargoOverweight && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium">Warning: Exceeds vehicle capacity of {selectedVehicle?.max_load_capacity}kg</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Planned Distance (km)</label>
                    <input type="number" {...register('planned_distance', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {errors.planned_distance && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.planned_distance.message}</p>}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="create-trip-form"
                disabled={isSubmitting || !!isCargoOverweight}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Create Trip Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Complete Trip</h2>
              <button onClick={() => setShowCompleteModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <form id="complete-trip-form" onSubmit={handleComplete} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Final Odometer</label>
                  <input 
                    type="number" 
                    required 
                    value={finalOdometer} 
                    onChange={e => setFinalOdometer(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fuel Consumed (Liters)</label>
                  <input 
                    type="number" 
                    required 
                    value={fuelConsumed}
                    onChange={e => setFuelConsumed(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" 
                  />
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowCompleteModal(null)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="complete-trip-form"
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
