import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { X, FileText, Droplets, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

const fuelSchema = z.object({
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  trip_id: z.string().optional(),
  liters: z.number().min(0.1, 'Liters must be > 0'),
  cost: z.number().min(0, 'Cost must be >= 0'),
  log_date: z.string().min(1, 'Date is required'),
})

const expenseSchema = z.object({
  vehicle_id: z.string().min(1, 'Vehicle is required'),
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0, 'Amount must be >= 0'),
  expense_date: z.string().min(1, 'Date is required'),
})

type FuelFormValues = z.infer<typeof fuelSchema>
type ExpenseFormValues = z.infer<typeof expenseSchema>

export default function FuelExpenses() {
  const { role } = useAuth()
  const [activeTab, setActiveTab] = useState<'fuel' | 'expenses'>('fuel')
  
  const [vehicles, setVehicles] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showFuelModal, setShowFuelModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  
  const [uploadData, setUploadData] = useState<{url: string, publicId: string} | null>(null)

  const { items: sortedFuelLogs, requestSort: requestFuelSort, sortConfig: fuelSortConfig } = useSortableData(fuelLogs)
  const { items: sortedExpenses, requestSort: requestExpenseSort, sortConfig: expenseSortConfig } = useSortableData(expenses)

  const fuelForm = useForm<FuelFormValues>({
    resolver: zodResolver(fuelSchema),
    defaultValues: { log_date: new Date().toISOString().split('T')[0] }
  })

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { expense_date: new Date().toISOString().split('T')[0] }
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [vehRes, trpRes, fuelRes, expRes, maintRes] = await Promise.all([
        supabase.from('vehicles').select('id, registration_number, name_model'),
        supabase.from('trips').select('id, source, destination, status'),
        supabase.from('fuel_logs').select('*, vehicles(registration_number), trips(source, destination)').order('log_date', { ascending: false }),
        supabase.from('expenses').select('*, vehicles(registration_number)').order('expense_date', { ascending: false }),
        supabase.from('maintenance_logs').select('vehicle_id, cost').not('cost', 'is', null)
      ])

      if (vehRes.error) throw vehRes.error
      if (fuelRes.error) throw fuelRes.error
      if (expRes.error) throw expRes.error

      setVehicles(vehRes.data || [])
      setTrips(trpRes.data || [])
      setFuelLogs(fuelRes.data || [])
      setExpenses(expRes.data || [])
      setMaintenanceLogs(maintRes.data || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const vehicleTotals = useMemo(() => {
    const totals: Record<string, { reg: string, total: number }> = {}
    vehicles.forEach(v => { totals[v.id] = { reg: v.registration_number, total: 0 } })
    fuelLogs.forEach(f => { if (totals[f.vehicle_id]) totals[f.vehicle_id].total += Number(f.cost) })
    expenses.forEach(e => { if (totals[e.vehicle_id]) totals[e.vehicle_id].total += Number(e.amount) })
    maintenanceLogs.forEach(m => { if (totals[m.vehicle_id]) totals[m.vehicle_id].total += Number(m.cost) })
    return Object.values(totals).sort((a, b) => b.total - a.total)
  }, [vehicles, fuelLogs, expenses, maintenanceLogs])

  const onSubmitFuel = async (data: FuelFormValues) => {
    try {
      const { error } = await supabase.from('fuel_logs').insert({
        ...data,
        trip_id: data.trip_id || null,
        receipt_url: uploadData?.url || null,
        receipt_public_id: uploadData?.publicId || null
      })
      if (error) throw error
      setShowFuelModal(false)
      fuelForm.reset()
      setUploadData(null)
      fetchData()
    } catch (err: any) {
      alert(`Error adding fuel log: ${err.message}`)
    }
  }

  const onSubmitExpense = async (data: ExpenseFormValues) => {
    try {
      const { error } = await supabase.from('expenses').insert({
        ...data,
        receipt_url: uploadData?.url || null,
        receipt_public_id: uploadData?.publicId || null
      })
      if (error) throw error
      setShowExpenseModal(false)
      expenseForm.reset()
      setUploadData(null)
      fetchData()
    } catch (err: any) {
      alert(`Error adding expense: ${err.message}`)
    }
  }

  const renderSortableHeader = (
    label: string, 
    key: string, 
    requestSortFunc: (key: string) => void, 
    sortConfigObj: { key: string, direction: 'asc'|'desc' } | null
  ) => (
    <th 
      scope="col" 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      onClick={() => requestSortFunc(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfigObj?.key === key && (
          sortConfigObj.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
      </div>
    </th>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fuel & Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track fleet operating costs</p>
        </div>
        {role === 'fleet_manager' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium"
            >
              <FileText className="w-4 h-4" /> Add Expense
            </button>
            <button
              onClick={() => setShowFuelModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
            >
              <Droplets className="w-4 h-4" /> Add Fuel Log
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Vehicle Lifetime Cost (Fuel + Expenses + Maint.)</h3>
        <div className="flex overflow-x-auto pb-2 gap-4">
          {vehicleTotals.map(vt => (
            <div key={vt.reg} className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-w-[140px] transition-colors">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{vt.reg}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">${vt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          ))}
          {vehicleTotals.length === 0 && <div className="text-sm text-gray-500 dark:text-gray-400">No data available</div>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('fuel')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fuel'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Fuel Logs
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'expenses'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              Other Expenses
            </button>
          </nav>
        </div>
        
        <div className="overflow-x-auto">
          {activeTab === 'fuel' ? (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {renderSortableHeader('Date', 'log_date', requestFuelSort, fuelSortConfig)}
                  {renderSortableHeader('Vehicle', 'vehicle_id', requestFuelSort, fuelSortConfig)}
                  {renderSortableHeader('Amount', 'liters', requestFuelSort, fuelSortConfig)}
                  {renderSortableHeader('Cost', 'cost', requestFuelSort, fuelSortConfig)}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Linked Trip</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
                ) : sortedFuelLogs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No fuel logs found.</td></tr>
                ) : (
                  sortedFuelLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{log.log_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{log.vehicles?.registration_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{log.liters} L</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">${Number(log.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {log.trips ? `${log.trips.source} -> ${log.trips.destination}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {log.receipt_url ? (
                          <a href={log.receipt_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">View</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {renderSortableHeader('Date', 'expense_date', requestExpenseSort, expenseSortConfig)}
                  {renderSortableHeader('Vehicle', 'vehicle_id', requestExpenseSort, expenseSortConfig)}
                  {renderSortableHeader('Category', 'category', requestExpenseSort, expenseSortConfig)}
                  {renderSortableHeader('Amount', 'amount', requestExpenseSort, expenseSortConfig)}
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
                ) : sortedExpenses.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No expenses found.</td></tr>
                ) : (
                  sortedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{exp.expense_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{exp.vehicles?.registration_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">{exp.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">${Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {exp.receipt_url ? (
                          <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">View</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showFuelModal && role === 'fleet_manager' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl mt-10 mb-10 overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Droplets className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Add Fuel Log
              </h2>
              <button onClick={() => setShowFuelModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="fuel-form" onSubmit={fuelForm.handleSubmit(onSubmitFuel)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle</label>
                    <select {...fuelForm.register('vehicle_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">Select vehicle</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number}</option>
                      ))}
                    </select>
                    {fuelForm.formState.errors.vehicle_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fuelForm.formState.errors.vehicle_id.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Trip (Optional)</label>
                    <select {...fuelForm.register('trip_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">No linked trip</option>
                      {trips.map(t => (
                        <option key={t.id} value={t.id}>{t.source} - {t.destination}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Liters (L)</label>
                    <input type="number" step="0.1" {...fuelForm.register('liters', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {fuelForm.formState.errors.liters && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fuelForm.formState.errors.liters.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Cost ($)</label>
                    <input type="number" step="0.01" {...fuelForm.register('cost', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {fuelForm.formState.errors.cost && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fuelForm.formState.errors.cost.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input type="date" {...fuelForm.register('log_date')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {fuelForm.formState.errors.log_date && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fuelForm.formState.errors.log_date.message}</p>}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <ImageUpload 
                    folder="transitops/receipts" 
                    label="Attach Receipt Scan (Optional)" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowFuelModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="fuel-form"
                disabled={fuelForm.formState.isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {fuelForm.formState.isSubmitting ? 'Saving...' : 'Save Fuel Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && role === 'fleet_manager' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl mt-10 mb-10 overflow-hidden flex flex-col transition-colors">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Add Expense
              </h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="expense-form" onSubmit={expenseForm.handleSubmit(onSubmitExpense)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle</label>
                    <select {...expenseForm.register('vehicle_id')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">Select vehicle</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registration_number}</option>
                      ))}
                    </select>
                    {expenseForm.formState.errors.vehicle_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{expenseForm.formState.errors.vehicle_id.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select {...expenseForm.register('category')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white">
                      <option value="">Select category</option>
                      <option value="toll">Toll</option>
                      <option value="maintenance">Maintenance (Ad-Hoc)</option>
                      <option value="other">Other</option>
                    </select>
                    {expenseForm.formState.errors.category && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{expenseForm.formState.errors.category.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
                    <input type="number" step="0.01" {...expenseForm.register('amount', { valueAsNumber: true })} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {expenseForm.formState.errors.amount && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{expenseForm.formState.errors.amount.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input type="date" {...expenseForm.register('expense_date')} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:text-white" />
                    {expenseForm.formState.errors.expense_date && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{expenseForm.formState.errors.expense_date.message}</p>}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <ImageUpload 
                    folder="transitops/receipts" 
                    label="Attach Receipt Scan (Optional)" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 transition-colors">
              <button 
                type="button" 
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="expense-form"
                disabled={expenseForm.formState.isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {expenseForm.formState.isSubmitting ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
