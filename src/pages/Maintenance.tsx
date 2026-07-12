import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, X, Wrench, CheckCircle, Info, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

const openMaintenanceSchema = z.object({
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  description: z.string().min(1, 'Description is required'),
})

type OpenMaintenanceValues = z.infer<typeof openMaintenanceSchema>

export default function Maintenance() {
  const { role } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [filterStatus, setFilterStatus] = useState('')
  
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState<string | null>(null)
  
  const [uploadData, setUploadData] = useState<{url: string, publicId: string} | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [closeCost, setCloseCost] = useState<number | ''>('')
  const [banner, setBanner] = useState<{message: string} | null>(null)

  const { items: sortedLogs, requestSort, sortConfig } = useSortableData(logs)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OpenMaintenanceValues>({
    resolver: zodResolver(openMaintenanceSchema)
  })

  useEffect(() => {
    fetchLogs()
  }, [filterStatus])

  useEffect(() => {
    if (showOpenModal) {
      fetchEligibleVehicles()
    }
  }, [showOpenModal])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('maintenance_logs')
        .select(`*, vehicles ( registration_number )`)
        .order('opened_at', { ascending: false })
      
      if (filterStatus) {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Error fetching maintenance logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchEligibleVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, registration_number, name_model')
        .neq('status', 'RETIRED')
        
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.error('Error fetching vehicles:', err)
    }
  }

  const showBannerMessage = (message: string) => {
    setBanner({ message })
    setTimeout(() => setBanner(null), 5000)
  }

  const onOpenMaintenance = async (data: OpenMaintenanceValues) => {
    try {
      setSubmitError(null)
      const { error } = await supabase.rpc('open_maintenance', {
        p_vehicle_id: data.vehicle_id,
        p_description: data.description,
        p_receipt_url: uploadData?.url || null,
        p_receipt_public_id: uploadData?.publicId || null
      })
      if (error) throw error
      
      const vehicle = vehicles.find(v => v.id === data.vehicle_id)
      
      setShowOpenModal(false)
      reset()
      setUploadData(null)
      fetchLogs()
      showBannerMessage(`Maintenance opened. ${vehicle?.registration_number} status changed to IN SHOP.`)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to open maintenance record')
    }
  }

  const handleCloseMaintenance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showCloseModal || closeCost === '') return
    
    try {
      const { error } = await supabase.rpc('close_maintenance', {
        p_log_id: showCloseModal,
        p_cost: Number(closeCost)
      })
      if (error) throw error
      
      const log = logs.find(l => l.id === showCloseModal)
      
      setShowCloseModal(null)
      setCloseCost('')
      fetchLogs()
      showBannerMessage(`Maintenance closed for ${log?.vehicles?.registration_number}. Vehicle status returned to AVAILABLE (if not retired).`)
    } catch (err: any) {
      alert(`Failed to close maintenance: ${err.message}`)
    }
  }

  const getStatusColor = (status: string) => {
    return status === 'OPEN' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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
      {banner && (
        <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 flex items-start gap-3 transition-colors">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">{banner.message}</p>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Maintenance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track vehicle repairs and shop time</p>
        </div>
        {role === 'fleet_manager' && (
          <button
            onClick={() => setShowOpenModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Open Record
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
            <option value="">All Records</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {renderSortableHeader('Vehicle', 'vehicle_id')}
                {renderSortableHeader('Description', 'description')}
                {renderSortableHeader('Cost', 'cost')}
                {renderSortableHeader('Status', 'status')}
                {renderSortableHeader('Opened At', 'opened_at')}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading records...</td></tr>
              ) : sortedLogs.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No maintenance records found.</td></tr>
              ) : (
                sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {log.vehicles?.registration_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-300 line-clamp-2 max-w-xs">{log.description}</div>
                      {log.receipt_url && (
                        <a href={log.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 block">
                          View Receipt
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      ${log.cost.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>Opened: {new Date(log.opened_at).toLocaleDateString()}</div>
                      {log.closed_at && <div>Closed: {new Date(log.closed_at).toLocaleDateString()}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {log.status === 'OPEN' && role === 'fleet_manager' && (
                        <button 
                          onClick={() => setShowCloseModal(log.id)} 
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md"
                        >
                          <CheckCircle className="w-3 h-3" /> Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showOpenModal && role === 'fleet_manager' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl mt-10 mb-10 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Open Maintenance Record
              </h2>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {submitError && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-md border border-red-100 dark:border-red-800 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="open-maintenance-form" onSubmit={handleSubmit(onOpenMaintenance)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Vehicle</label>
                  <select {...register('vehicle_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                    <option value="">Choose a vehicle (excludes retired)</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.registration_number} - {v.name_model}</option>
                    ))}
                  </select>
                  {errors.vehicle_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicle_id.message}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Description</label>
                  <textarea 
                    {...register('description')} 
                    rows={3} 
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" 
                    placeholder="Describe the maintenance issue or work required..." 
                  />
                  {errors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>}
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <ImageUpload 
                    folder="transitops/maintenance" 
                    label="Attach Quotation / Preliminary Receipt (Optional)" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="open-maintenance-form"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Opening...' : 'Submit to Shop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && role === 'fleet_manager' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Close Maintenance</h2>
              <button onClick={() => setShowCloseModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <form id="close-maintenance-form" onSubmit={handleCloseMaintenance} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Final Cost ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required 
                    value={closeCost} 
                    onChange={e => setCloseCost(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" 
                    placeholder="e.g. 250.00"
                  />
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowCloseModal(null)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="close-maintenance-form"
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
              >
                Confirm Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
