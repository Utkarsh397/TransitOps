import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

const vehicleSchema = z.object({
  registration_number: z.string().min(1, 'Registration is required'),
  name_model: z.string().min(1, 'Model is required'),
  type: z.string().min(1, 'Type is required'),
  max_load_capacity: z.number().min(1, 'Capacity > 0 required'),
  acquisition_cost: z.number().min(0, 'Cost >= 0 required'),
  region: z.string().optional(),
})

type VehicleFormValues = z.infer<typeof vehicleSchema>

export default function Vehicles() {
  const { role } = useAuth()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  
  const [showModal, setShowModal] = useState(false)
  const [uploadData, setUploadData] = useState<{url: string, publicId: string} | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { items: sortedVehicles, requestSort, sortConfig } = useSortableData(vehicles)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { max_load_capacity: 0, acquisition_cost: 0 }
  })

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

  useEffect(() => {
    fetchVehicles()
  }, [filterType, filterStatus, filterRegion])

  const fetchVehicles = async () => {
    try {
      setLoading(true)
      let query = supabase.from('vehicles').select('*').order('created_at', { ascending: false })
      if (filterType) query = query.eq('type', filterType)
      if (filterStatus) query = query.eq('status', filterStatus)
      if (filterRegion) query = query.eq('region', filterRegion)

      const { data, error } = await query
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.error('Error fetching vehicles:', err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: VehicleFormValues) => {
    try {
      setSubmitError(null)
      const insertData = {
        ...data,
        photo_url: uploadData?.url || null,
        photo_public_id: uploadData?.publicId || null,
        status: 'AVAILABLE',
        odometer: 0,
      }

      const { error } = await supabase.from('vehicles').insert(insertData)
      if (error) {
        if (error.code === '23505') throw new Error('A vehicle with this registration number already exists.')
        throw error
      }
      
      setShowModal(false)
      reset()
      setUploadData(null)
      fetchVehicles()
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to add vehicle')
    }
  }

  const getThumbnailUrl = (publicId: string | null) => {
    if (!publicId || !cloudName) return null
    return `https://res.cloudinary.com/${cloudName}/image/upload/w_200,h_150,c_fill,q_auto,f_auto/${publicId}`
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'ON_TRIP': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'IN_SHOP': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'RETIRED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vehicles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your fleet registry</p>
        </div>
        {role === 'fleet_manager' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Vehicle
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap gap-4 items-end transition-colors">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Status</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="block w-40 pl-3 pr-10 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="IN_SHOP">In Shop</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Type</label>
          <input 
            type="text" 
            placeholder="e.g. Van, Truck"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="block w-40 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Region</label>
          <input 
            type="text" 
            placeholder="Filter Region"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="block w-40 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
          />
        </div>
        {(filterStatus || filterType || filterRegion) && (
          <button 
            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterRegion(''); }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline px-2 py-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Photo</th>
                {renderSortableHeader('Registration / Model', 'registration_number')}
                {renderSortableHeader('Type / Region', 'type')}
                {renderSortableHeader('Odometer', 'odometer')}
                {renderSortableHeader('Status', 'status')}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading vehicles...</td></tr>
              ) : sortedVehicles.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No vehicles found.</td></tr>
              ) : (
                sortedVehicles.map((v) => {
                  const thumb = getThumbnailUrl(v.photo_public_id)
                  return (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {thumb ? (
                          <img src={thumb} alt={v.name_model} className="h-16 w-20 object-cover rounded shadow-sm border border-gray-200 dark:border-gray-600" />
                        ) : (
                          <div className="h-16 w-20 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                            No Photo
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{v.registration_number}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{v.name_model}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{v.type}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{v.region || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {v.odometer.toLocaleString()} km
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(v.status)}`}>
                          {v.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && role === 'fleet_manager' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mt-10 mb-10 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Vehicle</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {submitError && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-md border border-red-100 dark:border-red-800 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="vehicle-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Number</label>
                    <input {...register('registration_number')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. AB-1234" />
                    {errors.registration_number && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.registration_number.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Name</label>
                    <input {...register('name_model')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. Ford Transit" />
                    {errors.name_model && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name_model.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle Type</label>
                    <input {...register('type')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. Cargo Van" />
                    {errors.type && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.type.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</label>
                    <input {...register('region')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" placeholder="e.g. North Area" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Load Capacity (kg)</label>
                    <input type="number" {...register('max_load_capacity', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {errors.max_load_capacity && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.max_load_capacity.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Acquisition Cost ($)</label>
                    <input type="number" {...register('acquisition_cost', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {errors.acquisition_cost && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.acquisition_cost.message}</p>}
                  </div>
                </div>

                <div className="pt-2">
                  <ImageUpload 
                    folder="transitops/vehicles" 
                    label="Vehicle Photo" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="vehicle-form"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
