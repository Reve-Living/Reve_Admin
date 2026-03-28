import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { apiGet, apiPost, apiPut, apiUpload } from '../lib/api';
import type { Category, Product, ProductDimensionRow, SubCategory, FilterType, FilterOption, CategoryFilter } from '../lib/types';
import { ICON_UPLOAD_ACCEPT, IMAGE_UPLOAD_ACCEPT, WEBP_UPLOAD_HINT } from '../lib/upload';

const resolveCategoryId = (product: Product, categories: Category[]): number | undefined => {
  const rawCategory = Number(product.category);
  if (Number.isFinite(rawCategory) && rawCategory > 0) return rawCategory;

  const bySlug = categories.find((cat) => cat.slug === product.category_slug);
  if (bySlug) return bySlug.id;

  const byName = categories.find((cat) => cat.name === product.category_name);
  return byName?.id;
};

const resolveSubcategoryId = (product: Product, subcategories: SubCategory[], categoryId?: number): number | null => {
  const rawSubcategory = Number(product.subcategory);
  if (Number.isFinite(rawSubcategory) && rawSubcategory > 0) return rawSubcategory;

  const bySlug = subcategories.find(
    (sub) =>
      sub.slug === product.subcategory_slug &&
      (!categoryId || Number(sub.category) === Number(categoryId))
  );
  if (bySlug) return bySlug.id;

  const byName = subcategories.find(
    (sub) =>
      sub.name === product.subcategory_name &&
      (!categoryId || Number(sub.category) === Number(categoryId))
  );
  return byName?.id ?? null;
};

const DIMENSION_SIZE_COLUMNS = [
  '2ft6 Small Single',
  '3ft Single',
  '4ft Small Double',
  '4ft6 Double',
  '5ft King',
  '6ft Super King',
];

const DEFAULT_DIMENSION_ROWS = [
  {
    measurement: 'Length',
    values: {
      '2ft6 Small Single': '190 cm (74.8")',
      '3ft Single': '190 cm (74.8")',
      '4ft Small Double': '190 cm (74.8")',
      '4ft6 Double': '190 cm (74.8")',
      '5ft King': '200 cm (78.7")',
      '6ft Super King': '200 cm (78.7")',
    },
  },
  {
    measurement: 'Width',
    values: {
      '2ft6 Small Single': '75 cm (30.0")',
      '3ft Single': '90 cm (35.4")',
      '4ft Small Double': '120 cm (47.2")',
      '4ft6 Double': '135 cm (53.1")',
      '5ft King': '150 cm (59.1")',
      '6ft Super King': '180 cm (70.9")',
    },
  },
  {
    measurement: 'Bed Height',
    values: {
      '2ft6 Small Single': '35 cm (13.8")',
      '3ft Single': '35 cm (13.8")',
      '4ft Small Double': '35 cm (13.8")',
      '4ft6 Double': '35 cm (13.8")',
      '5ft King': '35 cm (13.8")',
      '6ft Super King': '35 cm (13.8")',
    },
  },
];

const DIMENSION_MEASUREMENT_SUGGESTIONS = [
  'Length',
  'Width',
  'Bed Height',
];

const COMMON_COLORS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Brown', hex: '#92400E' },
  { name: 'Beige', hex: '#D4A574' },
  { name: 'Navy', hex: '#1E3A8A' },
  { name: 'Gold', hex: '#D97706' },
];

const productSchema = z.object({
    name: z.string().min(1, 'Title is required'),
    slug: z.string().optional(),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    short_description: z.string().min(1, 'Short description is required'),
    description: z.string().min(1, 'Long description is required'),
    category: z.number().min(1, 'Category is required'),
    subcategory: z.number().optional().nullable(),
    price: z.number().min(0, 'Price must be 0 or more'),
    original_price: z.number().nullable().optional(),
    discount_percentage: z.number().min(0).max(100).optional().nullable(),
    delivery_charges: z.number().min(0).optional().nullable(),
    sort_order: z.number().optional(),
    is_hidden: z.boolean().optional(),
    is_bestseller: z.boolean().optional(),
    is_new: z.boolean().optional(),
    show_size_icons: z.boolean().optional(),
    images: z
      .array(
        z.object({
          url: z.string().optional().nullable(),
          color_name: z.string().optional().nullable(),
          alt_text: z.string().optional().nullable(),
        })
      )
      .optional(),
    videos: z.array(z.object({ url: z.string().optional().nullable() })).optional(),
    colors: z.array(z.object({ name: z.string().optional(), hex_code: z.string().optional(), image_url: z.string().optional() })).optional(),
    sizes: z
      .array(
        z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          price_delta: z.number().optional(),
        })
      )
      .optional(),
    styles: z
      .array(
        z.object({
          name: z.string().optional(),
          icon_url: z.string().optional(),
          size: z.string().optional(),
          sizes: z.array(z.string()).optional(),
          is_shared: z.boolean().optional(),
          options: z
            .array(
              z.object({
                label: z.string().optional(),
                description: z.string().optional(),
                icon_url: z.string().optional(),
                price_delta: z.number().optional(),
                size: z.string().optional(),
                sizes: z.array(z.string()).optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
    fabrics: z
      .array(
        z.object({
          name: z.string().optional(),
          image_url: z.string().optional(),
          is_shared: z.boolean().optional(),
          colors: z
            .array(
              z.object({
                name: z.string().optional(),
                hex_code: z.string().optional(),
                image_url: z.string().optional(),
              })
            )
            .optional(),
        })
      )
      .optional(),
    mattresses: z
      .array(
        z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          image_url: z.string().optional(),
          price: z.number().nullable().optional(),
          enable_bunk_positions: z.boolean().optional(),
          price_top: z.number().nullable().optional(),
          price_bottom: z.number().nullable().optional(),
          price_both: z.number().nullable().optional(),
          source_product: z.number().nullable().optional(),
        })
      )
      .optional(),
    features: z.array(z.string()).optional(),
    dimensions: z
      .array(
        z.object({
          measurement: z.string().optional(),
          values: z.record(z.string(), z.string()).optional(),
        })
      )
      .optional(),
    dimension_images: z
      .array(
        z.object({
          size: z.string().optional(),
          url: z.string().optional(),
        })
      )
      .optional(),
    dimension_paragraph: z.string().optional(),
    show_dimensions_table: z.boolean().optional(),
    faqs: z
      .array(
        z.object({
          question: z.string().optional(),
          answer: z.string().optional(),
        })
      )
      .optional(),
    delivery_info: z.string().optional(),
    returns_guarantee: z.string().optional(),
    delivery_title: z.string().optional(),
    returns_title: z.string().optional(),
    custom_info_sections: z
      .array(
        z.object({
          title: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .optional(),
    filter_values: z
      .array(
        z.object({
          filter_option: z.number().optional().nullable(),
        })
      )
      .optional(),
  });

type ProductFormValues = z.infer<typeof productSchema>;

type StyleOptionInput = { label: string; description: string; icon_url?: string; price_delta?: number; size?: string; sizes?: string[] };
type StyleLibraryItem = {
  id: number;
  name: string;
  icon_url?: string;
  options: any[];
  is_shared?: boolean;
  product_id: number;
  product_name: string;
  product_slug: string;
};
const MAX_INLINE_SVG_CHARS = 50000;
const MAX_PRODUCT_PAYLOAD_BYTES = 2500000;

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(file);
  });

const minifySvgMarkup = (svg: string): string =>
  svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

const normalizeStyleOptions = (options: unknown, includeEmpty = false): StyleOptionInput[] => {
  if (!Array.isArray(options)) return [];
  return (
    options
      .map((option) => {
        if (typeof option === 'string') {
          const label = option.trim();
          if (!label) {
            return includeEmpty ? { label: '', description: '', icon_url: '' } : null;
          }
          return { label, description: '', icon_url: '' };
        }
        if (option && typeof option === 'object') {
          const rawLabel = (option as { label?: unknown; name?: unknown }).label ?? (option as { name?: unknown }).name;
          const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
          const rawDescription = (option as { description?: unknown }).description;
          const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
          const rawIcon = (option as { icon_url?: unknown }).icon_url;
          const icon_url = typeof rawIcon === 'string' ? rawIcon.trim() : '';
          const rawDelta = (option as { price_delta?: unknown }).price_delta;
          const price_delta = typeof rawDelta === 'number' ? rawDelta : Number(rawDelta || 0);
          const rawSize = (option as { size?: unknown }).size;
          const size = typeof rawSize === 'string' ? rawSize.trim() : '';
          const rawSizes = (option as { sizes?: unknown }).sizes;
          const sizes =
            Array.isArray(rawSizes)
              ? rawSizes
                  .map((s) => (typeof s === 'string' ? s.trim() : ''))
                  .filter(Boolean)
              : [];
          if (size && !sizes.includes(size)) sizes.push(size);
          if (!label && !includeEmpty) return null;
          return { label, description, icon_url, price_delta, size, sizes };
        }
        return null;
      })
      .filter(Boolean) as StyleOptionInput[]
  );
};

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Track whether filter selections changed so we don't wipe them on save
  const [filterValuesDirty, setFilterValuesDirty] = useState(false);
  const [mattressImportId, setMattressImportId] = useState('');
  const [importProductOptions, setImportProductOptions] = useState<Product[]>([]);
  const [selectedImportProductId, setSelectedImportProductId] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([]);
  const [categoryFilterOptions, setCategoryFilterOptions] = useState<FilterOption[]>([]);
  const [dimensionColumns, setDimensionColumns] = useState<string[]>(() => [...DIMENSION_SIZE_COLUMNS]);
  const [loadedProductCategory, setLoadedProductCategory] = useState<number | null>(null);
  const [loadedProductSubcategory, setLoadedProductSubcategory] = useState<number | null>(null);

  const { register, control, handleSubmit, formState: { errors }, setValue, watch } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      short_description: '',
      slug: '',
      meta_title: '',
      meta_description: '',
      images: [],
      videos: [],
      colors: [],
      sizes: [],
      styles: [],
      fabrics: [],
      mattresses: [],
      // allow bunk position selection per mattress when enabled
      is_bestseller: false,
      is_new: false,
      show_size_icons: true,
      discount_percentage: 0,
      delivery_charges: 0,
      sort_order: 0,
      is_hidden: false,
      features: [],
      dimensions: [],
      dimension_images: [],
      dimension_paragraph: '',
      show_dimensions_table: true,
      faqs: [],
      delivery_info: '',
      returns_guarantee: '',
      delivery_title: '',
      returns_title: '',
      custom_info_sections: [],
      filter_values: [],
    }
  });

  // Define watched values early for use in effects
  const selectedCategory = watch('category');
  const selectedSubcategory = watch('subcategory');
  const featuresValue = (watch('features') || []).join('\n');
  const availableSubcategories = subcategories.filter((s) => s.category === selectedCategory);
  const watchPrice = watch('price');
  const watchDiscount = watch('discount_percentage');
  const watchedStyles = watch('styles') || [];
  const hasWingbackHeadboard = watchedStyles.some((style) => {
    const nameMatch = (style?.name || '').toLowerCase().includes('wingback');
          const optionMatch = normalizeStyleOptions((style as { options?: unknown })?.options, false).some(
            (option) => (option.label || '').toLowerCase().includes('wingback')
          );
    return nameMatch || optionMatch;
  });
  const displayDiscountFactor =
    typeof watchDiscount === 'number' && !Number.isNaN(watchDiscount)
      ? 1 - watchDiscount / 100
      : null;
  const computedOriginalPriceDisplay =
    watchPrice && watchDiscount && watchDiscount > 0 && displayDiscountFactor && displayDiscountFactor > 0
      ? (watchPrice / displayDiscountFactor).toFixed(2)
      : '';

  const deriveDimensionColumnsFromRows = (rows: ProductDimensionRow[]) => {
    const columnSet = new Set<string>(DIMENSION_SIZE_COLUMNS);
    rows.forEach((row) => Object.keys(row.values || {}).forEach((key) => columnSet.add(key)));
    return Array.from(columnSet);
  };

  const adjustWidthForWingback = (rows: ProductDimensionRow[]): ProductDimensionRow[] => {
    if (!hasWingbackHeadboard) return rows;
    return rows.map((row) => {
      if ((row.measurement || '').toLowerCase() !== 'width') return row;
      const adjustedValues: Record<string, string> = {};
      Object.entries(row.values || {}).forEach(([size, rawValue]) => {
        const value = String(rawValue || '');
        const match = value.match(/(\d+(?:\.\d+)?)\s*cm\s*\((\d+(?:\.\d+)?)\s*\"?/i);
        if (match) {
          const cmValue = Number.parseFloat(match[1]);
          const newCm = Number((cmValue + 4).toFixed(1));
          const newInches = Number((newCm / 2.54).toFixed(1));
          adjustedValues[size] = `${newCm} cm (${newInches}")`;
        } else if (value.trim().length > 0) {
          adjustedValues[size] = value;
        } else {
          adjustedValues[size] = '';
        }
      });
      return { ...row, values: adjustedValues };
    });
  };

  const handleUploadColorImage = async (file: File, index: number) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setValue(`colors.${index}.image_url`, res.url);
      toast.success('Color image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const { fields: imageFields, append: appendImage, remove: removeImage, replace: replaceImages } = useFieldArray({
    control,
    name: "images"
  });

  const { fields: videoFields, append: appendVideo, remove: removeVideo, replace: replaceVideos } = useFieldArray({
    control,
    name: "videos"
  });

  const { fields: styleFields, append: appendStyle, remove: removeStyle, replace: replaceStyles } = useFieldArray({
    control,
    name: "styles"
  });
  // legacy importProductId no longer used (kept for compatibility if needed)
  const [styleLibrary, setStyleLibrary] = useState<StyleLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  const { fields: sizeFields, append: appendSize, remove: removeSize, replace: replaceSizes } = useFieldArray({
    control,
    name: "sizes"
  });

  const { fields: colorFields, append: appendColor, remove: removeColor, replace: replaceColors } = useFieldArray({
    control,
    name: "colors"
  });
  const colorFileInputRefs = useRef<HTMLInputElement[]>([]);

  const { fields: fabricFields, append: appendFabric, remove: removeFabric, replace: replaceFabrics } = useFieldArray({
    control,
    name: "fabrics"
  });

  const { fields: mattressFields, append: appendMattress, remove: removeMattress, replace: replaceMattresses } = useFieldArray({
    control,
    name: "mattresses"
  });

  const { fields: faqFields, append: appendFaq, remove: removeFaq, replace: replaceFaqs } = useFieldArray({
    control,
    name: "faqs"
  });

  const {
    fields: infoSectionFields,
    append: appendInfoSection,
    remove: removeInfoSection,
    replace: replaceInfoSections,
  } = useFieldArray({
    control,
    name: "custom_info_sections",
  });

  const {
    replace: replaceFilterValues,
  } = useFieldArray({
    control,
    name: "filter_values",
  });

  const {
    fields: dimensionFields,
    append: appendDimension,
    remove: removeDimension,
    replace: replaceDimensions,
  } = useFieldArray({
    control,
    name: "dimensions"
  });

  const {
    fields: dimensionImageFields,
    append: appendDimensionImage,
    remove: removeDimensionImage,
    replace: replaceDimensionImages,
  } = useFieldArray({
    control,
    name: "dimension_images",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, subs, products, _filters, options] = await Promise.all([
          apiGet<Category[]>('/categories/'),
          apiGet<SubCategory[]>('/subcategories/'),
          apiGet<Product[]>('/products/'),
          apiGet<FilterType[]>('/filter-types/'),
          apiGet<FilterOption[]>('/filter-options/'),
        ]);
        setCategories(cats);
        setSubcategories(subs);
        setImportProductOptions(Array.isArray(products) ? products : []);
        setFilterOptions((options || []).filter((opt) => opt.is_active !== false));
      } catch {
        toast.error('Failed to load categories');
      }
    };
    load();
  }, []);

  // Load filter options from the selected subcategory when present.
  // If the category has no subcategories, fall back to category-level filters.
  useEffect(() => {
    const loadCategoryFilters = async () => {
      if (!selectedCategory) {
        setCategoryFilterOptions([]);
        return;
      }

      const categoryId = Number(selectedCategory);
      const subcategoryId = Number(selectedSubcategory || 0);
      const hasSubcategories = subcategories.some((sub) => Number(sub.category) === categoryId);
      const filterQuery =
        hasSubcategories && subcategoryId > 0
          ? `/category-filters/?subcategory=${subcategoryId}`
          : !hasSubcategories
          ? `/category-filters/?category=${categoryId}`
          : '';

      if (!filterQuery) {
        setCategoryFilterOptions([]);
        return;
      }

      try {
        const [categoryAssignments, typesRes, optsRes] = await Promise.all([
          apiGet<CategoryFilter[]>(filterQuery),
          apiGet<FilterType[]>('/filter-types/'),
          apiGet<FilterOption[]>('/filter-options/'),
        ]);

        const activeTypes = (typesRes || []).filter((ft) => ft.is_active !== false);
        const activeTypeIds = new Set(activeTypes.map((ft) => ft.id));
        const assignedTypeIds = new Set(
          (categoryAssignments || [])
            .filter((assignment) => assignment.is_active !== false)
            .map((assignment) => Number(assignment.filter_type))
            .filter((id) => Number.isFinite(id) && id > 0)
        );

        setFilterOptions(
          (optsRes || []).filter(
            (opt) => opt.is_active !== false && (!opt.filter_type || activeTypeIds.has(opt.filter_type))
          )
        );

        const opts = activeTypes
          .filter((ft) => assignedTypeIds.has(Number(ft.id)))
          .flatMap((ft) =>
            (ft.options || [])
              .filter((opt) => opt.is_active !== false)
              .map((opt) => ({
                ...opt,
                filter_type: ft.id,
                filter_type_name: ft.name,
              }))
          );
        setCategoryFilterOptions(opts);
      } catch (err) {
        console.error('Failed to load category filters', err);
        setCategoryFilterOptions([]);
      }
    };
    loadCategoryFilters();
  }, [selectedCategory, selectedSubcategory, subcategories]);

  useEffect(() => {
    const loadLibrary = async () => {
      setIsLoadingLibrary(true);
      try {
        const styles = await apiGet<StyleLibraryItem[]>('/style-groups/');
        setStyleLibrary(styles);
      } catch {
        setStyleLibrary([]);
      } finally {
        setIsLoadingLibrary(false);
      }
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        const product = await apiGet<Product>(`/products/${id}/`);
        const resolvedCategoryId = resolveCategoryId(product, categories);
        const resolvedSubcategoryId = resolveSubcategoryId(product, subcategories, resolvedCategoryId);
        setLoadedProductCategory(resolvedCategoryId ?? null);
        setLoadedProductSubcategory(resolvedSubcategoryId ?? null);
        setValue('name', product.name);
        setValue('short_description', product.short_description || (product.description || '').split('. ')[0] || '');
        setValue('description', product.description);
        setValue('category', resolvedCategoryId ?? Number(product.category));
        setValue('subcategory', resolvedSubcategoryId);
        setValue('price', Number(product.price));

        // Ensure original_price is numeric to satisfy zod validation when editing
        const originalPrice =
          product.original_price !== null && product.original_price !== undefined
            ? Number(product.original_price)
            : null;
        setValue('original_price', Number.isFinite(originalPrice) ? originalPrice : null);
        const computedDiscount =
          product.original_price && product.price
            ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
            : 0;
        const discountPercentage = Number.isFinite(Number(product.discount_percentage))
          ? Number(product.discount_percentage)
          : computedDiscount ?? 0;
        setValue('discount_percentage', discountPercentage);
        setValue('delivery_charges', Number(product.delivery_charges) || 0);
        setValue('is_hidden', product.is_hidden === true);
        setValue('is_bestseller', product.is_bestseller);
        setValue('is_new', product.is_new);
        setValue('show_size_icons', product.show_size_icons !== false);
        setValue('sort_order', Number.isFinite(Number(product.sort_order)) ? Number(product.sort_order) : 0);
        setValue('slug', product.slug || '');
        setValue('meta_title', product.meta_title || '');
        setValue('meta_description', product.meta_description || '');
        const images = product.images.map((i) => ({ url: i.url, color_name: i.color_name || '', alt_text: i.alt_text || '' }));
        const videos = product.videos.map((v) => ({ url: v.url }));
        const colors = product.colors.map((c) => ({
          name: c.name,
          hex_code: c.hex_code || c.image || '#000000',
          image_url: c.image_url || '',
        }));
        const styles = product.styles.map((s) => ({
          name: s.name,
          icon_url: s.icon_url || '',
          is_shared: s.is_shared ?? false,
          options: normalizeStyleOptions(s.options).map((o, idx) => ({
            ...o,
            price_delta:
              typeof (s.options as any[])?.[idx]?.price_delta === 'number'
                ? Number((s.options as any[])?.[idx]?.price_delta)
                : Number(o.price_delta || 0),
            size: (s.options as any[])?.[idx]?.size || o.size || '',
            sizes: Array.isArray((s.options as any[])?.[idx]?.sizes)
              ? ((s.options as any[])?.[idx]?.sizes as any[])
                  .map((sz) => String(sz || '').trim())
                  .filter(Boolean)
              : o.sizes || [],
          })),
        }));
        const fabrics = (product.fabrics || []).map((f) => ({
          name: f.name,
          image_url: f.image_url,
          is_shared: f.is_shared ?? false,
          colors: f.colors || [],
        }));
        const mattresses = (product.mattresses || []).map((m) => ({
          name: m.name || '',
          description: m.description || '',
          image_url: m.image_url || '',
          price: m.price !== undefined && m.price !== null ? Number(m.price) : null,
          enable_bunk_positions: m.enable_bunk_positions ?? false,
          price_top: m.price_top !== undefined && m.price_top !== null ? Number(m.price_top) : null,
          price_bottom: m.price_bottom !== undefined && m.price_bottom !== null ? Number(m.price_bottom) : null,
          price_both: m.price_both !== undefined && m.price_both !== null ? Number(m.price_both) : null,
          source_product: m.source_product || null,
        }));
        const faqs = (product.faqs || []).map((faq) => ({
          question: (faq.question || '').trim(),
          answer: (faq.answer || '').trim(),
        }));
        const dimensions = (product.dimensions || []).map((row) => ({
          measurement: (row.measurement || '').trim(),
          values: row.values || {},
        }));
        const dimensionImages = (product.dimension_images || []).map((img) => ({
          size: (img.size || '').trim(),
          url: (img.url || '').trim(),
        }));
        setValue('dimension_paragraph', product.dimension_paragraph || '');
        setValue('dimension_images', dimensionImages);
        replaceDimensionImages(dimensionImages);
        setValue('show_dimensions_table', product.show_dimensions_table !== false);
        setDimensionColumns(deriveDimensionColumnsFromRows(dimensions));
        setValue('images', images);
        setValue('videos', videos);
        setValue('colors', colors);
        const sizes = product.sizes.map((s) => ({
          name: s.name,
          description: s.description || '',
          price_delta: Number(s.price_delta ?? 0),
        }));
        setValue('sizes', sizes);
        setValue('styles', styles);
        setValue('fabrics', fabrics);
        setValue('mattresses', mattresses);
        setValue('faqs', faqs);
        setValue('dimensions', dimensions);
        setValue('delivery_info', product.delivery_info || '');
        setValue('returns_guarantee', product.returns_guarantee || '');
        setValue('delivery_title', product.delivery_title || '');
        setValue('returns_title', product.returns_title || '');
        setValue('custom_info_sections', Array.isArray(product.custom_info_sections) ? product.custom_info_sections : []);
        const filterValuesFromFlatList = Array.isArray(product.filter_values)
          ? product.filter_values
              .map((fv) => ({
                filter_option: fv.filter_option_id || fv.filter_option || null,
              }))
              .filter((fv) => fv.filter_option)
          : [];
        const filterValuesFromGroupedFilters = Array.isArray(product.filters)
          ? product.filters
              .flatMap((group) => group.options || [])
              .map((opt) => ({
                filter_option: opt.id || null,
              }))
              .filter((fv) => fv.filter_option)
          : [];
        const filterValues =
          filterValuesFromFlatList.length > 0 ? filterValuesFromFlatList : filterValuesFromGroupedFilters;
        replaceFilterValues(filterValues);
        setFilterValuesDirty(false);
        replaceImages(images);
        replaceVideos(videos);
        replaceColors(colors);
        replaceSizes(sizes);
        replaceStyles(styles);
        replaceFabrics(fabrics);
        replaceMattresses(mattresses);
        replaceFaqs(faqs);
        replaceDimensions(dimensions);
        replaceInfoSections(Array.isArray(product.custom_info_sections) ? product.custom_info_sections : []);
        setValue('features', product.features || []);
        setValue('delivery_info', product.delivery_info || '');
        setValue('returns_guarantee', product.returns_guarantee || '');
      } catch {
        toast.error('Failed to load product');
      }
    };
    loadProduct();
  }, [id, categories, subcategories, setValue, replaceImages, replaceVideos, replaceColors, replaceSizes, replaceStyles, replaceFabrics, replaceMattresses, replaceFaqs, replaceDimensions, replaceInfoSections, replaceFilterValues]);

  useEffect(() => {
    if (!id) return;
    if (loadedProductCategory && Number(selectedCategory || 0) !== Number(loadedProductCategory)) {
      setValue('category', loadedProductCategory);
    }
    if (loadedProductSubcategory !== null && Number(selectedSubcategory || 0) !== Number(loadedProductSubcategory)) {
      setValue('subcategory', loadedProductSubcategory);
    }
  }, [id, loadedProductCategory, loadedProductSubcategory, selectedCategory, selectedSubcategory, setValue]);

  const handleUpload = async (file: File, onSuccess: (url: string) => void, inlineSvgPreferred = false) => {
    setIsUploading(true);
    try {
      if (inlineSvgPreferred && file.type === 'image/svg+xml') {
        const svgText = await readFileAsText(file);
        const minifiedSvg = minifySvgMarkup(svgText);
        const hasEmbeddedDataImage = /<image[\s\S]+?(href|xlink:href)\s*=\s*["']data:image\//i.test(minifiedSvg);
        if (minifiedSvg.length > MAX_INLINE_SVG_CHARS || hasEmbeddedDataImage) {
          const res = await apiUpload('/uploads/', file);
          onSuccess(res.url);
          toast.info('Large SVG stored as uploaded file to keep product payload small.');
        } else {
          onSuccess(minifiedSvg);
        }
      } else {
        const res = await apiUpload('/uploads/', file);
        onSuccess(res.url);
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDimensionColumn = (column: string) => {
    if (dimensionColumns.length <= 1) {
      toast.error('At least one size column is required.');
      return;
    }
    if (!confirm(`Remove the "${column}" column from the dimensions table?`)) return;
    const currentRows = (watch('dimensions') || []).map((row) => {
      const nextValues = { ...(row.values || {}) };
      delete nextValues[column];
      return { ...row, values: nextValues };
    });
    setDimensionColumns((cols) => cols.filter((c) => c !== column));
    setValue('dimensions', currentRows);
    replaceDimensions(currentRows);
  };

  const importStylesFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import styles');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const styles = (product.styles || []).map((s) => ({
        name: (s.name || '').replace(/\s+/g, '-'),
        icon_url: s.icon_url || '',
        is_shared: s.is_shared ?? false,
        options: (s.options || []).map((o: any) => ({
          label: typeof o === 'string' ? o.replace(/\s+/g, '-') : (o.label || '').replace(/\s+/g, '-'),
          description: o.description || '',
          icon_url: o.icon_url || '',
          price_delta: typeof o.price_delta === 'number' ? Number(o.price_delta) : 0,
          sizes: Array.isArray(o.sizes)
            ? o.sizes.map((s: any) => String(s || '').trim()).filter(Boolean)
            : o.size
            ? [String(o.size).trim()]
            : [],
        })),
      }));
      const merged = [...(watch('styles') || []), ...styles];
      setValue('styles', merged);
      replaceStyles(merged);
      toast.success(`Imported ${styles.length} style groups from ${product.name}`);
    } catch {
      toast.error('Failed to import styles from that product');
    }
  };

  const importSizesFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import sizes');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const sizes = (product.sizes || []).map((s) => ({
        name: s.name || '',
        description: s.description || '',
        price_delta: Number.isFinite(Number(s.price_delta)) ? Number(s.price_delta) : 0,
      }));
      const merged = [...(watch('sizes') || []), ...sizes];
      setValue('sizes', merged);
      replaceSizes(merged);
      toast.success(`Imported ${sizes.length} size${sizes.length === 1 ? '' : 's'} from ${product.name}`);
    } catch {
      toast.error('Failed to import sizes from that product');
    }
  };

  const importColorsFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import colors');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const colors = (product.colors || []).map((c) => ({
        name: c.name || '',
        hex_code: c.hex_code || '#000000',
        image_url: c.image_url || '',
      }));
      const merged = [...(watch('colors') || []), ...colors];
      setValue('colors', merged);
      replaceColors(merged);
      toast.success(`Imported ${colors.length} color${colors.length === 1 ? '' : 's'} from ${product.name}`);
    } catch {
      toast.error('Failed to import colors from that product');
    }
  };

  const importDimensionsFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import dimensions');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const dimensions = Array.isArray(product.dimensions)
        ? product.dimensions.map((row) => ({
            measurement: row.measurement || '',
            values: row.values || {},
          }))
        : [];
      const images = Array.isArray(product.dimension_images)
        ? product.dimension_images.map((img) => ({
            size: img.size || '',
            url: img.url || '',
          }))
        : [];

      setValue('dimensions', dimensions);
      replaceDimensions(dimensions);
      setDimensionColumns(deriveDimensionColumnsFromRows(dimensions));

      setValue('dimension_images', images);
      replaceDimensionImages(images);

      setValue('dimension_paragraph', product.dimension_paragraph || '');
      setValue('show_dimensions_table', product.show_dimensions_table !== false);

      toast.success(`Imported dimensions from ${product.name}`);
    } catch {
      toast.error('Failed to import dimensions from that product');
    }
  };

  const importFabricsFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import fabrics');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const fabrics = (product.fabrics || []).map((f) => ({
        name: f.name || '',
        image_url: f.image_url || '',
        is_shared: f.is_shared ?? false,
        colors: (f.colors || []).map((c) => ({
          name: c.name || '',
          hex_code: c.hex_code || '#000000',
          image_url: c.image_url || '',
        })),
      }));
      const merged = [...(watch('fabrics') || []), ...fabrics];
      setValue('fabrics', merged);
      replaceFabrics(merged);
      toast.success(`Imported ${fabrics.length} fabric${fabrics.length === 1 ? '' : 's'} from ${product.name}`);
    } catch {
      toast.error('Failed to import fabrics from that product');
    }
  };

  const importShortDescriptionFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import the short description');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const incoming = (product.short_description || '').trim();
      if (!incoming) {
        toast.error('Selected product has no short description to import');
        return;
      }
      const current = (watch('short_description') || '').trim();
      const merged = current ? `${current}\n\n${incoming}` : incoming;
      setValue('short_description', merged);
      toast.success(`Imported short description from ${product.name}`);
    } catch {
      toast.error('Failed to import short description from that product');
    }
  };

  const importLongDescriptionFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import the long description');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const incoming = (product.description || '').trim();
      if (!incoming) {
        toast.error('Selected product has no long description to import');
        return;
      }
      const current = (watch('description') || '').trim();
      const merged = current ? `${current}\n\n${incoming}` : incoming;
      setValue('description', merged);
      toast.success(`Imported long description from ${product.name}`);
    } catch {
      toast.error('Failed to import long description from that product');
    }
  };

  const importFaqsFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import FAQs');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const faqs = Array.isArray(product.faqs)
        ? product.faqs
            .map((faq) => ({
              question: (faq.question || '').trim(),
              answer: (faq.answer || '').trim(),
            }))
            .filter((faq) => faq.question && faq.answer)
        : [];

      if (faqs.length === 0) {
        toast.error('Selected product has no FAQs to import');
        return;
      }

      const existing = (watch('faqs') || []).map((faq) => ({
        question: (faq.question || '').trim(),
        answer: (faq.answer || '').trim(),
      }));

      const deduped = faqs.filter(
        (faq) =>
          !existing.some(
            (e) =>
              e.question.toLowerCase() === faq.question.toLowerCase() &&
              e.answer.toLowerCase() === faq.answer.toLowerCase()
          )
      );

      const merged = [...existing, ...deduped];
      setValue('faqs', merged);
      replaceFaqs(merged);
      toast.success(`Imported ${deduped.length} FAQ${deduped.length === 1 ? '' : 's'} from ${product.name}`);
    } catch {
      toast.error('Failed to import FAQs from that product');
    }
  };

  const importDeliveryInfoFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import delivery info');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const deliveryInfo = (product.delivery_info || '').trim();

      if (!deliveryInfo) {
        toast.error('Selected product has no delivery info to import');
        return;
      }

      const current = (watch('delivery_info') || '').trim();
      const merged = current ? `${current}\n\n${deliveryInfo}` : deliveryInfo;
      setValue('delivery_info', merged);
      toast.success(`Imported delivery info from ${product.name}`);
    } catch {
      toast.error('Failed to import delivery info from that product');
    }
  };

  const importReturnsInfoFromProduct = async () => {
    if (!selectedImportProductId) {
      toast.error('Select a product to import returns & guarantee info');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${selectedImportProductId}/`);
      const returnsInfo = (product.returns_guarantee || '').trim();

      if (!returnsInfo) {
        toast.error('Selected product has no returns/guarantee info to import');
        return;
      }

      const current = (watch('returns_guarantee') || '').trim();
      const merged = current ? `${current}\n\n${returnsInfo}` : returnsInfo;
      setValue('returns_guarantee', merged);
      toast.success(`Imported returns & guarantee info from ${product.name}`);
    } catch {
      toast.error('Failed to import returns/guarantee info from that product');
    }
  };

  const importMattressesFromProduct = async () => {
    const pid = mattressImportId.trim();
    if (!pid) {
      toast.error('Enter a product ID to import mattresses');
      return;
    }
    try {
      const product = await apiGet<Product>(`/products/${pid}/`);
      const mattresses = (product.mattresses || []).map((m) => ({
        name: m.name || '',
        description: m.description || '',
        image_url: m.image_url || '',
        price: m.price !== undefined && m.price !== null ? Number(m.price) : null,
        source_product: m.source_product || product.id,
      }));
      const merged = [...(watch('mattresses') || []), ...mattresses];
      setValue('mattresses', merged);
      replaceMattresses(merged);
      toast.success(`Imported ${mattresses.length} mattress option${mattresses.length === 1 ? '' : 's'} from product #${pid}`);
    } catch {
      toast.error('Failed to import mattresses from that product');
    }
  };

  const handleMultiImageUpload = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await Promise.all(files.map((file) => apiUpload('/uploads/', file)));
      uploaded.forEach((res) => appendImage({ url: res.url, alt_text: '' }));
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch {
      toast.error('Some images failed to upload');
    } finally {
      setIsUploading(false);
    }
  };

  const onInvalid = (formErrors: FieldErrors<ProductFormValues>) => {
    const firstError =
      formErrors.name?.message ||
      formErrors.short_description?.message ||
      formErrors.description?.message ||
      formErrors.category?.message ||
      formErrors.price?.message ||
      formErrors.images?.message;
    toast.error(firstError ? String(firstError) : 'Please fix the highlighted fields.');
  };

  const onSubmit = async (data: ProductFormValues) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const discountPercentage =
        typeof data.discount_percentage === 'number' && !Number.isNaN(data.discount_percentage)
          ? data.discount_percentage
          : 0;
      const discountFactor = 1 - discountPercentage / 100;
      if (discountPercentage >= 100 || discountFactor <= 0) {
        toast.error('Discount must be less than 100%');
        return;
      }
      // Preserve existing original price while still supporting auto-compute when a discount is set
      const computedOriginalPriceRaw =
        discountPercentage > 0
          ? Number((data.price / discountFactor).toFixed(2))
          : (data.original_price ?? null);
      const computedOriginalPrice = Number.isFinite(computedOriginalPriceRaw) ? computedOriginalPriceRaw : null;
      const payload: ProductFormValues = {
        ...data,
        slug: (data.slug || '').trim(),
        meta_title: (data.meta_title || '').trim(),
        meta_description: (data.meta_description || '').trim(),
        category:
          Number.isFinite(Number(data.category)) && Number(data.category) > 0
            ? Number(data.category)
            : loadedProductCategory || 0,
        subcategory: Number.isFinite(Number(data.subcategory)) && Number(data.subcategory) > 0
          ? Number(data.subcategory)
          : loadedProductSubcategory ?? null,
        price: Number.isFinite(data.price) ? data.price : 0,
        delivery_charges: Number.isFinite(data.delivery_charges ?? null)
          ? Number(data.delivery_charges)
          : 0,
        is_hidden: data.is_hidden === true,
        show_size_icons: data.show_size_icons !== false,
        sort_order: Number.isFinite(data.sort_order) ? Number(data.sort_order) : 0,
        short_description: data.short_description.trim(),
        description: data.description.trim(),
        discount_percentage: Number.isFinite(discountPercentage) ? discountPercentage : 0,
        original_price: Number.isFinite(computedOriginalPrice) ? computedOriginalPrice : null,
        images: (data.images || [])
          .map((img) => ({
            url: (img.url || '').trim(),
            color_name: (img.color_name || '').trim(),
            alt_text: (img.alt_text || '').trim(),
          }))
          .filter((img) => img.url.length > 0),
        videos: (data.videos || []).filter((vid) => (vid.url || '').trim().length > 0),
        colors: (data.colors || [])
          .map((col) => ({
            name: (col.name || '').trim(),
            hex_code: (col.hex_code || '#000000').trim(),
            image_url: (col.image_url || '').trim(),
          }))
          .filter((col) => col.name.length > 0),
        sizes: (data.sizes || [])
          .map((s) => ({
            name: (s.name || '').trim(),
            description: (s.description || '').trim(),
            price_delta: Number.isFinite(Number(s.price_delta)) ? Number(s.price_delta) : 0,
          }))
          .filter((s) => s.name.length > 0),
        styles: (data.styles || [])
          .map((style) => {
            const name = (style.name || '').trim();
            const options = (style.options || [])
              .map((option) => {
                const label = (option.label || '').trim();
                const sizes = Array.isArray(option.sizes)
                  ? option.sizes.map((s) => String(s || '').trim()).filter(Boolean)
                  : [];
                return {
                  label,
                  description: (option.description || '').trim(),
                  icon_url: (option.icon_url || '').trim(),
                  price_delta: Number.isFinite(Number(option.price_delta))
                    ? Number(option.price_delta)
                    : 0,
                  size: (option.size || '').trim(),
                  sizes,
                };
              })
              .filter((option) => option.label.length > 0);
            return {
              name,
              icon_url: (style.icon_url || '').trim(),
              options,
              is_shared: Boolean(style.is_shared),
            };
          })
          .filter((style) => style.name.length > 0),
        fabrics: (data.fabrics || [])
          .map((fabric) => ({
            name: (fabric.name || '').trim(),
            image_url: (fabric.image_url || '').trim(),
            is_shared: Boolean(fabric.is_shared),
            colors: (fabric.colors || [])
              .map((c) => ({
                name: (c.name || '').trim(),
                hex_code: (c.hex_code || '').trim(),
                image_url: (c.image_url || '').trim(),
              }))
              .filter((c) => c.image_url.length > 0),
          }))
          .filter((fabric) => fabric.name.length > 0 && (fabric.colors?.length || 0) > 0),
        mattresses: (data.mattresses || [])
          .map((m) => ({
            name: (m.name || '').trim(),
            description: (m.description || '').trim(),
            image_url: (m.image_url || '').trim(),
            enable_bunk_positions: Boolean(m.enable_bunk_positions),
            price_top: (() => {
              const raw = (m as { price_top?: unknown })?.price_top;
              if (raw === null || raw === undefined || raw === '') return null;
              const num = Number(raw as any);
              return Number.isFinite(num) ? num : null;
            })(),
            price_bottom: (() => {
              const raw = (m as { price_bottom?: unknown })?.price_bottom;
              if (raw === null || raw === undefined || raw === '') return null;
              const num = Number(raw as any);
              return Number.isFinite(num) ? num : null;
            })(),
            price_both: (() => {
              const raw = (m as { price_both?: unknown })?.price_both;
              if (raw === null || raw === undefined || raw === '') return null;
              const num = Number(raw as any);
              return Number.isFinite(num) ? num : null;
            })(),
            price: (() => {
              const raw = (m as { price?: unknown })?.price;
              if (raw === null || raw === undefined || raw === '') return null;
              const num = Number(raw as any);
              return Number.isFinite(num) ? num : null;
            })(),
            source_product: m.source_product ? Number(m.source_product) : null,
          }))
          .filter((m) => (m.name?.length || 0) > 0 || (m.description?.length || 0) > 0 || !!m.image_url || Number.isFinite(m.price)),
        features: (data.features || []).map((f) => f.trim()).filter(Boolean),
        dimensions: (data.dimensions || [])
          .map((row) => {
            const measurement = (row.measurement || '').trim();
            const values = Object.fromEntries(
              Object.entries(row.values || {})
                .map(([key, value]) => {
                  const str = (value ?? '').toString().trim();
                  return [key, str];
                })
                .filter(([, str]) => str.length > 0)
            );
            return { measurement, values };
          })
          .filter(
            (row) =>
              row.measurement.length > 0 &&
              Object.values(row.values).some((value) => (value as string).length > 0)
          ),
        dimension_images: (data.dimension_images || [])
          .map((img) => ({
            size: (img.size || '').trim(),
            url: (img.url || '').trim(),
          }))
          .filter((img) => img.size.length > 0 && img.url.length > 0),
        dimension_paragraph: (data.dimension_paragraph || '').trim(),
        show_dimensions_table: data.show_dimensions_table !== false,
        faqs: (data.faqs || [])
          .map((faq) => ({
            question: (faq.question || '').trim(),
            answer: (faq.answer || '').trim(),
          }))
          .filter((faq) => faq.question.length > 0 && faq.answer.length > 0),
        delivery_info: data.delivery_info?.trim() || '',
        returns_guarantee: data.returns_guarantee?.trim() || '',
        delivery_title: (data.delivery_title || '').trim(),
        returns_title: (data.returns_title || '').trim(),
        custom_info_sections: (data.custom_info_sections || [])
          .map((section) => ({
            title: (section?.title || '').trim(),
            content: (section?.content || '').trim(),
          }))
          .filter((section) => section.title || section.content),
        filter_values: (data.filter_values || [])
          .map((fv) => {
            const id = Number(fv.filter_option);
            return Number.isFinite(id) && id > 0 ? { filter_option: id } : null;
          })
          .filter(Boolean) as { filter_option: number }[],
      };
      if (!payload.images || payload.images.length === 0) {
        if (isEditing) {
          delete (payload as Partial<ProductFormValues>).images;
        } else {
          payload.images = [];
        }
      }
      if (!payload.videos || payload.videos.length === 0) {
        delete (payload as Partial<ProductFormValues>).videos;
      }
      if (!payload.colors || payload.colors.length === 0) {
        delete (payload as Partial<ProductFormValues>).colors;
      }
      if (!payload.sizes || payload.sizes.length === 0) {
        delete (payload as Partial<ProductFormValues>).sizes;
      }
      if (!payload.styles || payload.styles.length === 0) {
        delete (payload as Partial<ProductFormValues>).styles;
      }
      if (!payload.fabrics || payload.fabrics.length === 0) {
        delete (payload as Partial<ProductFormValues>).fabrics;
      }
      if (!payload.mattresses || payload.mattresses.length === 0) {
        delete (payload as Partial<ProductFormValues>).mattresses;
      }
      if (!payload.features || payload.features.length === 0) {
        delete (payload as Partial<ProductFormValues>).features;
      }
      if (!payload.dimensions || payload.dimensions.length === 0) {
        delete (payload as Partial<ProductFormValues>).dimensions;
      }
      // Avoid wiping existing dimension images when editing if none are provided in the form payload.
      if (isEditing && (!payload.dimension_images || payload.dimension_images.length === 0)) {
        delete (payload as Partial<ProductFormValues>).dimension_images;
      }
      if (!payload.faqs || payload.faqs.length === 0) {
        delete (payload as Partial<ProductFormValues>).faqs;
      }

      // Preserve existing filters when editing unless the user changed/cleared them.
      if (isEditing && !filterValuesDirty && (!payload.filter_values || payload.filter_values.length === 0)) {
        delete (payload as Partial<ProductFormValues>).filter_values;
      }

      const payloadSize = new Blob([JSON.stringify(payload)]).size;
      if (payloadSize > MAX_PRODUCT_PAYLOAD_BYTES) {
        toast.error('Product data is too large. Please upload large icons/files instead of pasting huge SVG content.');
        return;
      }

      if (id) {
        await apiPut(`/products/${id}/`, payload);
        toast.success('Product updated successfully');
      } else {
        await apiPost<{ id: number }>('/products/', payload);
        toast.success('Product created successfully');
      }

      navigate('/products');
    } catch {
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center space-x-4">
        <Link to="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-3xl font-serif font-bold text-espresso">
          {id ? 'Edit Product' : 'Add New Product'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        {Object.keys(errors).length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Please fix the highlighted fields:</p>
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(errors).map(([key, value]) => (
                <li key={key}>
                  {key}: {String((value as { message?: string })?.message || 'Invalid')}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Product Title *</label>
                <Input {...register('name')} placeholder="e.g. Cambridge Divan Bed" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">URL Slug</label>
                <Input {...register('slug')} maxLength={255} placeholder="e.g. cambridge-divan-bed" />
                <p className="text-[11px] text-muted-foreground">Leave blank to auto-generate from the product title. Max 255 characters.</p>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Title</label>
                <Input {...register('meta_title')} placeholder="Optional SEO title" />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Meta Description</label>
                <textarea
                  {...register('meta_description')}
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optional SEO description"
                />
              </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Short Description *</label>
              <textarea 
                {...register('short_description')} 
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Short summary shown under product name..."
              />
              {errors.short_description && <p className="text-xs text-destructive">{errors.short_description.message}</p>}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Long Description *</label>
              <textarea 
                {...register('description')} 
                className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Full detailed description shown at the bottom..."
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                <label className="text-sm font-medium">Category *</label>
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  {...register('category', {
                    setValueAs: (value) => (value === '' ? undefined : Number(value)),
                  })}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Subcategory</label>
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  {...register('subcategory', {
                    setValueAs: (value) => (value === '' ? null : Number(value)),
                  })}
                >
                  <option value="">None</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Price (Â£) *</label>
                <Input type="number" {...register('price', { valueAsNumber: true })} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Discount (%)</label>
                <Input
                  type="number"
                  {...register('discount_percentage', { valueAsNumber: true })}
                  placeholder="e.g. 20"
                  min="0"
                  max="99"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Display Order</label>
                <Input
                  type="number"
                  {...register('sort_order', {
                    setValueAs: (value) => {
                      const n = Number(value);
                      return Number.isNaN(n) ? 0 : n;
                    },
                  })}
                  placeholder="1 = first, 2 = second, 0 = unsorted"
                />
                <p className="text-[11px] text-muted-foreground">Use 1 for first position. Leave 0 to place the product after manually ordered items.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_hidden"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="is_hidden"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                />
                <label htmlFor="is_hidden" className="text-sm font-medium cursor-pointer">Hide from storefront</label>
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_bestseller"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="is_bestseller"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                />
                <label htmlFor="is_bestseller" className="text-sm font-medium cursor-pointer">Mark as Best Seller</label>
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_new"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="is_new"
                      checked={!!field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                />
                <label htmlFor="is_new" className="text-sm font-medium cursor-pointer">Mark as New</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Delivery Charges (Â£)</label>
                <Input type="number" {...register('delivery_charges', { valueAsNumber: true })} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Original Price (auto)</label>
                <Input
                  type="text"
                  value={computedOriginalPriceDisplay}
                  readOnly
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Media (Images & Videos)</CardTitle>
            <div className="space-x-2">
              <Input
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleMultiImageUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="inline-flex w-64 cursor-pointer bg-black/5"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => appendImage({ url: '', alt_text: '' })}>
                <Plus className="h-4 w-4 mr-2" /> Add Image
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => appendVideo({ url: '' })}>
                <Plus className="h-4 w-4 mr-2" /> Add Video
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Images (Optional)</label>
              {imageFields.map((field, index) => {
                const swatchColors = (watch('colors') || []).map((c) => c.name).filter(Boolean);
                const fabricColors = (watch('fabrics') || [])
                  .flatMap((f) => (f?.colors || []).map((c: any) => c?.name).filter(Boolean));
                const colorOptions = Array.from(new Set([...swatchColors, ...fabricColors]));
                return (
                <div key={field.id} className="space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      type="file"
                      accept={IMAGE_UPLOAD_ACCEPT}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUpload(file, (url) => setValue(`images.${index}.url`, url));
                        }
                      }}
                      className="cursor-pointer bg-black/5"
                    />
                    {index > 0 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {watch(`images.${index}.url`) && (
                    <img src={watch(`images.${index}.url`) || undefined} alt={`Preview ${index + 1}`} className="w-32 h-32 object-cover rounded-md border" />
                  )}
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Image ALT text</label>
                    <Input
                      value={watch(`images.${index}.alt_text`) || ''}
                      onChange={(e) => setValue(`images.${index}.alt_text`, e.target.value)}
                      placeholder="Describe this image for SEO/accessibility"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Optional: bind to color</label>
                    <select
                      className="w-56 rounded-md border border-input bg-white px-2 py-1 text-sm"
                      value={watch(`images.${index}.color_name`) || ''}
                      onChange={(e) => setValue(`images.${index}.color_name`, e.target.value)}
                    >
                      <option value="">No color binding</option>
                      {colorOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground">If set, this image shows when that color is selected on the storefront.</p>
                  </div>
                </div>
              )})}
              {errors.images && <p className="text-xs text-destructive">{errors.images.message}</p>}
              {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Product Videos (Optional)</label>
              {videoFields.map((field, index) => (
                <div key={field.id} className="space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUpload(file, (url) => setValue(`videos.${index}.url`, url));
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeVideo(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {watch(`videos.${index}.url`) && (
                    <video src={watch(`videos.${index}.url`) || undefined} controls className="w-64 h-40 rounded-md border" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Variants</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoadingLibrary}
                  onChange={(e) => {
                    const styleId = Number(e.target.value || 0);
                    if (!styleId) return;
                    const found = styleLibrary.find((s) => s.id === styleId);
                    if (!found) return;
                    const newStyle = {
                      name: (found.name || '').replace(/\s+/g, '-'),
                      icon_url: found.icon_url || '',
                      is_shared: found.is_shared ?? false,
                      options: (found.options || []).map((o: any) => ({
                        label: typeof o === 'string' ? o.replace(/\s+/g, '-') : (o.label || '').replace(/\s+/g, '-'),
                        description: o.description || '',
                        icon_url: o.icon_url || '',
                        price_delta: typeof o.price_delta === 'number' ? Number(o.price_delta) : 0,
                        sizes: Array.isArray(o.sizes)
                          ? o.sizes.map((s: any) => String(s || '').trim()).filter(Boolean)
                          : o.size
                          ? [String(o.size).trim()]
                          : [],
                      })),
                    };
                    const merged = [...(watch('styles') || []), newStyle];
                    setValue('styles', merged);
                    replaceStyles(merged);
                    e.target.value = '';
                    toast.success('Style group added from library');
                  }}
                >
                  <option value="">{isLoadingLibrary ? 'Loading styles...' : 'Add from library'}</option>
                  {styleLibrary.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (#{s.product_id} - {s.product_name})
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedImportProductId ?? ''}
                  onChange={(e) => setSelectedImportProductId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select product to import from</option>
                  {importProductOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (#{p.id})
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={importStylesFromProduct}>
                  Import styles
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importSizesFromProduct}>
                  Import sizes
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importColorsFromProduct}>
                  Import colors
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importFabricsFromProduct}>
                  Import fabrics
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importShortDescriptionFromProduct}>
                  Import short desc
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importLongDescriptionFromProduct}>
                  Import long desc
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importDimensionsFromProduct}>
                  Import dimensions
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importFaqsFromProduct}>
                  Import FAQs
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importDeliveryInfoFromProduct}>
                  Import delivery info
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={importReturnsInfoFromProduct}>
                  Import returns/guarantee
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => appendStyle({ name: '', options: [] })}>
                  <Plus className="h-4 w-4 mr-2" /> Add Style Group
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Sizes</label>
                <Button type="button" variant="outline" size="sm" onClick={() => appendSize({ name: '', description: '', price_delta: 0 })}>
                  <Plus className="h-4 w-4 mr-2" /> Add Size
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  name="show_size_icons"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="show_size_icons"
                      checked={field.value !== false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  )}
                />
                <label htmlFor="show_size_icons" className="text-sm font-medium cursor-pointer">
                  Show icons next to size options
                </label>
              </div>
              <div className="space-y-2">
                {sizeFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2">
                    <Input
                      className="col-span-4"
                      {...register(`sizes.${index}.name` as const)}
                      placeholder="Size name (e.g. Small Double)"
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.01"
                      {...register(`sizes.${index}.price_delta` as const, { valueAsNumber: true })}
                      placeholder="Price delta (e.g. 90)"
                    />
                    <Input
                      className="col-span-4"
                      {...register(`sizes.${index}.description` as const)}
                      placeholder="Size description (optional)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeSize(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Colors</label>
              {colorFields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={
                          COMMON_COLORS.find(c => c.hex.toLowerCase() === (watch(`colors.${index}.hex_code`) as string)?.toLowerCase())?.name || ''
                        }
                        onChange={(e) => {
                          const selectedColor = COMMON_COLORS.find(c => c.name === e.target.value);
                          if (selectedColor) {
                            setValue(`colors.${index}.name`, selectedColor.name);
                            setValue(`colors.${index}.hex_code`, selectedColor.hex);
                          }
                        }}
                        className="flex-1 px-3 py-2 border rounded-md bg-white text-sm h-10"
                      >
                        <option value="">Select common color</option>
                        {COMMON_COLORS.map((color) => (
                          <option key={color.name} value={color.name}>
                            {color.name}
                          </option>
                        ))}
                  </select>
                  <Input
                    type="color"
                    value={watch(`colors.${index}.hex_code`) || '#000000'}
                    onChange={(e) => {
                          const name = watch(`colors.${index}.name`);
                          const commonColor = COMMON_COLORS.find(c => c.hex.toLowerCase() === e.target.value.toLowerCase());
                          setValue(`colors.${index}.hex_code`, e.target.value);
                          if (!name && commonColor) {
                            setValue(`colors.${index}.name`, commonColor.name);
                          } else if (!name) {
                            setValue(`colors.${index}.name`, e.target.value);
                          }
                        }}
                        className="w-12 h-10 p-1 rounded-md border cursor-pointer"
                      />
                    </div>
                  <Input
                    {...register(`colors.${index}.name` as const)}
                    placeholder="Custom color name (optional)"
                    className="text-sm"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        {...register(`colors.${index}.image_url` as const)}
                        placeholder="Image URL (optional; overrides swatch color)"
                        className="text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => colorFileInputRefs.current[index]?.click()}
                      >
                        Choose file
                      </Button>
                    </div>
                    <input
                      type="file"
                      accept={IMAGE_UPLOAD_ACCEPT}
                      className="hidden"
                      ref={(el) => {
                        if (el) colorFileInputRefs.current[index] = el;
                      }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadColorImage(file, index);
                      }}
                    />
                    {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeColor(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendColor({ name: '', hex_code: '#000000', image_url: '' })}>
                <Plus className="h-4 w-4 mr-2" /> Add Color
              </Button>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Fabrics</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendFabric({
                        name: '',
                        is_shared: false,
                        colors: [{ name: '', hex_code: '', image_url: '' }],
                      })
                    }
                  >
                  <Plus className="h-4 w-4 mr-2" /> Add Fabric
                </Button>
              </div>
              {fabricFields.map((field, index) => (
                <div key={field.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex gap-2">
                    <Input
                      {...register(`fabrics.${index}.name` as const)}
                      placeholder="Fabric name (e.g. Plush Velvet)"
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFabric(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...register(`fabrics.${index}.is_shared` as const)}
                      className="h-4 w-4"
                    />
                    Shared across sizes
                  </label>
                  <div className="space-y-2 rounded-md border border-dashed p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Fabric colours</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                          setValue(`fabrics.${index}.colors`, [
                            ...current,
                            { name: '', hex_code: '', image_url: '' },
                          ]);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add colour
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add one or more colours for this fabric. Upload the image against each colour (fabric image not required).
                    </p>
                    <div className="space-y-2">
                      {((watch(`fabrics.${index}.colors`) || []) as any[]).map((color, colorIdx) => (
                        <div
                          key={`${field.id}-color-${colorIdx}`}
                          className="space-y-2 rounded-md border border-muted/60 p-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-12 overflow-hidden rounded-md border">
                              {color.image_url ? (
                                <img
                                  src={color.image_url}
                                  alt={color.name || 'Colour preview'}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div
                                  className="h-full w-full"
                                  style={{ backgroundColor: color.hex_code || '#000000' }}
                                />
                              )}
                              {color.name && (
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow-sm text-center px-1">
                                  {color.name}
                                </span>
                              )}
                            </div>
                          <input
                            type="color"
                            value={color.hex_code || '#d1d5db'}
                            onChange={(e) => {
                              const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                              current[colorIdx] = { ...current[colorIdx], hex_code: e.target.value };
                              setValue(`fabrics.${index}.colors`, current);
                            }}
                            className="h-10 w-12 rounded"
                          />
                            <Input
                              value={color.name || ''}
                              onChange={(e) => {
                                const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                                current[colorIdx] = { ...current[colorIdx], name: e.target.value };
                                setValue(`fabrics.${index}.colors`, current);
                              }}
                              placeholder="Colour name"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                                setValue(
                                  `fabrics.${index}.colors`,
                                  current.filter((_, idx) => idx !== colorIdx)
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row">
                            <Input
                              type="file"
                              accept={IMAGE_UPLOAD_ACCEPT}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) => {
                                    const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                                    current[colorIdx] = { ...current[colorIdx], image_url: url };
                                    setValue(`fabrics.${index}.colors`, current);
                                  });
                                }
                              }}
                              className="cursor-pointer bg-black/5 md:flex-1"
                            />
                            <Input
                              value={color.image_url || ''}
                              onChange={(e) => {
                                const current = (watch(`fabrics.${index}.colors`) || []) as any[];
                                current[colorIdx] = { ...current[colorIdx], image_url: e.target.value };
                                setValue(`fabrics.${index}.colors`, current);
                              }}
                              placeholder="Image URL for this colour"
                              className="md:flex-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium">Mattress options</label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={mattressImportId}
                    onChange={(e) => setMattressImportId(e.target.value)}
                    placeholder="Import from product ID"
                    className="w-44"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={importMattressesFromProduct}>
                    Import
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendMattress({
                        name: '',
                        description: '',
                        image_url: '',
                        price: null,
                        source_product: null,
                        enable_bunk_positions: false,
                        price_top: null,
                        price_bottom: null,
                        price_both: null,
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Mattress
                  </Button>
                </div>
              </div>
              {mattressFields.length === 0 && (
                <p className="text-xs text-muted-foreground">Optional: add mattresses that can be reused by other products.</p>
              )}
              <div className="space-y-3">
                {mattressFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-md border p-3 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={() => removeMattress(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        {...register(`mattresses.${index}.name` as const)}
                        placeholder="Mattress name (e.g. Winwood Mattress)"
                        className="col-span-1"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`mattresses.${index}.price` as const, {
                          setValueAs: (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
                        })}
                        placeholder="Price (optional)"
                        className="col-span-1"
                      />
                      <Input
                        {...register(`mattresses.${index}.source_product` as const, {
                          setValueAs: (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
                        })}
                        placeholder="Source product ID (optional)"
                        className="col-span-1"
                      />
                      <Input
                        type="file"
                        accept={IMAGE_UPLOAD_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUpload(file, (url) => setValue(`mattresses.${index}.image_url`, url));
                          }
                        }}
                        className="col-span-1 cursor-pointer bg-black/5"
                      />
                      <label className="col-span-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(watch(`mattresses.${index}.enable_bunk_positions`))}
                          onChange={(e) => setValue(`mattresses.${index}.enable_bunk_positions`, e.target.checked)}
                        />
                        Allow bunk selection (Top / Bottom) for this mattress.
                      </label>
                      {watch(`mattresses.${index}.enable_bunk_positions`) && (
                        <div className="col-span-2 grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`mattresses.${index}.price_top` as const, {
                              setValueAs: (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
                            })}
                            placeholder="Top price (£)"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            {...register(`mattresses.${index}.price_bottom` as const, {
                              setValueAs: (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
                            })}
                            placeholder="Bottom price (£)"
                          />
                        </div>
                      )}
                    </div>
                    {watch(`mattresses.${index}.image_url`) && (
                      <img
                        src={watch(`mattresses.${index}.image_url`) || undefined}
                        alt={watch(`mattresses.${index}.name`) || `Mattress ${index + 1}`}
                        className="h-24 w-24 rounded-md border object-cover"
                      />
                    )}
                    <textarea
                      {...register(`mattresses.${index}.description` as const)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Description / tension / springs (optional)"
                    />
                    <Input
                      {...register(`mattresses.${index}.image_url` as const)}
                      placeholder="Image URL (optional)"
                    />
                  </div>
                ))}
              </div>
            </div>

            {styleFields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-md space-y-4 relative">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => removeStyle(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Style Name (e.g. Headboard Style)</label>
                  <Input
                    {...register(`styles.${index}.name` as const)}
                    placeholder="Style group name"
                    onChange={(e) => {
                      // Allow natural text (spaces, quotes, inches)
                      setValue(`styles.${index}.name`, e.target.value);
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Group Icon URL (SVG/PNG/WebP)</label>
                  <div className="flex gap-2">
                    <Input {...register(`styles.${index}.icon_url` as const)} placeholder="URL or inline SVG markup" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = ICON_UPLOAD_ACCEPT;
                        fileInput.onchange = async () => {
                          const file = fileInput.files?.[0];
                          if (!file) return;
                          await handleUpload(file, (url) => setValue(`styles.${index}.icon_url`, url), true);
                        };
                        fileInput.click();
                      }}
                    >
                      Upload
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{WEBP_UPLOAD_HINT}</p>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Options</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                        setValue(`styles.${index}.options`, [...current, { label: '', description: '', icon_url: '' }]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {normalizeStyleOptions(watch(`styles.${index}.options`), true).map((option, optionIndex) => (
                      <div key={`${field.id}-option-${optionIndex}`} className="grid grid-cols-12 gap-2 items-start">
                    <Input
                      className="col-span-3"
                      placeholder='Option title (e.g. 2 drawers or 54" Floorstanding)'
                      value={option.label}
                      onChange={(e) => {
                        const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                        current[optionIndex] = { ...current[optionIndex], label: e.target.value };
                        setValue(`styles.${index}.options`, current);
                      }}
                    />
                        <Input
                          className="col-span-3"
                          placeholder="Description (e.g. choose left or right)"
                          value={option.description || ''}
                          onChange={(e) => {
                            const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                            current[optionIndex] = { ...current[optionIndex], description: e.target.value };
                            setValue(`styles.${index}.options`, current);
                          }}
                        />
                        <div className="col-span-2">
                          <div className="flex flex-wrap gap-1">
                            {(watch('sizes') || []).map((s, idx) => {
                              const val = s.name || `Size ${idx + 1}`;
                              const current = option.sizes || (option.size ? [option.size] : []);
                              const checked = current.includes(val);
                              return (
                                <label key={`${val}-${idx}`} className="flex items-center gap-1 text-[12px]">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                                      const sizes = (current[optionIndex].sizes || []).slice();
                                      if (e.target.checked) {
                                        if (!sizes.includes(val)) sizes.push(val);
                                      } else {
                                        const i = sizes.indexOf(val);
                                        if (i >= 0) sizes.splice(i, 1);
                                      }
                                      current[optionIndex] = { ...current[optionIndex], sizes };
                                      setValue(`styles.${index}.options`, current);
                                    }}
                                  />
                                  {val}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <Input
                          className="col-span-2"
                          placeholder="+Â£0"
                          type="text"
                          inputMode="decimal"
                          value={option.price_delta ?? 0}
                          onChange={(e) => {
                            const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                        const raw = e.target.value.replace(/[^0-9.-]/g, '');
                        const val = raw === '' ? 0 : Number(raw);
                        current[optionIndex] = { ...current[optionIndex], price_delta: val };
                        setValue(`styles.${index}.options`, current);
                      }}
                    />
                        <Input
                          className="col-span-3"
                          placeholder="Icon (URL or inline SVG)"
                          value={option.icon_url || ''}
                          onChange={(e) => {
                            const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                            current[optionIndex] = { ...current[optionIndex], icon_url: e.target.value };
                            setValue(`styles.${index}.options`, current);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="col-span-2"
                          onClick={async () => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = ICON_UPLOAD_ACCEPT;
                            fileInput.onchange = async () => {
                              const file = fileInput.files?.[0];
                              if (!file) return;
                              const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                              await handleUpload(file, (url) => {
                                current[optionIndex] = { ...current[optionIndex], icon_url: url };
                                setValue(`styles.${index}.options`, current);
                              }, true);
                            };
                            fileInput.click();
                          }}
                        >
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="col-span-1"
                          onClick={() => {
                            const current = normalizeStyleOptions(watch(`styles.${index}.options`), true);
                            setValue(
                              `styles.${index}.options`,
                              current.filter((_, idx) => idx !== optionIndex)
                            );
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Features (one per line)</label>
              <textarea
                className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Semi-orthopaedic mattress included as standard&#10;Supportive divan base for a stable sleep surface&#10;Castor legs for easy movement"
                defaultValue={featuresValue}
                onBlur={(e) => {
                  const features = e.target.value
                    .split(/[\r\n]+|â€¢/g)
                    .map((f) => f.trim().replace(/^[\\-â€“â€”â€¢]+\\s*/, ''))
                    .filter(Boolean);
                  setValue('features', features);
                }}
              />
              <p className="text-xs text-muted-foreground">Use separate lines (or bullets) to avoid commas becoming extra bullets on the storefront.</p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Dimensions Table</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={watch('show_dimensions_table') !== false}
                      onChange={(e) => setValue('show_dimensions_table', e.target.checked)}
                    />
                    Show table
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const defaultRows = adjustWidthForWingback(
                        DEFAULT_DIMENSION_ROWS.map((row) => ({
                          measurement: row.measurement,
                          values: { ...row.values },
                        }))
                      );
                      setDimensionColumns([...DIMENSION_SIZE_COLUMNS]);
                      replaceDimensions(defaultRows);
                      setValue('dimensions', defaultRows);
                    }}
                  >
                    Apply Default Dimensions
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendDimension({
                        measurement: '',
                        values: Object.fromEntries(dimensionColumns.map((size) => [size, ''])),
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Dimension Row
                  </Button>
                </div>
              </div>
              {hasWingbackHeadboard && (
                <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
                  Wingback headboard detected: overall bed width increases by ~4 cm to accommodate the winged sides. Length and heights stay the same. Default width values below include this adjustment.
                </div>
              )}
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-[1050px] text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left font-medium whitespace-nowrap">Measurement</th>
                      {dimensionColumns.map((size) => (
                        <th key={size} className="p-2 text-left font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{size}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive/80"
                              onClick={() => handleRemoveDimensionColumn(size)}
                              title={`Remove ${size} column`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </th>
                      ))}
                      <th className="p-2 text-left font-medium whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionFields.map((field, index) => (
                      <tr key={field.id} className="border-t">
                        <td className="p-2 align-top whitespace-nowrap min-w-[150px]">
                          <Input
                            {...register(`dimensions.${index}.measurement` as const)}
                            placeholder="e.g. Length"
                            list="dimension-measurements"
                            className="whitespace-nowrap"
                          />
                        </td>
                        {dimensionColumns.map((size) => (
                          <td key={`${field.id}-${size}`} className="p-2 align-top whitespace-nowrap min-w-[175px]">
                            <Controller
                              control={control}
                              name={`dimensions.${index}.values.${size}` as any}
                              render={({ field: dimensionField }) => (
                                <Input
                                  value={dimensionField.value || ''}
                                  onChange={dimensionField.onChange}
                                  placeholder='e.g. 193 cm (76.0")'
                                  className="whitespace-nowrap text-xs sm:text-sm"
                                />
                              )}
                            />
                          </td>
                        ))}
                        <td className="p-2 align-top whitespace-nowrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDimension(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {dimensionFields.length === 0 && (
                      <tr>
                        <td colSpan={dimensionColumns.length + 2} className="p-4 text-center text-muted-foreground">
                          No dimensions added yet. Click "Apply Default Dimensions" or add rows manually.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <datalist id="dimension-measurements">
                {DIMENSION_MEASUREMENT_SUGGESTIONS.map((measurement) => (
                  <option key={measurement} value={measurement} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Dimensions Paragraph (optional)</label>
                <p className="text-xs text-muted-foreground">Use when you prefer a short note instead of a table.</p>
              </div>
              <textarea
                {...register('dimension_paragraph')}
                rows={4}
                placeholder="e.g. Overall dimensions: 200cm L x 150cm W x 120cm H. Suits standard UK single mattresses."
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">If filled, the storefront will show this text. Leave empty to show the table above.</p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Dimension Images (optional)</label>
                <Button type="button" variant="outline" size="sm" onClick={() => appendDimensionImage({ size: '', url: '' })}>
                  <Plus className="h-4 w-4 mr-2" /> Add Dimension Image
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add an image per size to display inside the “View dimensions” modal. Leave empty to skip images.
              </p>
              <div className="space-y-3">
                {dimensionImageFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start border rounded-md p-3">
                    <Input
                      className="col-span-4"
                      placeholder="Size label (e.g. 4ft6 Double)"
                      {...register(`dimension_images.${index}.size` as const)}
                    />
                    <Input
                      className="col-span-6"
                      placeholder="https://... image URL"
                      {...register(`dimension_images.${index}.url` as const)}
                    />
                    <div className="col-span-2 flex items-center gap-2">
                      <Input
                        type="file"
                        accept={IMAGE_UPLOAD_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleUpload(file, (url) => setValue(`dimension_images.${index}.url`, url));
                          }
                        }}
                        className="flex-1 cursor-pointer bg-black/5"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDimensionImage(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {watch(`dimension_images.${index}.url`) && (
                      <img
                        src={watch(`dimension_images.${index}.url`) || undefined}
                        alt="Dimension preview"
                        className="col-span-12 h-32 w-auto object-contain rounded border mt-1"
                      />
                    )}
                  </div>
                ))}
                {dimensionImageFields.length === 0 && (
                  <p className="text-xs text-muted-foreground">No dimension images added.</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium">FAQs</label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={importFaqsFromProduct}>
                    Import FAQs
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendFaq({ question: '', answer: '' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add FAQ
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {faqFields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2">
                    <Input
                      className="col-span-4"
                      {...register(`faqs.${index}.question` as const)}
                      placeholder="Question"
                    />
                    <Input
                      className="col-span-7"
                      {...register(`faqs.${index}.answer` as const)}
                      placeholder="Answer"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeFaq(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Delivery Information</label>
                  <Input
                    placeholder="Tab title (e.g., Delivery Information)"
                    {...register('delivery_title')}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={importDeliveryInfoFromProduct}>
                  Import delivery
                </Button>
              </div>
              <textarea
                {...register('delivery_info')}
                rows={6}
                placeholder={`Delivery Process:
- Headline goes on its own line
- Details continue on the next line`}
                className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">Line breaks are preserved on the storefront, so add a blank line before headings.</p>
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Returns & Guarantee</label>
                  <Input
                    placeholder="Tab title (e.g., Returns & Guarantee)"
                    {...register('returns_title')}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={importReturnsInfoFromProduct}>
                  Import returns/guarantee
                </Button>
              </div>
              <textarea
                {...register('returns_guarantee')}
                rows={6}
                placeholder={`Returns & Guarantee:
- Free returns within 14 days
- 10-year structural guarantee`}
                className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">Keep each policy on its own line; headings will stay separated when shown to shoppers.</p>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Additional Info Tabs</p>
                  <p className="text-xs text-muted-foreground">Add custom titled sections that will appear as tabs on the product page.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => appendInfoSection({ title: '', content: '' })}>
                  <Plus className="h-4 w-4 mr-2" /> Add Tab
                </Button>
              </div>
              {infoSectionFields.length === 0 && (
                <p className="text-xs text-muted-foreground">No extra tabs yet.</p>
              )}
              {infoSectionFields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-border/70 p-3 space-y-2 bg-white">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Tab title (e.g., Care Instructions)"
                      {...register(`custom_info_sections.${index}.title` as const)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInfoSection(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <textarea
                    {...register(`custom_info_sections.${index}.content` as const)}
                    rows={4}
                    placeholder="Tab content"
                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Filters</p>
                  <p className="text-xs text-muted-foreground">
                    Optionally assign this product to filter options. If the category has subcategories, these appear after you choose a subcategory. Otherwise category filters appear automatically.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    replaceFilterValues([]);
                    setFilterValuesDirty(true);
                  }}
                  disabled={categoryFilterOptions.length === 0}
                >
                  Clear
                </Button>
              </div>
              {categoryFilterOptions.length === 0 && filterOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No filter options yet. Create them in the Filters or Categories page.</p>
              )}
              {!selectedSubcategory && availableSubcategories.length > 0 && (
                <p className="text-xs text-muted-foreground">Select a subcategory to see its available filters.</p>
              )}
              {(() => {
                const selectedIds = new Set(
                  (watch('filter_values') || [])
                    .map((fv) => fv.filter_option)
                    .filter((v) => v !== undefined && v !== null)
                    .map((v) => Number(v))
                );

                const optionList =
                  categoryFilterOptions
                    .filter((opt) => opt.is_active !== false)
                    .map((opt) => ({
                      id: opt.id,
                      label: `${opt.filter_type_name || 'Filter'} — ${opt.name}`,
                    }));

                const toggleId = (id: number, checked: boolean) => {
                  const next = new Set(selectedIds);
                  if (checked) {
                    next.add(id);
                  } else {
                    next.delete(id);
                  }
                  replaceFilterValues(Array.from(next).map((val) => ({ filter_option: val })));
                };

                return (
                  <div className="flex flex-col gap-2">
                    <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-white px-3 py-2 space-y-2">
                      {optionList.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(opt.id)}
                        onChange={(e) => {
                          setFilterValuesDirty(true);
                          toggleId(opt.id, e.target.checked);
                        }}
                      />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                      {optionList.length === 0 && (
                        <p className="text-xs text-muted-foreground">No filter options available.</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Tick the options that apply to this product.</p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Link to="/products">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
          <Button type="submit" className="px-8" disabled={isSaving || isUploading}>
            {isSaving ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;


