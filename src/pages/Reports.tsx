import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, ArrowUp, ArrowDown } from 'lucide-react'
// @ts-ignore
import Papa from 'papaparse'
import { useSortableData } from '../hooks/useSortableData'

export default function Reports() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [revenueMap, setRevenueMap] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [vehRes, trpRes, fuelRes, expRes, maintRes] = await Promise.all([
        supabase.from('vehicles').select('id, registration_number, name_model, acquisition_cost, status'),
        supabase.from('trips').select('vehicle_id, planned_distance, status'),
        supabase.from('fuel_logs').select('vehicle_id, liters, cost'),
        supabase.from('expenses').select('vehicle_id, amount'),
        supabase.from('maintenance_logs').select('vehicle_id, cost').not('cost', 'is', null)
      ])

      if (vehRes.error) throw vehRes.error

      setVehicles(vehRes.data || [])
      setTrips(trpRes.data || [])
      setFuelLogs(fuelRes.data || [])
      setExpenses(expRes.data || [])
      setMaintenanceLogs(maintRes.data || [])
    } catch (err) {
      console.error('Error fetching report data:', err)
    } finally {
      setLoading(false)
    }
  }

  const reportData = useMemo(() => {
    return vehicles.map(v => {
      const vTrips = trips.filter(t => t.vehicle_id === v.id)
      const vFuel = fuelLogs.filter(f => f.vehicle_id === v.id)
      const vExp = expenses.filter(e => e.vehicle_id === v.id)
      const vMaint = maintenanceLogs.filter(m => m.vehicle_id === v.id)

      const totalDistance = vTrips.reduce((sum, t) => sum + (Number(t.planned_distance) || 0), 0)
      const totalFuelLiters = vFuel.reduce((sum, f) => sum + (Number(f.liters) || 0), 0)
      const fuelEfficiency = totalFuelLiters > 0 ? Number((totalDistance / totalFuelLiters).toFixed(2)) : 0

      const costFuel = vFuel.reduce((sum, f) => sum + (Number(f.cost) || 0), 0)
      const costExpenses = vExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      const costMaintenance = vMaint.reduce((sum, m) => sum + (Number(m.cost) || 0), 0)
      
      const totalCost = costFuel + costExpenses + costMaintenance
      const acqCost = Number(v.acquisition_cost) || 1 

      const revenue = revenueMap[v.id] || 0
      const roi = Number((((revenue - totalCost) / acqCost) * 100).toFixed(2))

      return {
        id: v.id,
        registration: v.registration_number,
        model: v.name_model,
        acquisition_cost: acqCost,
        total_distance: totalDistance,
        fuel_efficiency: fuelEfficiency,
        cost_fuel: costFuel,
        cost_maintenance: costMaintenance,
        cost_expenses: costExpenses,
        total_cost: totalCost,
        revenue: revenue,
        roi: roi
      }
    })
  }, [vehicles, trips, fuelLogs, expenses, maintenanceLogs, revenueMap])

  const { items: sortedReportData, requestSort, sortConfig } = useSortableData(reportData)

  const handleRevenueChange = (id: string, value: string) => {
    setRevenueMap(prev => ({
      ...prev,
      [id]: Number(value) || 0
    }))
  }

  const exportCsv = () => {
    const csvData = sortedReportData.map(row => ({
      'Registration': row.registration,
      'Model': row.model,
      'Acquisition Cost': row.acquisition_cost,
      'Total Distance (km)': row.total_distance,
      'Fuel Efficiency (km/L)': row.fuel_efficiency,
      'Fuel Cost': row.cost_fuel,
      'Maintenance Cost': row.cost_maintenance,
      'Other Expenses': row.cost_expenses,
      'Total Operational Cost': row.total_cost,
      'Assumed Revenue': row.revenue,
      'ROI (%)': row.roi
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'fleet_roi_report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderSortableHeader = (label: string, key: string) => (
    <th 
      scope="col" 
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Deep dive into fleet performance and costs</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-500 dark:text-gray-400">Loading Analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Fuel Efficiency (km/L)</h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                    <XAxis dataKey="registration" tick={{fontSize: 12, fill: '#9ca3af'}} angle={-45} textAnchor="end" />
                    <YAxis tick={{fontSize: 12, fill: '#9ca3af'}} />
                    <Tooltip cursor={{fill: 'rgba(107, 114, 128, 0.2)'}} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                    <Bar dataKey="fuel_efficiency" name="Efficiency (km/L)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Operational Cost Breakdown ($)</h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                    <XAxis dataKey="registration" tick={{fontSize: 12, fill: '#9ca3af'}} angle={-45} textAnchor="end" />
                    <YAxis tick={{fontSize: 12, fill: '#9ca3af'}} />
                    <Tooltip cursor={{fill: 'rgba(107, 114, 128, 0.2)'}} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#9ca3af' }}/>
                    <Bar dataKey="cost_fuel" name="Fuel" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="cost_maintenance" name="Maintenance" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="cost_expenses" name="Other" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Vehicle ROI Analysis</h2>
              <button 
                onClick={exportCsv}
                className="flex items-center gap-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    {renderSortableHeader('Registration', 'registration')}
                    {renderSortableHeader('Acquisition Cost', 'acquisition_cost')}
                    {renderSortableHeader('Total Ops Cost', 'total_cost')}
                    {renderSortableHeader('Assumed Revenue ($)', 'revenue')}
                    {renderSortableHeader('ROI %', 'roi')}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedReportData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{row.registration}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${row.acquisition_cost.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${row.total_cost.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <input 
                          type="number"
                          className="w-24 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                          value={revenueMap[row.id] || ''}
                          onChange={(e) => handleRevenueChange(row.id, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${row.roi > 0 ? 'text-green-600 dark:text-green-400' : row.roi < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {row.roi > 0 ? '+' : ''}{row.roi}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              * ROI = (Revenue - Operational Cost) / Acquisition Cost. Operational Cost includes Fuel, Maintenance, and Other Expenses.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
