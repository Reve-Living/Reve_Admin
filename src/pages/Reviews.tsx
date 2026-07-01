import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Eye, EyeOff, Trash2, Star, PlusCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiUpload } from "../lib/api";
import type { Product, Review, ReviewMedia } from "../lib/types";

type StatusFilter = "all" | "visible" | "hidden";
const REVIEW_MEDIA_ACCEPT = "image/*,video/*";
const MAX_REVIEW_MEDIA = 6;

type SelectedReviewMedia = {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video";
};

const Reviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewMediaFiles, setReviewMediaFiles] = useState<SelectedReviewMedia[]>([]);
  const reviewMediaFilesRef = useRef<SelectedReviewMedia[]>([]);
  const [form, setForm] = useState({
    product: "",
    name: "",
    rating: 5,
    comment: "",
    is_visible: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reviewsRes, productsRes] = await Promise.all([
        apiGet<Review[]>("/reviews/"),
        apiGet<Product[]>("/products/?admin_summary=1"),
      ]);
      setReviews(reviewsRes);
      setProducts(productsRes);
    } catch (error) {
      toast.error("Failed to load reviews");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      reviewMediaFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  useEffect(() => {
    reviewMediaFilesRef.current = reviewMediaFiles;
  }, [reviewMediaFiles]);

  const handleReviewMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setReviewMediaFiles((prev) => {
      const remainingSlots = Math.max(MAX_REVIEW_MEDIA - prev.length, 0);
      if (remainingSlots === 0) {
        toast.error(`Please upload no more than ${MAX_REVIEW_MEDIA} images or videos`);
        return prev;
      }

      const accepted = files
        .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
        .slice(0, remainingSlots)
        .map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        }));

      if (accepted.length < files.length) {
        toast.error(`Only ${remainingSlots} more media file${remainingSlots === 1 ? "" : "s"} can be added`);
      }

      return [...prev, ...accepted];
    });

    event.target.value = "";
  };

  const removeReviewMedia = (id: string) => {
    setReviewMediaFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.name || !form.comment) {
      toast.error("Product, name, and review text are required");
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedMedia = await Promise.all(
        reviewMediaFiles.map((item) =>
          apiUpload("/reviews/upload_media/", item.file).then((uploaded) => ({
            url: uploaded.url,
            type: (uploaded.type || item.type) as ReviewMedia["type"],
            name: uploaded.name || item.file.name,
            mime_type: uploaded.mime_type || item.file.type,
          }))
        )
      );

      const payload = {
        product: Number(form.product),
        name: form.name,
        rating: form.rating,
        comment: form.comment,
        media: uploadedMedia,
        is_visible: form.is_visible,
      };
      const created = await apiPost<Review>("/reviews/", payload);
      setReviews((prev) => [created, ...prev]);
      toast.success("Review created");
      reviewMediaFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setReviewMediaFiles([]);
      setForm({ product: "", name: "", rating: 5, comment: "", is_visible: true });
    } catch (error) {
      toast.error("Failed to create review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (review: Review) => {
    try {
      const updated = await apiPost<Review>(`/reviews/${review.id}/set_visibility/`, {
        is_visible: !review.is_visible,
      });
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(updated.is_visible ? "Review unhidden" : "Review hidden");
    } catch (error) {
      toast.error("Failed to update visibility");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this review?")) return;
    try {
      await apiDelete(`/reviews/${id}/`);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success("Review deleted");
    } catch (error) {
      toast.error("Failed to delete review");
    }
  };

  const filteredReviews = useMemo(() => {
    if (filter === "visible") return reviews.filter((r) => r.is_visible);
    if (filter === "hidden") return reviews.filter((r) => !r.is_visible);
    return reviews;
  }, [filter, reviews]);

  const stats = {
    total: reviews.length,
    visible: reviews.filter((r) => r.is_visible).length,
    hidden: reviews.filter((r) => !r.is_visible).length,
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );

  const renderReviewMedia = (media?: ReviewMedia[]) => {
    if (!media?.length) return <span className="text-xs text-muted-foreground">No media</span>;

    return (
      <div className="grid grid-cols-2 gap-2">
        {media.slice(0, 4).map((item, index) =>
          item.type === "video" ? (
            <video
              key={`${item.url}-${index}`}
              src={item.url}
              controls
              className="h-20 w-24 rounded-md border border-border object-cover"
            />
          ) : (
            <img
              key={`${item.url}-${index}`}
              src={item.url}
              alt={item.name || "Review media"}
              className="h-20 w-24 rounded-md border border-border object-cover"
            />
          )
        )}
        {media.length > 4 && <span className="text-xs text-muted-foreground">+{media.length - 4} more</span>}
      </div>
    );
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif font-bold text-espresso">Customer Reviews</h2>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Reviews</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("visible")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.visible}</div>
            <p className="text-sm text-muted-foreground">Visible</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("hidden")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{stats.hidden}</div>
            <p className="text-sm text-muted-foreground">Hidden</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              Add Review
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Product</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Customer name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Rating</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-24 rounded-md border border-input px-3 py-2"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: Number(e.target.value) || 0 })}
                />
                {renderStars(form.rating)}
              </div>
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm font-medium text-gray-700">Visibility</label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={form.is_visible ? "default" : "outline"}
                  onClick={() => setForm({ ...form, is_visible: !form.is_visible })}
                >
                  {form.is_visible ? "Visible" : "Hidden"}
                </Button>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Review</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 min-h-[120px]"
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>
            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="admin-review-media"
                  className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition hover:border-primary"
                >
                  Upload review images/videos
                </label>
                <input
                  id="admin-review-media"
                  type="file"
                  className="sr-only"
                  accept={REVIEW_MEDIA_ACCEPT}
                  multiple
                  onChange={handleReviewMediaChange}
                />
                <span className="text-xs text-muted-foreground">Optional. Up to {MAX_REVIEW_MEDIA} files.</span>
              </div>

              {reviewMediaFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {reviewMediaFiles.map((item) => (
                    <div key={item.id} className="relative overflow-hidden rounded-md border border-border">
                      {item.type === "video" ? (
                        <video src={item.previewUrl} className="h-28 w-full object-cover" muted />
                      ) : (
                        <img src={item.previewUrl} alt={item.file.name} className="h-28 w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeReviewMedia(item.id)}
                        className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-white">
                        <p className="truncate">{item.file.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Review"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {filter === "all" ? "All Reviews" : `${filter === "visible" ? "Visible" : "Hidden"} Reviews`}
            </CardTitle>
            {filter !== "all" && (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading reviews...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No reviews found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{review.name || "Anonymous"}</div>
                          {review.created_by_username && (
                            <div className="text-xs text-muted-foreground">by {review.created_by_username}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{review.product_name || review.product}</TableCell>
                      <TableCell>{renderStars(review.rating)}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm line-clamp-2">{review.comment}</p>
                      </TableCell>
                      <TableCell>{renderReviewMedia(review.media)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(review.created_at)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            review.is_visible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {review.is_visible ? "Visible" : "Hidden"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleToggle(review)} title="Toggle">
                            {review.is_visible ? (
                              <EyeOff className="h-4 w-4 text-gray-600" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(review.id)}
                            title="Delete review"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reviews;
