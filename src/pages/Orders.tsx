import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CheckCircle, Download, Eye, Plus, Trash2 } from 'lucide-react';
import { apiDownload, apiGet, apiPost } from '../lib/api';
import type { Order, Product } from '../lib/types';
import { toast } from 'sonner';

type OrderAction = 'mark_paid' | 'mark_delivered';
type ManualOrderSource = 'whatsapp' | 'phone' | 'walk_in' | 'other';

type ManualOrderItem = {
  id: string;
  productId: string;
  productSearch: string;
  categoryFilter: string;
  subcategoryFilter: string;
  quantity: string;
  unitPrice: string;
  size: string;
  color: string;
  style: string;
  dimension: string;
  dimensionDetails: string;
  extrasTotal: string;
  assemblyServiceSelected: boolean;
  assemblyServicePrice: string;
};

type ManualOrderFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alternativePhone: string;
  address: string;
  city: string;
  postalCode: string;
  floorNumber: string;
  paymentMethod: string;
  paymentReference: string;
  deliveryCharges: string;
  source: ManualOrderSource;
  specialNotes: string;
  sendConfirmationEmail: boolean;
  items: ManualOrderItem[];
};

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const textareaClassName =
  'flex min-h-[104px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const createManualItem = (): ManualOrderItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  productId: '',
  productSearch: '',
  categoryFilter: '',
  subcategoryFilter: '',
  quantity: '1',
  unitPrice: '',
  size: '',
  color: '',
  style: '',
  dimension: '',
  dimensionDetails: '',
  extrasTotal: '',
  assemblyServiceSelected: false,
  assemblyServicePrice: '',
});

const createInitialManualOrder = (): ManualOrderFormState => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  alternativePhone: '',
  address: '',
  city: '',
  postalCode: '',
  floorNumber: '',
  paymentMethod: 'paid',
  paymentReference: '',
  deliveryCharges: '0.00',
  source: 'whatsapp',
  specialNotes: '',
  sendConfirmationEmail: false,
  items: [createManualItem()],
});

const normalizeList = <T,>(data: T[] | { results?: T[] }): T[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const parseNumber = (value?: string | number | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseQuantity = (value?: string) => {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const formatMoney = (value?: string | number | null) => `GBP ${parseNumber(value).toFixed(2)}`;

const normalizeSearchText = (value?: string | null) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const matchesSearchText = (value: string, query: string) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeSearchText(value);
  return normalizedQuery.split(' ').every((term) => haystack.includes(term));
};

const getProductCategoryLabel = (product: Product) => (product.category_name || 'Uncategorised').trim() || 'Uncategorised';

const getProductSubcategoryLabel = (product: Product) => (product.subcategory_name || '').trim();

const getProductLocationLabel = (product: Product) => {
  const categoryLabel = getProductCategoryLabel(product);
  const subcategoryLabel = getProductSubcategoryLabel(product);
  return subcategoryLabel ? `${categoryLabel} > ${subcategoryLabel}` : categoryLabel;
};

const getProductOptionLabel = (product: Product) =>
  `${product.name} - ${getProductLocationLabel(product)} (${formatMoney(product.price)})`;

const getProductSearchValue = (product: Product) =>
  [product.name, product.slug, getProductCategoryLabel(product), getProductSubcategoryLabel(product)].join(' ');

const getPaymentMethodLabel = (value?: string) =>
  (
    {
      paid: 'Paid',
      cash_on_delivery: 'Cash on delivery',
      cod: 'Cash on delivery',
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
      card: 'Card',
      manual: 'Manual',
      paypal: 'PayPal',
    } as Record<string, string>
  )[(value || '').toLowerCase()] || value || 'Not provided';

const getStatusLabel = (status: string) => {
  if (status === 'shipped') return 'delivered';
  return status;
};

const isDisplayableOrderPart = (value?: string) => {
  const cleaned = (value || '').trim();
  if (!cleaned) return false;
  const lower = cleaned.toLowerCase();
  if (lower.includes('dimension')) return false;
  if (/(^|\b)(length|width|height|headboard height|bed height)\s*:/.test(lower)) return false;
  if (/(cm|inch|inches|")/.test(lower) && /(length|width|height)/.test(lower)) return false;
  return true;
};

const getOrderPartRank = (value?: string) => {
  const lower = (value || '').trim().toLowerCase();
  if (lower.startsWith('size:')) return 1;
  if (lower.startsWith('colour:') || lower.startsWith('color:')) return 2;
  if (lower.startsWith('fabric:')) return 3;
  if (lower.includes('storage')) return 4;
  if (lower.includes('headboard')) return 5;
  if (lower.startsWith('mattress')) return 6;
  if (lower.startsWith('assembly service')) return 7;
  return 99;
};

const sortOrderParts = (parts: string[]) =>
  [...parts].sort((a, b) => {
    const rankDiff = getOrderPartRank(a) - getOrderPartRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  });

const getCleanItemSummary = (item: Order['items'][number]) => {
  const parts: string[] = [];
  const seen = new Set<string>();

  const addPart = (value?: string) => {
    const cleaned = (value || '').trim();
    if (!cleaned || !isDisplayableOrderPart(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(cleaned);
  };

  if (item.size) addPart(`Size: ${item.size}`);
  if (item.color) addPart(`Colour: ${item.color}`);

  (item.style || '')
    .split('|')
    .map((part) => part.trim())
    .forEach((part) => addPart(part));

  if (item.mattress_name) addPart(`Mattress: ${item.mattress_name}`);
  if (item.assembly_service_selected) {
    addPart(`Assembly Service: ${formatMoney(item.assembly_service_price || 0)}`);
  }

  return sortOrderParts(parts);
};

const isManualItemEmpty = (item: ManualOrderItem) =>
  !item.productId &&
  !item.size.trim() &&
  !item.color.trim() &&
  !item.style.trim() &&
  !item.dimension.trim() &&
  !item.dimensionDetails.trim() &&
  !item.extrasTotal.trim() &&
  !item.assemblyServicePrice.trim();

const sourceLabel: Record<ManualOrderSource, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
};

const buildManualNotes = (source: ManualOrderSource, notes: string) => {
  const lines = [`Order source: ${sourceLabel[source]}`];
  const trimmedNotes = notes.trim();
  if (trimmedNotes) {
    lines.push(trimmedNotes);
  }
  return lines.join('\n');
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmittingManualOrder, setIsSubmittingManualOrder] = useState(false);
  const [manualOrder, setManualOrder] = useState<ManualOrderFormState>(() => createInitialManualOrder());

  const manualSubtotal = useMemo(
    () =>
      manualOrder.items.reduce((sum, item) => {
        return sum + parseNumber(item.unitPrice) * parseQuantity(item.quantity);
      }, 0),
    [manualOrder.items]
  );

  const manualDeliveryCharges = useMemo(
    () => parseNumber(manualOrder.deliveryCharges),
    [manualOrder.deliveryCharges]
  );

  const productLookup = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );

  const catalogProducts = useMemo(
    () =>
      [...products].sort((left, right) => {
        const nameCompare = left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (nameCompare !== 0) return nameCompare;

        const categoryCompare = getProductCategoryLabel(left).localeCompare(getProductCategoryLabel(right), undefined, {
          sensitivity: 'base',
          numeric: true,
        });
        if (categoryCompare !== 0) return categoryCompare;

        return getProductSubcategoryLabel(left).localeCompare(getProductSubcategoryLabel(right), undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      }),
    [products]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Map<
      string,
      {
        label: string;
        subcategories: Map<string, string>;
      }
    >();

    for (const product of catalogProducts) {
      const categoryValue = String(product.category ?? '');
      const subcategoryValue = String(product.subcategory ?? '');
      const categoryLabel = getProductCategoryLabel(product);
      const subcategoryLabel = getProductSubcategoryLabel(product);

      if (!categories.has(categoryValue)) {
        categories.set(categoryValue, {
          label: categoryLabel,
          subcategories: new Map<string, string>(),
        });
      }

      if (subcategoryValue && subcategoryLabel) {
        categories.get(categoryValue)?.subcategories.set(subcategoryValue, subcategoryLabel);
      }
    }

    return [...categories.entries()]
      .map(([value, details]) => ({
        value,
        label: details.label,
        subcategories: [...details.subcategories.entries()]
          .map(([subcategoryValue, subcategoryLabel]) => ({
            value: subcategoryValue,
            label: subcategoryLabel,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true })),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }));
  }, [catalogProducts]);

  const allSubcategoryOptions = useMemo(() => {
    const subcategories = new Map<string, string>();
    for (const option of categoryOptions) {
      for (const subcategory of option.subcategories) {
        subcategories.set(subcategory.value, subcategory.label);
      }
    }

    return [...subcategories.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }));
  }, [categoryOptions]);

  const subcategoryOptionsByCategory = useMemo(
    () =>
      new Map(
        categoryOptions.map((option) => [
          option.value,
          option.subcategories,
        ])
      ),
    [categoryOptions]
  );

  const manualTotal = useMemo(
    () => manualSubtotal + manualDeliveryCharges,
    [manualDeliveryCharges, manualSubtotal]
  );

  const loadOrders = async () => {
    try {
      const data = await apiGet<Order[] | { results?: Order[] }>('/orders/');
      setOrders(normalizeList(data));
    } catch {
      toast.error('Failed to load orders');
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiGet<Product[] | { results?: Product[] }>('/products/?summary=1');
      setProducts(normalizeList(data));
    } catch {
      toast.error('Failed to load products for manual orders');
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadProducts();
  }, []);

  const viewOrder = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const order = await apiGet<Order>(`/orders/${id}/`);
      setSelectedOrder(order);
    } catch {
      toast.error('Failed to load order details');
      setSelectedOrder(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const updateStatus = async (id: number, action: OrderAction) => {
    try {
      await apiPost(`/orders/${id}/${action}/`, {});
      toast.success('Order updated');
      await loadOrders();
      if (selectedOrder?.id === id) {
        await viewOrder(id);
      }
    } catch {
      toast.error('Update failed');
    }
  };

  const downloadDeliveryPdf = async (id: number) => {
    try {
      const blob = await apiDownload(`/orders/${id}/delivery_note_pdf/`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `order-${id}-delivery-note.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const setManualField = <K extends keyof ManualOrderFormState>(field: K, value: ManualOrderFormState[K]) => {
    setManualOrder((current) => ({ ...current, [field]: value }));
  };

  const updateManualItem = (itemId: string, patch: Partial<ManualOrderItem>) => {
    setManualOrder((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  const handleManualProductChange = (itemId: string, productId: string) => {
    const selectedProduct = productLookup.get(productId);
    updateManualItem(itemId, {
      productId,
      unitPrice: selectedProduct ? parseNumber(selectedProduct.price).toFixed(2) : '',
    });
  };

  const addManualItem = () => {
    setManualOrder((current) => ({ ...current, items: [...current.items, createManualItem()] }));
  };

  const removeManualItem = (itemId: string) => {
    setManualOrder((current) => {
      const remainingItems = current.items.filter((item) => item.id !== itemId);
      return {
        ...current,
        items: remainingItems.length > 0 ? remainingItems : [createManualItem()],
      };
    });
  };

  const submitManualOrder = async (downloadPdfAfterCreate: boolean) => {
    if (products.length === 0) {
      toast.error('Products are still loading. Please try again in a moment.');
      return;
    }

    const filledItems = manualOrder.items.filter((item) => !isManualItemEmpty(item));
    if (filledItems.length === 0) {
      toast.error('Add at least one order item');
      return;
    }

    for (const item of filledItems) {
      if (!item.productId) {
        toast.error('Choose a product for each order item');
        return;
      }
      if (parseNumber(item.unitPrice) <= 0) {
        toast.error('Each order item needs a unit price greater than 0');
        return;
      }
      if (parseQuantity(item.quantity) <= 0) {
        toast.error('Each order item needs a valid quantity');
        return;
      }
      if (item.assemblyServiceSelected && parseNumber(item.assemblyServicePrice) <= 0) {
        toast.error('Assembly service items need a service price greater than 0');
        return;
      }
    }

    const payload = {
      first_name: manualOrder.firstName.trim(),
      last_name: manualOrder.lastName.trim(),
      email: manualOrder.email.trim(),
      phone: manualOrder.phone.trim(),
      alternative_phone: manualOrder.alternativePhone.trim(),
      address: manualOrder.address.trim(),
      city: manualOrder.city.trim(),
      postal_code: manualOrder.postalCode.trim(),
      floor_number: manualOrder.floorNumber.trim(),
      total_amount: manualTotal.toFixed(2),
      delivery_charges: manualDeliveryCharges.toFixed(2),
      payment_method: manualOrder.paymentMethod.trim(),
      payment_id: manualOrder.paymentReference.trim(),
      send_confirmation_email: manualOrder.sendConfirmationEmail,
      special_notes: buildManualNotes(manualOrder.source, manualOrder.specialNotes),
      items: filledItems.map((item) => ({
        product_id: Number(item.productId),
        quantity: parseQuantity(item.quantity),
        price: parseNumber(item.unitPrice).toFixed(2),
        size: item.size.trim(),
        color: item.color.trim(),
        style: item.style.trim(),
        dimension: item.dimension.trim(),
        dimension_details: item.dimensionDetails.trim(),
        extras_total: parseNumber(item.extrasTotal).toFixed(2),
        include_dimension: true,
        assembly_service_selected: item.assemblyServiceSelected,
        assembly_service_price: item.assemblyServiceSelected
          ? parseNumber(item.assemblyServicePrice).toFixed(2)
          : '0.00',
      })),
    };

    setIsSubmittingManualOrder(true);
    try {
      const createdOrder = await apiPost<Order>('/orders/', payload);
      setSelectedOrder(createdOrder);
      setManualOrder(createInitialManualOrder());
      await loadOrders();
      toast.success('Manual order created');
      if (downloadPdfAfterCreate) {
        await downloadDeliveryPdf(createdOrder.id);
      }
    } catch {
      toast.error('Failed to create manual order');
    } finally {
      setIsSubmittingManualOrder(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Orders</h2>
        <p className="text-muted-foreground">Monitor website orders and create manual records from WhatsApp or phone orders.</p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-espresso">Create Manual Order</h3>
              <p className="text-sm text-muted-foreground">
                Add orders received outside the website and keep them available for record tracking and PDF downloads.
              </p>
            </div>
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Running total</p>
              <p className="mt-1 text-2xl font-semibold text-espresso">{formatMoney(manualTotal)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-first-name">
                First name
              </label>
              <Input
                id="manual-first-name"
                value={manualOrder.firstName}
                onChange={(event) => setManualField('firstName', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-last-name">
                Last name
              </label>
              <Input
                id="manual-last-name"
                value={manualOrder.lastName}
                onChange={(event) => setManualField('lastName', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-email">
                Email
              </label>
              <Input
                id="manual-email"
                type="email"
                value={manualOrder.email}
                onChange={(event) => setManualField('email', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-phone">
                Phone
              </label>
              <Input
                id="manual-phone"
                value={manualOrder.phone}
                onChange={(event) => setManualField('phone', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-alt-phone">
                Alternative phone
              </label>
              <Input
                id="manual-alt-phone"
                value={manualOrder.alternativePhone}
                onChange={(event) => setManualField('alternativePhone', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 xl:col-span-3">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-address">
                Address
              </label>
              <Input
                id="manual-address"
                value={manualOrder.address}
                onChange={(event) => setManualField('address', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-city">
                City
              </label>
              <Input
                id="manual-city"
                value={manualOrder.city}
                onChange={(event) => setManualField('city', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-postal-code">
                Postal code
              </label>
              <Input
                id="manual-postal-code"
                value={manualOrder.postalCode}
                onChange={(event) => setManualField('postalCode', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-floor-number">
                Floor number
              </label>
              <Input
                id="manual-floor-number"
                value={manualOrder.floorNumber}
                onChange={(event) => setManualField('floorNumber', event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-source">
                Order source
              </label>
              <select
                id="manual-source"
                className={selectClassName}
                value={manualOrder.source}
                onChange={(event) => setManualField('source', event.target.value as ManualOrderSource)}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-payment-method">
                Payment method
              </label>
              <select
                id="manual-payment-method"
                className={selectClassName}
                value={manualOrder.paymentMethod}
                onChange={(event) => setManualField('paymentMethod', event.target.value)}
              >
                <option value="paid">Paid</option>
                <option value="cash_on_delivery">Cash on delivery</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-payment-reference">
                Payment reference
              </label>
              <Input
                id="manual-payment-reference"
                value={manualOrder.paymentReference}
                onChange={(event) => setManualField('paymentReference', event.target.value)}
                placeholder="Website paid, PayPal, bank transfer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso" htmlFor="manual-delivery-charges">
                Delivery charges
              </label>
              <Input
                id="manual-delivery-charges"
                type="number"
                min="0"
                step="0.01"
                value={manualOrder.deliveryCharges}
                onChange={(event) => setManualField('deliveryCharges', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso" htmlFor="manual-special-notes">
              Notes for this order
            </label>
            <textarea
              id="manual-special-notes"
              className={textareaClassName}
              value={manualOrder.specialNotes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setManualField('specialNotes', event.target.value)}
              placeholder="Delivery instructions, WhatsApp notes, or any extra record details."
            />
          </div>

          <div className="rounded-md border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-espresso">Items</h4>
                <p className="text-sm text-muted-foreground">
                  Choose existing products so the order record stays linked to the catalog and PDF output.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addManualItem}>
                <Plus className="mr-2 h-4 w-4" /> Add item
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {manualOrder.items.map((item, index) => (
                <div key={item.id} className="rounded-md border border-border/70 bg-muted/10 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-espresso">Item {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Unit price should be the final charge per item.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeManualItem(item.id)}
                      disabled={manualOrder.items.length === 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {(() => {
                      const selectedProduct = productLookup.get(item.productId);
                      const availableSubcategories = item.categoryFilter
                        ? subcategoryOptionsByCategory.get(item.categoryFilter) || []
                        : allSubcategoryOptions;
                      const filteredProducts = catalogProducts.filter((product) => {
                        if (item.categoryFilter && String(product.category ?? '') !== item.categoryFilter) {
                          return false;
                        }
                        if (item.subcategoryFilter && String(product.subcategory ?? '') !== item.subcategoryFilter) {
                          return false;
                        }
                        return matchesSearchText(getProductSearchValue(product), item.productSearch);
                      });
                      const selectableProducts =
                        selectedProduct && !filteredProducts.some((product) => product.id === selectedProduct.id)
                          ? [selectedProduct, ...filteredProducts]
                          : filteredProducts;

                      return (
                        <>
                          <div className="space-y-2 xl:col-span-2">
                            <label className="text-sm font-medium text-espresso" htmlFor={`manual-product-search-${item.id}`}>
                              Search product
                            </label>
                            <Input
                              id={`manual-product-search-${item.id}`}
                              value={item.productSearch}
                              onChange={(event) => updateManualItem(item.id, { productSearch: event.target.value })}
                              placeholder="Type initial letters to filter products"
                            />
                            <p className="text-xs text-muted-foreground">
                              Sorted A-Z. You can search by product, category, or subcategory.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-espresso" htmlFor={`manual-category-filter-${item.id}`}>
                              Category
                            </label>
                            <select
                              id={`manual-category-filter-${item.id}`}
                              className={selectClassName}
                              value={item.categoryFilter}
                              onChange={(event) =>
                                updateManualItem(item.id, {
                                  categoryFilter: event.target.value,
                                  subcategoryFilter: '',
                                })
                              }
                            >
                              <option value="">All categories</option>
                              {categoryOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-espresso" htmlFor={`manual-subcategory-filter-${item.id}`}>
                              Subcategory
                            </label>
                            <select
                              id={`manual-subcategory-filter-${item.id}`}
                              className={selectClassName}
                              value={item.subcategoryFilter}
                              onChange={(event) => updateManualItem(item.id, { subcategoryFilter: event.target.value })}
                            >
                              <option value="">All subcategories</option>
                              {availableSubcategories.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2 xl:col-span-4">
                            <label className="text-sm font-medium text-espresso" htmlFor={`manual-product-${item.id}`}>
                              Product
                            </label>
                            <select
                              id={`manual-product-${item.id}`}
                              className={selectClassName}
                              value={item.productId}
                              onChange={(event) => handleManualProductChange(item.id, event.target.value)}
                            >
                              <option value="">
                                {selectableProducts.length > 0 ? 'Choose a product' : 'No matching products found'}
                              </option>
                              {selectableProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {getProductOptionLabel(product)}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                              Showing {filteredProducts.length} of {catalogProducts.length} products.
                            </p>
                            {selectedProduct && (
                              <p className="text-xs text-muted-foreground">
                                Selected: {getProductLocationLabel(selectedProduct)}
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-quantity-${item.id}`}>
                        Quantity
                      </label>
                      <Input
                        id={`manual-quantity-${item.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateManualItem(item.id, { quantity: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-price-${item.id}`}>
                        Unit price
                      </label>
                      <Input
                        id={`manual-price-${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateManualItem(item.id, { unitPrice: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-size-${item.id}`}>
                        Size
                      </label>
                      <Input
                        id={`manual-size-${item.id}`}
                        value={item.size}
                        onChange={(event) => updateManualItem(item.id, { size: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-colour-${item.id}`}>
                        Colour
                      </label>
                      <Input
                        id={`manual-colour-${item.id}`}
                        value={item.color}
                        onChange={(event) => updateManualItem(item.id, { color: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-style-${item.id}`}>
                        Specification / style
                      </label>
                      <Input
                        id={`manual-style-${item.id}`}
                        value={item.style}
                        onChange={(event) => updateManualItem(item.id, { style: event.target.value })}
                        placeholder="Fabric: Plush Velvet | Headboard: Wingback"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-extras-${item.id}`}>
                        Extras note amount
                      </label>
                      <Input
                        id={`manual-extras-${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.extrasTotal}
                        onChange={(event) => updateManualItem(item.id, { extrasTotal: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-dimension-${item.id}`}>
                        Dimension label
                      </label>
                      <Input
                        id={`manual-dimension-${item.id}`}
                        value={item.dimension}
                        onChange={(event) => updateManualItem(item.id, { dimension: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-dimension-details-${item.id}`}>
                        Dimension details
                      </label>
                      <Input
                        id={`manual-dimension-details-${item.id}`}
                        value={item.dimensionDetails}
                        onChange={(event) => updateManualItem(item.id, { dimensionDetails: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 pt-7 text-sm font-medium text-espresso">
                        <input
                          type="checkbox"
                          checked={item.assemblyServiceSelected}
                          onChange={(event) =>
                            updateManualItem(item.id, {
                              assemblyServiceSelected: event.target.checked,
                              assemblyServicePrice: event.target.checked ? item.assemblyServicePrice : '',
                            })
                          }
                        />
                        Assembly service
                      </label>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso" htmlFor={`manual-assembly-price-${item.id}`}>
                        Assembly price
                      </label>
                      <Input
                        id={`manual-assembly-price-${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.assemblyServicePrice}
                        disabled={!item.assemblyServiceSelected}
                        onChange={(event) => updateManualItem(item.id, { assemblyServicePrice: event.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Subtotal: {formatMoney(manualSubtotal)}</p>
              <p className="text-sm text-muted-foreground">Delivery: {formatMoney(manualDeliveryCharges)}</p>
              <p className="text-lg font-semibold text-espresso">Total: {formatMoney(manualTotal)}</p>
            </div>
            <div className="space-y-3 text-right">
              <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={manualOrder.sendConfirmationEmail}
                  onChange={(event) => setManualField('sendConfirmationEmail', event.target.checked)}
                />
                Send email notifications after saving
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualOrder(createInitialManualOrder())}
                  disabled={isSubmittingManualOrder}
                >
                  Reset form
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void submitManualOrder(false)}
                  disabled={isSubmittingManualOrder}
                >
                  {isSubmittingManualOrder ? 'Saving...' : 'Create record'}
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitManualOrder(true)}
                  disabled={isSubmittingManualOrder}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isSubmittingManualOrder ? 'Saving...' : 'Create and download PDF'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-espresso">Order ORD-{selectedOrder.id}</h3>
                <p className="text-sm text-muted-foreground">
                  {[`${selectedOrder.first_name} ${selectedOrder.last_name}`.trim(), selectedOrder.email || selectedOrder.phone]
                    .filter(Boolean)
                    .join(' / ') || 'Manual order'}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => void downloadDeliveryPdf(selectedOrder.id)}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border bg-white p-4">
                <p className="text-sm font-medium text-espresso">Shipping address</p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedOrder.address}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.city} {selectedOrder.postal_code}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{selectedOrder.phone}</p>
                {selectedOrder.alternative_phone && (
                  <p className="text-sm text-muted-foreground">Alt: {selectedOrder.alternative_phone}</p>
                )}
                {selectedOrder.floor_number && (
                  <p className="text-sm text-muted-foreground">Floor: {selectedOrder.floor_number}</p>
                )}
              </div>
              <div className="rounded-md border bg-white p-4">
                <p className="text-sm font-medium text-espresso">Order summary</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Payment: {getPaymentMethodLabel(selectedOrder.payment_method)}
                </p>
                {selectedOrder.payment_id && (
                  <p className="text-sm text-muted-foreground">Reference: {selectedOrder.payment_id}</p>
                )}
                <p className="text-sm text-muted-foreground">Status: {getStatusLabel(selectedOrder.status)}</p>
                <p className="mt-2 text-sm font-semibold text-espresso">
                  Total: {formatMoney(selectedOrder.total_amount)}
                </p>
              </div>
            </div>

            {(selectedOrder.special_notes || (selectedOrder.reference_images || []).length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedOrder.special_notes && (
                  <div className="rounded-md border bg-white p-4">
                    <p className="text-sm font-medium text-espresso">Order notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedOrder.special_notes}
                    </p>
                  </div>
                )}
                {(selectedOrder.reference_images || []).length > 0 && (
                  <div className="rounded-md border bg-white p-4">
                    <p className="text-sm font-medium text-espresso">Reference images</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {(selectedOrder.reference_images || []).map((rawUrl, index) => {
                        const url = rawUrl || '';
                        const openImage = () => {
                          try {
                            const base64 = url.replace(/^data:[^;]+;base64,/, '');
                            const mimeMatch = url.match(/^data:([^;]+);/);
                            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                            const bytes = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0));
                            const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
                            const openedWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                            if (openedWindow) openedWindow.opener = null;
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                          } catch {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }
                        };

                        return (
                          <div
                            key={`${url}-${index}`}
                            className="group relative block h-24 w-24 cursor-pointer overflow-hidden rounded-md border border-muted/60 bg-muted"
                            title="Open image in new tab"
                            onClick={openImage}
                          >
                            <img
                              src={url}
                              alt={`Reference ${index + 1}`}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-espresso">Items</p>
              <div className="mt-2 space-y-2">
                {(selectedOrder.items || []).map((item) => {
                  const extras = parseNumber(item.extras_total || 0);
                  const summaryParts = getCleanItemSummary(item);

                  return (
                    <div key={item.id} className="space-y-2 rounded-md border bg-white p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-espresso">{item.product_name || `Product #${item.product}`}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty {item.quantity}
                            {summaryParts.length > 0 ? ` / ${summaryParts.join(' / ')}` : ''}
                          </p>
                          {extras > 0 && <p className="text-xs text-amber-700">Extras: {formatMoney(extras)}</p>}
                        </div>
                        <div className="whitespace-nowrap font-semibold text-espresso">
                          {formatMoney(item.price)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(selectedOrder.items || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No items found for this order.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact info</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">ORD-{order.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {order.first_name} {order.last_name}
                    </div>
                    <div className="max-w-[220px] truncate text-xs text-muted-foreground">{order.address}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{order.email}</div>
                    <div className="text-xs text-muted-foreground">{order.phone}</div>
                  </TableCell>
                  <TableCell>{formatMoney(order.total_amount)}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                      {getStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void viewOrder(order.id)}
                      disabled={isLoadingDetail}
                    >
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void updateStatus(order.id, 'mark_paid')}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Paid
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void updateStatus(order.id, 'mark_delivered')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" /> Delivered
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void downloadDeliveryPdf(order.id)}>
                      <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No orders yet.
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

export default Orders;
