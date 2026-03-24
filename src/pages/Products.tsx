import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiDelete, apiGet } from '../lib/api';
import type { Product, Category, SubCategory } from '../lib/types';
import { toast } from 'sonner';

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>('all');
  const getDisplayOrder = (value?: number) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : Number.MAX_SAFE_INTEGER;
  };

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiGet<Product[] | { results?: Product[] }>('/products/'),
        apiGet<Category[] | { results?: Category[] }>('/categories/'),
      ]);

      const normalizeList = <T,>(data: T[] | { results?: T[] }): T[] => {
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as { results?: T[] }).results)) return (data as { results: T[] }).results;
        return [];
      };

      const normalizedProducts = normalizeList(productsData).sort((a, b) => {
        const aOrder = getDisplayOrder(a.sort_order);
        const bOrder = getDisplayOrder(b.sort_order);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.id || 0) - (a.id || 0);
      });
      setProducts(normalizedProducts);
      setCategories(normalizeList(categoriesData));
    } catch {
      toast.error('Failed to load products');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    try {
      await apiDelete(`/products/${id}/`);
      toast.success('Product deleted');
      await loadData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const selectedCategoryData = useMemo(
    () =>
      categories.find((c) => c.slug === selectedCategory || String(c.id) === selectedCategory) || null,
    [categories, selectedCategory]
  );

  const availableSubcategories = useMemo<SubCategory[]>(() => {
    if (selectedCategoryData) return selectedCategoryData.subcategories || [];

    return categories.flatMap((category) => category.subcategories || []);
  }, [categories, selectedCategoryData]);

  const filteredProducts = useMemo(() => {
    const targetCategory = selectedCategoryData;
    const targetSubcategory = availableSubcategories.find(
      (sub) => sub.slug === selectedSubcategory || String(sub.id) === selectedSubcategory
    );

    const targetCategorySlug = (targetCategory?.slug || '').toLowerCase();
    const targetCategoryId = targetCategory?.id;
    const targetCategoryName = (targetCategory?.name || '').toLowerCase();
    const targetSubcategorySlug = (targetSubcategory?.slug || '').toLowerCase();
    const targetSubcategoryId = targetSubcategory?.id;
    const targetSubcategoryName = (targetSubcategory?.name || '').toLowerCase();

    return products.filter((product) => {
      const productCategorySlug = (product.category_slug || '').toLowerCase();
      const productCategoryId = Number(product.category);
      const productCategoryName = (product.category_name || '').toLowerCase();
      const productSubcategorySlug = (product.subcategory_slug || '').toLowerCase();
      const productSubcategoryId = Number(product.subcategory);
      const productSubcategoryName = (product.subcategory_name || '').toLowerCase();

      const matchesCategory =
        selectedCategory === 'all' ||
        (targetCategorySlug ? productCategorySlug === targetCategorySlug : false) ||
        (targetCategoryId != null && Number.isFinite(productCategoryId)
          ? productCategoryId === targetCategoryId
          : false) ||
        (targetCategoryName ? productCategoryName === targetCategoryName : false);

      const matchesSubcategory =
        selectedSubcategory === 'all' ||
        (targetSubcategorySlug ? productSubcategorySlug === targetSubcategorySlug : false) ||
        (targetSubcategoryId != null && Number.isFinite(productSubcategoryId)
          ? productSubcategoryId === targetSubcategoryId
          : false) ||
        (targetSubcategoryName ? productSubcategoryName === targetSubcategoryName : false);

      return matchesCategory && matchesSubcategory;
    });
  }, [products, selectedCategoryData, availableSubcategories, selectedCategory, selectedSubcategory]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-espresso">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog.</p>
        </div>
        <Link to="/products/new">
          <Button className="bg-primary text-white hover:bg-primary/90">
            Add Product
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Filter by category</label>
        <select
          className="min-w-[220px] rounded-md border border-input bg-white px-3 py-2 text-sm"
          value={selectedCategory === 'all' ? '' : selectedCategory}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedCategory(val === '' ? 'all' : val);
            setSelectedSubcategory('all');
          }}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug || String(cat.id)}>
              {cat.name}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium text-muted-foreground">Filter by subcategory</label>
        <select
          className="min-w-[220px] rounded-md border border-input bg-white px-3 py-2 text-sm"
          value={selectedSubcategory === 'all' ? '' : selectedSubcategory}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedSubcategory(val === '' ? 'all' : val);
          }}
        >
          <option value="">All subcategories</option>
          {availableSubcategories.map((sub) => (
            <option key={sub.id} value={sub.slug || String(sub.id)}>
              {sub.name}
            </option>
          ))}
        </select>

        {(selectedCategory !== 'all' || selectedSubcategory !== 'all') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedSubcategory('all');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Display Order</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{Number.isFinite(Number(product.sort_order)) ? product.sort_order : 0}</TableCell>
                  <TableCell>{product.category_name || product.category_slug || product.category}</TableCell>
                  <TableCell>£{product.price}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        product.in_stock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.in_stock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link to={`/products/edit/${product.id}`}>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No products found for the selected filters.
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

export default Products;
