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
  slug: string;
  description: string;
  image: string;
  article_title: string;
  article_intro: string;
  article_body: string;
  article_content: Array<{
    type: 'paragraph' | 'image';
    text?: string;
    url?: string;
  }>;
  read_more_type: 'none' | 'url' | 'pdf' | 'article';
  read_more_url: string;
  read_more_pdf: string;
  is_active: boolean;
  sort_order: number;
};

type ArticleContentBlock = {
  type: 'paragraph' | 'image';
  text?: string;
  url?: string;
};

const emptySectionForm: SectionForm = {
  title: 'Transform Your Home',
  subtitle: '',
  is_active: true,
};

const emptyArticleForm: ArticleForm = {
  title: '',
  slug: '',
  description: '',
  image: '',
  article_title: '',
  article_intro: '',
  article_body: '',
  article_content: [],
  read_more_type: 'none',
  read_more_url: '',
  read_more_pdf: '',
  is_active: true,
  sort_order: 0,
};

const normalizeArticleContent = (
  value: LifestyleArticle['article_content'] | ArticleForm['article_content']
): ArticleContentBlock[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((block): ArticleContentBlock | null => {
      if (!block || typeof block !== 'object') return null;
      const type = block.type === 'image' ? 'image' : 'paragraph';
      return {
        type,
        text: typeof block.text === 'string' ? block.text : '',
        url: typeof block.url === 'string' ? block.url : '',
      };
    })
    .filter((block): block is ArticleContentBlock => Boolean(block));
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
    if (articleForm.read_more_type === 'article' && !articleForm.article_body.trim()) {
      const hasContentBlocks = normalizeArticleContent(articleForm.article_content).length > 0;
      if (!hasContentBlocks) {
        toast.error('Add the full article content');
        return;
      }
    }

    setIsSavingArticle(true);
    const normalizedArticleContent = normalizeArticleContent(articleForm.article_content);
    const fallbackArticleBody = normalizedArticleContent
      .filter((block) => block.type === 'paragraph' && block.text?.trim())
      .map((block) => block.text!.trim())
      .join('\n\n');
    const payload = {
      section: sectionId,
      title: articleForm.title.trim(),
      slug: articleForm.slug.trim(),
      description: articleForm.description.trim(),
      image: articleForm.image.trim(),
      read_more_type: articleForm.read_more_type,
      article_title: articleForm.article_title.trim(),
      article_intro: articleForm.article_intro.trim(),
      article_body: articleForm.article_body.trim() || fallbackArticleBody,
      article_content: normalizedArticleContent,
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
      slug: article.slug || '',
      description: article.description || '',
      image: article.image || '',
      article_title: article.article_title || '',
      article_intro: article.article_intro || '',
      article_body: article.article_body || '',
      article_content: normalizeArticleContent(article.article_content),
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

  const updateArticleContentBlock = (
    index: number,
    patch: Partial<NonNullable<ArticleForm['article_content'][number]>>
  ) => {
    setArticleForm((prev) => ({
      ...prev,
      article_content: prev.article_content.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block
      ),
    }));
  };

  const addArticleContentBlock = (type: 'paragraph' | 'image') => {
    setArticleForm((prev) => ({
      ...prev,
      article_content: [...prev.article_content, type === 'image' ? { type, url: '' } : { type, text: '' }],
    }));
  };

  const removeArticleContentBlock = (index: number) => {
    setArticleForm((prev) => ({
      ...prev,
      article_content: prev.article_content.filter((_, blockIndex) => blockIndex !== index),
    }));
  };

  const moveArticleContentBlock = (index: number, direction: -1 | 1) => {
    setArticleForm((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.article_content.length) return prev;
      const articleContent = [...prev.article_content];
      const [block] = articleContent.splice(index, 1);
      articleContent.splice(nextIndex, 0, block);
      return { ...prev, article_content: articleContent };
    });
  };

  const useBlocksAsArticleBody = () => {
    const text = normalizeArticleContent(articleForm.article_content)
      .filter((block) => block.type === 'paragraph' && block.text?.trim())
      .map((block) => block.text!.trim())
      .join('\n\n');
    setArticleForm((prev) => ({ ...prev, article_body: text }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Lifestyle Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage the homepage Transform Your Home cards and the full article pages they can open into.
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
            <p className="text-sm text-muted-foreground">No articles yet. Active articles can appear on the homepage and open into full article pages.</p>
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
                      {article.read_more_type === 'pdf'
                        ? 'PDF'
                        : article.read_more_type === 'url'
                        ? 'URL'
                        : article.read_more_type === 'article'
                        ? 'Article page'
                        : 'None'}
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
            <label className="text-sm font-medium text-espresso">Slug</label>
            <Input
              value={articleForm.slug}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="choose-the-right-bed-for-your-space"
            />
            <p className="text-xs text-muted-foreground">You can edit the article URL slug here.</p>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Article Page Title</label>
              <Input
                value={articleForm.article_title}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, article_title: e.target.value }))}
                placeholder="Optional. Defaults to the article title."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Button Type</label>
              <select
                value={articleForm.read_more_type}
                onChange={(e) =>
                  setArticleForm((prev) => ({ ...prev, read_more_type: e.target.value as 'none' | 'url' | 'pdf' | 'article' }))
                }
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              >
                <option value="none">No button</option>
                <option value="article">Open article page</option>
                <option value="url">Open URL</option>
                <option value="pdf">Open PDF</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Article Page Intro</label>
            <textarea
              value={articleForm.article_intro}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, article_intro: e.target.value }))}
              rows={4}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Short intro shown near the top of the full article page."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Full Article Content</label>
            <textarea
              value={articleForm.article_body}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, article_body: e.target.value }))}
              rows={14}
              className="flex min-h-56 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste the full article here. Use blank lines to separate paragraphs."
            />
            <p className="text-xs text-muted-foreground">
              This content is used on the article page when Read More is set to article page.
            </p>
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <label className="text-sm font-medium text-espresso">Ordered Article Blocks</label>
                <p className="text-xs text-muted-foreground">
                  Edit every paragraph and image in the exact order shown on the article page.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addArticleContentBlock('paragraph')}>
                  Add Paragraph
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addArticleContentBlock('image')}>
                  Add Image
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={useBlocksAsArticleBody}>
                  Copy Paragraphs To Body
                </Button>
              </div>
            </div>

            {articleForm.article_content.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ordered blocks yet.</p>
            ) : (
              <div className="space-y-3">
                {articleForm.article_content.map((block, index) => (
                  <div key={`article-block-${index}`} className="space-y-3 rounded-md border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Block {index + 1}</span>
                        <select
                          value={block.type}
                          onChange={(e) =>
                            updateArticleContentBlock(index, {
                              type: e.target.value as 'paragraph' | 'image',
                              text: e.target.value === 'paragraph' ? block.text || '' : '',
                              url: e.target.value === 'image' ? block.url || '' : '',
                            })
                          }
                          className="rounded-md border border-input bg-white px-2 py-1 text-sm"
                        >
                          <option value="paragraph">Paragraph</option>
                          <option value="image">Image</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => moveArticleContentBlock(index, -1)}>
                          Up
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => moveArticleContentBlock(index, 1)}>
                          Down
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeArticleContentBlock(index)}>
                          Remove
                        </Button>
                      </div>
                    </div>

                    {block.type === 'paragraph' ? (
                      <textarea
                        value={block.text || ''}
                        onChange={(e) => updateArticleContentBlock(index, { text: e.target.value })}
                        rows={5}
                        className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Paragraph text"
                      />
                    ) : (
                      <div className="space-y-3">
                        <Input
                          value={block.url || ''}
                          onChange={(e) => updateArticleContentBlock(index, { url: e.target.value })}
                          placeholder="Image URL"
                        />
                        {block.url ? <img src={block.url} alt={`Block ${index + 1}`} className="max-h-64 rounded object-cover" /> : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <label className="text-sm font-medium text-espresso">Read More Behaviour</label>
              <p className="text-xs text-muted-foreground">
                Use article page for full on-site articles, or choose URL/PDF to open an external link or document.
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

          {articleForm.read_more_type === 'article' && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <label className="text-sm font-medium text-espresso">Article Page Preview Link</label>
              <p className="text-xs text-muted-foreground">
                After saving, this article will open on its own page and show related article suggestions automatically at the end.
              </p>
              {editingArticleId && articleForm.title.trim() ? (
                <p className="text-xs text-muted-foreground">
                  URL will look like: `/transform-your-home/...`
                </p>
              ) : null}
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
