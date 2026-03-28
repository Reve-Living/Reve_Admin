import { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Eye, CheckCircle, Download } from 'lucide-react';
import { apiDownload, apiGet, apiPost } from '../lib/api';
import type { Order } from '../lib/types';
import { toast } from 'sonner';

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
  if (/(cm|inch|inches|\")/.test(lower) && /(length|width|height)/.test(lower)) return false;
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
    if (!cleaned) return;
    if (!isDisplayableOrderPart(cleaned)) return;
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
    addPart(`Assembly Service: £${Number(item.assembly_service_price || 0).toFixed(2)}`);
  }

  return sortOrderParts(parts);
};

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const loadOrders = async () => {
    try {
      const data = await apiGet<Order[]>('/orders/');
      setOrders(data);
    } catch {
      toast.error('Failed to load orders');
    }
  };

  useEffect(() => {
    loadOrders();
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

  const updateStatus = async (id: number, action: 'mark_paid' | 'mark_delivered') => {
    try {
      await apiPost(`/orders/${id}/${action}/`, {});
      toast.success('Order updated');
      await loadOrders();
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Orders</h2>
        <p className="text-muted-foreground">Monitor and manage customer orders.</p>
      </div>

      {selectedOrder && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-espresso">Order ORD-{selectedOrder.id}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.first_name} {selectedOrder.last_name} • {selectedOrder.email}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => downloadDeliveryPdf(selectedOrder.id)}>
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border bg-white p-4">
                <p className="text-sm font-medium text-espresso">Shipping Address</p>
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
                <p className="text-sm font-medium text-espresso">Order Summary</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Payment: {selectedOrder.payment_method}
                </p>
                <p className="text-sm text-muted-foreground">
                  Status: {getStatusLabel(selectedOrder.status)}
                </p>
                <p className="mt-2 text-sm font-semibold text-espresso">
                  Total: £{Number(selectedOrder.total_amount).toFixed(2)}
                </p>
              </div>
            </div>

            {(selectedOrder.special_notes || (selectedOrder.reference_images || []).length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {selectedOrder.special_notes && (
                  <div className="rounded-md border bg-white p-4">
                    <p className="text-sm font-medium text-espresso">Customer Notes</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedOrder.special_notes}
                    </p>
                  </div>
                )}
                {(selectedOrder.reference_images || []).length > 0 && (
                  <div className="rounded-md border bg-white p-4">
                    <p className="text-sm font-medium text-espresso">Reference Images</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {selectedOrder.reference_images!.map((rawUrl, idx) => {
                        const url = rawUrl || '';
                        const openImage = () => {
                          try {
                            const base64 = url.replace(/^data:[^;]+;base64,/, '');
                            const mimeMatch = url.match(/^data:([^;]+);/);
                            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                            const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                            const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
                            const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                            if (win) win.opener = null;
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                          } catch {
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }
                        };

                        return (
                          <div
                            key={idx}
                            className="group relative block h-24 w-24 cursor-pointer overflow-hidden rounded-md border border-muted/60 bg-muted"
                            title="Open image in new tab"
                            onClick={openImage}
                          >
                            <img
                              src={url}
                              alt={`Reference ${idx + 1}`}
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
                  const extras = Number(item.extras_total || 0);
                  const summaryParts = getCleanItemSummary(item);

                  return (
                    <div key={item.id} className="space-y-2 rounded-md border bg-white p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-espresso">{item.product_name || `Product #${item.product}`}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty {item.quantity}
                            {summaryParts.length > 0 ? ` • ${summaryParts.join(' • ')}` : ''}
                          </p>
                          {extras > 0 && (
                            <p className="text-xs text-amber-700">Extras: £{extras.toFixed(2)}</p>
                          )}
                        </div>
                        <div className="whitespace-nowrap font-semibold text-espresso">
                          £{Number(item.price).toFixed(2)}
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
                <TableHead>Contact Info</TableHead>
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
                    <div className="max-w-[200px] truncate text-xs text-muted-foreground">{order.address}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{order.email}</div>
                    <div className="text-xs text-muted-foreground">{order.phone}</div>
                  </TableCell>
                  <TableCell>£{Number(order.total_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                      {getStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewOrder(order.id)}
                      disabled={isLoadingDetail && selectedOrder?.id === order.id}
                    >
                      <Eye className="mr-2 h-4 w-4" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(order.id, 'mark_paid')}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Paid
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(order.id, 'mark_delivered')}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Delivered
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadDeliveryPdf(order.id)}>
                      <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
