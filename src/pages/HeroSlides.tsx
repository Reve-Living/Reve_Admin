import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '../lib/api';
import type { Category, SubCategory, HeroSlide } from '../lib/types';
import { toast } from 'sonner';

type HeroSlideForm = {
  title: string;
  subtitle: string;
  category: number | null;
  subcategory: number | null;
  cta_text: string;
  cta_link: string;
  image: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm: HeroSlideForm = {
  title: '',
  subtitle: '',
  category: null,
  subcategory: null,
  cta_text: 'Shop Now',
  cta_link: '',
  image: '',
  is_active: true,
  sort_order: 0,
};

const normalizeSlidesResponse = (payload: unknown): HeroSlide[] => {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { results?: HeroSlide[] }).results)
  ) {
    return (payload as { results: HeroSlide[] }).results;
  }
  return [];
};

const HeroSlides = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [form, setForm] = useState<HeroSlideForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sortedSlides = useMemo(
    () =>
      [...slides].sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (b.updated_at || '').localeCompare(a.updated_at || '')
      ),
    [slides]
  );

  const loadSlides = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<HeroSlide[] | { results?: HeroSlide[] }>('/hero-slides/');
      setSlides(normalizeSlidesResponse(data));
    } catch {
      setSlides([]);
      toast.error('Failed to load hero slides');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSlides();
    const loadCategories = async () => {
      try {
        const data = await apiGet<Category[]>('/categories/');
        setCategories(data);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const loadSubs = async () => {
      if (!form.category) {
        setSubcategories([]);
        setForm((prev) => ({ ...prev, subcategory: null }));
        return;
      }
      try {
        const data = await apiGet<SubCategory[]>(`/subcategories/?category=${form.category}`);
        setSubcategories(data);
        if (form.subcategory && !data.find((s) => s.id === form.subcategory)) {
          setForm((prev) => ({ ...prev, subcategory: null }));
        }
      } catch {
        setSubcategories([]);
        setForm((prev) => ({ ...prev, subcategory: null }));
      }
    };
    loadSubs();
  }, [form.category, form.subcategory]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setForm((prev) => ({ ...prev, image: res.url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Image upload failed - please try again');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.image.trim()) {
      toast.error('Hero image is required');
      return;
    }
    if (isUploading) {
      toast.error('Please wait for the image upload to finish');
      return;
    }

    setIsSaving(true);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      category: form.category,
      subcategory: form.subcategory,
      cta_text: form.cta_text.trim() || 'Shop Now',
      cta_link: form.cta_link.trim(),
      image: form.image.trim(),
      is_active: form.is_active,
      sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
    };

    try {
      if (editingId) {
        await apiPut(`/hero-slides/${editingId}/`, payload);
        toast.success('Hero slide updated');
      } else {
        await apiPost('/hero-slides/', payload);
        toast.success('Hero slide created');
      }
      resetForm();
      await loadSlides();
    } catch {
      toast.error('Failed to save hero slide');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (slide: HeroSlide) => {
    setEditingId(slide.id ?? null);
    setForm({
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      category: slide.category ?? null,
      subcategory: slide.subcategory ?? null,
      cta_text: slide.cta_text || 'Shop Now',
      cta_link: slide.cta_link || '',
      image: slide.image || '',
      is_active: slide.is_active !== false,
      sort_order: slide.sort_order ?? 0,
    });
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await apiDelete(`/hero-slides/${id}/`);
      toast.success('Hero slide removed');
      if (editingId === id) {
        resetForm();
      }
      await loadSlides();
    } catch {
      toast.error('Failed to delete hero slide');
    }
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    if (!slide.id) return;
    try {
      await apiPatch(`/hero-slides/${slide.id}/`, { is_active: !slide.is_active });
      toast.success(slide.is_active ? 'Slide deactivated' : 'Slide activated');
      await loadSlides();
    } catch {
      toast.error('Unable to change status right now');
    }
  };

  const onFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Hero Slider</h1>
          <p className="text-sm text-muted-foreground">Control the homepage hero slides per category.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetForm}>
            Clear form
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {editingId ? 'Update Slide' : 'Create Slide'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing slides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading slides...</p>
          ) : sortedSlides.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hero slides yet. Create your first one below.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>CTA</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSlides.map((slide) => (
                  <TableRow key={slide.id ?? slide.title}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {slide.image && <img src={slide.image} alt="" className="h-12 w-16 rounded object-cover" />}
                        <div>
                          <div>{slide.title}</div>
                          {slide.subtitle && <div className="text-xs text-muted-foreground">{slide.subtitle}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{slide.cta_text || 'Shop Now'}</div>
                      <div className="text-xs text-muted-foreground">{slide.cta_link}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{slide.category_name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{slide.subcategory_name || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          slide.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {slide.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {slide.updated_at ? new Date(slide.updated_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(slide)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(slide)}>
                        {slide.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(slide.id)}>
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
          <CardTitle>{editingId ? 'Edit hero slide' : 'New hero slide'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Beds that feel like home"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Subtitle</label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Curated comfort for every room"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Category</label>
              <select
                value={form.category ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value ? Number(e.target.value) : null }))
                }
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No category (manual link)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                If left blank, the CTA link defaults to the selected category slug.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Subcategory</label>
              <select
                value={form.subcategory ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subcategory: e.target.value ? Number(e.target.value) : null }))
                }
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={!form.category || subcategories.length === 0}
              >
                <option value="">No subcategory</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Optional. CTA will use subcategory slug when set.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">CTA label</label>
              <Input
                value={form.cta_text}
                onChange={(e) => setForm((prev) => ({ ...prev, cta_text: e.target.value }))}
                placeholder="Shop Beds"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">CTA link</label>
              <Input
                value={form.cta_link}
                onChange={(e) => setForm((prev) => ({ ...prev, cta_link: e.target.value }))}
                placeholder="/category/beds"
              />
              <p className="text-xs text-muted-foreground">
                You can paste a full URL or a relative link. Leave empty to auto-use the category link.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium text-espresso">Sort order</label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-espresso">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Active on site
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Hero image</label>
              <Input
                value={form.image}
                onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="https://..."
              />
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileInputChange}
                  disabled={isUploading}
                  className="text-sm"
                />
                {isUploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
              </div>
            </div>
            {form.image && (
              <div className="overflow-hidden rounded-lg border border-dashed">
                <img src={form.image} alt="Preview" className="h-40 w-full object-cover" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HeroSlides;
