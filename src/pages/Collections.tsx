import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiGet, apiPut } from '../lib/api';
import type { Category, SubCategory } from '../lib/types';
import { toast } from 'sonner';

type CollectionItem = {
  id: number;
  name: string;
  description: string;
  image: string;
  sort_order?: number;
  show_in_collections?: boolean;
  show_in_all_collections?: boolean;
  itemType: 'category' | 'subcategory';
  parentName?: string;
};

const Collections = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [updatingKeys, setUpdatingKeys] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const [categoriesData, subcategoriesData] = await Promise.all([
        apiGet<Category[]>('/categories/'),
        apiGet<SubCategory[]>('/subcategories/'),
      ]);
      setCategories(categoriesData);
      setSubcategories(subcategoriesData);
    } catch {
      setCategories([]);
      setSubcategories([]);
      toast.error('Failed to load existing categories');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const items = useMemo<CollectionItem[]>(() => {
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const categoryItems: CollectionItem[] = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      sort_order: category.sort_order,
      show_in_collections: category.show_in_collections,
      show_in_all_collections: category.show_in_all_collections,
      itemType: 'category',
    }));

    const subcategoryItems: CollectionItem[] = subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
      description: subcategory.description || '',
      image: subcategory.image || '',
      sort_order: subcategory.sort_order,
      show_in_collections: subcategory.show_in_collections,
      show_in_all_collections: subcategory.show_in_all_collections,
      itemType: 'subcategory',
      parentName: categoryMap.get(subcategory.category) || '',
    }));

    return [...subcategoryItems, ...categoryItems].sort((a, b) => {
      const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  }, [categories, subcategories]);

  const selectedCount = items.filter((item) => item.show_in_collections).length;
  const selectedViewAllCount = items.filter((item) => item.show_in_all_collections).length;

  const handleToggle = async (
    item: CollectionItem,
    field: 'show_in_collections' | 'show_in_all_collections',
    checked: boolean
  ) => {
    const key = `${item.itemType}-${item.id}-${field}`;
    setUpdatingKeys((prev) => [...prev, key]);

    try {
      if (item.itemType === 'category') {
        const category = categories.find((entry) => entry.id === item.id);
        if (!category) throw new Error('Category not found');

        await apiPut(`/categories/${item.id}/`, {
          ...category,
          [field]: checked,
        });

        setCategories((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, [field]: checked } : entry))
        );
      } else {
        const subcategory = subcategories.find((entry) => entry.id === item.id);
        if (!subcategory) throw new Error('Subcategory not found');

        await apiPut(`/subcategories/${item.id}/`, {
          ...subcategory,
          [field]: checked,
        });

        setSubcategories((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, [field]: checked } : entry))
        );
      }

      toast.success(
        field === 'show_in_collections'
          ? checked
            ? 'Added to homepage top display'
            : 'Removed from homepage top display'
          : checked
            ? 'Added to View All Collections'
            : 'Removed from View All Collections'
      );
    } catch {
      toast.error('Failed to update display selection');
      await loadData();
    } finally {
      setUpdatingKeys((prev) => prev.filter((entry) => entry !== key));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Collections</h2>
        <p className="text-muted-foreground">
          Choose from the categories and subcategories you already have.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Homepage top 4 selected: {selectedCount}. View All Collections selected: {selectedViewAllCount}.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Show In Top 4</TableHead>
                <TableHead>Show In View All</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const topKey = `${item.itemType}-${item.id}-show_in_collections`;
                const viewAllKey = `${item.itemType}-${item.id}-show_in_all_collections`;
                return (
                  <TableRow key={`${item.itemType}-${item.id}`}>
                    <TableCell>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-12 w-16 rounded-md object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No image</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="capitalize">{item.itemType}</TableCell>
                    <TableCell>{item.parentName || '-'}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{item.description}</TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          checked={Boolean(item.show_in_collections)}
                          disabled={updatingKeys.includes(topKey)}
                          onChange={(e) => handleToggle(item, 'show_in_collections', e.target.checked)}
                        />
                        <span>{item.show_in_collections ? 'Selected' : 'Not selected'}</span>
                      </label>
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          checked={Boolean(item.show_in_all_collections)}
                          disabled={updatingKeys.includes(viewAllKey)}
                          onChange={(e) => handleToggle(item, 'show_in_all_collections', e.target.checked)}
                        />
                        <span>{item.show_in_all_collections ? 'Selected' : 'Not selected'}</span>
                      </label>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No categories found.
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
