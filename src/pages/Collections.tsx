import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '../lib/api';
import type { Collection, Product } from '../lib/types';
import { IMAGE_UPLOAD_ACCEPT, WEBP_UPLOAD_HINT } from '../lib/upload';
import { toast } from 'sonner';

type CollectionForm = {
  name: string;
  description: string;
  image: string;
  is_featured: boolean;
  sort_order: number;
  products: number[];
};

const emptyForm: CollectionForm = {
  name: '',
  description: '',
  image: '',
  is_featured: false,
  sort_order: 0,
  products: [],
};




const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<CollectionForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadCollections = async () => {
    try {
      const data = await apiGet<Collection[]>('/collections/');
      setCollections(data);
    } catch {
      setCollections([]);
      toast.error('Failed to load collections');
    }
  };

  useEffect(() => {
    loadCollections();
    const loadProducts = async () => {
      try {
        const data = await apiGet<Product[]>('/products/');
        setProducts(data);
      } catch {
        setProducts([]);
      }
    };
    loadProducts();
  }, []);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setForm((prev) => ({ ...prev, image: res.url }));
    } catch {
      toast.error('Image upload failed – please try again');
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
    if (!form.name.trim()) {
      toast.error('Collection name is required');
      return;
    }
    if (isUploading) {
      toast.error('Please wait for the image upload to finish');
      return;
    }
    if (!form.image.trim()) {
      toast.error('Collection image is required');
      return;
    }
    setIsSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      is_featured: form.is_featured,
      sort_order: Number.isFinite(form.sort_order) ? form.sort_order : 0,
      products: form.products,
    };
    try {
      if (editingId) {
        await apiPut(`/collections/${editingId}/`, payload);
        toast.success('Collection updated');
      } else {
        await apiPost('/collections/', payload);
        toast.success('Collection created');
      }
      resetForm();
      await loadCollections();
    } catch (error) {
      toast.error('Failed to save collection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setForm({
      name: collection.name || '',
      description: collection.description || '',
      image: collection.image || '',
      is_featured: Boolean(collection.is_featured),
      sort_order: collection.sort_order ?? 0,
      products: collection.products || [],
    });
  };

  const handleFeaturedToggle = async (collection: Collection, checked: boolean) => {
    try {
      await apiPut(`/collections/${collection.id}/`, {
        name: collection.name,
        description: collection.description || '',
        image: collection.image || '',
        is_featured: checked,
        sort_order: collection.sort_order ?? 0,
        products: collection.products || [],
      });
      toast.success(
        checked ? 'Collection added to top display' : 'Collection removed from top display'
      );
      await loadCollections();
    } catch {
      toast.error('Failed to update display selection');
    }
  };

  const featuredCount = collections.filter((collection) => collection.is_featured).length;

  const toggleProduct = (productId: number) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.includes(productId)
        ? prev.products.filter((id) => id !== productId)
        : [...prev.products, productId],
    }));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this collection?')) return;
    try {
      await apiDelete(`/collections/${id}/`);
      toast.success('Collection deleted');
      await loadCollections();
    } catch {
      toast.error('Failed to delete collection');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Collections</h2>
        <p className="text-muted-foreground">Create and manage homepage collections.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit Collection' : 'New Collection'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Signature Beds"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short collection description..."
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Collection Image *</label>
            <Input
              type="file"
              accept={IMAGE_UPLOAD_ACCEPT}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUpload(file);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">{WEBP_UPLOAD_HINT}</p>
            {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
            {form.image && (
              <img
                src={form.image}
                alt="Collection preview"
                className="h-28 w-40 rounded-md border object-cover"
              />
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Sort Order</label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))
              }
            />
          </div>

          <label className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))}
            />
            <span>
              Show this collection in the top display section
            </span>
          </label>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Products in Collection</label>
            <div className="max-h-48 overflow-y-auto rounded-md border bg-white p-3">
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.products.includes(product.id)}
                    onChange={() => toggleProduct(product.id)}
                  />
                  <span>{product.name}</span>
                </label>
              ))}
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground">No products available.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || isUploading}>
              {editingId ? 'Update Collection' : 'Create Collection'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Selected for top display: {featuredCount}. The storefront shows the first 4 selected collections by sort order, and users can then view all collections.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Top Display</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell>
                    {collection.image ? (
                      <img
                        src={collection.image}
                        alt={collection.name}
                        className="h-12 w-16 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{collection.name}</TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {collection.description}
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(collection.is_featured)}
                        onChange={(e) => handleFeaturedToggle(collection, e.target.checked)}
                      />
                      <span>{collection.is_featured ? 'Shown' : 'Hidden'}</span>
                    </label>
                  </TableCell>
                  <TableCell>{collection.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(collection)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(collection.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {collections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No collections yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Collections;
