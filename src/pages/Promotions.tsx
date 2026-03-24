import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import type { Category, Promotion, SubCategory } from '../lib/types';
import { toast } from 'sonner';

const todayString = () => new Date().toISOString().slice(0, 10);

const emptyPromotion = (): Promotion => ({
  name: '',
  code: '',
  announcement_text: '',
  discount_percentage: 0,
  start_date: todayString(),
  end_date: todayString(),
  categories: [],
  subcategories: [],
  is_active: true,
  sort_order: 0,
});

const Promotions = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [form, setForm] = useState<Promotion>(emptyPromotion());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [promotionData, categoryData, subcategoryData] = await Promise.all([
        apiGet<Promotion[]>('/promotions/'),
        apiGet<Category[]>('/categories/'),
        apiGet<SubCategory[]>('/subcategories/'),
      ]);
      setPromotions(Array.isArray(promotionData) ? promotionData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setSubcategories(Array.isArray(subcategoryData) ? subcategoryData : []);
    } catch {
      toast.error('Failed to load promotions');
      setPromotions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const sortedPromotions = useMemo(
    () =>
      [...promotions].sort(
        (a, b) =>
          (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
          (a.start_date || '').localeCompare(b.start_date || '') ||
          (a.name || '').localeCompare(b.name || '')
      ),
    [promotions]
  );

  const resetForm = () => {
    setForm(emptyPromotion());
    setEditingId(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!form.name.trim()) {
      toast.error('Promotion name is required');
      return;
    }
    if (!form.code.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error('Start and end dates are required');
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      announcement_text: (form.announcement_text || '').trim(),
      discount_percentage: Number(form.discount_percentage) || 0,
      start_date: form.start_date,
      end_date: form.end_date,
      categories: form.categories || [],
      subcategories: form.subcategories || [],
      is_active: form.is_active !== false,
      sort_order: Number(form.sort_order) || 0,
    };

    try {
      if (editingId) {
        await apiPut(`/promotions/${editingId}/`, payload);
        toast.success('Promotion updated');
      } else {
        await apiPost('/promotions/', payload);
        toast.success('Promotion created');
      }
      resetForm();
      await loadData();
    } catch {
      toast.error('Failed to save promotion');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingId(promotion.id ?? null);
    setForm({
      id: promotion.id,
      name: promotion.name || '',
      code: promotion.code || '',
      announcement_text: promotion.announcement_text || '',
      discount_percentage: Number(promotion.discount_percentage) || 0,
      start_date: promotion.start_date || todayString(),
      end_date: promotion.end_date || todayString(),
      categories: promotion.categories || [],
      subcategories: promotion.subcategories || [],
      is_active: promotion.is_active !== false,
      sort_order: Number(promotion.sort_order) || 0,
    });
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm('Delete this promotion?')) return;
    try {
      await apiDelete(`/promotions/${id}/`);
      toast.success('Promotion deleted');
      if (editingId === id) resetForm();
      await loadData();
    } catch {
      toast.error('Failed to delete promotion');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Schedule promo codes, set the navbar announcement text, and choose which categories or subcategories can use each discount.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetForm}>
            Clear form
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {editingId ? 'Update Promotion' : 'Create Promotion'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing promotions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading promotions...</p>
          ) : sortedPromotions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No promotions saved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Targets</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPromotions.map((promotion) => (
                  <TableRow key={promotion.id ?? promotion.code}>
                    <TableCell>
                      <div className="font-medium">{promotion.name}</div>
                      <div className="text-xs text-muted-foreground">{promotion.announcement_text || 'No navbar text'}</div>
                    </TableCell>
                    <TableCell>{promotion.code}</TableCell>
                    <TableCell>{Number(promotion.discount_percentage || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {promotion.start_date} to {promotion.end_date}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          promotion.is_currently_live
                            ? 'bg-green-100 text-green-700'
                            : promotion.is_active
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {promotion.is_currently_live ? 'Live' : promotion.is_active ? 'Scheduled' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[...(promotion.category_names || []), ...(promotion.subcategory_names || [])].join(', ') || 'All products'}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(promotion)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(promotion.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit promotion' : 'New promotion'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Campaign name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Christmas Sale"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Promo code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="XMAS20"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Discount %</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.discount_percentage}
                onChange={(e) => setForm((prev) => ({ ...prev, discount_percentage: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Start date</label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">End date</label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Navbar announcement text</label>
              <Input
                value={form.announcement_text || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, announcement_text: e.target.value }))}
                placeholder="Christmas promo live now. Use XMAS20 for 20% off selected beds."
              />
              <p className="text-xs text-muted-foreground">
                This replaces the current top-bar text on the website while the promotion is live.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-espresso">Sort order</label>
                <Input
                  type="number"
                  value={form.sort_order || 0}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-espresso">
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Promotion active
              </label>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-espresso">Applicable categories and subcategories</p>
                <p className="text-xs text-muted-foreground">
                  Leave everything unchecked if this promo should work for all products.
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setForm((prev) => ({ ...prev, categories: [], subcategories: [] }))}
              >
                Clear all
              </button>
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {categories.map((category) => {
                const categoryChecked = (form.categories || []).includes(category.id);
                const categorySubcategories = subcategories.filter((sub) => sub.category === category.id);
                return (
                  <div key={category.id} className="rounded-md border border-border/60 bg-ivory/60 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-espresso">
                      <input
                        type="checkbox"
                        checked={categoryChecked}
                        onChange={(e) => {
                          const next = new Set(form.categories || []);
                          if (e.target.checked) next.add(category.id);
                          else next.delete(category.id);
                          setForm((prev) => ({ ...prev, categories: Array.from(next) }));
                        }}
                      />
                      {category.name}
                    </label>
                    {categorySubcategories.length > 0 && (
                      <div className="mt-2 grid gap-1 pl-6">
                        {categorySubcategories.map((subcategory) => {
                          const subChecked = (form.subcategories || []).includes(subcategory.id);
                          return (
                            <label key={subcategory.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={subChecked}
                                onChange={(e) => {
                                  const next = new Set(form.subcategories || []);
                                  if (e.target.checked) next.add(subcategory.id);
                                  else next.delete(subcategory.id);
                                  setForm((prev) => ({ ...prev, subcategories: Array.from(next) }));
                                }}
                              />
                              {subcategory.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Promotions;
