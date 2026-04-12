import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Edit, Trash2, Plus, X, ChevronDown, ChevronRight, FolderPlus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload, apiPatch } from '../lib/api';
import type { Category, Product, SubCategory, FilterType, CategoryFilter, FilterOption } from '../lib/types';
import { IMAGE_UPLOAD_ACCEPT, WEBP_UPLOAD_HINT } from '../lib/upload';

const toSafeSlug = (value: string) =>
  (value || '')
    .toLowerCase()
    .trim()
    .replace(/[\/\\]+/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const getLinkedCategoryIds = (subcategory: SubCategory) =>
  Array.from(new Set([Number(subcategory.category), ...((subcategory.linked_category_ids || []).map(Number))])).filter(Boolean);

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterTypes, setFilterTypes] = useState<FilterType[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingFilterType, setEditingFilterType] = useState<FilterType | null>(null);
  const [editingOption, setEditingOption] = useState<FilterOption | null>(null);
  const [optionFormData, setOptionFormData] = useState({ name: '', slug: '', color_code: '' });
  const [optionEditData, setOptionEditData] = useState({ name: '', slug: '', color_code: '' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [filterTargetCategoryId, setFilterTargetCategoryId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingFilter, setIsSavingFilter] = useState(false);

  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryImageUrl, setCategoryImageUrl] = useState('');
  const [categoryMetaTitle, setCategoryMetaTitle] = useState('');
  const [categoryMetaDescription, setCategoryMetaDescription] = useState('');
  const [categoryImageAltText, setCategoryImageAltText] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState(0);
  const [subCategoryFormData, setSubCategoryFormData] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    imageAltText: '',
    metaTitle: '',
    metaDescription: '',
    sort_order: 0,
    linkedCategoryIds: [] as number[],
    selectedProducts: [] as number[],
  });
  const [filterForm, setFilterForm] = useState({
    filter_type: '',
    subcategory: '',
    display_order: 0,
    is_active: true,
  });
  const [lastCreatedFilterTypeId, setLastCreatedFilterTypeId] = useState<number | null>(null);
  const [quickFilterForm, setQuickFilterForm] = useState({
    name: '',
    display_type: 'checkbox' as FilterType['display_type'],
    is_expanded_by_default: true,
  });
  const [quickFilterOptions, setQuickFilterOptions] = useState<{ name: string }[]>([{ name: '' }]);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const loadData = async () => {
    try {
      const [categoriesRes, productsRes, filterTypesRes, catFiltersRes] = await Promise.all([
        apiGet<Category[]>('/categories/'),
        apiGet<Product[]>('/products/'),
        apiGet<FilterType[]>('/filter-types/'),
        apiGet<CategoryFilter[]>('/category-filters/'),
      ]);
      // Keep categories and their subcategories ordered consistently so newly created
      // subcategories appear immediately near the top instead of "somewhere later".
      const sortedCategories = [...categoriesRes]
        .map((c) => ({
          ...c,
          subcategories: [...(c.subcategories || [])].sort(
            (a, b) =>
              (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
              a.name.localeCompare(b.name)
          ),
        }))
        .sort(
          (a, b) =>
            (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
            a.name.localeCompare(b.name)
        );

      setCategories(sortedCategories);
      setProducts(productsRes);
      setFilterTypes(filterTypesRes);
      setCategoryFilters(catFiltersRes);
      setExpandedCategories(new Set(sortedCategories.map((c) => c.id)));
    } catch {
      toast.error('Failed to load categories');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editingFilterType) {
      const updated = filterTypes.find((ft) => ft.id === editingFilterType.id);
      if (updated) {
        setEditingFilterType(updated);
      }
    }
  }, [filterTypes, editingFilterType]);

  const toggleCategory = (id: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategorySlug(category.slug || '');
      setCategoryDescription(category.description || '');
      setCategoryImageUrl(category.image || '');
      setCategoryMetaTitle(category.meta_title || '');
      setCategoryMetaDescription(category.meta_description || '');
      setCategoryImageAltText(category.image_alt_text || '');
      setCategorySortOrder(Number(category.sort_order) || 0);
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategorySlug('');
      setCategoryDescription('');
      setCategoryImageUrl('');
      setCategoryMetaTitle('');
      setCategoryMetaDescription('');
      setCategoryImageAltText('');
      setCategorySortOrder(0);
    }
    setShowCategoryModal(true);
  };

  const openSubCategoryModal = (categoryId: number, subCategory?: SubCategory) => {
    if (subCategory) {
      setSelectedCategoryId(subCategory.category);
      setEditingSubCategory(subCategory);
      setSubCategoryFormData({
        name: subCategory.name,
        slug: subCategory.slug || '',
        description: subCategory.description,
        imageUrl: subCategory.image,
        imageAltText: subCategory.image_alt_text || '',
        metaTitle: subCategory.meta_title || '',
        metaDescription: subCategory.meta_description || '',
        sort_order: Number(subCategory.sort_order) || 0,
        linkedCategoryIds: getLinkedCategoryIds(subCategory).filter((id) => id !== Number(subCategory.category)),
        selectedProducts: products
          .filter((p) => p.subcategory === subCategory.id)
          .map((p) => p.id),
      });
    } else {
      setSelectedCategoryId(categoryId);
      setEditingSubCategory(null);
      setSubCategoryFormData({
        name: '',
        slug: '',
        description: '',
        imageUrl: '',
        imageAltText: '',
        metaTitle: '',
        metaDescription: '',
        sort_order: 0,
        linkedCategoryIds: [],
        selectedProducts: [],
      });
    }
    setShowSubCategoryModal(true);
  };

  const openFilterModal = (categoryId: number) => {
    setFilterTargetCategoryId(categoryId);
    setFilterForm({
      // Force an explicit choice so we don’t auto-assign the first filter type
      filter_type: '',
      subcategory: '',
      display_order: 0,
      is_active: true,
    });
    setShowFilterModal(true);
  };

  const slugify = (value: string) => toSafeSlug(value);

  const ensureUniqueSlug = (base: string) => {
    const existing = new Set(filterTypes.map((ft) => ft.slug));
    if (!existing.has(base)) return base;
    let suffix = 2;
    while (existing.has(`${base}-${suffix}`)) {
      suffix += 1;
    }
    return `${base}-${suffix}`;
  };

  // Creates a filter type from the quick form and returns it, or null on failure
  const createFilterTypeFromQuickForm = async () => {
    if (!quickFilterForm.name.trim()) {
      toast.error('Filter name is required');
      return null;
    }
    const baseSlug = slugify(quickFilterForm.name);
    const attempts = [ensureUniqueSlug(baseSlug), ensureUniqueSlug(`${baseSlug}-${Date.now()}`)];
    try {
      setIsCreatingType(true);
      let created: FilterType | null = null;
      let lastError: unknown = null;
      for (const slugCandidate of attempts) {
        const payload = {
          name: quickFilterForm.name.trim(),
          slug: slugCandidate,
          display_type: quickFilterForm.display_type,
          is_expanded_by_default: quickFilterForm.is_expanded_by_default,
        };
        try {
          created = await apiPost<FilterType>('/filter-types/', payload);
          break;
        } catch (err) {
          lastError = err;
          // if slug clash, try next candidate; otherwise abort
          const msg = String(err || '').toLowerCase();
          if (!msg.includes('slug') && !msg.includes('unique') && !msg.includes('exists')) {
            throw err;
          }
        }
      }
      if (!created) {
        throw lastError || new Error('Failed to create filter type');
      }
      // Make sure the new filter type is available in local state immediately
      setFilterTypes((prev) => [...prev, created!]);
      const optionPayloads = quickFilterOptions
        .map((opt, idx) => ({
          name: (opt.name || '').trim(),
          slug: toSafeSlug(opt.name || ''),
          filter_type: created.id,
          display_order: idx,
        }))
        .filter((opt) => opt.name.length > 0);
      if (optionPayloads.length > 0) {
        await Promise.all(optionPayloads.map((opt) => apiPost('/filter-options/', opt)));
      }
      setLastCreatedFilterTypeId(created.id || null);
      setFilterForm((prev) => ({ ...prev, filter_type: String(created.id || '') }));
      setQuickFilterForm({
        name: '',
        display_type: 'checkbox',
        is_expanded_by_default: true,
      });
      setQuickFilterOptions([{ name: '' }]);
      return created;
    } catch {
      toast.error('Failed to create filter type');
      return null;
    } finally {
      setIsCreatingType(false);
    }
  };

  const handleSaveFilter = async () => {
    const quickName = quickFilterForm.name.trim();
    const explicitSelection = Number.isFinite(Number(filterForm.filter_type))
      ? Number(filterForm.filter_type)
      : null;

    let chosenFilterTypeId = explicitSelection || lastCreatedFilterTypeId || null;

    const needCreateFromQuickName = quickName.length > 0 && !explicitSelection;

    if (needCreateFromQuickName) {
      const created = await createFilterTypeFromQuickForm();
      if (created?.id) {
        chosenFilterTypeId = created.id;
        toast.success('Filter type created');
      }
    }

    if (!filterTargetCategoryId) {
      toast.error('Select a category before assigning a filter.');
      return;
    }

    if (!chosenFilterTypeId) {
      toast.error('Select or create a filter type first.');
      return;
    }

    const subcategoryId = Number(filterForm.subcategory) || null;
    const payload = {
      category: subcategoryId ? null : filterTargetCategoryId,
      subcategory: subcategoryId,
      filter_type: chosenFilterTypeId,
      display_order: Number(filterForm.display_order) || 0,
      is_active: filterForm.is_active,
    };

    try {
      setIsSavingFilter(true);
      await apiPost('/category-filters/', payload);
      toast.success('Filter assigned');
      setShowFilterModal(false);
      await loadData();
    } catch {
      toast.error('Failed to assign filter');
    } finally {
      setIsSavingFilter(false);
    }
  };

  const handleQuickCreateFilterType = async () => {
    const created = await createFilterTypeFromQuickForm();
    if (!created) return;
    toast.success('Filter type created');
    await loadData();
  };

  const handleDeleteCategoryFilter = async (id: number) => {
    if (!confirm('Remove this filter from the category?')) return;
    try {
      await apiDelete(`/category-filters/${id}/`);
      toast.success('Filter removed');
      await loadData();
    } catch {
      toast.error('Failed to remove filter');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      if (editingCategory) {
        await apiPut(`/categories/${editingCategory.id}/`, {
          ...editingCategory,
          name: categoryName.trim(),
          slug: categorySlug.trim() || slugify(categoryName),
          description: categoryDescription,
          image: categoryImageUrl,
          meta_title: categoryMetaTitle.trim(),
          meta_description: categoryMetaDescription.trim(),
          image_alt_text: categoryImageAltText.trim(),
          sort_order: Number.isFinite(categorySortOrder) ? categorySortOrder : 0,
        });
        toast.success('Category updated successfully');
      } else {
        await apiPost('/categories/', {
          name: categoryName.trim(),
          slug: categorySlug.trim() || slugify(categoryName),
          description: categoryDescription,
          image: categoryImageUrl,
          meta_title: categoryMetaTitle.trim(),
          meta_description: categoryMetaDescription.trim(),
          image_alt_text: categoryImageAltText.trim(),
          sort_order: Number.isFinite(categorySortOrder) ? categorySortOrder : 0,
        });
        toast.success('Category created successfully');
      }
      setShowCategoryModal(false);
      setCategoryName('');
      setCategorySlug('');
      setCategoryDescription('');
      setCategoryImageUrl('');
      setCategoryMetaTitle('');
      setCategoryMetaDescription('');
      setCategoryImageAltText('');
      setCategorySortOrder(0);
      await loadData();
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleSaveSubCategory = async () => {
    if (!subCategoryFormData.name.trim() || !selectedCategoryId) {
      toast.error('Subcategory name is required');
      return;
    }
    try {
      let targetSubId = editingSubCategory?.id;
      if (editingSubCategory) {
        await apiPut(`/subcategories/${editingSubCategory.id}/`, {
          ...editingSubCategory,
          name: subCategoryFormData.name.trim(),
          slug: subCategoryFormData.slug.trim() || slugify(subCategoryFormData.name),
          description: subCategoryFormData.description,
          image: subCategoryFormData.imageUrl,
          image_alt_text: subCategoryFormData.imageAltText.trim(),
          meta_title: subCategoryFormData.metaTitle.trim(),
          meta_description: subCategoryFormData.metaDescription.trim(),
          sort_order: Number.isFinite(subCategoryFormData.sort_order) ? subCategoryFormData.sort_order : 0,
          category: selectedCategoryId,
          additional_categories: subCategoryFormData.linkedCategoryIds.filter((id) => id !== selectedCategoryId),
        });
        toast.success('Subcategory updated successfully');
      } else {
        const created = await apiPost<SubCategory>('/subcategories/', {
          name: subCategoryFormData.name.trim(),
          slug: subCategoryFormData.slug.trim() || slugify(subCategoryFormData.name),
          description: subCategoryFormData.description,
          image: subCategoryFormData.imageUrl,
          image_alt_text: subCategoryFormData.imageAltText.trim(),
          meta_title: subCategoryFormData.metaTitle.trim(),
          meta_description: subCategoryFormData.metaDescription.trim(),
          sort_order: Number.isFinite(subCategoryFormData.sort_order) ? subCategoryFormData.sort_order : 0,
          category: selectedCategoryId,
          additional_categories: subCategoryFormData.linkedCategoryIds.filter((id) => id !== selectedCategoryId),
        });
        targetSubId = created.id;
        toast.success('Subcategory created successfully');
      }

      if (targetSubId) {
        await Promise.all(
          subCategoryFormData.selectedProducts.map((productId) =>
            apiPut(`/products/${productId}/`, { subcategory: targetSubId })
          )
        );
      }
      setShowSubCategoryModal(false);
      await loadData();
    } catch {
      toast.error('Failed to save subcategory');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirm('Are you sure you want to delete this category? This will also delete all subcategories.')) {
      try {
        await apiDelete(`/categories/${id}/`);
        toast.success('Category deleted successfully');
        await loadData();
      } catch {
        toast.error('Failed to delete category');
      }
    }
  };

  const handleDeleteSubCategory = async (id: number) => {
    if (confirm('Are you sure you want to delete this subcategory?')) {
      try {
        await apiDelete(`/subcategories/${id}/`);
        toast.success('Subcategory deleted successfully');
        await loadData();
      } catch {
        toast.error('Failed to delete subcategory');
      }
    }
  };

  const toggleProductSelection = (productId: number) => {
    setSubCategoryFormData((prev) => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(productId)
        ? prev.selectedProducts.filter((id) => id !== productId)
        : [...prev.selectedProducts, productId],
    }));
  };

  const getProductNames = (productIds: number[]) => {
    return products
      .filter((p) => productIds.includes(p.id))
      .map((p) => p.name)
      .join(', ');
  };

  const getTotalProducts = (category: Category) => {
    return (category.subcategories || []).reduce((total, sub) => {
      const count = products.filter((p) => p.subcategory === sub.id).length;
      return total + count;
    }, 0);
  };

  const filtersForCategory = (category: Category) => {
    const subIds = new Set((category.subcategories || []).map((s) => s.id));
    return categoryFilters
      .filter((cf) => cf.category === category.id || (cf.subcategory && subIds.has(cf.subcategory)))
      .map((cf) => {
        const resolvedName = getFilterTypeName(cf.filter_type, cf.filter_type_name);
        return { ...cf, filter_type_name: resolvedName };
      });
  };

  const getFilterTypeName = (id?: number, fallbackName?: string) => {
    const targetId = id == null ? null : Number(id);
    const liveName = filterTypes.find((ft) => Number(ft.id) === targetId)?.name;
    if (liveName && liveName.trim()) return liveName;
    if (fallbackName && fallbackName.trim()) return fallbackName;
    return `Filter #${id}`;
  };

  const escapeHtml = (value?: string) =>
    (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const renderRichText = (value?: string) => {
    const safe = escapeHtml(value);
    return safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  };

  const openFilterTypeEditor = (filterTypeId: number) => {
    const ft = filterTypes.find((f) => f.id === filterTypeId);
    if (ft) {
      setEditingFilterType(ft);
      setEditingOption(null);
      setOptionFormData({ name: '', slug: '', color_code: '' });
      setOptionEditData({ name: '', slug: '', color_code: '' });
    } else {
      toast.error('Filter type not found');
    }
  };

  const handleUnlinkSubCategory = async (subcategory: SubCategory, categoryId: number) => {
    if (!confirm('Remove this subcategory from only this category? It will stay linked everywhere else.')) return;
    try {
      await apiPost(`/subcategories/${subcategory.id}/unlink-category/`, { category: categoryId });
      toast.success('Subcategory removed from this category only');
      await loadData();
    } catch {
      toast.error('Failed to remove subcategory from this category');
    }
  };

  const startEditingOption = (option: FilterOption) => {
    setEditingOption(option);
    setOptionEditData({
      name: option.name,
      slug: option.slug,
      color_code: option.color_code || '',
    });
  };

  const handleUpdateOption = async () => {
    if (!editingFilterType || !editingOption) return;
    if (!optionEditData.name.trim() || !optionEditData.slug.trim()) {
      toast.error('Option name and slug are required');
      return;
    }
    try {
      await apiPatch(`/filter-options/${editingOption.id}/`, {
        name: optionEditData.name,
        slug: optionEditData.slug,
        color_code: optionEditData.color_code || null,
        filter_type: editingFilterType.id,
      });
      toast.success('Option updated');
      setEditingOption(null);
      setOptionEditData({ name: '', slug: '', color_code: '' });
      await loadData();
    } catch {
      toast.error('Failed to update option');
    }
  };

  const handleAddOption = async () => {
    if (!editingFilterType) return;
    if (!optionFormData.name.trim() || !optionFormData.slug.trim()) {
      toast.error('Option name and slug are required');
      return;
    }
    try {
      await apiPost('/filter-options/', {
        name: optionFormData.name,
        slug: optionFormData.slug,
        color_code: optionFormData.color_code || null,
        filter_type: editingFilterType.id,
      });
      toast.success('Option added');
      setOptionFormData({ name: '', slug: '', color_code: '' });
      await loadData();
    } catch {
      toast.error('Failed to add option');
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!editingFilterType) return;
    if (!confirm('Delete this option?')) return;
    try {
      await apiDelete(`/filter-options/${optionId}/`);
      toast.success('Option deleted');
      await loadData();
    } catch {
      toast.error('Failed to delete option');
    }
  };

  const getSubcategoryName = (id?: number) =>
    categories
      .flatMap((c) => c.subcategories || [])
      .find((s) => s.id === id)?.name || undefined;

  const subcategoryProducts = useMemo(() => products, [products]);

  const handleUploadImage = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setSubCategoryFormData((prev) => ({ ...prev, imageUrl: res.url }));
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadCategoryImage = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setCategoryImageUrl(res.url);
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBoldDescription = () => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) return;
    const selected = value.substring(selectionStart, selectionEnd);
    const wrapped = `**${selected}**`;
    const newValue = value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
    setSubCategoryFormData((prev) => ({ ...prev, description: newValue }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd + 4);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-espresso">Categories & Subcategories</h2>
          <p className="text-muted-foreground">Organize your products into collections.</p>
        </div>
        <Button onClick={() => openCategoryModal()} className="bg-primary text-white hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add Main Category
        </Button>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="hover:bg-gray-100 rounded p-1"
                  >
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                  <div>
                    <CardTitle className="text-xl">{category.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Display order: {Number(category.sort_order) || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {(category.subcategories || []).length} subcategories • {getTotalProducts(category)} products
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openFilterModal(category.id)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSubCategoryModal(category.id)}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Add Subcategory
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openCategoryModal(category)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedCategories.has(category.id) && (
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/70 p-3 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Filters for this category</h4>
                    <Button variant="ghost" size="sm" onClick={() => openFilterModal(category.id)}>
                      <Plus className="h-4 w-4 mr-2" /> Add Filter
                    </Button>
                  </div>
                  {filtersForCategory(category).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No filters assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filtersForCategory(category).map((cf) => (
                        <span
                          key={cf.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-sm"
                        >
                          {getFilterTypeName(cf.filter_type, cf.filter_type_name)}
                          {cf.subcategory && (
                            <span className="text-xs text-muted-foreground">
                              • {getSubcategoryName(cf.subcategory) || 'Subcategory'}
                            </span>
                          )}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary"
                            title="Edit filter type & options"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFilterTypeEditor(cf.filter_type);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategoryFilter(cf.id)}
                            className="text-destructive hover:opacity-80"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {(category.subcategories || []).length > 0 ? (
                  <div className="space-y-3">
                    {(category.subcategories || []).map((sub) => {
                      const productIds = products
                        .filter((p) => p.subcategory === sub.id)
                        .map((p) => p.id);
                      return (
                        <div key={sub.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border">
                          {sub.image && (
                            <img
                              src={sub.image}
                              alt={sub.name}
                              className="w-24 h-24 object-cover rounded-md"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-lg">{sub.name}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sub.category === category.id ? 'Main category' : 'Also linked here'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Display order: {Number(sub.sort_order) || 0}
                            </p>
                            <p
                              className="text-sm text-muted-foreground mt-1"
                              dangerouslySetInnerHTML={{ __html: renderRichText(sub.description) }}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              <span className="font-medium">Products ({productIds.length}):</span>{' '}
                              {productIds.length > 0 ? getProductNames(productIds) : 'None'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openSubCategoryModal(category.id, sub)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                getLinkedCategoryIds(sub).length > 1
                                  ? handleUnlinkSubCategory(sub, category.id)
                                  : handleDeleteSubCategory(sub.id)
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No subcategories yet. Click "Add Subcategory" to create one.
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowCategoryModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category Name *</label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Divan Beds"
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">URL Slug</label>
                <Input
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  placeholder="e.g. divan-beds"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  rows={5}
                  placeholder="Introductory text shown on the category page..."
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Category Image</label>
                <Input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={(e) => handleUploadCategoryImage(e.target.files?.[0])}
                  className="cursor-pointer bg-black/5"
                />
                <p className="text-xs text-muted-foreground">{WEBP_UPLOAD_HINT}</p>
                {isUploading && (
                  <p className="text-xs text-muted-foreground">Uploading...</p>
                )}
                {categoryImageUrl && (
                  <div className="relative">
                    <img
                      src={categoryImageUrl}
                      alt="Category preview"
                      className="w-full h-40 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setCategoryImageUrl('')}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Title</label>
                <Input
                  value={categoryMetaTitle}
                  onChange={(e) => setCategoryMetaTitle(e.target.value)}
                  placeholder="Optional SEO title"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Description</label>
                <textarea
                  value={categoryMetaDescription}
                  onChange={(e) => setCategoryMetaDescription(e.target.value)}
                  rows={4}
                  placeholder="Optional SEO description"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Image ALT Text</label>
                <Input
                  value={categoryImageAltText}
                  onChange={(e) => setCategoryImageAltText(e.target.value)}
                  placeholder="Describe the category image for SEO/accessibility"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Display Order</label>
                <Input
                  type="number"
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first. Higher numbers appear later.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
                <Button onClick={handleSaveCategory}>
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Filter to Category</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-white p-3 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Quick create filter type</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleQuickCreateFilterType}
                      disabled={isCreatingType}
                    >
                      {isCreatingType ? 'Saving...' : 'Create'}
                    </Button>
                  </div>
                  <Input
                    placeholder="Name (e.g., Bed Size)"
                    value={quickFilterForm.name}
                    onChange={(e) =>
                      setQuickFilterForm({
                        ...quickFilterForm,
                        name: e.target.value,
                      })
                    }
                  />
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Display Type</label>
                    <select
                      className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                      value={quickFilterForm.display_type}
                      onChange={(e) =>
                        setQuickFilterForm({
                          ...quickFilterForm,
                          display_type: e.target.value as FilterType['display_type'],
                        })
                      }
                    >
                      <option value="checkbox">Checkbox list</option>
                      <option value="color_swatch">Color swatch</option>
                      <option value="radio">Radio buttons</option>
                      <option value="dropdown">Dropdown</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Options</label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuickFilterOptions((prev) => [...prev, { name: '' }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {quickFilterOptions.map((opt, idx) => (
                        <div key={idx} className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
                          <Input
                            className="w-full"
                            placeholder={`Option ${idx + 1}`}
                            value={opt.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setQuickFilterOptions((prev) => {
                                const next = [...prev];
                                next[idx] = { name: value };
                                return next;
                              });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                            onClick={() =>
                              setQuickFilterOptions((prev) =>
                                prev.length === 1
                                  ? [{ name: '' }]
                                  : prev.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add option names (e.g., Small Single, Double, King). Slugs auto-fill.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={quickFilterForm.is_expanded_by_default}
                      onChange={(e) =>
                        setQuickFilterForm({
                          ...quickFilterForm,
                          is_expanded_by_default: e.target.checked,
                        })
                      }
                    />
                    Expanded by default
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Create a filter type here; it will appear in the list and auto-select.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target (optional subcategory)</label>
                  <select
                    className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                    value={filterForm.subcategory}
                    onChange={(e) => setFilterForm({ ...filterForm, subcategory: e.target.value })}
                    disabled={!filterTargetCategoryId}
                  >
                    <option value="">Apply to whole category</option>
                    {(categories.find((c) => c.id === filterTargetCategoryId)?.subcategories || []).map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Choose a subcategory to target it; leave blank for whole category.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Order</label>
                  <Input
                    type="number"
                    value={filterForm.display_order}
                    onChange={(e) => setFilterForm({ ...filterForm, display_order: Number(e.target.value) })}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filterForm.is_active}
                      onChange={(e) => setFilterForm({ ...filterForm, is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowFilterModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveFilter} disabled={isSavingFilter}>
                  {isSavingFilter ? 'Saving...' : 'Assign Filter'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showSubCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingSubCategory ? 'Edit Subcategory' : 'Add New Subcategory'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowSubCategoryModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Subcategory Name *</label>
                <Input
                  value={subCategoryFormData.name}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, name: e.target.value })}
                  placeholder="e.g. Storage Divans"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Main Category *</label>
                <select
                  className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                  value={selectedCategoryId ?? ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select main category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Also Show Under</label>
                <div className="grid gap-2 rounded-md border border-input p-3 max-h-48 overflow-y-auto">
                  {categories.map((category) => {
                    const checked = subCategoryFormData.linkedCategoryIds.includes(category.id);
                    return (
                      <label key={category.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={category.id === selectedCategoryId}
                          onChange={(e) =>
                            setSubCategoryFormData((prev) => ({
                              ...prev,
                              linkedCategoryIds: e.target.checked
                                ? [...prev.linkedCategoryIds, category.id]
                                : prev.linkedCategoryIds.filter((id) => id !== category.id),
                            }))
                          }
                        />
                        <span>{category.name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add existing subcategories under extra main categories without losing products or data.
                </p>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleBoldDescription}
                      className="h-8 px-3"
                    >
                      Bold
                    </Button>
                    <span>Tip: select text and click Bold to wrap with ** **</span>
                  </div>
                </div>
                <textarea
                  ref={descriptionRef}
                  value={subCategoryFormData.description}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, description: e.target.value })}
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Brief description of this subcategory... (supports **bold**)"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">URL Slug</label>
                <Input
                  value={subCategoryFormData.slug}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, slug: e.target.value })}
                  placeholder="e.g. ottoman-divans"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Display Order</label>
                <Input
                  type="number"
                  value={subCategoryFormData.sort_order}
                  onChange={(e) =>
                    setSubCategoryFormData({
                      ...subCategoryFormData,
                      sort_order: Number(e.target.value),
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Subcategory Image</label>
                <Input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={(e) => handleUploadImage(e.target.files?.[0])}
                  className="cursor-pointer bg-black/5"
                />
                <p className="text-xs text-muted-foreground">{WEBP_UPLOAD_HINT}</p>
                {isUploading && (
                  <p className="text-xs text-muted-foreground">Uploading...</p>
                )}
                {subCategoryFormData.imageUrl && (
                  <div className="relative">
                    <img
                      src={subCategoryFormData.imageUrl}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-md border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 "
                      onClick={() => setSubCategoryFormData({ ...subCategoryFormData, imageUrl: '' })}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Image ALT Text</label>
                <Input
                  value={subCategoryFormData.imageAltText}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, imageAltText: e.target.value })}
                  placeholder="Describe the subcategory image"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Title</label>
                <Input
                  value={subCategoryFormData.metaTitle}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, metaTitle: e.target.value })}
                  placeholder="Optional SEO title"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Description</label>
                <textarea
                  value={subCategoryFormData.metaDescription}
                  onChange={(e) => setSubCategoryFormData({ ...subCategoryFormData, metaDescription: e.target.value })}
                  rows={4}
                  placeholder="Optional SEO description"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Select Products</label>
                <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
                  {subcategoryProducts.map((product) => (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={subCategoryFormData.selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">{product.name} - £{product.price}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {subCategoryFormData.selectedProducts.length} product(s) selected
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowSubCategoryModal(false)}>Cancel</Button>
                <Button onClick={handleSaveSubCategory}>
                  {editingSubCategory ? 'Update Subcategory' : 'Create Subcategory'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editingFilterType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Edit Filter: {editingFilterType.name}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEditingFilterType(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Options</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editingFilterType.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-start justify-between p-2 bg-gray-50 rounded-md border"
                    >
                      <div className="flex-1 space-y-2">
                        {editingOption?.id === opt.id ? (
                          <>
                            <Input
                              placeholder="Option name"
                              value={optionEditData.name}
                                onChange={(e) =>
                                  setOptionEditData({
                                    ...optionEditData,
                                    name: e.target.value,
                                    slug: toSafeSlug(e.target.value),
                                  })
                                }
                            />
                            <Input
                              placeholder="Slug"
                              value={optionEditData.slug}
                              onChange={(e) =>
                                setOptionEditData({ ...optionEditData, slug: e.target.value })
                              }
                            />
                            {editingFilterType.display_type === 'color_swatch' && (
                              <Input
                                type="color"
                                value={optionEditData.color_code || '#000000'}
                                onChange={(e) =>
                                  setOptionEditData({ ...optionEditData, color_code: e.target.value })
                                }
                              />
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            {opt.color_code && (
                              <div
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: opt.color_code }}
                              />
                            )}
                            <div>
                              <p className="font-medium">{opt.name}</p>
                              <p className="text-xs text-muted-foreground">{opt.slug}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingOption?.id === opt.id ? (
                          <>
                            <Button size="sm" onClick={handleUpdateOption}>Save</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingOption(null);
                                setOptionEditData({ name: '', slug: '', color_code: '' });
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => startEditingOption(opt)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOption(opt.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {editingFilterType.options.length === 0 && (
                    <p className="text-sm text-muted-foreground">No options yet.</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t space-y-3">
                <h4 className="font-semibold text-sm">Add New Option</h4>
                <Input
                  placeholder="Option name"
                  value={optionFormData.name}
                  onChange={(e) =>
                    setOptionFormData({
                      ...optionFormData,
                      name: e.target.value,
                      slug: toSafeSlug(e.target.value),
                    })
                  }
                />
                <Input
                  placeholder="Slug"
                  value={optionFormData.slug}
                  onChange={(e) => setOptionFormData({ ...optionFormData, slug: e.target.value })}
                />
                {editingFilterType.display_type === 'color_swatch' && (
                  <Input
                    type="color"
                    value={optionFormData.color_code || '#000000'}
                    onChange={(e) =>
                      setOptionFormData({ ...optionFormData, color_code: e.target.value })
                    }
                  />
                )}
                <Button onClick={handleAddOption}>
                  <Plus className="h-4 w-4 mr-2" /> Add Option
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Categories;
