import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, ArrowUp, ArrowDown } from 'lucide-react'
import { ErrorBanner } from '../components/ErrorBanner'
// @ts-ignore
import Papa from 'papaparse'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Reports() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
    } catch (err: any) {
      console.error('Error fetching report data:', err)
      setError(err.message || 'Something went wrong')
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

      const costFuelCents = vFuel.reduce((sum, f) => sum + Math.round(Number(f.cost) * 100), 0)
      const costExpensesCents = vExp.reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0)
      const costMaintenanceCents = vMaint.reduce((sum, m) => sum + Math.round(Number(m.cost) * 100), 0)
      
      const totalCostCents = costFuelCents + costExpensesCents + costMaintenanceCents

      const costFuel = costFuelCents / 100
      const costExpenses = costExpensesCents / 100
      const costMaintenance = costMaintenanceCents / 100
      const totalCost = totalCostCents / 100
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep dive into fleet performance and costs</p>
        </div>
      </div>
      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">Loading Analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fuel Efficiency (km/L)</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Operational Cost Breakdown ($)</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-lg">Vehicle ROI Analysis</CardTitle>
              <Button 
                variant="outline"
                onClick={exportCsv}
                className="gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {renderSortableHeader('Registration', 'registration')}
                      {renderSortableHeader('Acquisition Cost', 'acquisition_cost')}
                      {renderSortableHeader('Total Ops Cost', 'total_cost')}
                      {renderSortableHeader('Assumed Revenue ($)', 'revenue')}
                      {renderSortableHeader('ROI %', 'roi')}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReportData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.registration}</TableCell>
                        <TableCell className="text-muted-foreground">${row.acquisition_cost.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">${row.total_cost.toLocaleString()}</TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            className="w-24 h-8 text-sm"
                            value={revenueMap[row.id] || ''}
                            onChange={(e) => handleRevenueChange(row.id, e.target.value)}
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${row.roi > 0 ? 'text-green-500' : row.roi < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {row.roi > 0 ? '+' : ''}{row.roi}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                * ROI = (Revenue - Operational Cost) / Acquisition Cost. Operational Cost includes Fuel, Maintenance, and Other Expenses.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
