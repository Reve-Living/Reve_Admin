import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Copy, Edit, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { Product, Category, SubCategory } from '../lib/types';
import { toast } from 'sonner';

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(() => searchParams.get('category') || 'all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>(() => searchParams.get('subcategory') || 'all');
  const getDisplayOrder = (value?: number) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  useEffect(() => {
    const nextCategory = searchParams.get('category') || 'all';
    const nextSubcategory = searchParams.get('subcategory') || 'all';
    setSelectedCategory((current) => (current === nextCategory ? current : nextCategory));
    setSelectedSubcategory((current) => (current === nextSubcategory ? current : nextSubcategory));
  }, [searchParams]);

  const updateProductFilters = (category: string | 'all', subcategory: string | 'all') => {
    const nextParams = new URLSearchParams(searchParams);

    if (category === 'all') nextParams.delete('category');
    else nextParams.set('category', category);

    if (subcategory === 'all') nextParams.delete('subcategory');
    else nextParams.set('subcategory', subcategory);

    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setSearchParams(nextParams, { replace: true });
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

  const handleToggleHidden = async (product: Product) => {
    try {
      await apiPatch(`/products/${product.id}/`, { is_hidden: !product.is_hidden });
      toast.success(product.is_hidden ? 'Product is now visible on the storefront' : 'Product hidden from the storefront');
      await loadData();
    } catch {
      toast.error('Failed to update product visibility');
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const duplicated = await apiPost<Product>(`/products/${product.id}/duplicate/`, {});
      toast.success('Product duplicated. The copy is hidden until you finish editing it.');
      navigate(`/products/${duplicated.id}`);
    } catch {
      toast.error('Failed to duplicate product');
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

  const productFormSearch = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedSubcategory !== 'all') params.set('subcategory', selectedSubcategory);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [selectedCategory, selectedSubcategory]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-espresso">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog.</p>
        </div>
        <Link to={`/products/new${productFormSearch}`}>
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
            updateProductFilters(val === '' ? 'all' : val, 'all');
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
            updateProductFilters(selectedCategory, val === '' ? 'all' : val);
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
              updateProductFilters('all', 'all');
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
                <TableHead>Visibility</TableHead>
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
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        product.is_hidden ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {product.is_hidden ? 'Hidden' : 'Visible'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicate product"
                      onClick={() => handleDuplicate(product)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={product.is_hidden ? 'Unhide product' : 'Hide product'}
                      onClick={() => handleToggleHidden(product)}
                    >
                      {product.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Link to={`/products/edit/${product.id}${productFormSearch}`}>
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
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
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
