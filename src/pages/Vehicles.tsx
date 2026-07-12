import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { useSortableData } from '../hooks/useSortableData'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
      if (filterStatus && filterStatus !== 'ALL') query = query.eq('status', filterStatus)
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

  const getStatusVariant = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'default' // could make custom variants later
      case 'ON_TRIP': return 'secondary'
      case 'IN_SHOP': return 'destructive'
      case 'RETIRED': return 'outline'
      default: return 'default'
    }
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
          <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your fleet registry</p>
        </div>
        {role === 'fleet_manager' && (
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" />
              Add Vehicle
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
              </DialogHeader>
              
              {submitError && (
                <div className="bg-destructive/15 text-destructive p-3 rounded-md border border-destructive/20 text-sm">
                  {submitError}
                </div>
              )}
              
              <form id="vehicle-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="registration_number">Registration Number</Label>
                    <Input id="registration_number" {...register('registration_number')} placeholder="e.g. AB-1234" />
                    {errors.registration_number && <p className="text-sm text-destructive">{errors.registration_number.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name_model">Model Name</Label>
                    <Input id="name_model" {...register('name_model')} placeholder="e.g. Ford Transit" />
                    {errors.name_model && <p className="text-sm text-destructive">{errors.name_model.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Vehicle Type</Label>
                    <Input id="type" {...register('type')} placeholder="e.g. Cargo Van" />
                    {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input id="region" {...register('region')} placeholder="e.g. North Area" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_load_capacity">Max Load Capacity (kg)</Label>
                    <Input id="max_load_capacity" type="number" {...register('max_load_capacity', { valueAsNumber: true })} />
                    {errors.max_load_capacity && <p className="text-sm text-destructive">{errors.max_load_capacity.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acquisition_cost">Acquisition Cost ($)</Label>
                    <Input id="acquisition_cost" type="number" {...register('acquisition_cost', { valueAsNumber: true })} />
                    {errors.acquisition_cost && <p className="text-sm text-destructive">{errors.acquisition_cost.message}</p>}
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
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowModal(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" form="vehicle-form" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Vehicle'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || "")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ON_TRIP">On Trip</SelectItem>
                <SelectItem value="IN_SHOP">In Shop</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
            <Input 
              type="text" 
              placeholder="e.g. Van, Truck"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Region</Label>
            <Input 
              type="text" 
              placeholder="Filter Region"
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="w-40"
            />
          </div>
          {(filterStatus && filterStatus !== 'ALL' || filterType || filterRegion) && (
            <Button 
              variant="link"
              onClick={() => { setFilterStatus('ALL'); setFilterType(''); setFilterRegion(''); }}
              className="text-muted-foreground h-10"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              {renderSortableHeader('Registration / Model', 'registration_number')}
              {renderSortableHeader('Type / Region', 'type')}
              {renderSortableHeader('Odometer', 'odometer')}
              {renderSortableHeader('Status', 'status')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading vehicles...</TableCell>
              </TableRow>
            ) : sortedVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No vehicles found.</TableCell>
              </TableRow>
            ) : (
              sortedVehicles.map((v) => {
                const thumb = getThumbnailUrl(v.photo_public_id)
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      {thumb ? (
                        <img src={thumb} alt={v.name_model} className="h-16 w-20 object-cover rounded shadow-sm border" />
                      ) : (
                        <div className="h-16 w-20 bg-muted rounded border flex items-center justify-center text-muted-foreground text-xs">
                          No Photo
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{v.registration_number}</div>
                      <div className="text-sm text-muted-foreground">{v.name_model}</div>
                    </TableCell>
                    <TableCell>
                      <div>{v.type}</div>
                      <div className="text-sm text-muted-foreground">{v.region || '-'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.odometer.toLocaleString()} km
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(v.status) as any}>
                        {v.status.replace('_', ' ')}
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
