import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Copy, Edit, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { Product, ProductStockStatus, Category, SubCategory } from '../lib/types';
import { toast } from 'sonner';

const buildProductListQuery = (
  category: string | 'all',
  subcategory: string | 'all',
  search: string,
  focusProductId?: number | null
) => {
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (subcategory !== 'all') params.set('subcategory', subcategory);
  if (search.trim()) params.set('q', search);
  if (focusProductId) params.set('focus', String(focusProductId));
  const query = params.toString();
  return query ? `?${query}` : '';
};

const normalizeProductStockStatus = (product: Product): ProductStockStatus => {
  switch (product.stock_status) {
    case 'available':
    case 'low_stock':
    case 'out_of_stock':
    case 'stock_check_needed':
      return product.stock_status;
    default:
      return product.in_stock ? 'available' : 'out_of_stock';
  }
};

const getStockStatusMeta = (status: ProductStockStatus) => {
  switch (status) {
    case 'available':
      return { label: 'Available', className: 'bg-green-100 text-green-800' };
    case 'low_stock':
      return { label: 'Low Stock', className: 'bg-amber-100 text-amber-800' };
    case 'stock_check_needed':
      return { label: 'Stock Check Needed', className: 'bg-orange-100 text-orange-800' };
    case 'out_of_stock':
    default:
      return { label: 'Out of Stock', className: 'bg-red-100 text-red-800' };
  }
};

const Products = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(() => searchParams.get('category') || 'all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | 'all'>(() => searchParams.get('subcategory') || 'all');
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const productRowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const productSearch = searchParams.get('q') || '';
  const focusProductId = Number(searchParams.get('focus') || 0);
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

  const updateProductFilters = (
    category: string | 'all',
    subcategory: string | 'all',
    search: string = productSearch,
    focusId?: number | null
  ) => {
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    const query = buildProductListQuery(category, subcategory, search, focusId);
    setSearchParams(new URLSearchParams(query), { replace: true });
  };

  const loadData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiGet<Product[] | { results?: Product[] }>('/products/?summary=1'),
        apiGet<Category[] | { results?: Category[] }>('/categories/'),
      ]);

      const normalizeList = <T,>(data: T[] | { results?: T[] }): T[] => {
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as { results?: T[] }).results)) return (data as { results: T[] }).results;
        return [];
      };

      setProducts(normalizeList(productsData));
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
      navigate(
        `/products/edit/${duplicated.id}${buildProductListQuery(
          selectedCategory,
          selectedSubcategory,
          productSearch,
          duplicated.id
        )}`,
        {
          state: { autoRevealOnSave: true },
        }
      );
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

  const categoryOrderLookup = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          Number(category.id),
          {
            order: getDisplayOrder(category.sort_order),
            name: (category.name || '').toLowerCase(),
          },
        ])
      ),
    [categories]
  );

  const subcategoryOrderLookup = useMemo(() => {
    const map = new Map<
      number,
      {
        order: number;
        name: string;
      }
    >();

    categories.forEach((category) => {
      (category.subcategories || []).forEach((subcategory) => {
        map.set(Number(subcategory.id), {
          order: getDisplayOrder(subcategory.sort_order),
          name: (subcategory.name || '').toLowerCase(),
        });
      });
    });

    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const targetCategory = selectedCategoryData;
    const targetSubcategory = availableSubcategories.find(
      (sub) => sub.slug === selectedSubcategory || String(sub.id) === selectedSubcategory
    );
    const normalizedSearch = productSearch.trim().toLowerCase();

    const targetCategorySlug = (targetCategory?.slug || '').toLowerCase();
    const targetCategoryId = targetCategory?.id;
    const targetCategoryName = (targetCategory?.name || '').toLowerCase();
    const targetCategorySubcategoryIds = new Set((targetCategory?.subcategories || []).map((sub) => Number(sub.id)));
    const targetCategorySubcategorySlugs = new Set(
      (targetCategory?.subcategories || []).map((sub) => (sub.slug || '').toLowerCase()).filter(Boolean)
    );
    const targetCategorySubcategoryNames = new Set(
      (targetCategory?.subcategories || []).map((sub) => (sub.name || '').toLowerCase()).filter(Boolean)
    );
    const targetSubcategorySlug = (targetSubcategory?.slug || '').toLowerCase();
    const targetSubcategoryId = targetSubcategory?.id;
    const targetSubcategoryName = (targetSubcategory?.name || '').toLowerCase();

    return products
      .filter((product) => {
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
        (targetCategoryName ? productCategoryName === targetCategoryName : false) ||
        (targetCategorySubcategorySlugs.size > 0 ? targetCategorySubcategorySlugs.has(productSubcategorySlug) : false) ||
        (targetCategorySubcategoryIds.size > 0 && Number.isFinite(productSubcategoryId)
          ? targetCategorySubcategoryIds.has(productSubcategoryId)
          : false) ||
        (targetCategorySubcategoryNames.size > 0 ? targetCategorySubcategoryNames.has(productSubcategoryName) : false);

      const matchesSubcategory =
        selectedSubcategory === 'all' ||
        (targetSubcategorySlug ? productSubcategorySlug === targetSubcategorySlug : false) ||
        (targetSubcategoryId != null && Number.isFinite(productSubcategoryId)
          ? productSubcategoryId === targetSubcategoryId
          : false) ||
        (targetSubcategoryName ? productSubcategoryName === targetSubcategoryName : false);

      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          product.name,
          product.slug,
          product.category_name,
          product.category_slug,
          product.subcategory_name,
          product.subcategory_slug,
          String(product.id || ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

        return matchesCategory && matchesSubcategory && matchesSearch;
      })
      .sort((a, b) => {
        const aCategory = categoryOrderLookup.get(Number(a.category));
        const bCategory = categoryOrderLookup.get(Number(b.category));
        const aCategoryOrder = aCategory?.order ?? Number.MAX_SAFE_INTEGER;
        const bCategoryOrder = bCategory?.order ?? Number.MAX_SAFE_INTEGER;
        if (aCategoryOrder !== bCategoryOrder) return aCategoryOrder - bCategoryOrder;

        const aCategoryName = aCategory?.name || (a.category_name || '').toLowerCase();
        const bCategoryName = bCategory?.name || (b.category_name || '').toLowerCase();
        if (aCategoryName !== bCategoryName) return aCategoryName.localeCompare(bCategoryName);

        const aSubcategory = subcategoryOrderLookup.get(Number(a.subcategory));
        const bSubcategory = subcategoryOrderLookup.get(Number(b.subcategory));
        const aSubcategoryOrder = aSubcategory?.order ?? Number.MAX_SAFE_INTEGER;
        const bSubcategoryOrder = bSubcategory?.order ?? Number.MAX_SAFE_INTEGER;
        if (aSubcategoryOrder !== bSubcategoryOrder) return aSubcategoryOrder - bSubcategoryOrder;

        const aSubcategoryName = aSubcategory?.name || (a.subcategory_name || '').toLowerCase();
        const bSubcategoryName = bSubcategory?.name || (b.subcategory_name || '').toLowerCase();
        if (aSubcategoryName !== bSubcategoryName) return aSubcategoryName.localeCompare(bSubcategoryName);

        const aOrder = getDisplayOrder(a.sort_order);
        const bOrder = getDisplayOrder(b.sort_order);
        if (aOrder !== bOrder) return aOrder - bOrder;

        return (b.id || 0) - (a.id || 0);
      });
  }, [
    products,
    selectedCategoryData,
    availableSubcategories,
    selectedCategory,
    selectedSubcategory,
    productSearch,
    categoryOrderLookup,
    subcategoryOrderLookup,
  ]);

  const productFormSearch = useMemo(() => {
    return buildProductListQuery(selectedCategory, selectedSubcategory, productSearch);
  }, [selectedCategory, selectedSubcategory, productSearch]);

  useEffect(() => {
    if (!focusProductId) return;
    const row = productRowRefs.current.get(focusProductId);
    if (!row) return;

    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedProductId(focusProductId);

    const timeoutId = window.setTimeout(() => {
      setHighlightedProductId((current) => (current === focusProductId ? null : current));
    }, 2500);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('focus');
    setSearchParams(nextParams, { replace: true });

    return () => window.clearTimeout(timeoutId);
  }, [focusProductId, filteredProducts, searchParams, setSearchParams]);

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

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Search products</label>
          <Input
            value={productSearch}
            onChange={(e) => updateProductFilters(selectedCategory, selectedSubcategory, e.target.value)}
            placeholder="Search by name, initials, slug, category, subcategory, or ID"
          />
        </div>

        <div className="min-w-[220px]">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Filter by category</label>
          <select
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
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
        </div>

        <div className="min-w-[220px]">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Filter by subcategory</label>
          <select
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
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
        </div>

        {(selectedCategory !== 'all' || selectedSubcategory !== 'all' || productSearch.trim().length > 0) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateProductFilters('all', 'all', '');
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
                <TableHead>Stock Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const stockStatusMeta = getStockStatusMeta(normalizeProductStockStatus(product));
                return (
                <TableRow
                  key={product.id}
                  ref={(node) => {
                    if (node) productRowRefs.current.set(product.id, node);
                    else productRowRefs.current.delete(product.id);
                  }}
                  className={highlightedProductId === product.id ? 'bg-primary/10 transition-colors duration-300' : ''}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{Number.isFinite(Number(product.sort_order)) ? product.sort_order : 0}</TableCell>
                  <TableCell>{product.category_name || product.category_slug || product.category}</TableCell>
                  <TableCell>£{product.price}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${stockStatusMeta.className}`}>
                      {stockStatusMeta.label}
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
                    <Link
                      to={`/products/edit/${product.id}${buildProductListQuery(
                        selectedCategory,
                        selectedSubcategory,
                        productSearch,
                        product.id
                      )}`}
                    >
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
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    No products found for the current search or filters.
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
