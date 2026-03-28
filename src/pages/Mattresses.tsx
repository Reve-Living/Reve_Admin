import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "../lib/api";
import { IMAGE_UPLOAD_ACCEPT, WEBP_UPLOAD_HINT } from "../lib/upload";
import type { MattressOptionPrice, ProductMattress, Category as ApiCategory, SubCategory as ApiSubCategory } from "../lib/types";
import { toast } from "sonner";

type MattressOption = ProductMattress;

const emptyOption = (): MattressOption => ({
  name: "",
  description: "",
  image_url: "",
  price: null,
  original_price: null,
  enable_bunk_positions: false,
  price_top: null,
  price_bottom: null,
  price_both: null,
  sort_order: 0,
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
});

const emptySizeRow = (): MattressOptionPrice => ({
  size_label: "",
  price: null,
  original_price: null,
  price_top: null,
  price_bottom: null,
  price_both: null,
});

const getMattressScopeLabel = (
  item: MattressOption,
  categories: ApiCategory[],
  subcategories: ApiSubCategory[]
) => {
  const categoryNames = categories
    .filter((cat) => (item.categories || []).includes(cat.id))
    .map((cat) => cat.name);
  const subcategoryNames = subcategories
    .filter((sub) => (item.subcategories || []).includes(sub.id))
    .map((sub) => sub.name);
  const labels = [...categoryNames, ...subcategoryNames];
  return labels.length > 0 ? labels.join(" | ") : "All categories";
};

const Mattresses = () => {
  const [items, setItems] = useState<MattressOption[]>([]);
  const [editing, setEditing] = useState<MattressOption>(emptyOption());
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ApiSubCategory[]>([]);
  const [importSourceId, setImportSourceId] = useState<number | null>(null);
  const importSource = useMemo(
    () => items.find((item) => item.id === importSourceId) ?? null,
    [importSourceId, items]
  );
  const selectedCategoryNames = useMemo(
    () => categories.filter((cat) => (editing.categories || []).includes(cat.id)).map((cat) => cat.name),
    [categories, editing.categories]
  );
  const selectedSubcategoryNames = useMemo(
    () => subcategories.filter((sub) => (editing.subcategories || []).includes(sub.id)).map((sub) => sub.name),
    [editing.subcategories, subcategories]
  );

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiGet<MattressOption[]>("/mattress-options/");
      setItems(res || []);
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
        const bedOnly = list.filter((c) => (c.slug || c.name || "").toLowerCase().includes("bed"));
        setCategories(bedOnly);
      })
      .catch(() => setCategories([]));
    apiGet<ApiSubCategory[]>("/subcategories/")
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setSubcategories(list);
      })
      .catch(() => setSubcategories([]));
  }, []);

  const resetForm = () => {
    setEditing(emptyOption());
    setImportSourceId(null);
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

  const handleSave = async () => {
    const payload = { ...editing };
    const prices = (editing.prices || []).filter((p) => p.size_label?.trim());
    payload.prices = prices;
    payload.categories = (editing.categories || []).filter(Boolean);
    payload.subcategories = (editing.subcategories || []).filter(Boolean);
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
                onClick={() => setEditing({ ...editing, categories: [], subcategories: [] })}
              >
                Clear
              </button>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const checked = (editing.categories || []).includes(cat.id);
                const subs = subcategories.filter((s) => s.category === cat.id);
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
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">No categories found.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Choose the category or subcategory first. Then import a mattress into that selection, or add a new one manually.
            </p>
            {(selectedCategoryNames.length > 0 || selectedSubcategoryNames.length > 0) && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-espresso">Selected:</span>{" "}
                {[...selectedCategoryNames, ...selectedSubcategoryNames].join(" • ")}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-ivory/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-espresso">2. Import existing mattress</p>
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
                    {item.name} - {getMattressScopeLabel(item, categories, subcategories)}
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
                      {importSource.prices?.length ? `${importSource.prices.length} size prices` : "No size prices"}{" "}
                      {importSource.enable_bunk_positions ? "| bunk enabled" : "| bunk off"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assigned to:{" "}
                      {getMattressScopeLabel(importSource, categories, subcategories)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm font-medium text-espresso">
              Name
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
            <label className="flex items-center gap-2 text-sm font-medium text-espresso">
              <input
                type="checkbox"
                checked={Boolean(editing.enable_bunk_positions)}
                onChange={(e) => setEditing({ ...editing, enable_bunk_positions: e.target.checked })}
              />
              Enable bunk positions (Top / Bottom)
            </label>
            <label className="text-sm font-medium text-espresso">
              Bunk price top
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.price_top ?? ""}
                onChange={(e) => setEditing({ ...editing, price_top: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
            <label className="text-sm font-medium text-espresso">
              Bunk price bottom
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={editing.price_bottom ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, price_bottom: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
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
            {items.length === 0 && <p className="text-sm text-muted-foreground">No mattresses yet.</p>}
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border px-3 py-3 hover:border-primary/50 transition cursor-pointer bg-white"
                onClick={() => setEditing({ ...item })}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-espresso">{item.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Base: {item.price ?? 0} {item.enable_bunk_positions ? "• bunk" : ""}
                      {item.prices && item.prices.length ? ` • ${item.prices.length} size prices` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Assigned to: {(() => {
                        const categoryNames = categories
                          .filter((cat) => (item.categories || []).includes(cat.id))
                          .map((cat) => cat.name);
                        const subNames = subcategories
                          .filter((sub) => (item.subcategories || []).includes(sub.id))
                          .map((sub) => sub.name);
                        const labels = [...categoryNames, ...subNames];
                        return labels.length > 0 ? labels.join(" • ") : "All categories";
                      })()}
                    </div>
                  </div>
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
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
