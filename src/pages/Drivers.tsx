import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
  
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false)
  
  const [showModal, setShowModal] = useState(false)
  const [uploadData, setUploadData] = useState<{url: string, publicId: string} | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { items: sortedDrivers, requestSort, sortConfig } = useSortableData(drivers)

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
        if (error.code === '23505') throw new Error('A driver with this license number already exists.')
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

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'default'
      case 'ON_TRIP': return 'secondary'
      case 'OFF_DUTY': return 'outline'
      case 'SUSPENDED': return 'destructive'
      default: return 'outline'
    }
  }

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date(new Date().setHours(0,0,0,0))
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
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage fleet personnel and licenses</p>
        </div>
        {role === 'safety_officer' && (
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" />
              Add Driver
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Driver</DialogTitle>
              </DialogHeader>
              
              {submitError && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="driver-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" {...register('name')} placeholder="e.g. John Smith" />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_number">Contact Number</Label>
                    <Input id="contact_number" {...register('contact_number')} placeholder="e.g. +1 555-0123" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_number">License Number</Label>
                    <Input id="license_number" {...register('license_number')} placeholder="e.g. DL-98765432" />
                    {errors.license_number && <p className="text-sm text-destructive">{errors.license_number.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_category">License Category</Label>
                    <Input id="license_category" {...register('license_category')} placeholder="e.g. CDL-A" />
                    {errors.license_category && <p className="text-sm text-destructive">{errors.license_category.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_expiry">License Expiry Date</Label>
                    <Input id="license_expiry" type="date" {...register('license_expiry')} />
                    {errors.license_expiry && <p className="text-sm text-destructive">{errors.license_expiry.message}</p>}
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
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowModal(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" form="driver-form" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Driver'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={filterExpiringSoon}
              onChange={(e) => setFilterExpiringSoon(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-input focus:ring-primary"
            />
            <span className="text-sm font-medium">Expiring Soon (Next 30 Days)</span>
          </label>
        </CardContent>
      </Card>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {renderSortableHeader('Driver Details', 'name')}
              {renderSortableHeader('License Info', 'license_number')}
              {renderSortableHeader('Expiry', 'license_expiry')}
              {renderSortableHeader('Safety Score', 'safety_score')}
              {renderSortableHeader('Status', 'status')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading drivers...</TableCell>
              </TableRow>
            ) : sortedDrivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No drivers found.</TableCell>
              </TableRow>
            ) : (
              sortedDrivers.map((d) => {
                const expired = isExpired(d.license_expiry)
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-sm text-muted-foreground">{d.contact_number || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div>{d.license_number}</div>
                      <div className="text-sm text-muted-foreground">Category: {d.license_category}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${expired ? 'text-destructive font-semibold' : ''}`}>
                          {d.license_expiry}
                        </span>
                        {expired && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      </div>
                      {expired && <span className="text-xs text-destructive">Expired</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${d.safety_score < 70 ? 'text-destructive' : d.safety_score < 90 ? 'text-orange-500' : 'text-green-500'}`}>
                        {d.safety_score}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(d.status) as any}>
                        {d.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
