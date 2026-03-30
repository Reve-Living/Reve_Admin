import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '../lib/api';
import type { LifestyleArticle, LifestyleSection } from '../lib/types';
import { IMAGE_UPLOAD_ACCEPT } from '../lib/upload';
import { toast } from 'sonner';

type SectionForm = {
  title: string;
  subtitle: string;
  is_active: boolean;
};

type ArticleForm = {
  title: string;
  description: string;
  image: string;
  read_more_type: 'none' | 'url' | 'pdf';
  read_more_url: string;
  read_more_pdf: string;
  is_active: boolean;
  sort_order: number;
};

const emptySectionForm: SectionForm = {
  title: 'Transform Your Home',
  subtitle: '',
  is_active: true,
};

const emptyArticleForm: ArticleForm = {
  title: '',
  description: '',
  image: '',
  read_more_type: 'none',
  read_more_url: '',
  read_more_pdf: '',
  is_active: true,
  sort_order: 0,
};

const LifestyleContent = () => {
  const [sections, setSections] = useState<LifestyleSection[]>([]);
  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);
  const [articleForm, setArticleForm] = useState<ArticleForm>(emptyArticleForm);
  const [editingArticleId, setEditingArticleId] = useState<number | null>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const activeSection = sections[0] || null;
  const sectionId = activeSection?.id || null;
  const articles = useMemo(
    () => [...(activeSection?.articles || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [activeSection?.articles]
  );

  const loadData = async () => {
    try {
      const data = await apiGet<LifestyleSection[]>('/lifestyle-sections/');
      const normalized = Array.isArray(data) ? data : [];
      setSections(normalized);
      const first = normalized[0];
      if (first) {
        setSectionForm({
          title: first.title || 'Transform Your Home',
          subtitle: first.subtitle || '',
          is_active: first.is_active !== false,
        });
      } else {
        setSectionForm(emptySectionForm);
      }
    } catch {
      setSections([]);
      toast.error('Failed to load lifestyle content');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetArticleForm = () => {
    setArticleForm(emptyArticleForm);
    setEditingArticleId(null);
  };

  const handleUpload = async (file: File, field: 'image' | 'read_more_pdf') => {
    if (field === 'image') setIsUploadingImage(true);
    else setIsUploadingPdf(true);

    try {
      const res = await apiUpload('/uploads/', file);
      setArticleForm((prev) => ({ ...prev, [field]: res.url }));
      toast.success(field === 'image' ? 'Image uploaded' : 'PDF uploaded');
    } catch {
      toast.error(`Failed to upload ${field === 'image' ? 'image' : 'PDF'}`);
    } finally {
      if (field === 'image') setIsUploadingImage(false);
      else setIsUploadingPdf(false);
    }
  };

  const handleSaveSection = async () => {
    if (isSavingSection) return;
    setIsSavingSection(true);
    try {
      const payload = {
        title: sectionForm.title.trim(),
        subtitle: sectionForm.subtitle.trim(),
        is_active: sectionForm.is_active,
      };
      if (sectionId) {
        await apiPut(`/lifestyle-sections/${sectionId}/`, payload);
        toast.success('Section updated');
      } else {
        await apiPost('/lifestyle-sections/', payload);
        toast.success('Section created');
      }
      await loadData();
    } catch {
      toast.error('Failed to save section');
    } finally {
      setIsSavingSection(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!sectionId) {
      toast.error('Save the section first');
      return;
    }
    if (!articleForm.title.trim()) {
      toast.error('Article title is required');
      return;
    }
    if (!articleForm.image.trim()) {
      toast.error('Article image is required');
      return;
    }
    if (articleForm.read_more_type === 'url' && !articleForm.read_more_url.trim()) {
      toast.error('Add a URL for Read More');
      return;
    }
    if (articleForm.read_more_type === 'pdf' && !articleForm.read_more_pdf.trim()) {
      toast.error('Add a PDF for Read More');
      return;
    }

    setIsSavingArticle(true);
    const payload = {
      section: sectionId,
      title: articleForm.title.trim(),
      description: articleForm.description.trim(),
      image: articleForm.image.trim(),
      read_more_type: articleForm.read_more_type,
      read_more_url: articleForm.read_more_url.trim(),
      read_more_pdf: articleForm.read_more_pdf.trim(),
      is_active: articleForm.is_active,
      sort_order: Number.isFinite(articleForm.sort_order) ? articleForm.sort_order : 0,
    };

    try {
      if (editingArticleId) {
        await apiPut(`/lifestyle-articles/${editingArticleId}/`, payload);
        toast.success('Article updated');
      } else {
        await apiPost('/lifestyle-articles/', payload);
        toast.success('Article created');
      }
      resetArticleForm();
      await loadData();
    } catch {
      toast.error('Failed to save article');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleEditArticle = (article: LifestyleArticle) => {
    setEditingArticleId(article.id || null);
    setArticleForm({
      title: article.title || '',
      description: article.description || '',
      image: article.image || '',
      read_more_type: article.read_more_type || 'none',
      read_more_url: article.read_more_url || '',
      read_more_pdf: article.read_more_pdf || '',
      is_active: article.is_active !== false,
      sort_order: article.sort_order || 0,
    });
  };

  const handleDeleteArticle = async (id?: number) => {
    if (!id) return;
    try {
      await apiDelete(`/lifestyle-articles/${id}/`);
      toast.success('Article deleted');
      if (editingArticleId === id) resetArticleForm();
      await loadData();
    } catch {
      toast.error('Failed to delete article');
    }
  };

  const onUploadFile = (event: ChangeEvent<HTMLInputElement>, field: 'image' | 'read_more_pdf') => {
    const file = event.target.files?.[0];
    if (file) handleUpload(file, field);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Lifestyle Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage the homepage "Transform Your Home" title, subtitle, and the two Read More article blocks.
          </p>
        </div>
        <Button variant="outline" onClick={resetArticleForm}>
          Clear article form
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section Heading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Title</label>
              <Input value={sectionForm.title} onChange={(e) => setSectionForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-espresso md:self-end">
              <input
                type="checkbox"
                checked={sectionForm.is_active}
                onChange={(e) => setSectionForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Show this section on site
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Subtitle</label>
            <textarea
              value={sectionForm.subtitle}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              rows={3}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Add the line that appears under the section title."
            />
          </div>
          <Button onClick={handleSaveSection} disabled={isSavingSection}>
            {sectionId ? 'Update Section' : 'Create Section'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Articles</CardTitle>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles yet. Add up to 2 active ones for the homepage layout.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Read More</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {article.image && <img src={article.image} alt="" className="h-12 w-16 rounded object-cover" />}
                        <div>
                          <div>{article.title}</div>
                          {article.description && <div className="text-xs text-muted-foreground line-clamp-2">{article.description}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {article.read_more_type === 'pdf' ? 'PDF' : article.read_more_type === 'url' ? 'URL' : 'None'}
                    </TableCell>
                    <TableCell>{article.is_active !== false ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>{article.sort_order || 0}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditArticle(article)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingArticleId ? 'Edit Article' : 'New Article'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Article Title</label>
              <Input value={articleForm.title} onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Sort Order</label>
              <Input type="number" value={articleForm.sort_order} onChange={(e) => setArticleForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Description</label>
            <textarea
              value={articleForm.description}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Add the article summary text shown beside the image."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Article Image</label>
              <Input
                value={articleForm.image}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="Paste image URL here, or upload from computer below"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Choose image from computer</label>
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={(e) => onUploadFile(e, 'image')}
                  disabled={isUploadingImage}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  You can either paste an image URL or choose a file from your computer.
                </p>
              </div>
            </div>
            {articleForm.image && <img src={articleForm.image} alt="Preview" className="h-40 w-full rounded object-cover" />}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Button Type</label>
              <select
                value={articleForm.read_more_type}
                onChange={(e) =>
                  setArticleForm((prev) => ({ ...prev, read_more_type: e.target.value as 'none' | 'url' | 'pdf' }))
                }
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="none">No button</option>
                <option value="url">Open URL</option>
                <option value="pdf">Open PDF</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Choose whether the Read More button should open a web link or a PDF file.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-espresso md:self-end">
              <input
                type="checkbox"
                checked={articleForm.is_active}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Active on site
            </label>
          </div>

          {articleForm.read_more_type === 'url' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Button Leads To</label>
              <Input
                value={articleForm.read_more_url}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, read_more_url: e.target.value }))}
                placeholder="https://... or /some-page"
              />
              <p className="text-xs text-muted-foreground">
                Paste the URL the customer should open when clicking Read More.
              </p>
            </div>
          )}

          {articleForm.read_more_type === 'pdf' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Button Leads To</label>
              <Input
                value={articleForm.read_more_pdf}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, read_more_pdf: e.target.value }))}
                placeholder="Paste PDF link here, or upload PDF from computer below"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Choose PDF from computer</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => onUploadFile(e, 'read_more_pdf')}
                  disabled={isUploadingPdf}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a PDF from your computer, or paste a PDF link manually.
                </p>
              </div>
            </div>
          )}

          <Button onClick={handleSaveArticle} disabled={isSavingArticle || isUploadingImage || isUploadingPdf}>
            {editingArticleId ? 'Update Article' : 'Create Article'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LifestyleContent;
