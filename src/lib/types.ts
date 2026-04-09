export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  show_in_collections?: boolean;
  show_in_all_collections?: boolean;
  image_alt_text?: string;
  meta_title?: string;
  meta_description?: string;
  sort_order?: number;
  subcategories?: SubCategory[];
}

export interface SubCategory {
  id: number;
  category: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  sort_order?: number;
  show_in_collections?: boolean;
  show_in_all_collections?: boolean;
  image_alt_text?: string;
  meta_title?: string;
  meta_description?: string;
}

export interface Collection {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string;
  is_featured?: boolean;
  sort_order: number;
  products?: number[];
}

export interface HeroSlide {
  id?: number;
  title: string;
  subtitle?: string;
  category?: number | null;
  subcategory?: number | null;
  selected_subcategories?: number[];
  selected_subcategory_slugs?: string[];
  selected_subcategory_names?: string[];
  category_name?: string;
  category_slug?: string;
  subcategory_name?: string;
  subcategory_slug?: string;
  cta_text?: string;
  cta_link?: string;
  image: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LifestyleArticle {
  id?: number;
  section: number;
  title: string;
  slug?: string;
  description?: string;
  card_image?: string;
  image?: string;
  article_title?: string;
  article_intro?: string;
  article_body?: string;
  article_content?: Array<{
    type: 'paragraph' | 'image';
    text?: string;
    url?: string;
  }>;
  article_sections?: Array<{
    sort_order?: number;
    heading: string;
    text: string;
    image?: string;
  }>;
  read_more_type?: 'none' | 'url' | 'pdf' | 'article';
  read_more_url?: string;
  read_more_pdf?: string;
  read_more_target?: string;
  related_articles?: Array<{
    id: number;
    title: string;
    slug: string;
    description?: string;
    card_image?: string;
    image?: string;
    read_more_target?: string;
  }>;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LifestyleSection {
  id?: number;
  title: string;
  subtitle?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  articles?: LifestyleArticle[];
}

export interface Promotion {
  id?: number;
  name: string;
  code: string;
  announcement_text?: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  categories?: number[];
  subcategories?: number[];
  category_names?: string[];
  subcategory_names?: string[];
  is_active?: boolean;
  is_currently_live?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AnnouncementSettings {
  id?: number;
  default_text?: string;
  updated_at?: string;
}

export interface ProductImage {
  id?: number;
  url: string;
  color_name?: string;
  style_name?: string;
  alt_text?: string;
}

export interface ProductVideo {
  id?: number;
  url: string;
}

export interface ProductColor {
  id?: number;
  name: string;
  hex_code?: string;
  image_url?: string;
  image?: string;
}

export interface ProductSize {
  id?: number;
  name: string;
  description?: string;
  price_delta?: number;
}

export interface ProductStyle {
  id?: number;
  size?: number | null;
  size_name?: string;
  is_shared?: boolean;
  name: string;
  icon_url?: string;
  options: ProductStyleOption[] | string[];
}

export interface ProductStyleOption {
  label: string;
  description?: string;
  icon_url?: string;
  price_delta?: number;
  size?: string;
  sizes?: string[];
  use_size_pricing?: boolean;
  size_price_overrides?: Record<string, number>;
}

export interface ProductFabric {
  id?: number;
  name: string;
  image_url?: string;
  is_shared?: boolean;
  colors?: ProductColor[];
}

export interface ProductMattress {
  id?: number;
  product_id?: number;
  product_name?: string;
  product_category_id?: number | null;
  product_subcategory_id?: number | null;
  name?: string;
  description?: string;
  features?: string;
  image_url?: string;
  price?: number | null;
  original_price?: number | null;
  enable_bunk_positions?: boolean;
  price_top?: number | null;
  price_bottom?: number | null;
  price_both?: number | null;
  source_product?: number | null;
  source_product_name?: string | null;
  source_product_slug?: string | null;
  prices?: MattressOptionPrice[];
  is_active?: boolean;
  sort_order?: number;
  categories?: number[];
  subcategories?: number[];
}

export interface MattressOptionPrice {
  id?: number;
  size_label: string;
  price?: number | null;
  original_price?: number | null;
  price_top?: number | null;
  price_bottom?: number | null;
  price_both?: number | null;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface ProductDimensionRow {
  measurement: string;
  values: Record<string, string>;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  meta_title?: string;
  meta_description?: string;
  category: number;
  // Some endpoints return the category/subcategory slugs instead of IDs; keep both for filtering.
  category_slug?: string;
  category_name?: string;
  subcategory?: number | null;
  subcategory_slug?: string;
  subcategory_name?: string;
  price: number;
  original_price?: number | null;
  discount_percentage?: number;
  description: string;
  short_description?: string;
  features: string[];
  dimensions?: ProductDimensionRow[];
  dimension_images?: { size: string; url: string }[];
  show_dimensions_table?: boolean;
  faqs?: ProductFaq[];
  delivery_info?: string;
  returns_guarantee?: string;
  delivery_title?: string;
  returns_title?: string;
  custom_info_sections?: { title?: string; content?: string }[];
  delivery_charges?: number;
  assembly_service_enabled?: boolean;
  assembly_service_price?: number;
  dimension_paragraph?: string;
  dimension_note?: string;
  is_hidden?: boolean;
  in_stock: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  sort_order?: number;
  show_size_icons?: boolean;
  rating: number;
  review_count: number;
  images: ProductImage[];
  videos: ProductVideo[];
  colors: ProductColor[];
  sizes: ProductSize[];
  styles: ProductStyle[];
  fabrics: ProductFabric[];
  mattresses?: ProductMattress[];
  filters?: {
    id?: number;
    name?: string;
    slug?: string;
    options?: {
      id?: number;
      name?: string;
      slug?: string;
    }[];
  }[];
  filter_values?: { filter_option_id?: number; filter_option?: number; filter_type?: string; option?: string }[];
}

export interface OrderItem {
  id: number;
  product: number;
  product_name?: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  style?: string;
  dimension?: string;
  dimension_details?: string;
  selected_variants?: Record<string, string>;
  extras_total?: number;
  include_dimension?: boolean;
  mattress_name?: string | null;
  mattress_id?: number | null;
  mattress_price?: number | null;
  assembly_service_selected?: boolean;
  assembly_service_price?: number;
}

export interface Order {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternative_phone?: string;
  address: string;
  city: string;
  postal_code: string;
  floor_number?: string;
  total_amount: number;
  delivery_charges: number;
  status: string;
  payment_method: string;
  payment_id?: string;
   special_notes?: string;
   reference_images?: string[];
  created_at: string;
  items: OrderItem[];
}

export interface FilterOption {
  id: number;
  name: string;
  slug: string;
  color_code?: string;
  filter_type?: number;
  filter_type_name?: string;
  display_order: number;
  is_active: boolean;
  product_count?: number;
}

export interface FilterType {
  id: number;
  name: string;
  slug: string;
  display_type: 'checkbox' | 'color_swatch' | 'radio' | 'dropdown';
  display_order: number;
  is_active: boolean;
  is_expanded_by_default: boolean;
  options: FilterOption[];
}

export interface CategoryFilter {
  id: number;
  category?: number;
  subcategory?: number;
  filter_type: number;
  display_order: number;
  is_active: boolean;
  category_name?: string;
  subcategory_name?: string;
  filter_type_name?: string;
}

export interface ProductFilterValue {
  id: number;
  product: number;
  filter_option: number;
  filter_option_id?: number;
  filter_type?: string;
}

export interface Review {
  id: number;
  product: number;
  product_name?: string;
  name: string;
  rating: number;
  comment: string;
  is_visible: boolean;
  created_at?: string;
  created_by?: number | null;
  created_by_username?: string | null;
}
