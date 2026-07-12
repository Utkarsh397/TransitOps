import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, Wrench, CheckCircle, Info, ArrowUp, ArrowDown } from 'lucide-react'
import { ErrorBanner } from '../components/ErrorBanner'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  const [error, setError] = useState<string | null>(null)
  
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
      
      if (filterStatus && filterStatus !== 'ALL') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      setError(err.message || 'Something went wrong')
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

  const getStatusVariant = (status: string) => {
    return status === 'OPEN' ? 'destructive' : 'secondary'
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
      {banner && (
        <div className="mb-4 bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3 transition-colors">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-primary">{banner.message}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-sm text-muted-foreground mt-1">Track repairs and service logs</p>
        </div>
      {role === 'fleet_manager' && (
          <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" />
              Open Record
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Open Maintenance Record
                </DialogTitle>
              </DialogHeader>
              
              {submitError && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="open-maintenance-form" onSubmit={handleSubmit(onOpenMaintenance)} className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_id">Select Vehicle</Label>
                  <select 
                    id="vehicle_id" 
                    {...register('vehicle_id')} 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a vehicle (excludes retired)</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.registration_number} - {v.name_model}</option>
                    ))}
                  </select>
                  {errors.vehicle_id && <p className="text-sm text-destructive">{errors.vehicle_id.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Issue Description</Label>
                  <textarea 
                    id="description"
                    {...register('description')} 
                    rows={3} 
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                    placeholder="Describe the maintenance issue or work required..." 
                  />
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>

                <div className="pt-2">
                  <ImageUpload 
                    folder="transitops/maintenance" 
                    label="Attach Quotation / Preliminary Receipt (Optional)" 
                    onUploaded={(data) => setUploadData(data.url ? data : null)}
                  />
                </div>
              </form>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowOpenModal(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" form="open-maintenance-form" disabled={isSubmitting}>
                  {isSubmitting ? 'Opening...' : 'Submit to Shop'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <ErrorBanner message={error} />
      <Card className="mb-6">
        <CardContent className="p-4 flex gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Records" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Records</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHeader('Vehicle', 'vehicle_id')}
              {renderSortableHeader('Description', 'description')}
              {renderSortableHeader('Cost', 'cost')}
              {renderSortableHeader('Status', 'status')}
              {renderSortableHeader('Opened At', 'opened_at')}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading records...</TableCell>
              </TableRow>
            ) : sortedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No maintenance records found.</TableCell>
              </TableRow>
            ) : (
              sortedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {log.vehicles?.registration_number}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm line-clamp-2 max-w-xs">{log.description}</div>
                    {log.receipt_url && (
                      <a href={log.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 block">
                        View Receipt
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    ${log.cost.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(log.status) as any}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>Opened: {new Date(log.opened_at).toLocaleDateString()}</div>
                    {log.closed_at && <div>Closed: {new Date(log.closed_at).toLocaleDateString()}</div>}
                  </TableCell>
                  <TableCell className="text-right">
                    {log.status === 'OPEN' && role === 'fleet_manager' && (
                      <Button size="sm" onClick={() => setShowCloseModal(log.id)} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="w-3 h-3" /> Close
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!showCloseModal} onOpenChange={(open) => !open && setShowCloseModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Close Maintenance</DialogTitle>
          </DialogHeader>
          <form id="close-maintenance-form" onSubmit={handleCloseMaintenance} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="close_cost">Final Cost ($)</Label>
              <Input 
                id="close_cost"
                type="number" 
                step="0.01"
                required 
                value={closeCost} 
                onChange={e => setCloseCost(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 250.00"
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseModal(null)} type="button">
              Cancel
            </Button>
            <Button type="submit" form="close-maintenance-form" className="bg-green-600 hover:bg-green-700 text-white">
              Confirm Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
