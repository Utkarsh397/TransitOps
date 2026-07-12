import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { FileText, Droplets, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => requestSortFunc(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfigObj?.key === key && (
          sortConfigObj.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
      </div>
    </TableHead>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fuel & Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track fleet operating costs</p>
        </div>
        {role === 'fleet_manager' && (
          <div className="flex gap-2">
            <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
              <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
                <FileText className="w-4 h-4" /> Add Expense
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Add Expense
                  </DialogTitle>
                </DialogHeader>
                <form id="expense-form" onSubmit={expenseForm.handleSubmit(onSubmitExpense)} className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_id">Vehicle</Label>
                      <select 
                        id="vehicle_id" 
                        {...expenseForm.register('vehicle_id')} 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_number}</option>
                        ))}
                      </select>
                      {expenseForm.formState.errors.vehicle_id && <p className="text-sm text-destructive">{expenseForm.formState.errors.vehicle_id.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select 
                        id="category" 
                        {...expenseForm.register('category')} 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select category</option>
                        <option value="toll">Toll</option>
                        <option value="maintenance">Maintenance (Ad-Hoc)</option>
                        <option value="other">Other</option>
                      </select>
                      {expenseForm.formState.errors.category && <p className="text-sm text-destructive">{expenseForm.formState.errors.category.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input id="amount" type="number" step="0.01" {...expenseForm.register('amount', { valueAsNumber: true })} />
                      {expenseForm.formState.errors.amount && <p className="text-sm text-destructive">{expenseForm.formState.errors.amount.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expense_date">Date</Label>
                      <Input id="expense_date" type="date" {...expenseForm.register('expense_date')} />
                      {expenseForm.formState.errors.expense_date && <p className="text-sm text-destructive">{expenseForm.formState.errors.expense_date.message}</p>}
                    </div>
                  </div>
                  <div className="pt-2">
                    <ImageUpload 
                      folder="transitops/receipts" 
                      label="Attach Receipt Scan (Optional)" 
                      onUploaded={(data) => setUploadData(data.url ? data : null)}
                    />
                  </div>
                </form>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowExpenseModal(false)} type="button">
                    Cancel
                  </Button>
                  <Button type="submit" form="expense-form" disabled={expenseForm.formState.isSubmitting}>
                    {expenseForm.formState.isSubmitting ? 'Saving...' : 'Save Expense'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showFuelModal} onOpenChange={setShowFuelModal}>
              <DialogTrigger render={<Button className="gap-2" />}>
                <Droplets className="w-4 h-4" /> Add Fuel Log
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-primary" />
                    Add Fuel Log
                  </DialogTitle>
                </DialogHeader>
                <form id="fuel-form" onSubmit={fuelForm.handleSubmit(onSubmitFuel)} className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_id_fuel">Vehicle</Label>
                      <select 
                        id="vehicle_id_fuel" 
                        {...fuelForm.register('vehicle_id')} 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_number}</option>
                        ))}
                      </select>
                      {fuelForm.formState.errors.vehicle_id && <p className="text-sm text-destructive">{fuelForm.formState.errors.vehicle_id.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trip_id">Linked Trip (Optional)</Label>
                      <select 
                        id="trip_id" 
                        {...fuelForm.register('trip_id')} 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">No linked trip</option>
                        {trips.map(t => (
                          <option key={t.id} value={t.id}>{t.source} - {t.destination}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="liters">Liters (L)</Label>
                      <Input id="liters" type="number" step="0.1" {...fuelForm.register('liters', { valueAsNumber: true })} />
                      {fuelForm.formState.errors.liters && <p className="text-sm text-destructive">{fuelForm.formState.errors.liters.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Total Cost ($)</Label>
                      <Input id="cost" type="number" step="0.01" {...fuelForm.register('cost', { valueAsNumber: true })} />
                      {fuelForm.formState.errors.cost && <p className="text-sm text-destructive">{fuelForm.formState.errors.cost.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="log_date">Date</Label>
                      <Input id="log_date" type="date" {...fuelForm.register('log_date')} />
                      {fuelForm.formState.errors.log_date && <p className="text-sm text-destructive">{fuelForm.formState.errors.log_date.message}</p>}
                    </div>
                  </div>
                  <div className="pt-2">
                    <ImageUpload 
                      folder="transitops/receipts" 
                      label="Attach Receipt Scan (Optional)" 
                      onUploaded={(data) => setUploadData(data.url ? data : null)}
                    />
                  </div>
                </form>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowFuelModal(false)} type="button">
                    Cancel
                  </Button>
                  <Button type="submit" form="fuel-form" disabled={fuelForm.formState.isSubmitting}>
                    {fuelForm.formState.isSubmitting ? 'Saving...' : 'Save Fuel Log'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground font-semibold">Vehicle Lifetime Cost (Fuel + Expenses + Maint.)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex overflow-x-auto pb-2 gap-4">
            {vehicleTotals.map(vt => (
              <div key={vt.reg} className="flex-shrink-0 bg-muted border rounded-lg p-3 min-w-[140px]">
                <div className="text-xs text-muted-foreground font-medium">{vt.reg}</div>
                <div className="text-lg font-bold">${vt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            ))}
            {vehicleTotals.length === 0 && <div className="text-sm text-muted-foreground">No data available</div>}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="fuel" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="fuel">Fuel Logs</TabsTrigger>
          <TabsTrigger value="expenses">Other Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="fuel" className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {renderSortableHeader('Date', 'log_date', requestFuelSort, fuelSortConfig)}
                {renderSortableHeader('Vehicle', 'vehicle_id', requestFuelSort, fuelSortConfig)}
                {renderSortableHeader('Amount', 'liters', requestFuelSort, fuelSortConfig)}
                {renderSortableHeader('Cost', 'cost', requestFuelSort, fuelSortConfig)}
                <TableHead>Linked Trip</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : sortedFuelLogs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No fuel logs found.</TableCell></TableRow>
              ) : (
                sortedFuelLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.log_date}</TableCell>
                    <TableCell className="font-medium">{log.vehicles?.registration_number}</TableCell>
                    <TableCell>{log.liters} L</TableCell>
                    <TableCell>${Number(log.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.trips ? `${log.trips.source} -> ${log.trips.destination}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.receipt_url ? (
                        <a href={log.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="expenses" className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {renderSortableHeader('Date', 'expense_date', requestExpenseSort, expenseSortConfig)}
                {renderSortableHeader('Vehicle', 'vehicle_id', requestExpenseSort, expenseSortConfig)}
                {renderSortableHeader('Category', 'category', requestExpenseSort, expenseSortConfig)}
                {renderSortableHeader('Amount', 'amount', requestExpenseSort, expenseSortConfig)}
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : sortedExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No expenses found.</TableCell></TableRow>
              ) : (
                sortedExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.expense_date}</TableCell>
                    <TableCell className="font-medium">{exp.vehicles?.registration_number}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{exp.category}</TableCell>
                    <TableCell>${Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      {exp.receipt_url ? (
                        <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  )
}
