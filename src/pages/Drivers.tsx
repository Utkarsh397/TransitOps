import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, X, AlertTriangle } from 'lucide-react'

const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  license_number: z.string().min(1, 'License number is required'),
  license_category: z.string().min(1, 'License category is required'),
  license_expiry: z.string().min(1, 'Expiry date is required'),
  contact_number: z.string().optional(),
})

type DriverFormValues = z.infer<typeof driverSchema>

export default function Drivers() {
  const { role } = useAuth()
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [uploadData, setUploadData] = useState<{url: string, publicId: string} | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema)
  })

  useEffect(() => {
    fetchDrivers()
  }, [filterExpiringSoon])

  const fetchDrivers = async () => {
    try {
      setLoading(true)
      let query = supabase.from('drivers').select('*').order('created_at', { ascending: false })
      
      if (filterExpiringSoon) {
        const today = new Date()
        const in30Days = new Date()
        in30Days.setDate(today.getDate() + 30)
        
        query = query
          .lte('license_expiry', in30Days.toISOString().split('T')[0])
          .gte('license_expiry', today.toISOString().split('T')[0])
      }

      const { data, error } = await query
      if (error) throw error
      setDrivers(data || [])
    } catch (err) {
      console.error('Error fetching drivers:', err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: DriverFormValues) => {
    try {
      setSubmitError(null)
      const insertData = {
        ...data,
        license_doc_url: uploadData?.url || null,
        license_doc_public_id: uploadData?.publicId || null,
        status: 'AVAILABLE',
        safety_score: 100,
      }

      const { error } = await supabase.from('drivers').insert(insertData)
      if (error) {
        if (error.code === '23505') {
          throw new Error('A driver with this license number already exists.')
        }
        throw error
      }
      
      setShowModal(false)
      reset()
      setUploadData(null)
      fetchDrivers()
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to add driver')
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800'
      case 'ON_TRIP': return 'bg-blue-100 text-blue-800'
      case 'OFF_DUTY': return 'bg-gray-100 text-gray-800'
      case 'SUSPENDED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date(new Date().setHours(0,0,0,0))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage fleet personnel and licenses</p>
        </div>
        {role === 'safety_officer' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Driver
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={filterExpiringSoon}
            onChange={(e) => setFilterExpiringSoon(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">Expiring Soon (Next 30 Days)</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver Details</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License info</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Safety Score</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading drivers...</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No drivers found.</td></tr>
              ) : (
                drivers.map((d) => {
                  const expired = isExpired(d.license_expiry)
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{d.name}</div>
                        <div className="text-sm text-gray-500">{d.contact_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{d.license_number}</div>
                        <div className="text-sm text-gray-500">Category: {d.license_category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${expired ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                            {d.license_expiry}
                          </span>
                          {expired && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </div>
                        {expired && <span className="text-xs text-red-600">Expired</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${d.safety_score < 70 ? 'text-red-600' : d.safety_score < 90 ? 'text-orange-600' : 'text-green-600'}`}>
                          {d.safety_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(d.status)}`}>
                          {d.status.replace('_', ' ')}
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

      {/* Modal */}
      {showModal && role === 'safety_officer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mt-10 mb-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Add New Driver</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {submitError && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md border border-red-100 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="driver-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input {...register('name')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. John Smith" />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                    <input {...register('contact_number')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. +1 555-0123" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                    <input {...register('license_number')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. DL-98765432" />
                    {errors.license_number && <p className="mt-1 text-sm text-red-600">{errors.license_number.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Category</label>
                    <input {...register('license_category')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. CDL-A" />
                    {errors.license_category && <p className="mt-1 text-sm text-red-600">{errors.license_category.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                    <input type="date" {...register('license_expiry')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
                    {errors.license_expiry && <p className="mt-1 text-sm text-red-600">{errors.license_expiry.message}</p>}
                  </div>
                </div>

                <div className="pt-2">
                  <ImageUpload 
                    folder="transitops/drivers" 
                    label="License Scan (Image)" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="driver-form"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
