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
  card_image: string;
  image: string;
  article_title: string;
  article_intro: string;
  article_body: string;
  article_content: Array<{
    type: 'paragraph' | 'image';
    text?: string;
    url?: string;
  }>;
  article_sections: ArticleSectionBlock[];
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

type ArticleSectionBlock = {
  heading: string;
  text: string;
  image?: string;
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
  card_image: '',
  image: '',
  article_title: '',
  article_intro: '',
  article_body: '',
  article_content: [],
  article_sections: [],
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

const normalizeArticleSections = (
  value: LifestyleArticle['article_sections'] | ArticleForm['article_sections']
): ArticleSectionBlock[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((section): ArticleSectionBlock | null => {
      if (!section || typeof section !== 'object') return null;
      return {
        heading: typeof section.heading === 'string' ? section.heading : '',
        text: typeof section.text === 'string' ? section.text : '',
        image: typeof section.image === 'string' ? section.image : '',
      };
    })
    .filter((section): section is ArticleSectionBlock => Boolean(section));
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

  const handleUpload = async (file: File, field: 'card_image' | 'image' | 'read_more_pdf') => {
    if (field === 'image' || field === 'card_image') setIsUploadingImage(true);
    else setIsUploadingPdf(true);

    try {
      const res = await apiUpload('/uploads/', file);
      setArticleForm((prev) => ({ ...prev, [field]: res.url }));
      toast.success(field === 'read_more_pdf' ? 'PDF uploaded' : 'Image uploaded');
    } catch {
      toast.error(`Failed to upload ${field === 'read_more_pdf' ? 'PDF' : 'image'}`);
    } finally {
      if (field === 'image' || field === 'card_image') setIsUploadingImage(false);
      else setIsUploadingPdf(false);
    }
  };

  const handleSectionImageUpload = async (file: File, index: number) => {
    setIsUploadingImage(true);
    try {
      const res = await apiUpload('/uploads/', file);
      setArticleForm((prev) => ({
        ...prev,
        article_sections: prev.article_sections.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, image: res.url } : section
        ),
      }));
      toast.success('Section image uploaded');
    } catch {
      toast.error('Failed to upload section image');
    } finally {
      setIsUploadingImage(false);
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
    if (!articleForm.card_image.trim()) {
      toast.error('Homepage card image is required');
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
    const normalizedArticleSections = normalizeArticleSections(articleForm.article_sections);
    if (articleForm.read_more_type === 'article' && !articleForm.article_body.trim()) {
      const hasStructuredSections = normalizedArticleSections.length > 0;
      const hasContentBlocks = normalizeArticleContent(articleForm.article_content).length > 0;
      if (!hasStructuredSections && !hasContentBlocks) {
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
      card_image: articleForm.card_image.trim(),
      image: articleForm.image.trim(),
      read_more_type: articleForm.read_more_type,
      article_title: articleForm.article_title.trim(),
      article_intro: articleForm.article_intro.trim(),
      article_body: articleForm.article_body.trim() || fallbackArticleBody,
      article_content: normalizedArticleContent,
      article_sections: normalizedArticleSections,
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
      card_image: article.card_image || '',
      image: article.image || '',
      article_title: article.article_title || '',
      article_intro: article.article_intro || '',
      article_body: article.article_body || '',
      article_content: normalizeArticleContent(article.article_content),
      article_sections: normalizeArticleSections(article.article_sections),
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

  const onUploadFile = (event: ChangeEvent<HTMLInputElement>, field: 'card_image' | 'image' | 'read_more_pdf') => {
    const file = event.target.files?.[0];
    if (file) handleUpload(file, field);
  };

  const updateArticleSection = (index: number, patch: Partial<ArticleSectionBlock>) => {
    setArticleForm((prev) => ({
      ...prev,
      article_sections: prev.article_sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      ),
    }));
  };

  const addArticleSection = () => {
    setArticleForm((prev) => ({
      ...prev,
      article_sections: [...prev.article_sections, { heading: '', text: '', image: '' }],
    }));
  };

  const removeArticleSection = (index: number) => {
    setArticleForm((prev) => ({
      ...prev,
      article_sections: prev.article_sections.filter((_, sectionIndex) => sectionIndex !== index),
    }));
  };

  const moveArticleSection = (index: number, direction: -1 | 1) => {
    setArticleForm((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.article_sections.length) return prev;
      const articleSections = [...prev.article_sections];
      const [section] = articleSections.splice(index, 1);
      articleSections.splice(nextIndex, 0, section);
      return { ...prev, article_sections: articleSections };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-espresso">Lifestyle Content</h1>
          <p className="text-sm text-muted-foreground">
            Manage the homepage top intro, the two homepage cards, and the full read more pages.
          </p>
        </div>
        <Button variant="outline" onClick={resetArticleForm}>
          Clear article form
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Homepage Top Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Homepage Heading</label>
              <Input value={sectionForm.title} onChange={(e) => setSectionForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-espresso md:self-end">
              <input
                type="checkbox"
                checked={sectionForm.is_active}
                onChange={(e) => setSectionForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Show this section on the homepage
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Top Intro Text</label>
            <textarea
              value={sectionForm.subtitle}
              onChange={(e) => setSectionForm((prev) => ({ ...prev, subtitle: e.target.value }))}
              rows={3}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Add the intro text shown under the homepage heading."
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
            <p className="text-sm text-muted-foreground">No cards yet. Active entries will show on the homepage and open into full read more pages.</p>
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
                        {(article.card_image || article.image) && (
                          <img src={article.card_image || article.image} alt="" className="h-12 w-16 rounded object-cover" />
                        )}
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
          <CardTitle>{editingArticleId ? 'Edit Homepage Card + Read More Page' : 'New Homepage Card + Read More Page'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Homepage Card Title</label>
              <Input value={articleForm.title} onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Homepage Card Order</label>
              <Input type="number" value={articleForm.sort_order} onChange={(e) => setArticleForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Read More Page URL Slug</label>
            <Input
              value={articleForm.slug}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="choose-the-right-bed-for-your-space"
            />
            <p className="text-xs text-muted-foreground">This controls the end part of the read more page link.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-espresso">Homepage Card Text</label>
            <textarea
              value={articleForm.description}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Add the short text shown on the homepage card."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Page Heading</label>
              <Input
                value={articleForm.article_title}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, article_title: e.target.value }))}
                placeholder="Main heading shown at the top of the read more page."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Button Action</label>
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
            <label className="text-sm font-medium text-espresso">Read More Page Intro</label>
            <textarea
              value={articleForm.article_intro}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, article_intro: e.target.value }))}
              rows={4}
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Intro text shown under the read more page heading."
            />
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <label className="text-sm font-medium text-espresso">Read More Page Sections</label>
                <p className="text-xs text-muted-foreground">
                  Add the sections shown lower down on the read more page. Each section needs a heading, text, and its own image.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addArticleSection}>
                Add Section
              </Button>
            </div>

            {articleForm.article_sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No read more sections added yet.</p>
            ) : (
              <div className="space-y-4">
                {articleForm.article_sections.map((section, index) => (
                  <div key={`article-section-${index}`} className="space-y-3 rounded-md border bg-muted/20 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Read More Section {index + 1}</span>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => moveArticleSection(index, -1)}>
                          Up
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => moveArticleSection(index, 1)}>
                          Down
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeArticleSection(index)}>
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso">Section Heading</label>
                      <Input
                        value={section.heading}
                        onChange={(e) => updateArticleSection(index, { heading: e.target.value })}
                        placeholder="Example: Size & Room Fit"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-espresso">Section Text</label>
                      <textarea
                        value={section.text}
                        onChange={(e) => updateArticleSection(index, { text: e.target.value })}
                        rows={6}
                        className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Text shown for this read more section"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-espresso">Section Image</label>
                        <Input
                          value={section.image || ''}
                          onChange={(e) => updateArticleSection(index, { image: e.target.value })}
                          placeholder="Paste the image URL for this section, or upload below"
                        />
                        <input
                          type="file"
                          accept={IMAGE_UPLOAD_ACCEPT}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSectionImageUpload(file, index);
                          }}
                          disabled={isUploadingImage}
                          className="text-sm"
                        />
                      </div>
                      {section.image ? <img src={section.image} alt={`Section ${index + 1}`} className="h-40 w-full rounded object-cover" /> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Extra Text Only Body</label>
            <textarea
              value={articleForm.article_body}
              onChange={(e) => setArticleForm((prev) => ({ ...prev, article_body: e.target.value }))}
              rows={8}
              className="flex min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional. Only use this if you want extra plain text instead of section blocks."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Home Image</label>
              <Input
                value={articleForm.card_image}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, card_image: e.target.value }))}
                placeholder="Image shown on the homepage card"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Upload home image</label>
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={(e) => onUploadFile(e, 'card_image')}
                  disabled={isUploadingImage}
                  className="text-sm"
                />
              </div>
            </div>
            {articleForm.card_image && (
              <img src={articleForm.card_image} alt="Homepage card preview" className="h-40 w-full rounded object-cover" />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More Top Image</label>
              <Input
                value={articleForm.image}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="Image shown at the top of the read more page"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Upload read more top image</label>
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  onChange={(e) => onUploadFile(e, 'image')}
                  disabled={isUploadingImage}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Leave this empty if you want the read more page to use the same image as the homepage card.
                </p>
              </div>
            </div>
            {(articleForm.image || articleForm.card_image) && (
              <img
                src={articleForm.image || articleForm.card_image}
                alt="Article header preview"
                className="h-40 w-full rounded object-cover"
              />
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">How Read More Should Open</label>
              <p className="text-xs text-muted-foreground">
                Usually you should use article page. URL and PDF are only for special cases.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-espresso md:self-end">
              <input
                type="checkbox"
                checked={articleForm.is_active}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Show this card on the site
            </label>
          </div>

          {articleForm.read_more_type === 'url' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More URL</label>
              <Input
                value={articleForm.read_more_url}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, read_more_url: e.target.value }))}
                placeholder="https://... or /some-page"
              />
              <p className="text-xs text-muted-foreground">
                Paste the link that should open when someone clicks Read More.
              </p>
            </div>
          )}

          {articleForm.read_more_type === 'article' && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <label className="text-sm font-medium text-espresso">Read More Page</label>
              <p className="text-xs text-muted-foreground">
                After saving, this will open as its own full article page and show more article suggestions at the end.
              </p>
              {editingArticleId && articleForm.title.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Link will look like: `/transform-your-home/...`
                </p>
              ) : null}
            </div>
          )}

          {articleForm.read_more_type === 'pdf' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-espresso">Read More PDF</label>
              <Input
                value={articleForm.read_more_pdf}
                onChange={(e) => setArticleForm((prev) => ({ ...prev, read_more_pdf: e.target.value }))}
                placeholder="Paste the PDF link here, or upload a PDF below"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Upload PDF</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => onUploadFile(e, 'read_more_pdf')}
                  disabled={isUploadingPdf}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a PDF or paste its link manually.
                </p>
              </div>
            </div>
          )}

          <Button onClick={handleSaveArticle} disabled={isSavingArticle || isUploadingImage || isUploadingPdf}>
            {editingArticleId ? 'Update Card + Read More Page' : 'Create Card + Read More Page'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LifestyleContent;
