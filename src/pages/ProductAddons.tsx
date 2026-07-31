import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import type { Product } from '../lib/types';

type ProductAddon = {
  id?: number; main_product: number; main_product_name?: string; addon_product: number;
  addon_product_name?: string; regular_price?: number | string; addon_price: number | string;
  is_active: boolean; sort_order: number;
};

const emptyAddon = (): ProductAddon => ({ main_product: 0, addon_product: 0, addon_price: 0, is_active: true, sort_order: 0 });

export default function ProductAddons() {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductAddon>(emptyAddon());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [links, productList] = await Promise.all([
        apiGet<ProductAddon[]>('/product-addons/', { noStore: true }),
        apiGet<Product[]>('/products/?admin_picker=1', { noStore: true }),
      ]);
      setAddons(Array.isArray(links) ? links : []);
      setProducts(Array.isArray(productList) ? productList : []);
    } catch { toast.error('Failed to load product add-ons'); }
  };
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...addons].sort((a, b) => a.sort_order - b.sort_order).filter((item) =>
      !query || `${item.main_product_name} ${item.addon_product_name}`.toLowerCase().includes(query));
  }, [addons, search]);

  const reset = () => { setForm(emptyAddon()); setEditingId(null); };
  const save = async () => {
    if (!form.main_product || !form.addon_product) return toast.error('Choose both products');
    if (form.main_product === form.addon_product) return toast.error('A product cannot be its own add-on');
    if (Number(form.addon_price) < 0) return toast.error('Add-on price cannot be negative');
    setSaving(true);
    const payload = { ...form, addon_price: Number(form.addon_price), sort_order: Number(form.sort_order) || 0 };
    try {
      if (editingId) await apiPut(`/product-addons/${editingId}/`, payload);
      else await apiPost('/product-addons/', payload);
      toast.success(editingId ? 'Product add-on updated' : 'Product add-on created');
      reset(); await load();
    } catch { toast.error('Could not save. Check that this product pairing is not already listed.'); }
    finally { setSaving(false); }
  };
  const remove = async (id?: number) => {
    if (!id || !window.confirm('Delete this add-on link? No products will be deleted.')) return;
    try { await apiDelete(`/product-addons/${id}/`); toast.success('Add-on link deleted'); await load(); }
    catch { toast.error('Failed to delete add-on link'); }
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-espresso">Product Add-ons</h1>
      <p className="text-sm text-muted-foreground">Offer existing products at a special price with another product. This never changes the standalone product or its normal price.</p></div>
    <Card><CardHeader><CardTitle>{editingId ? 'Edit add-on' : 'Create add-on'}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">Main product
            <select className="w-full rounded-md border bg-white px-3 py-2" value={form.main_product} onChange={e => setForm({...form, main_product: Number(e.target.value)})}>
              <option value={0}>Choose main product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="space-y-2 text-sm font-medium">Add-on product
            <select className="w-full rounded-md border bg-white px-3 py-2" value={form.addon_product} onChange={e => setForm({...form, addon_product: Number(e.target.value)})}>
              <option value={0}>Choose related product</option>{products.filter(p => p.id !== form.main_product).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="space-y-2 text-sm font-medium">Discounted add-on price (£)<Input type="number" min="0" step="0.01" value={form.addon_price} onChange={e => setForm({...form, addon_price: e.target.value})}/></label>
          <label className="space-y-2 text-sm font-medium">Display order<Input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: Number(e.target.value)})}/></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})}/> Active on product page</label>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={reset}>Clear</Button><Button onClick={save} disabled={saving}>{editingId ? 'Update Add-on' : 'Create Add-on'}</Button></div>
      </CardContent></Card>
    <Card><CardHeader><CardTitle>Configured add-ons</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input placeholder="Search product add-ons" value={search} onChange={e => setSearch(e.target.value)}/>
      <Table><TableHeader><TableRow><TableHead>Main product</TableHead><TableHead>Add-on product</TableHead><TableHead>Normal price</TableHead><TableHead>Add-on price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{visible.map(item => <TableRow key={item.id}><TableCell>{item.main_product_name}</TableCell><TableCell>{item.addon_product_name}</TableCell><TableCell>£{Number(item.regular_price || 0).toFixed(2)}</TableCell><TableCell>£{Number(item.addon_price).toFixed(2)}</TableCell><TableCell>{item.is_active ? 'Active' : 'Inactive'}</TableCell><TableCell className="space-x-2 text-right"><Button variant="ghost" size="sm" onClick={() => {setEditingId(item.id || null); setForm(item);}}>Edit</Button><Button variant="ghost" size="sm" onClick={() => remove(item.id)}>Delete link</Button></TableCell></TableRow>)}</TableBody></Table>
    </CardContent></Card>
  </div>;
}
