import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiGet, apiPut } from '../lib/api';
import type { Collection } from '../lib/types';
import { toast } from 'sonner';

const Collections = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);

  const loadCollections = async () => {
    try {
      const data = await apiGet<Collection[]>('/collections/');
      setCollections(data);
    } catch {
      setCollections([]);
      toast.error('Failed to load collections');
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleFeaturedToggle = async (collection: Collection, checked: boolean) => {
    setUpdatingIds((prev) => [...prev, collection.id]);
    try {
      await apiPut(`/collections/${collection.id}/`, {
        name: collection.name,
        description: collection.description || '',
        image: collection.image || '',
        is_featured: checked,
        sort_order: collection.sort_order ?? 0,
        products: collection.products || [],
      });
      toast.success(
        checked ? 'Collection added to homepage top 4' : 'Collection removed from homepage top 4'
      );
      await loadCollections();
    } catch {
      toast.error('Failed to update collection display selection');
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== collection.id));
    }
  };

  const featuredCount = collections.filter((collection) => collection.is_featured).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Collections</h2>
        <p className="text-muted-foreground">
          Select which existing collections should appear in the homepage top 4.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Checked collections: {featuredCount}. The site will show only 4 collections on the homepage, and the rest will appear in View All Collections.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Show In Top 4</TableHead>
                <TableHead>Sort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.map((collection) => (
                <TableRow key={collection.id}>
                  <TableCell>
                    {collection.image ? (
                      <img
                        src={collection.image}
                        alt={collection.name}
                        className="h-12 w-16 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{collection.name}</TableCell>
                  <TableCell className="max-w-[320px] truncate">
                    {collection.description}
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(collection.is_featured)}
                        disabled={updatingIds.includes(collection.id)}
                        onChange={(e) => handleFeaturedToggle(collection, e.target.checked)}
                      />
                      <span>{collection.is_featured ? 'Selected' : 'Not selected'}</span>
                    </label>
                  </TableCell>
                  <TableCell>{collection.sort_order ?? 0}</TableCell>
                </TableRow>
              ))}
              {collections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No collections found.
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
