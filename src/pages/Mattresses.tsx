import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "../lib/api";
import { IMAGE_UPLOAD_ACCEPT, WEBP_UPLOAD_HINT } from "../lib/upload";
import type {
  MattressOptionPrice,
  Product,
  ProductMattress,
  Category as ApiCategory,
  SubCategory as ApiSubCategory,
} from "../lib/types";
import { toast } from "sonner";

type MattressOption = ProductMattress;

const emptyOption = (): MattressOption => ({
  name: "",
  display_name: "",
  kids_button_label: "",
  description: "",
  features: "",
  image_url: "",
  price: null,
  original_price: null,
  enable_bunk_positions: false,
  price_top: null,
  price_bottom: null,
  price_both: null,
  sort_order: 0,
  products: [],
  prices: [],
});

const cloneMattressOption = (option: MattressOption): MattressOption => ({
  ...emptyOption(),
  ...option,
  id: undefined,
  prices: Array.isArray(option.prices)
    ? option.prices.map((row) => ({
        ...row,
        id: undefined,
      }))
    : [],
  categories: Array.isArray(option.categories) ? [...option.categories] : [],
  subcategories: Array.isArray(option.subcategories) ? [...option.subcategories] : [],
  products: Array.isArray(option.products) ? [...option.products] : [],
});

const emptySizeRow = (): MattressOptionPrice => ({
  size_label: "",
  price: null,
  original_price: null,
  price_top: null,
  price_bottom: null,
  price_both: null,
});

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasMattressKeyword = (...values: Array<string | null | undefined>) =>
  values.some((value) => String(value || "").toLowerCase().includes("mattress"));

const isKidsBedsEntity = (...values: Array<string | null | undefined>) =>
  values.some((value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "kids beds" || normalized === "kids-beds" || normalized.includes("kids bed");
  });

const isMattressCategory = (category: Pick<ApiCategory, "name" | "slug">) =>
  hasMattressKeyword(category.name, category.slug);

const isMattressSourceProduct = (
  product: Pick<Product, "category_name" | "category_slug" | "subcategory_name" | "subcategory_slug">
) =>
  hasMattressKeyword(
    product.category_name,
    product.category_slug,
    product.subcategory_name,
    product.subcategory_slug
  );

const mapProductToMattressOption = (product: Product): MattressOption => ({
  ...emptyOption(),
  name: product.name || "",
  display_name: product.name || "",
  description: product.description || product.short_description || "",
  features: Array.isArray(product.features) ? product.features.filter(Boolean).join("\n") : "",
  image_url: product.images?.[0]?.url || "",
  price: normalizeOptionalNumber(product.price),
  original_price: normalizeOptionalNumber(product.original_price),
  prices: Array.isArray(product.sizes)
    ? product.sizes
        .filter((size) => String(size.name || "").trim().length > 0)
        .map((size) => ({
          ...emptySizeRow(),
          size_label: String(size.name || "").trim(),
          price: normalizeOptionalNumber(size.price_delta),
          original_price: normalizeOptionalNumber(product.original_price),
        }))
    : [],
});

const getMattressScopeLabel = (
  item: MattressOption,
  categories: ApiCategory[],
  subcategories: ApiSubCategory[],
  products: Product[]
) => {
  const categoryNames = categories
    .filter((cat) => (item.categories || []).includes(cat.id))
    .map((cat) => cat.name);
  const subcategoryNames = subcategories
    .filter((sub) => (item.subcategories || []).includes(sub.id))
    .map((sub) => sub.name);
  const matchedProducts = products
    .filter((product) => (item.products || []).includes(product.id))
    .map((product) => product.name || `Product ${product.id}`);
  const productLabel =
    matchedProducts.length === 0
      ? []
      : matchedProducts.length <= 2
        ? matchedProducts
        : [`${matchedProducts.length} beds`];
  const labels = [...categoryNames, ...subcategoryNames, ...productLabel];
  return labels.length > 0 ? labels.join(" | ") : "All categories";
};

const subcategoryMatchesCategory = (subcategory: ApiSubCategory, categoryId: number) =>
  Number(subcategory.category) === Number(categoryId) ||
  (subcategory.linked_category_ids || []).map(Number).includes(Number(categoryId));

const productMatchesSelectedScope = (
  product: Product,
  categoryIds: number[],
  subcategoryIds: number[]
) => {
  const productCategoryId = Number(product.category || 0);
  const productSubcategoryId = Number(product.subcategory || 0);
  const normalizedCategoryIds = categoryIds.map(Number).filter(Boolean);
  const normalizedSubcategoryIds = subcategoryIds.map(Number).filter(Boolean);

  if (normalizedSubcategoryIds.length > 0) {
    return normalizedSubcategoryIds.includes(productSubcategoryId);
  }

  if (normalizedCategoryIds.length > 0) {
    return normalizedCategoryIds.includes(productCategoryId);
  }

  return false;
};

const Mattresses = () => {
  const [items, setItems] = useState<MattressOption[]>([]);
  const [editing, setEditing] = useState<MattressOption>(emptyOption());
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ApiSubCategory[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [importSourceId, setImportSourceId] = useState<number | null>(null);
  const [productImportSourceId, setProductImportSourceId] = useState<number | null>(null);
  const [mattressProducts, setMattressProducts] = useState<Product[]>([]);
  const [mattressProductsLoading, setMattressProductsLoading] = useState(true);
  const [productImportPreview, setProductImportPreview] = useState<Product | null>(null);
  const [productImportLoading, setProductImportLoading] = useState(false);
  const [productImportCache, setProductImportCache] = useState<Record<number, Product>>({});
  const importSource = useMemo(
    () => items.find((item) => item.id === importSourceId) ?? null,
    [importSourceId, items]
  );
  const productImportSource = useMemo(
    () => mattressProducts.find((product) => product.id === productImportSourceId) ?? null,
    [mattressProducts, productImportSourceId]
  );
  const assignableCategories = useMemo(() => {
    const nonMattressCategories = categories.filter((category) => !isMattressCategory(category));
    return nonMattressCategories.length > 0 ? nonMattressCategories : categories;
  }, [categories]);
  const selectedCategoryNames = useMemo(
    () => categories.filter((cat) => (editing.categories || []).includes(cat.id)).map((cat) => cat.name),
    [categories, editing.categories]
  );
  const selectedSubcategoryNames = useMemo(
    () => subcategories.filter((sub) => (editing.subcategories || []).includes(sub.id)).map((sub) => sub.name),
    [editing.subcategories, subcategories]
  );
  const scopedAssignableProducts = useMemo(() => {
    const selectedCategories = Array.isArray(editing.categories) ? editing.categories : [];
    const selectedSubcategories = Array.isArray(editing.subcategories) ? editing.subcategories : [];
    if (selectedCategories.length === 0 && selectedSubcategories.length === 0) return [];

    return allProducts
      .filter((product) => !isMattressSourceProduct(product))
      .filter((product) => productMatchesSelectedScope(product, selectedCategories, selectedSubcategories))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [allProducts, editing.categories, editing.subcategories]);
  const selectedProductNames = useMemo(
    () => allProducts.filter((product) => (editing.products || []).includes(product.id)).map((product) => product.name),
    [allProducts, editing.products]
  );
  const isKidsBedsScope = useMemo(() => {
    const selectedCategoryMatches = categories.some(
      (category) =>
        (editing.categories || []).includes(category.id) &&
        isKidsBedsEntity(category.name, category.slug)
    );
    const selectedProductMatches = allProducts.some(
      (product) =>
        (editing.products || []).includes(product.id) &&
        isKidsBedsEntity(product.category_name, product.category_slug)
    );
    return selectedCategoryMatches || selectedProductMatches;
  }, [allProducts, categories, editing.categories, editing.products]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet<MattressOption[]>("/mattress-options/");
      const sorted = [...(res || [])].sort((a, b) => {
        const orderA = Number(a.sort_order ?? 0);
        const orderB = Number(b.sort_order ?? 0);
        const priorityA = orderA > 0 ? 0 : 1;
        const priorityB = orderB > 0 ? 0 : 1;
        if (priorityA !== priorityB) return priorityA - priorityB;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      setItems(sorted);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load mattresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    apiGet<ApiCategory[]>("/categories/")
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setCategories(list);
      })
      .catch(() => setCategories([]));
    apiGet<ApiSubCategory[]>("/subcategories/")
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setSubcategories(list);
      })
      .catch(() => setSubcategories([]));
    apiGet<Product[]>("/products/")
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setAllProducts(list);
        const mattressOnly = list
          .filter((product) => isMattressSourceProduct(product))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        setMattressProducts(mattressOnly);
      })
      .catch(() => {
        setAllProducts([]);
        setMattressProducts([]);
      })
      .finally(() => setMattressProductsLoading(false));
  }, []);

  useEffect(() => {
    const allowedProductIds = new Set(scopedAssignableProducts.map((product) => product.id));
    setEditing((prev) => {
      const current = Array.isArray(prev.products) ? prev.products.map(Number).filter(Boolean) : [];
      const filtered = current.filter((id) => allowedProductIds.has(id));
      const isSame =
        current.length === filtered.length && current.every((id, index) => id === filtered[index]);
      if (isSame) return prev;
      return { ...prev, products: filtered };
    });
  }, [scopedAssignableProducts]);

  const resetForm = () => {
    setEditing(emptyOption());
    setImportSourceId(null);
    setProductImportSourceId(null);
    setProductImportPreview(null);
  };

  const loadProductImportPreview = async (productId: number) => {
    const cached = productImportCache[productId];
    if (cached) {
      setProductImportPreview(cached);
      return cached;
    }

    const detail = await apiGet<Product>(`/products/${productId}/`);
    setProductImportCache((prev) => ({ ...prev, [productId]: detail }));
    setProductImportPreview(detail);
    return detail;
  };

  const importMattressProductIntoForm = async (sourceId: number, notify = true) => {
    const hasScopeSelection = (editing.categories || []).length > 0 || (editing.subcategories || []).length > 0;
    if (!hasScopeSelection) {
      toast.error("Choose a category or subcategory first");
      return;
    }

    try {
      const source = await loadProductImportPreview(sourceId);
      const imported = mapProductToMattressOption(source);
      const preservedCategories = Array.isArray(editing.categories) ? [...editing.categories] : [];
      const preservedSubcategories = Array.isArray(editing.subcategories) ? [...editing.subcategories] : [];

      setEditing({
        ...imported,
        categories: preservedCategories,
        subcategories: preservedSubcategories,
      });

      if (notify) {
        toast.success("Mattress product imported into form. You can now edit it for this category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to import mattress from product category");
    }
  };

  const importMattressIntoForm = (sourceId: number, notify = true) => {
    const hasScopeSelection = (editing.categories || []).length > 0 || (editing.subcategories || []).length > 0;
    if (!hasScopeSelection) {
      toast.error("Choose a category or subcategory first");
      return;
    }

    const source = items.find((item) => item.id === sourceId);
    if (!source) {
      toast.error("Selected mattress could not be found");
      return;
    }

    const preservedCategories = Array.isArray(editing.categories) ? [...editing.categories] : [];
    const preservedSubcategories = Array.isArray(editing.subcategories) ? [...editing.subcategories] : [];
    const imported = cloneMattressOption(source);

    setEditing({
      ...imported,
      categories: preservedCategories.length > 0 ? preservedCategories : imported.categories,
      subcategories: preservedSubcategories.length > 0 ? preservedSubcategories : imported.subcategories,
    });
    if (notify) {
      toast.success("Mattress imported into form. You can now edit it for this category.");
    }
  };

  const handleImport = () => {
    if (!importSourceId) {
      toast.error("Choose a mattress to import");
      return;
    }
    importMattressIntoForm(importSourceId);
  };

  const handleProductImport = async () => {
    if (!productImportSourceId) {
      toast.error("Choose a mattress product to import");
      return;
    }
    await importMattressProductIntoForm(productImportSourceId);
  };

  const handleSave = async () => {
    const payload = { ...editing };
    const prices = (editing.prices || []).filter((p) => p.size_label?.trim());
    payload.prices = prices;
    payload.categories = (editing.categories || []).filter(Boolean);
    payload.subcategories = (editing.subcategories || []).filter(Boolean);
    payload.products = (editing.products || []).filter(Boolean);
    try {
      if (editing.id) {
        try {
          await apiPatch(`/mattress-options/${editing.id}/`, payload);
          toast.success("Mattress updated");
        } catch (err) {
          // If the record no longer exists (e.g., stale ID), fall back to create.
          await apiPost("/mattress-options/", payload);
          toast.success("Mattress saved");
        }
      } else {
        await apiPost("/mattress-options/", payload);
        toast.success("Mattress created");
      }
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Delete this mattress option?")) return;
    try {
      await apiDelete(`/mattress-options/${id}/`);
      toast.success("Deleted");
      if (editing.id === id) resetForm();
      await load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const activeSizes = useMemo(
    () => editing.prices || [],
    [editing.prices]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Mattresses</h1>
          <p className="text-sm text-muted-foreground">
            Define global mattress options, per-size pricing, and bunk-bed pricing.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          onClick={resetForm}
        >
          <Plus className="h-4 w-4" />
          New mattress
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <div className="rounded-lg border bg-white shadow-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-espresso">1. Choose category first</p>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setEditing({ ...editing, categories: [], subcategories: [], products: [] })}
              >
                Clear
              </button>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {assignableCategories.map((cat) => {
                const checked = (editing.categories || []).includes(cat.id);
                const subs = subcategories.filter((s) => subcategoryMatchesCategory(s, cat.id));
                return (
                  <div key={cat.id} className="rounded-md border border-border/60 bg-ivory/60 p-2 space-y-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-espresso">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(editing.categories || []);
                          if (e.target.checked) next.add(cat.id);
                          else next.delete(cat.id);
                          setEditing({ ...editing, categories: Array.from(next) });
                        }}
                      />
                      {cat.name}
                    </label>
                    {subs.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 pl-6">
                        {subs.map((sub) => {
                          const subChecked = (editing.subcategories || []).includes(sub.id);
                          return (
                            <label key={sub.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={subChecked}
                                onChange={(e) => {
                                  const next = new Set(editing.subcategories || []);
                                  if (e.target.checked) next.add(sub.id);
                                  else next.delete(sub.id);
                                  setEditing({ ...editing, subcategories: Array.from(next) });
                                }}
                              />
                              {sub.name}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {assignableCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">No categories found.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Choose the category or subcategory first. Then import a mattress into that selection, or add a new one manually.
            </p>
            {(selectedCategoryNames.length > 0 || selectedSubcategoryNames.length > 0 || selectedProductNames.length > 0) && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-espresso">Selected:</span>{" "}
                {[...selectedCategoryNames, ...selectedSubcategoryNames, ...selectedProductNames].join(" | ")}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-ivory/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-espresso">2. Choose exact beds (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Leave this empty to show the mattress on every product in the selected category. Check specific beds
                  when it should appear only on those kids beds.
                </p>
              </div>
              {scopedAssignableProducts.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      setEditing({ ...editing, products: scopedAssignableProducts.map((product) => product.id) })
                    }
                  >
                    Check all
                  </button>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setEditing({ ...editing, products: [] })}
                  >
                    Clear beds
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(editing.categories || []).length === 0 && (editing.subcategories || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Select a category above to load matching bed products.</p>
              )}
              {((editing.categories || []).length > 0 || (editing.subcategories || []).length > 0) &&
                scopedAssignableProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No bed products found for the current selection.</p>
                )}
              {scopedAssignableProducts.map((product) => {
                const checked = (editing.products || []).includes(product.id);
                return (
                  <label
                    key={product.id}
                    className="flex items-start gap-2 rounded-md border border-border/60 bg-white px-3 py-2 text-sm text-espresso"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(editing.products || []);
                        if (e.target.checked) next.add(product.id);
                        else next.delete(product.id);
                        setEditing({ ...editing, products: Array.from(next) });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{product.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {product.category_name || "Category"}
                        {product.subcategory_name ? ` | ${product.subcategory_name}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border bg-ivory/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-espresso">3. Import from mattress category</p>
                <p className="text-xs text-muted-foreground">
                  Import a live mattress product into this form. It copies the name, description, image, base price,
                  and size prices from the mattress category.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-espresso hover:bg-muted"
                onClick={() => void handleProductImport()}
                disabled={
                  ((editing.categories || []).length === 0 && (editing.subcategories || []).length === 0) ||
                  !productImportSourceId
                }
              >
                Import category mattress
              </button>
            </div>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={productImportSourceId ?? ""}
              onChange={async (e) => {
                const nextId = e.target.value ? Number(e.target.value) : null;
                setProductImportSourceId(nextId);
                if (!nextId) {
                  setProductImportPreview(null);
                  return;
                }

                try {
                  setProductImportLoading(true);
                  const hasScopeSelection =
                    (editing.categories || []).length > 0 || (editing.subcategories || []).length > 0;

                  if (hasScopeSelection) {
                    await importMattressProductIntoForm(nextId, false);
                  } else {
                    await loadProductImportPreview(nextId);
                  }
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to load mattress category product");
                } finally {
                  setProductImportLoading(false);
                }
              }}
            >
              <option value="">Select a mattress product to import</option>
              {mattressProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.category_name || product.subcategory_name || "Mattress category"}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This is useful when you already created mattresses as products and want to reuse their description and
              size pricing here.
            </p>
            <p className="text-xs text-muted-foreground">
              When a category is already selected, choosing a mattress here will also fill the editable form below with
              its name, description, prices, and sizes.
            </p>
            {mattressProductsLoading && (
              <p className="text-xs text-muted-foreground">Loading mattress category products...</p>
            )}
            {!mattressProductsLoading && !productImportLoading && mattressProducts.length === 0 && (
              <p className="text-xs text-muted-foreground">No products were found in the mattress category.</p>
            )}
            {productImportLoading && (
              <p className="text-xs text-muted-foreground">Loading mattress product details...</p>
            )}
            {(productImportPreview || productImportSource) && (
              <div className="rounded-md border border-border/70 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mattress category preview
                </p>
                <div className="mt-2 flex items-start gap-3">
                  {(productImportPreview || productImportSource)?.images?.[0]?.url ? (
                    <img
                      src={(productImportPreview || productImportSource)?.images?.[0]?.url}
                      alt={(productImportPreview || productImportSource)?.name || "Mattress preview"}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted/40 text-center text-[11px] text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-espresso">
                      {(productImportPreview || productImportSource)?.name || "Untitled mattress"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {(productImportPreview || productImportSource)?.description?.trim() ||
                        (productImportPreview || productImportSource)?.short_description?.trim() ||
                        "No description on this mattress product yet."}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Base price:{" "}
                      <span className="font-medium text-espresso">
                        {(productImportPreview || productImportSource)?.price ?? "Not set"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(productImportPreview || productImportSource)?.sizes?.length
                        ? `${(productImportPreview || productImportSource)?.sizes?.length} size prices`
                        : "No size prices"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Source category:{" "}
                      {(productImportPreview || productImportSource)?.category_name ||
                        (productImportPreview || productImportSource)?.subcategory_name ||
                        "Mattress category"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-ivory/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-espresso">4. Import existing mattress</p>
                <p className="text-xs text-muted-foreground">
                  Import copies all mattress details into the form. If you do not change anything, it will save the same mattress details for the selected category.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-espresso hover:bg-muted"
                onClick={handleImport}
                disabled={(editing.categories || []).length === 0 && (editing.subcategories || []).length === 0}
              >
                Import mattress
              </button>
            </div>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={importSourceId ?? ""}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : null;
                setImportSourceId(nextId);
                if (nextId) {
                  importMattressIntoForm(nextId, false);
                }
              }}
            >
              <option value="">Select an existing mattress to import</option>
              {items
                .filter((item) => item.id !== editing.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {getMattressScopeLabel(item, categories, subcategories, allProducts)}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Pick a mattress, click import, and all of its fields below will be filled in: name, description, image, base price, size prices, and bunk pricing.
            </p>
            {importSource && (
              <div className="rounded-md border border-border/70 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected mattress preview</p>
                <div className="mt-2 flex items-start gap-3">
                  {importSource.image_url ? (
                    <img
                      src={importSource.image_url}
                      alt={importSource.name || "Mattress preview"}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted/40 text-center text-[11px] text-muted-foreground">
                      No image
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-espresso">{importSource.name || "Untitled mattress"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {importSource.description?.trim() || "No description on this mattress yet."}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Base price:{" "}
                      <span className="font-medium text-espresso">
                        {importSource.price === 0 ? "Included" : importSource.price ?? "Not set"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {importSource.prices?.length ? `${importSource.prices.length} size prices` : "No size prices"}
                    </div>
                    {importSource.kids_button_label && (
                      <div className="text-xs text-muted-foreground">
                        Kids bed button: <span className="font-medium text-espresso">{importSource.kids_button_label}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Assigned to:{" "}
                      {getMattressScopeLabel(importSource, categories, subcategories, allProducts)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm font-medium text-espresso">
              Display name
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.display_name || ""}
                onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the storefront label shown on the bed page. Leave blank to use the internal mattress name.
              </p>
            </label>
            {isKidsBedsScope && (
              <label className="col-span-2 text-sm font-medium text-espresso">
                Kids bed button label
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={editing.kids_button_label || ""}
                  onChange={(e) => setEditing({ ...editing, kids_button_label: e.target.value })}
                  placeholder="e.g. Top Mattress, Bottom Mattress"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Used only on Kids Beds. Mattresses with the same label will appear under the same button in the
                  Add a Mattress popup.
                </p>
              </label>
            )}
            <label className="col-span-2 text-sm font-medium text-espresso">
              Internal name
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="col-span-2 text-sm font-medium text-espresso">
              Description
              <textarea
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={editing.description || ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <label className="col-span-2 text-sm font-medium text-espresso">
              Features (shown in "See details" only)
              <textarea
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                rows={4}
                placeholder={"Enter one feature per line\nOrthopaedic support\nBreathable fabric\nHypoallergenic"}
                value={editing.features || ""}
                onChange={(e) => setEditing({ ...editing, features: e.target.value })}
              />
            </label>
            <div className="col-span-2 text-sm font-medium text-espresso space-y-2">
              <div className="flex items-center justify-between">
                <span>Image</span>
                {editing.image_url && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setEditing({ ...editing, image_url: "" })}
                  >
                    Clear
                  </button>
                )}
              </div>
              {editing.image_url && (
                <img
                  src={editing.image_url}
                  alt="Mattress"
                  className="h-24 w-24 rounded-md border object-cover"
                />
              )}
              <div className="flex gap-2">
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await apiUpload("/uploads/", file);
                      setEditing({ ...editing, image_url: res.url });
                      toast.success("Image uploaded");
                    } catch {
                      toast.error("Image upload failed");
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">{WEBP_UPLOAD_HINT}</p>
              </div>
            </div>

            <label className="text-sm font-medium text-espresso">
              Base price
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.price ?? ""}
                onChange={(e) => setEditing({ ...editing, price: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Set to 0 to show this mattress as Included on the frontend.
              </p>
            </label>
            <label className="text-sm font-medium text-espresso">
              Original price (discount ref)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.original_price ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, original_price: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm font-medium text-espresso">
              Sort order
              <input
                type="number"
                step="1"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.sort_order ?? 0}
                onChange={(e) =>
                  setEditing({ ...editing, sort_order: e.target.value === "" ? 0 : Number(e.target.value) })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use 1, 2, 3... to control order. 0 means unsorted and appears after ordered items.
              </p>
            </label>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-espresso">Per-size pricing</p>
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setEditing({ ...editing, prices: [...(editing.prices || []), emptySizeRow()] })}
              >
                Add size
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              If a size price is 0, that mattress size will appear as Included on the frontend.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeSizes.length === 0 && <p className="text-xs text-muted-foreground">No size overrides added.</p>}
              {activeSizes.map((row, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 items-center bg-white rounded-md border p-2">
                  <input
                    placeholder="Size (e.g., 4ft6 Double)"
                    className="col-span-2 rounded-md border px-2 py-1 text-sm"
                    value={row.size_label}
                    onChange={(e) => {
                      const next = [...activeSizes];
                      next[idx] = { ...next[idx], size_label: e.target.value };
                      setEditing({ ...editing, prices: next });
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    className="col-span-1 rounded-md border px-2 py-1 text-sm"
                    value={row.price ?? ""}
                    onChange={(e) => {
                      const next = [...activeSizes];
                      next[idx] = { ...next[idx], price: e.target.value === "" ? null : Number(e.target.value) };
                      setEditing({ ...editing, prices: next });
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Orig."
                    className="col-span-1 rounded-md border px-2 py-1 text-sm"
                    value={row.original_price ?? ""}
                    onChange={(e) => {
                      const next = [...activeSizes];
                      next[idx] = { ...next[idx], original_price: e.target.value === "" ? null : Number(e.target.value) };
                      setEditing({ ...editing, prices: next });
                    }}
                  />
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={() => {
                      const next = activeSizes.filter((_, i) => i !== idx);
                      setEditing({ ...editing, prices: next });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-espresso hover:bg-muted"
              onClick={resetForm}
            >
              Reset
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              Save mattress
            </button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-espresso">Existing mattresses</h2>
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
          </div>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-muted-foreground">No global mattresses yet.</p>}
            {items.map((item) => (
              <div
                key={`global-${item.id}`}
                className="rounded-lg border px-3 py-3 hover:border-primary/50 transition cursor-pointer bg-white"
                onClick={() =>
                  setEditing({
                    ...item,
                    categories: Array.isArray(item.categories) ? [...item.categories] : [],
                    subcategories: Array.isArray(item.subcategories) ? [...item.subcategories] : [],
                    products: Array.isArray(item.products) ? [...item.products] : [],
                    prices: Array.isArray(item.prices) ? [...item.prices] : [],
                  })
                }
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-espresso">{item.name}</p>
                    {item.display_name && item.display_name !== item.name && (
                      <p className="text-xs text-muted-foreground mt-1">Shown as: {item.display_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    {item.features?.trim() && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        Features: {item.features}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Base: {item.price ?? 0}
                      {item.prices && item.prices.length ? ` • ${item.prices.length} size prices` : ""}
                    </div>
                    {item.kids_button_label && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Kids bed button: {item.kids_button_label}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Sort order: {item.sort_order ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Assigned to: {(() => {
                        const categoryNames = categories
                          .filter((cat) => (item.categories || []).includes(cat.id))
                          .map((cat) => cat.name);
                        const subNames = subcategories
                          .filter((sub) => (item.subcategories || []).includes(sub.id))
                          .map((sub) => sub.name);
                        const productNames = allProducts
                          .filter((product) => (item.products || []).includes(product.id))
                          .map((product) => product.name || `Product ${product.id}`);
                        const productLabels =
                          productNames.length === 0
                            ? []
                            : productNames.length <= 2
                              ? productNames
                              : [`${productNames.length} beds`];
                        const labels = [...categoryNames, ...subNames, ...productLabels];
                        return labels.length > 0 ? labels.join(" | ") : "All categories";
                      })()}
                    </div>
                  </div>
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({
                        ...item,
                        categories: Array.isArray(item.categories) ? [...item.categories] : [],
                        subcategories: Array.isArray(item.subcategories) ? [...item.subcategories] : [],
                        products: Array.isArray(item.products) ? [...item.products] : [],
                        prices: Array.isArray(item.prices) ? [...item.prices] : [],
                      });
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mattresses;
