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

type ProductPickerProps = {
  label: string; placeholder: string; products: Product[]; value: number; excludedId?: number;
  onChange: (value: number) => void;
};

function ProductPicker({ label, placeholder, products, value, excludedId, onChange }: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');

  const categories = useMemo(() => Array.from(new Map(products.map(product => [String(product.category), product.category_name || 'Uncategorised'])).entries())
    .sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const subcategories = useMemo(() => Array.from(new Map(products
    .filter(product => !category || String(product.category) === category)
    .filter(product => product.subcategory != null)
    .map(product => [String(product.subcategory), product.subcategory_name || 'Uncategorised'])).entries())
    .sort((a, b) => a[1].localeCompare(b[1])), [products, category]);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter(product => product.id !== excludedId)
      .filter(product => !category || String(product.category) === category)
      .filter(product => !subcategory || String(product.subcategory) === subcategory)
      .filter(product => !normalizedQuery || `${product.name} ${product.category_name || ''} ${product.subcategory_name || ''}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, excludedId, category, subcategory, query]);
  const selectedProduct = products.find(product => product.id === value);

  return <div className="space-y-2">
    <label className="text-sm font-medium">{label}</label>
    <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} />
    <div className="grid grid-cols-2 gap-2">
      <select className="w-full rounded-md border bg-white px-3 py-2 text-sm" value={category} onChange={event => { setCategory(event.target.value); setSubcategory(''); }}>
        <option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <select className="w-full rounded-md border bg-white px-3 py-2 text-sm" value={subcategory} onChange={event => setSubcategory(event.target.value)}>
        <option value="">All subcategories</option>{subcategories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </div>
    <select className="w-full rounded-md border bg-white px-3 py-2" value={value} onChange={event => onChange(Number(event.target.value))}>
      <option value={0}>{placeholder}</option>
      {selectedProduct && !filteredProducts.some(product => product.id === selectedProduct.id) && <option value={selectedProduct.id}>{selectedProduct.name}</option>}
      {filteredProducts.map(product => <option key={product.id} value={product.id}>{product.name} — {product.category_name || 'Uncategorised'}{product.subcategory_name ? ` / ${product.subcategory_name}` : ''}</option>)}
    </select>
    <p className="text-xs text-muted-foreground">{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} found</p>
  </div>;
}

type AddonDraft = { addon_price: number | string; sort_order: number; is_active: boolean };

function MultiAddonPicker({ products, excludedId, selected, onChange }: { products: Product[]; excludedId?: number; selected: Record<number, AddonDraft>; onChange: (value: Record<number, AddonDraft>) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const categories = useMemo(() => Array.from(new Map(products.map(p => [String(p.category), p.category_name || 'Uncategorised'])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const subcategories = useMemo(() => Array.from(new Map(products.filter(p => !category || String(p.category) === category).filter(p => p.subcategory != null).map(p => [String(p.subcategory), p.subcategory_name || 'Uncategorised'])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [products, category]);
  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => p.id !== excludedId).filter(p => !category || String(p.category) === category).filter(p => !subcategory || String(p.subcategory) === subcategory).filter(p => !q || `${p.name} ${p.category_name || ''} ${p.subcategory_name || ''}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, excludedId, category, subcategory, query]);
  const update = (id: number, values: Partial<AddonDraft>) => onChange({ ...selected, [id]: { ...selected[id], ...values } });

  return <div className="space-y-3 md:col-span-2">
    <label className="text-sm font-medium">Add-on products</label>
    <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search add-on products..." />
    <div className="grid grid-cols-2 gap-2">
      <select className="rounded-md border bg-white px-3 py-2 text-sm" value={category} onChange={e => { setCategory(e.target.value); setSubcategory(''); }}><option value="">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select className="rounded-md border bg-white px-3 py-2 text-sm" value={subcategory} onChange={e => setSubcategory(e.target.value)}><option value="">All subcategories</option>{subcategories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
    </div>
    <div className="max-h-[440px] space-y-2 overflow-y-auto rounded-md border p-2">
      {visibleProducts.map(product => {
        const checked = Boolean(selected[product.id]);
        return <div key={product.id} className={`rounded-md border p-3 ${checked ? 'border-primary bg-primary/5' : 'bg-white'}`}>
          <label className="flex cursor-pointer items-start gap-3"><input className="mt-1 h-4 w-4" type="checkbox" checked={checked} onChange={e => {
            if (e.target.checked) onChange({ ...selected, [product.id]: { addon_price: product.price, sort_order: Object.keys(selected).length, is_active: true } });
            else { const next = { ...selected }; delete next[product.id]; onChange(next); }
          }}/><span className="flex-1"><span className="block font-medium">{product.name}</span><span className="text-xs text-muted-foreground">{product.category_name || 'Uncategorised'}{product.subcategory_name ? ` / ${product.subcategory_name}` : ''} · Normal price £{Number(product.price || 0).toFixed(2)}</span></span></label>
          {checked && <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium">Discounted price (£)<Input type="number" min="0" step="0.01" value={selected[product.id].addon_price} onChange={e => update(product.id, { addon_price: e.target.value })}/></label>
            <label className="space-y-1 text-xs font-medium">Display order<Input type="number" value={selected[product.id].sort_order} onChange={e => update(product.id, { sort_order: Number(e.target.value) || 0 })}/></label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium"><input type="checkbox" checked={selected[product.id].is_active} onChange={e => update(product.id, { is_active: e.target.checked })}/> Show on product page</label>
          </div>}
        </div>;
      })}
      {!visibleProducts.length && <p className="p-3 text-sm text-muted-foreground">No products match these filters.</p>}
    </div>
    <p className="text-xs text-muted-foreground">{Object.keys(selected).length} selected · {visibleProducts.length} products shown</p>
  </div>;
}

export default function ProductAddons() {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductAddon>(emptyAddon());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [addonDrafts, setAddonDrafts] = useState<Record<number, AddonDraft>>({});

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

  const reset = () => { setForm(emptyAddon()); setEditingId(null); setAddonDrafts({}); };
  const save = async () => {
    if (!form.main_product) return toast.error('Choose a main product');
    if (!editingId && !Object.keys(addonDrafts).length) return toast.error('Select at least one add-on product');
    if (editingId && !form.addon_product) return toast.error('Choose an add-on product');
    if (!editingId && Object.values(addonDrafts).some(draft => Number(draft.addon_price) < 0 || !Number.isFinite(Number(draft.addon_price)))) return toast.error('Enter a valid discounted price for every selected product');
    if (form.main_product === form.addon_product) return toast.error('A product cannot be its own add-on');
    if (Number(form.addon_price) < 0) return toast.error('Add-on price cannot be negative');
    setSaving(true);
    const payload = { ...form, addon_price: Number(form.addon_price), sort_order: Number(form.sort_order) || 0 };
    try {
      if (editingId) await apiPut(`/product-addons/${editingId}/`, payload);
      else await Promise.all(Object.entries(addonDrafts).map(([productId, draft]) => {
        const values = { main_product: form.main_product, addon_product: Number(productId), addon_price: Number(draft.addon_price), sort_order: Number(draft.sort_order) || 0, is_active: draft.is_active };
        const existing = addons.find(item => item.main_product === form.main_product && item.addon_product === Number(productId));
        return existing?.id ? apiPut(`/product-addons/${existing.id}/`, values) : apiPost('/product-addons/', values);
      }));
      toast.success(editingId ? 'Product add-on updated' : `${Object.keys(addonDrafts).length} product add-ons created`);
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
          <ProductPicker label="Main product" placeholder="Choose main product" products={products} value={form.main_product} excludedId={form.addon_product || undefined} onChange={main_product => setForm({...form, main_product})} />
          {editingId ? <ProductPicker label="Add-on product" placeholder="Choose related product" products={products} value={form.addon_product} excludedId={form.main_product || undefined} onChange={addon_product => setForm({...form, addon_product})} /> : <MultiAddonPicker products={products} excludedId={form.main_product || undefined} selected={addonDrafts} onChange={setAddonDrafts} />}
          {editingId && <>
            <label className="space-y-2 text-sm font-medium">Discounted add-on price (£)<Input type="number" min="0" step="0.01" value={form.addon_price} onChange={e => setForm({...form, addon_price: e.target.value})}/></label>
            <label className="space-y-2 text-sm font-medium">Display order<Input type="number" value={form.sort_order} onChange={e => setForm({...form, sort_order: Number(e.target.value)})}/></label>
          </>}
        </div>
        {editingId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})}/> Active on product page</label>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={reset}>Clear</Button><Button onClick={save} disabled={saving}>{editingId ? 'Update Add-on' : 'Create Selected Add-ons'}</Button></div>
      </CardContent></Card>
    <Card><CardHeader><CardTitle>Configured add-ons</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input placeholder="Search product add-ons" value={search} onChange={e => setSearch(e.target.value)}/>
      <Table><TableHeader><TableRow><TableHead>Main product</TableHead><TableHead>Add-on product</TableHead><TableHead>Normal price</TableHead><TableHead>Add-on price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{visible.map(item => <TableRow key={item.id}><TableCell>{item.main_product_name}</TableCell><TableCell>{item.addon_product_name}</TableCell><TableCell>£{Number(item.regular_price || 0).toFixed(2)}</TableCell><TableCell>£{Number(item.addon_price).toFixed(2)}</TableCell><TableCell>{item.is_active ? 'Active' : 'Inactive'}</TableCell><TableCell className="space-x-2 text-right"><Button variant="ghost" size="sm" onClick={() => {setEditingId(item.id || null); setForm(item);}}>Edit</Button><Button variant="ghost" size="sm" onClick={() => remove(item.id)}>Delete link</Button></TableCell></TableRow>)}</TableBody></Table>
    </CardContent></Card>
  </div>;
}
