import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Edit, Trash2, Plus, X, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api';
import type { Category, CategoryFilter, FilterType, SubCategory } from '../lib/types';

const toSafeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[\/\\]+/g, '-')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const Filters = () => {
  const [filterTypes, setFilterTypes] = useState<FilterType[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<FilterType | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    display_type: 'checkbox' as const,
    is_expanded_by_default: true,
  });

  const [optionFormData, setOptionFormData] = useState({
    name: '',
    slug: '',
    color_code:     '',
  });
  const [editingOption, setEditingOption] = useState<{ typeId: number; optionId: number } | null>(null);
  const [optionEditData, setOptionEditData] = useState({ name: '', slug: '', color_code: '' });

  const [categoryFilterForm, setCategoryFilterForm] = useState({
    category: '',
    subcategory: '',
    filter_type: '',
    display_order: 0,
    is_active: true,
  });

  const filteredSubcategories = useMemo(() => {
    if (!categoryFilterForm.category) return subcategories;
    const catId = Number(categoryFilterForm.category);
    return subcategories.filter((s) => s.category === catId);
  }, [categoryFilterForm.category, subcategories]);

  const loadData = async () => {
    try {
      const [filters, cats, subs, catFilters] = await Promise.all([
        apiGet<FilterType[]>('/filter-types/'),
        apiGet<Category[]>('/categories/'),
        apiGet<SubCategory[]>('/subcategories/'),
        apiGet<CategoryFilter[]>('/category-filters/'),
      ]);
      setFilterTypes(filters);
      setExpandedTypes(new Set(filters.map((ft) => ft.id)));
      setCategories(cats);
      setSubcategories(subs);
      setCategoryFilters(catFilters);
    } catch {
      toast.error('Failed to load filters');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTypes(newExpanded);
  };

  const openModal = (type?: FilterType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        slug: type.slug,
        display_type: type.display_type as any,
        is_expanded_by_default: type.is_expanded_by_default,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        slug: '',
        display_type: 'checkbox',
        is_expanded_by_default: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
  };

  const handleSaveType = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    try {
      setIsUploading(true);
      if (editingType) {
        await apiPut(`/filter-types/${editingType.id}/`, formData);
        toast.success('Filter type updated successfully');
      } else {
        await apiPost('/filter-types/', formData);
        toast.success('Filter type created successfully');
      }
      loadData();
      closeModal();
    } catch (error) {
      toast.error('Failed to save filter type');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteType = async (id: number) => {
    if (!confirm('Are you sure you want to delete this filter type?')) return;
    try {
      await apiDelete(`/filter-types/${id}/`);
      toast.success('Filter type deleted successfully');
      loadData();
    } catch {
      toast.error('Failed to delete filter type');
    }
  };

  const handleAddOption = async (typeId: number) => {
    if (!optionFormData.name.trim() || !optionFormData.slug.trim()) {
      toast.error('Option name and slug are required');
      return;
    }

    try {
      setIsUploading(true);
      const payload = {
        name: optionFormData.name,
        slug: optionFormData.slug,
        color_code: optionFormData.color_code || null,
        filter_type: typeId,
      };
      await apiPost('/filter-options/', payload);
      toast.success('Filter option added successfully');
      setOptionFormData({ name: '', slug: '', color_code: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to add filter option');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditingOption = (typeId: number, option: { id: number; name: string; slug: string; color_code?: string | null }) => {
    setEditingOption({ typeId, optionId: option.id });
    setOptionEditData({
      name: option.name,
      slug: option.slug,
      color_code: option.color_code || '',
    });
  };

  const handleUpdateOption = async (typeId: number, optionId: number) => {
    if (!optionEditData.name.trim() || !optionEditData.slug.trim()) {
      toast.error('Option name and slug are required');
      return;
    }

    try {
      setIsUploading(true);
      const payload = {
        name: optionEditData.name,
        slug: optionEditData.slug,
        color_code: optionEditData.color_code || null,
        filter_type: typeId,
      };
      await apiPatch(`/filter-options/${optionId}/`, payload);
      toast.success('Filter option updated successfully');
      setEditingOption(null);
      setOptionEditData({ name: '', slug: '', color_code: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to update filter option');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteOption = async (_typeId: number, optionId: number) => {
    if (!confirm('Are you sure you want to delete this filter option?')) return;
    try {
      await apiDelete(`/filter-options/${optionId}/`);
      toast.success('Filter option deleted successfully');
      loadData();
    } catch {
      toast.error('Failed to delete filter option');
    }
  };

  const handleSaveCategoryFilter = async () => {
    const categoryId = Number(categoryFilterForm.category) || null;
    const subcategoryId = Number(categoryFilterForm.subcategory) || null;
    const filterTypeId = Number(categoryFilterForm.filter_type) || null;

    if (!filterTypeId) {
      toast.error('Select a filter type to assign');
      return;
    }
    if (!categoryId && !subcategoryId) {
      toast.error('Pick a category or subcategory');
      return;
    }

    // Enforce mutually exclusive selection to avoid ambiguity
    const payload = {
      category: subcategoryId ? null : categoryId,
      subcategory: subcategoryId || null,
      filter_type: filterTypeId,
      display_order: Number(categoryFilterForm.display_order) || 0,
      is_active: categoryFilterForm.is_active,
    };

    try {
      setIsUploading(true);
      await apiPost('/category-filters/', payload);
      toast.success('Filter assigned successfully');
      setCategoryFilterForm({
        category: '',
        subcategory: '',
        filter_type: '',
        display_order: 0,
        is_active: true,
      });
      loadData();
    } catch {
      toast.error('Failed to assign filter');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCategoryFilter = async (id: number) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await apiDelete(`/category-filters/${id}/`);
      toast.success('Assignment removed');
      loadData();
    } catch {
      toast.error('Failed to remove assignment');
    }
  };

  const handleUpdateCategoryFilter = async (id: number, updates: Partial<CategoryFilter>) => {
    try {
      await apiPatch(`/category-filters/${id}/`, updates);
      loadData();
    } catch {
      toast.error('Update failed');
    }
  };

  const resolvedCategoryFilters = useMemo(() => {
    const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const subById = Object.fromEntries(subcategories.map((s) => [s.id, `${s.name} (${catById[s.category] || 'Unassigned'})`]));
    const ftById = Object.fromEntries(filterTypes.map((f) => [f.id, f.name]));

    return categoryFilters.map((cf) => ({
      ...cf,
      category_name: cf.category ? catById[cf.category] : undefined,
      subcategory_name: cf.subcategory ? subById[cf.subcategory] : undefined,
      filter_type_name: ftById[cf.filter_type],
    }));
  }, [categories, subcategories, filterTypes, categoryFilters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Product Filters</h1>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" /> Create Filter Type
        </Button>
      </div>

      {filterTypes.map((type) => (
        <Card key={type.id}>
          <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50">
            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => toggleExpand(type.id)}
            >
              {expandedTypes.has(type.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <div>
                <CardTitle>{type.name}</CardTitle>
                <p className="text-sm text-gray-600">
                  Type: {type.display_type} • {type.options.length} options
                </p>
              </div>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openModal(type)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteType(type.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>

          {expandedTypes.has(type.id) && (
            <CardContent className="space-y-4 border-t pt-4">
              {type.options.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Options</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {type.options.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                      >
                        <div className="flex flex-col gap-2 flex-1">
                          {editingOption?.optionId === option.id && editingOption?.typeId === type.id ? (
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
                              {type.display_type === 'color_swatch' && (
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
                              {option.color_code && (
                                <div
                                  className="w-6 h-6 rounded border"
                                  style={{ backgroundColor: option.color_code }}
                                />
                              )}
                              <div>
                                <p className="font-medium">{option.name}</p>
                                <p className="text-xs text-gray-600">{option.slug}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingOption?.optionId === option.id && editingOption?.typeId === type.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleUpdateOption(type.id, option.id)}
                                disabled={isUploading}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingOption(null)}
                                disabled={isUploading}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingOption(type.id, option)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOption(type.id, option.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t space-y-3">
                <h3 className="font-semibold">Add New Option</h3>
                <Input
                  placeholder="Option name (e.g., Small Single)"
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
                  placeholder="Slug (e.g., small-single)"
                  value={optionFormData.slug}
                  onChange={(e) =>
                    setOptionFormData({ ...optionFormData, slug: e.target.value })
                  }
                />
                {type.display_type === 'color_swatch' && (
                  <Input
                    type="color"
                    value={optionFormData.color_code || '#000000'}
                    onChange={(e) =>
                      setOptionFormData({
                        ...optionFormData,
                        color_code: e.target.value,
                      })
                    }
                  />
                )}
                <Button
                  onClick={() => handleAddOption(type.id)}
                  disabled={isUploading}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Option
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Assign Filters to Categories/Subcategories</CardTitle>
          <p className="text-sm text-gray-600">
            Choose which filters should show on each category or subcategory page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category (optional)</label>
              <select
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                value={categoryFilterForm.category}
                onChange={(e) =>
                  setCategoryFilterForm({
                    ...categoryFilterForm,
                    category: e.target.value,
                    subcategory: '', // reset subcategory if category selected
                  })
                }
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Subcategory (optional)</label>
              <select
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                value={categoryFilterForm.subcategory}
                onChange={(e) =>
                  setCategoryFilterForm({
                    ...categoryFilterForm,
                    subcategory: e.target.value,
                    category: '', // prefer subcategory specificity
                  })
                }
              >
                <option value="">Select a subcategory</option>
                {filteredSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({categories.find((c) => c.id === s.category)?.name || 'No category'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Pick a subcategory for more specific filters; leave empty to target the whole category.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter Type</label>
              <select
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                value={categoryFilterForm.filter_type}
                onChange={(e) =>
                  setCategoryFilterForm({
                    ...categoryFilterForm,
                    filter_type: e.target.value,
                  })
                }
              >
                <option value="">Select a filter type</option>
                {filterTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Display Order</label>
              <Input
                type="number"
                value={categoryFilterForm.display_order}
                onChange={(e) =>
                  setCategoryFilterForm({
                    ...categoryFilterForm,
                    display_order: Number(e.target.value),
                  })
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryFilterForm.is_active}
                  onChange={(e) =>
                    setCategoryFilterForm({
                      ...categoryFilterForm,
                      is_active: e.target.checked,
                    })
                  }
                />
                Active
              </label>
            </div>
          </div>
          <Button onClick={handleSaveCategoryFilter} disabled={isUploading}>
            <Plus className="h-4 w-4 mr-2" /> Assign Filter
          </Button>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Current assignments</h3>
              <span className="text-xs text-gray-500">{resolvedCategoryFilters.length} total</span>
            </div>
            {resolvedCategoryFilters.length === 0 ? (
              <p className="text-sm text-gray-600">No filters assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Target</th>
                      <th className="px-3 py-2">Filter</th>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedCategoryFilters.map((cf) => (
                      <tr key={cf.id} className="border-t">
                        <td className="px-3 py-2">
                          {cf.subcategory_name || cf.category_name || '—'}
                        </td>
                        <td className="px-3 py-2">{cf.filter_type_name || `Filter #${cf.filter_type}`}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            defaultValue={cf.display_order}
                            className="h-9 w-24"
                            onBlur={(e) =>
                              handleUpdateCategoryFilter(cf.id, { display_order: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateCategoryFilter(cf.id, { is_active: !cf.is_active })}
                            title={cf.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {cf.is_active ? (
                              <ToggleRight className="h-5 w-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-gray-400" />
                            )}
                          </Button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategoryFilter(cf.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingType ? 'Edit Filter Type' : 'Create Filter Type'}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeModal}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Filter name (e.g., Bed Size)"
                value={formData.name}
                onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: toSafeSlug(e.target.value),
                    })
                  }
                />
              <Input
                placeholder="Slug (e.g., bed-size)"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium mb-1">
                  Display Type
                </label>
                <select
                  value={formData.display_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-white"
                >
                  <option value="checkbox">Checkbox List</option>
                  <option value="color_swatch">Color Swatch</option>
                  <option value="radio">Radio Buttons</option>
                  <option value="dropdown">Dropdown Select</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_expanded_by_default}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_expanded_by_default: e.target.checked,
                    })
                  }
                />
                <span className="text-sm">Expanded by default</span>
              </label>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveType}
                  disabled={isUploading}
                  className="flex-1"
                >
                  {editingType ? 'Update' : 'Create'}
                </Button>
                <Button
                  variant="outline"
                  onClick={closeModal}
                  disabled={isUploading}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Filters;
